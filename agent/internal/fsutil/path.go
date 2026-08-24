package fsutil

import (
	"errors"
	"path/filepath"
	"strings"
)

var ErrOutsideRoot = errors.New("path escapes the allowed root directory")

// Resolve safely joins a user-supplied relative path against root,
// guaranteeing the result can't escape via "..", absolute paths, or symlinks
// pointing outside root.
func Resolve(root, userPath string) (string, error) {
	// Treat the incoming path as relative no matter what the client sends.
	cleanUser := filepath.Clean("/" + userPath) // forces a leading slash, collapses ".."
	full := filepath.Join(root, cleanUser)

	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	absFull, err := filepath.Abs(full)
	if err != nil {
		return "", err
	}

	if !within(absRoot, absFull) {
		return "", ErrOutsideRoot
	}

	// Follow symlinks on the existing portion of the path and re-check
	// containment, so a symlink inside root pointing elsewhere can't escape.
	real, err := evalExistingSymlinks(absFull)
	if err != nil {
		return "", err
	}
	if !within(absRoot, real) {
		return "", ErrOutsideRoot
	}
	return real, nil
}

func within(root, p string) bool {
	if p == root {
		return true
	}
	return strings.HasPrefix(p, root+string(filepath.Separator))
}

// evalExistingSymlinks resolves symlinks on the deepest existing ancestor of
// p and re-appends any not-yet-existing tail, so it works for paths that are
// about to be created (mkdir/upload) as well as existing ones.
func evalExistingSymlinks(p string) (string, error) {
	var tail []string
	cur := p
	for {
		resolved, err := filepath.EvalSymlinks(cur)
		if err == nil {
			for i := len(tail) - 1; i >= 0; i-- {
				resolved = filepath.Join(resolved, tail[i])
			}
			return resolved, nil
		}
		parent := filepath.Dir(cur)
		if parent == cur {
			return "", err
		}
		tail = append(tail, filepath.Base(cur))
		cur = parent
	}
}

// ToRelative converts an absolute path back into a root-relative path
// using forward slashes, suitable for sending to the client.
func ToRelative(root, abs string) string {
	rel, err := filepath.Rel(root, abs)
	if err != nil {
		return ""
	}
	if rel == "." {
		return ""
	}
	return filepath.ToSlash(rel)
}
