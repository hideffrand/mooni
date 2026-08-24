package files

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"syscall"
	"time"

	"mooni-backend/internal/cache"
	"mooni-backend/internal/dto"
	"mooni-backend/internal/fsutil"
)

type Service struct {
	Root  string
	cache cache.Cache
}

// listCacheTTL bounds staleness for out-of-band changes; mutations invalidate immediately.
const listCacheTTL = 60 * time.Second

// Version-stamped listings: one INCR on mutation invalidates every cached list.
const (
	listVerKey = "mooni:files:list:ver"
)

func listKey(userPath string) string {
	return "mooni:files:list:" + userPath
}

type cachedList struct {
	Version int64
	Entries []dto.FileEntry
}

func NewService(root string, c cache.Cache) *Service {
	return &Service{Root: root, cache: c}
}

// Invalidate drops all cached listings (uploads bypass this service).
func (s *Service) Invalidate(ctx context.Context) {
	s.cache.Incr(ctx, listVerKey)
}

func (s *Service) cachedList(ctx context.Context, userPath string) ([]dto.FileEntry, bool) {
	data, ok := s.cache.Get(ctx, listKey(userPath))
	if !ok {
		return nil, false
	}
	var cl cachedList
	if json.Unmarshal(data, &cl) != nil || cl.Version != s.cache.GetInt64(ctx, listVerKey) {
		return nil, false
	}
	return cl.Entries, true
}

func (s *Service) storeList(ctx context.Context, userPath string, entries []dto.FileEntry) {
	b, err := json.Marshal(cachedList{Version: s.cache.GetInt64(ctx, listVerKey), Entries: entries})
	if err != nil {
		return
	}
	s.cache.Set(ctx, listKey(userPath), b, listCacheTTL)
}

// resolve is a thin wrapper so handlers don't import fsutil directly.
func (s *Service) resolve(userPath string) (string, error) {
	return fsutil.Resolve(s.Root, userPath)
}

func (s *Service) List(ctx context.Context, userPath string) ([]dto.FileEntry, error) {
	if entries, ok := s.cachedList(ctx, userPath); ok {
		return entries, nil
	}
	dir, err := s.resolve(userPath)
	if err != nil {
		return nil, err
	}
	items, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := make([]dto.FileEntry, 0, len(items))
	for _, it := range items {
		info, err := it.Info()
		if err != nil {
			continue // skip unreadable entries (broken symlinks etc.)
		}
		abs := filepath.Join(dir, it.Name())
		out = append(out, dto.FileEntry{
			Name:    it.Name(),
			Path:    fsutil.ToRelative(s.Root, abs),
			IsDir:   it.IsDir(),
			Size:    info.Size(),
			ModTime: info.ModTime(),
			Mode:    info.Mode().String(),
		})
	}
	s.storeList(ctx, userPath, out)
	return out, nil
}

func (s *Service) Stat(userPath string) (dto.FileEntry, string, error) {
	abs, err := s.resolve(userPath)
	if err != nil {
		return dto.FileEntry{}, "", err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return dto.FileEntry{}, "", err
	}
	return dto.FileEntry{
		Name:    info.Name(),
		Path:    fsutil.ToRelative(s.Root, abs),
		IsDir:   info.IsDir(),
		Size:    info.Size(),
		ModTime: info.ModTime(),
		Mode:    info.Mode().String(),
	}, abs, nil
}

func (s *Service) Mkdir(ctx context.Context, userPath string) error {
	abs, err := s.resolve(userPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		return err
	}
	s.Invalidate(ctx)
	return nil
}

func (s *Service) Rename(ctx context.Context, oldPath, newPath string) error {
	oldAbs, err := s.resolve(oldPath)
	if err != nil {
		return err
	}
	newAbs, err := s.resolve(newPath)
	if err != nil {
		return err
	}
	if _, err := os.Stat(newAbs); err == nil {
		return fmt.Errorf("destination already exists")
	}
	if err := os.Rename(oldAbs, newAbs); err != nil {
		return err
	}
	s.Invalidate(ctx)
	return nil
}

func (s *Service) Move(ctx context.Context, src, dst string) error {
	// Rename when possible (EXDEV -> copy+delete); refuse to clobber.
	srcAbs, err := s.resolve(src)
	if err != nil {
		return err
	}
	dstAbs, err := s.resolve(dst)
	if err != nil {
		return err
	}
	if _, err := os.Stat(dstAbs); err == nil {
		return fmt.Errorf("destination already exists")
	}
	if err := os.Rename(srcAbs, dstAbs); err == nil {
		s.Invalidate(ctx)
		return nil
	} else if !errors.Is(err, syscall.EXDEV) {
		return err
	}
	if err := s.Copy(ctx, src, dst); err != nil {
		return err
	}
	if err := os.RemoveAll(srcAbs); err != nil {
		return err
	}
	s.Invalidate(ctx)
	return nil
}

func (s *Service) Copy(ctx context.Context, src, dst string) error {
	srcAbs, err := s.resolve(src)
	if err != nil {
		return err
	}
	dstAbs, err := s.resolve(dst)
	if err != nil {
		return err
	}
	info, err := os.Stat(srcAbs)
	if err != nil {
		return err
	}
	if info.IsDir() {
		if err := copyDir(srcAbs, dstAbs); err != nil {
			return err
		}
	} else if err := copyFile(srcAbs, dstAbs, info.Mode()); err != nil {
		return err
	}
	s.Invalidate(ctx)
	return nil
}

func (s *Service) Delete(ctx context.Context, userPath string) error {
	abs, err := s.resolve(userPath)
	if err != nil {
		return err
	}
	if abs == s.Root {
		return fmt.Errorf("refusing to delete the root directory")
	}
	if err := os.RemoveAll(abs); err != nil {
		return err
	}
	s.Invalidate(ctx)
	return nil
}

func copyFile(src, dst string, mode os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func copyDir(src, dst string) error {
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}
	for _, e := range entries {
		srcPath := filepath.Join(src, e.Name())
		dstPath := filepath.Join(dst, e.Name())
		if e.IsDir() {
			if err := copyDir(srcPath, dstPath); err != nil {
				return err
			}
			continue
		}
		info, err := e.Info()
		if err != nil {
			return err
		}
		if err := copyFile(srcPath, dstPath, info.Mode()); err != nil {
			return err
		}
	}
	return nil
}
