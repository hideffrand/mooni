package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

// Config lives next to the agent (config.json). Only the API key is a secret;
// env vars override so the same binary can be re-pointed without a rebuild.
type Config struct {
	URL             string `json:"url"`
	APIKey          string `json:"api_key,omitempty"`
	Tenant          string `json:"tenant"`
	IntervalMinutes int    `json:"interval_minutes"`
	IPURL           string `json:"ip_url,omitempty"`
}

const defaultURL = "https://api.zyrex.com/api/v1/devices/report"

func defaultConfig() Config {
	return Config{
		URL:             defaultURL,
		Tenant:          "zyrex",
		IntervalMinutes: 360, // 6h
		IPURL:           "https://api.ipify.org?format=json",
	}
}

// dataDir is %ProgramData%\zyrex-mdm on Windows (the boot task runs as SYSTEM,
// so a per-user home is not usable). ZYREX_DATA_DIR overrides for testing.
func dataDir() string {
	if d := os.Getenv("ZYREX_DATA_DIR"); d != "" {
		return d
	}
	if pd := os.Getenv("ProgramData"); pd != "" {
		return filepath.Join(pd, "zyrex-mdm")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(os.TempDir(), "zyrex-mdm")
	}
	return filepath.Join(home, ".zyrex-mdm")
}

func configPath() string { return filepath.Join(dataDir(), "config.json") }

// loadConfig: defaults, then config.json, then env overrides.
func loadConfig() Config {
	cfg := defaultConfig()
	if b, err := os.ReadFile(configPath()); err == nil {
		_ = json.Unmarshal(b, &cfg)
	}
	if v := os.Getenv("ZYREX_URL"); v != "" {
		cfg.URL = v
	}
	if v := os.Getenv("ZYREX_API_KEY"); v != "" {
		cfg.APIKey = v
	}
	if v := os.Getenv("ZYREX_TENANT"); v != "" {
		cfg.Tenant = v
	}
	if v := os.Getenv("ZYREX_IP_URL"); v != "" {
		cfg.IPURL = v
	}
	if v := os.Getenv("ZYREX_INTERVAL_MINUTES"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.IntervalMinutes = n
		}
	}
	return cfg
}

// saveConfig writes the file 0600 - it holds the API key.
func saveConfig(cfg Config) error {
	if err := os.MkdirAll(dataDir(), 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath(), append(b, '\n'), 0o600)
}

func (c Config) interval() time.Duration {
	if c.IntervalMinutes <= 0 {
		return 6 * time.Hour
	}
	return time.Duration(c.IntervalMinutes) * time.Minute
}
