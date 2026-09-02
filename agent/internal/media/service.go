// Package media implements the Photos-style library: listing, cached
// thumbnails/previews, upload and delete.
package media

import (
	"context"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"mooni-backend/internal/cache"
	"mooni-backend/internal/dto"
	"mooni-backend/internal/fsutil"
	"mooni-backend/internal/thumbs"
)

const (
	KindImage = "image"
	KindVideo = "video"
)

// listCacheTTL bounds staleness for out-of-band changes; uploads/deletes invalidate immediately.
const listCacheTTL = 30 * time.Second

// browseCacheTTL bounds staleness for per-folder browse listings (same
// invalidation version as the flat list, so mutations bust both).
const browseCacheTTL = 30 * time.Second

const (
	listKey = "mooni:media:list"
	listVer = "mooni:media:list:ver"
)

type cachedList struct {
	Version int64
	Items   []dto.MediaItem
}

type Service struct {
	Root     string
	cache    cache.Cache
	thumbGen *thumbs.Generator

	warmMu   sync.Mutex
	lastWarm time.Time
}

func NewService(root string, c cache.Cache, g *thumbs.Generator) *Service {
	return &Service{Root: root, cache: c, thumbGen: g}
}

// resolve is the sandbox boundary: every user path goes through fsutil.
func (s *Service) resolve(userPath string) (string, error) {
	return fsutil.Resolve(s.Root, userPath)
}

// warmCooldown spacing lets freshly-listed items settle (their thumbs were
// likely just requested anyway) without re-walking on every list call.
const warmCooldown = 2 * time.Minute

// WarmAll schedules background generation of grid thumbs (and viewer large
// previews) for every item, so first requests are served from disk instead of
// paying decode/ffmpeg latency. In-process dedup: at most one pass per
// cooldown; callers may invoke it on every list request. The warm pass
// itself no-ops for already-cached files, so re-checking is cheap (one stat
// per item) and also picks up files whose thumbnails were deleted manually.
func (s *Service) WarmAll(ctx context.Context, items []dto.MediaItem) {
	if s.thumbGen == nil || len(items) == 0 {
		return
	}
	s.warmMu.Lock()
	defer s.warmMu.Unlock()
	if time.Since(s.lastWarm) < warmCooldown {
		return
	}
	s.lastWarm = time.Now()
	go s.warm(items)
}

// WarmPaths warms specific items right away, bypassing the cooldown. Used
// for fresh uploads: the phone refetches the list immediately after an
// upload and would otherwise race the thumb generation.
func (s *Service) WarmPaths(items []dto.MediaItem) {
	if s.thumbGen == nil || len(items) == 0 {
		return
	}
	go s.warm(items)
}

func (s *Service) warm(items []dto.MediaItem) {
	for _, it := range items {
		abs, err := s.resolve(it.Path)
		if err != nil {
			continue
		}
		info, err := os.Stat(abs)
		if err != nil {
			continue
		}
		// Grid cell thumbnail first (small, feeds the first screenful fast).
		s.thumbGen.WarmWait(abs, info, thumbMaxDim)
		// Large preview tier is only served for images - videos always stream
		// the original and webp falls through to it, so skip both.
		if it.Kind == KindImage && !thumbs.IsWebpExt(filepath.Ext(it.Name)) {
			s.thumbGen.WarmWait(abs, info, previewMaxDim)
		}
	}
}

// List walks the media library and returns every image/video, newest first.
func (s *Service) List(ctx context.Context) ([]dto.MediaItem, error) {
	if items, ok := s.cachedList(ctx); ok {
		return items, nil
	}

	var items []dto.MediaItem
	err := filepath.WalkDir(s.Root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable entries (broken symlinks, etc.)
		}
		if d.IsDir() {
			if d.Name() != "." && strings.HasPrefix(d.Name(), ".") {
				return filepath.SkipDir // hidden dirs are not part of the library
			}
			return nil
		}
		ext := filepath.Ext(d.Name())
		var kind string
		if thumbs.IsImageExt(ext) {
			kind = KindImage
		} else if thumbs.IsVideoExt(ext) {
			kind = KindVideo
		} else {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		items = append(items, dto.MediaItem{
			Path:    fsutil.ToRelative(s.Root, path),
			Name:    d.Name(),
			Size:    info.Size(),
			ModTime: info.ModTime(),
			Kind:    kind,
		})
		return nil
	})
	if err != nil {
		return nil, err
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ModTime.After(items[j].ModTime)
	})
	s.storeList(ctx, items)
	return items, nil
}

// Stat resolves userPath to metadata plus its absolute path.
func (s *Service) Stat(userPath string) (dto.MediaItem, string, error) {
	abs, err := s.resolve(userPath)
	if err != nil {
		return dto.MediaItem{}, "", err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return dto.MediaItem{}, "", err
	}
	if info.IsDir() {
		return dto.MediaItem{}, "", &os.PathError{Op: "stat", Path: abs, Err: os.ErrInvalid}
	}
	ext := filepath.Ext(abs)
	kind := ""
	if thumbs.IsImageExt(ext) {
		kind = KindImage
	} else if thumbs.IsVideoExt(ext) {
		kind = KindVideo
	}
	return dto.MediaItem{
		Path:    fsutil.ToRelative(s.Root, abs),
		Name:    info.Name(),
		Size:    info.Size(),
		ModTime: info.ModTime(),
		Kind:    kind,
	}, abs, nil
}

// ThumbFile returns userPath's cached thumbnail path plus source modtime.
func (s *Service) ThumbFile(userPath string, maxDim int) (string, time.Time, error) {
	abs, err := s.resolve(userPath)
	if err != nil {
		return "", time.Time{}, err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", time.Time{}, err
	}
	return s.thumbGen.Get(abs, info, maxDim)
}

// Delete removes one or more library entries. Refuses to delete the root.
func (s *Service) Delete(ctx context.Context, paths []string) error {
	for _, p := range paths {
		abs, err := s.resolve(p)
		if err != nil {
			return err
		}
		if abs == s.Root {
			return &os.PathError{Op: "delete", Path: s.Root, Err: os.ErrPermission}
		}
		if err := os.RemoveAll(abs); err != nil {
			return err
		}
	}
	s.cache.Incr(ctx, listVer)
	return nil
}

// Invalidate drops the cached index (uploads bypass this service).
func (s *Service) Invalidate(ctx context.Context) {
	s.cache.Incr(ctx, listVer)
}

func (s *Service) cachedList(ctx context.Context) ([]dto.MediaItem, bool) {
	data, ok := s.cache.Get(ctx, listKey)
	if !ok {
		return nil, false
	}
	var cl cachedList
	if json.Unmarshal(data, &cl) != nil || cl.Version != s.cache.GetInt64(ctx, listVer) {
		return nil, false
	}
	return cl.Items, true
}

func (s *Service) storeList(ctx context.Context, items []dto.MediaItem) {
	b, err := json.Marshal(cachedList{Version: s.cache.GetInt64(ctx, listVer), Items: items})
	if err != nil {
		return
	}
	s.cache.Set(ctx, listKey, b, listCacheTTL)
}

type cachedBrowse struct {
	Version int64
	Folders []dto.MediaFolder
	Items   []dto.MediaItem
}

func browseKey(userPath string) string {
	return "mooni:media:browse:" + userPath
}

func (s *Service) cachedBrowse(ctx context.Context, userPath string) ([]dto.MediaFolder, []dto.MediaItem, bool) {
	data, ok := s.cache.Get(ctx, browseKey(userPath))
	if !ok {
		return nil, nil, false
	}
	var cb cachedBrowse
	if json.Unmarshal(data, &cb) != nil || cb.Version != s.cache.GetInt64(ctx, listVer) {
		return nil, nil, false
	}
	return cb.Folders, cb.Items, true
}

func (s *Service) storeBrowse(ctx context.Context, userPath string, folders []dto.MediaFolder, items []dto.MediaItem) {
	b, err := json.Marshal(cachedBrowse{Version: s.cache.GetInt64(ctx, listVer), Folders: folders, Items: items})
	if err != nil {
		return
	}
	s.cache.Set(ctx, browseKey(userPath), b, browseCacheTTL)
}

// Browse lists one directory of the library: its subfolders as albums
// (each with a recursive media count and newest-item cover) plus the media
// files directly inside it. Unlike List, it is not recursive for items.
func (s *Service) Browse(ctx context.Context, userPath string) ([]dto.MediaFolder, []dto.MediaItem, error) {
	if folders, items, ok := s.cachedBrowse(ctx, userPath); ok {
		return folders, items, nil
	}
	dir, err := s.resolve(userPath)
	if err != nil {
		return nil, nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, nil, err
	}

	var folders []dto.MediaFolder
	var items []dto.MediaItem
	for _, it := range entries {
		name := it.Name()
		if strings.HasPrefix(name, ".") {
			continue // hidden entries are not part of the library
		}
		abs := filepath.Join(dir, name)
		if it.IsDir() {
			folder := dto.MediaFolder{Name: name, Path: fsutil.ToRelative(s.Root, abs)}
			folder.Count, folder.Cover = s.scanFolder(abs)
			folders = append(folders, folder)
			continue
		}
		ext := filepath.Ext(name)
		var kind string
		if thumbs.IsImageExt(ext) {
			kind = KindImage
		} else if thumbs.IsVideoExt(ext) {
			kind = KindVideo
		} else {
			continue
		}
		info, err := it.Info()
		if err != nil {
			continue // skip unreadable entries (broken symlinks etc.)
		}
		items = append(items, dto.MediaItem{
			Path:    fsutil.ToRelative(s.Root, abs),
			Name:    name,
			Size:    info.Size(),
			ModTime: info.ModTime(),
			Kind:    kind,
		})
	}

	sort.Slice(folders, func(i, j int) bool { return folders[i].Name < folders[j].Name })
	sort.Slice(items, func(i, j int) bool { return items[i].ModTime.After(items[j].ModTime) })
	s.storeBrowse(ctx, userPath, folders, items)
	return folders, items, nil
}

// scanFolder counts media files under dir recursively and returns the newest
// one as the album cover.
func (s *Service) scanFolder(dir string) (int, *dto.MediaItem) {
	count := 0
	var best *dto.MediaItem
	filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable entries
		}
		if d.IsDir() {
			if path != dir && strings.HasPrefix(d.Name(), ".") {
				return filepath.SkipDir
			}
			return nil
		}
		ext := filepath.Ext(d.Name())
		var kind string
		if thumbs.IsImageExt(ext) {
			kind = KindImage
		} else if thumbs.IsVideoExt(ext) {
			kind = KindVideo
		} else {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		count++
		mi := &dto.MediaItem{
			Path:    fsutil.ToRelative(s.Root, path),
			Name:    d.Name(),
			Size:    info.Size(),
			ModTime: info.ModTime(),
			Kind:    kind,
		}
		if best == nil || mi.ModTime.After(best.ModTime) {
			best = mi
		}
		return nil
	})
	return count, best
}
