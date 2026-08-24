package media

import (
	"context"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
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
}

func NewService(root string, c cache.Cache, g *thumbs.Generator) *Service {
	return &Service{Root: root, cache: c, thumbGen: g}
}

// resolve is the sandbox boundary: every user path goes through fsutil.
func (s *Service) resolve(userPath string) (string, error) {
	return fsutil.Resolve(s.Root, userPath)
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
