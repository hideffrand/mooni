package alerts

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// Config holds the user-configurable alert thresholds. A threshold of 0
// disables that metric. Values are percentages for cpu/mem/disk and
// degrees Celsius for temp.
type Config struct {
	Enabled         bool    `json:"enabled"`
	CPUPercent      float64 `json:"cpuPercent"`
	MemPercent      float64 `json:"memPercent"`
	DiskPercent     float64 `json:"diskPercent"`
	TempCelsius     float64 `json:"tempCelsius"`
	CooldownMinutes int     `json:"cooldownMinutes"`
}

// DefaultConfig is used when no alerts.json exists yet: everything off.
func DefaultConfig() Config {
	return Config{
		Enabled:         false,
		CPUPercent:      90,
		MemPercent:      90,
		DiskPercent:     90,
		TempCelsius:     85,
		CooldownMinutes: 30,
	}
}

// State is what gets persisted to disk: thresholds plus the Expo push
// tokens of every paired phone that should receive notifications.
// Tokens are credentials-ish (they can send a push to one phone), so the
// file is written with 0600 like the rest of ~/.mooni/.
type State struct {
	Config Config   `json:"config"`
	Tokens []string `json:"tokens,omitempty"`
}

// Store persists State as a single JSON file and guards concurrent access
// between the HTTP handlers (writes) and the monitor goroutine (reads).
type Store struct {
	mu   sync.RWMutex
	path string
	st   State
}

// DefaultPath returns ~/.mooni/alerts.json, matching where install.sh
// keeps config.env. Falls back to the temp dir if HOME is unavailable.
func DefaultPath() string {
	if home, err := os.UserHomeDir(); err == nil {
		return filepath.Join(home, ".mooni", "alerts.json")
	}
	return filepath.Join(os.TempDir(), "mooni-alerts.json")
}

// NewStore loads the state file if present; a missing or unreadable file
// means defaults (alerts disabled). The server must still start fine when
// the file is corrupt - it just resets to defaults.
func NewStore(path string) *Store {
	s := &Store{path: path, st: State{Config: DefaultConfig()}}
	b, err := os.ReadFile(path)
	if err == nil {
		var st State
		if json.Unmarshal(b, &st) == nil && st.Config != (Config{}) {
			s.st = st
			if s.st.Config.CooldownMinutes == 0 {
				s.st.Config.CooldownMinutes = DefaultConfig().CooldownMinutes
			}
		}
	}
	return s
}

// Config returns a snapshot of the current configuration.
func (s *Store) Config() Config {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.st.Config
}

// Tokens returns a copy of the registered push tokens.
func (s *Store) Tokens() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]string, len(s.st.Tokens))
	copy(out, s.st.Tokens)
	return out
}

// Update applies new thresholds and/or tokens atomically and persists to
// disk (tmp file + rename so a crash never leaves a half-written file).
func (s *Store) Update(cfg *Config, addTokens, removeTokens []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if cfg != nil {
		s.st.Config = *cfg
	}
	for _, t := range addTokens {
		if !contains(s.st.Tokens, t) {
			s.st.Tokens = append(s.st.Tokens, t)
		}
	}
	if len(removeTokens) > 0 {
		kept := s.st.Tokens[:0]
		for _, t := range s.st.Tokens {
			if !contains(removeTokens, t) {
				kept = append(kept, t)
			}
		}
		s.st.Tokens = kept
	}

	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return fmt.Errorf("create state dir: %w", err)
	}
	b, err := json.MarshalIndent(s.st, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func contains(list []string, v string) bool {
	for _, s := range list {
		if s == v {
			return true
		}
	}
	return false
}
