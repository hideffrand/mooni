package config

import (
	"fmt"
	"os"
	"path/filepath"
)

// Config holds runtime configuration loaded from environment variables.
type Config struct {
	// RootDir is the ONLY directory tree the API may touch.
	RootDir string
	// APIKey must be sent by clients in the "X-API-Key" header.
	APIKey string
	// Port the HTTP server listens on.
	Port string
	// MaxUploadBytes limits the size of a single upload (default 2GB).
	MaxUploadBytes int64
	// RedisAddr, when non-empty, enables response caching via Redis.
	RedisAddr string
	// RedisPassword is optional and only used when RedisAddr is set.
	RedisPassword string
	// MediaDir optionally enables the media library; empty means disabled.
	MediaDir string
}

func Load() (*Config, error) {
	root, err := resolveDir("MOONI_ROOT_DIR")
	if err != nil {
		return nil, err
	}

	apiKey := os.Getenv("MOONI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("MOONI_API_KEY is required (used to authenticate the mobile app)")
	}

	port := os.Getenv("MOONI_PORT")
	if port == "" {
		port = "8080"
	}

	var mediaDir string
	if m := os.Getenv("MOONI_MEDIA_DIR"); m != "" {
		mediaDir, err = resolveDir("MOONI_MEDIA_DIR")
		if err != nil {
			return nil, err
		}
	}

	return &Config{
		RootDir:        root,
		APIKey:         apiKey,
		Port:           port,
		MaxUploadBytes: 2 << 30, // 2 GiB
		RedisAddr:      os.Getenv("MOONI_REDIS_ADDR"),
		RedisPassword:  os.Getenv("MOONI_REDIS_PASSWORD"),
		MediaDir:       mediaDir,
	}, nil
}

// resolveDir validates that the env var `name` points at an existing
// directory, returns its absolute path with symlinks resolved so all sandbox
// comparisons operate on one canonical path.
func resolveDir(name string) (string, error) {
	raw := os.Getenv(name)
	if raw == "" {
		return "", fmt.Errorf("%s is required", name)
	}
	abs, err := filepath.Abs(raw)
	if err != nil {
		return "", fmt.Errorf("invalid %s: %w", name, err)
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", fmt.Errorf("%s does not exist: %w", name, err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("%s is not a directory: %s", name, abs)
	}
	resolved, err := filepath.EvalSymlinks(abs)
	if err != nil {
		return "", fmt.Errorf("resolving %s: %w", name, err)
	}
	return resolved, nil
}
