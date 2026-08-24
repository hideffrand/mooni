package alerts

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCheckMetric(t *testing.T) {
	now := time.Now()
	base := metricState{armed: true}

	// Crossing the threshold fires once and disarms.
	fired, next := CheckMetric(base, true, 95, 90, 30*time.Minute, now)
	if !fired || next.armed {
		t.Fatalf("expected fire+disarm at crossing, got fired=%v armed=%v", fired, next.armed)
	}

	// Staying high doesn't re-fire...
	fired, _ = CheckMetric(next, true, 96, 90, 30*time.Minute, now.Add(time.Minute))
	if fired {
		t.Fatal("re-fired while still above threshold")
	}

	// ...and not even after cooldown, because it never dropped below the band.
	fired, _ = CheckMetric(next, true, 96, 90, 0, now.Add(2*time.Hour))
	if fired {
		t.Fatal("re-fired without dropping below hysteresis band")
	}

	// Dropping back into the band re-arms; a new crossing then fires again.
	_, rearmed := CheckMetric(next, true, 80, 90, 0, now)
	if !rearmed.armed {
		t.Fatal("did not re-arm below hysteresis band")
	}
	fired, _ = CheckMetric(rearmed, true, 92, 90, 0, now)
	if !fired {
		t.Fatal("did not fire on fresh crossing after re-arm")
	}

	// Cooldown blocks a fresh crossing that comes too soon.
	fired, _ = CheckMetric(rearmed, true, 92, 90, time.Hour, now.Add(time.Minute))
	if fired {
		t.Fatal("fired during cooldown")
	}

	// Disabled metrics always stay armed and never fire.
	fired, st := CheckMetric(base, false, 100, 90, 0, now)
	if fired || !st.armed {
		t.Fatal("disabled metric fired or disarmed")
	}
}

func TestStoreRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "alerts.json")

	s := NewStore(path)
	cfg := s.Config()
	if cfg.Enabled || cfg.CooldownMinutes != 30 {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}

	if err := s.Update(&Config{Enabled: true, CPUPercent: 85, CooldownMinutes: 10}, []string{"ExponentPushToken[abc]"}, nil); err != nil {
		t.Fatal(err)
	}
	if len(s.Tokens()) != 1 {
		t.Fatalf("token not added: %v", s.Tokens())
	}

	// Duplicate token must not duplicate.
	_ = s.Update(nil, []string{"ExponentPushToken[abc]"}, nil)
	if len(s.Tokens()) != 1 {
		t.Fatalf("token duplicated: %v", s.Tokens())
	}

	// Reload from disk: state survives restart.
	s2 := NewStore(path)
	if !s2.Config().Enabled || s2.Config().CPUPercent != 85 || len(s2.Tokens()) != 1 {
		t.Fatalf("state lost across reload: %+v %v", s2.Config(), s2.Tokens())
	}

	// File permissions stay private (it holds push tokens).
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Fatalf("alerts.json mode is %o, want 600", perm)
	}

	// Removing tokens works.
	_ = s.Update(nil, nil, []string{"ExponentPushToken[abc]"})
	if len(s.Tokens()) != 0 {
		t.Fatalf("token not removed: %v", s.Tokens())
	}
}

func TestSanitize(t *testing.T) {
	c := Config{CPUPercent: -5, MemPercent: 133.7, TempCelsius: 500, CooldownMinutes: 0}
	if err := sanitize(&c); err == nil {
		t.Fatal("expected error for out-of-range temp")
	}
	c.TempCelsius = 85
	if err := sanitize(&c); err != nil {
		t.Fatal(err)
	}
	if c.CPUPercent != 0 || c.MemPercent != 100 || c.CooldownMinutes != 30 {
		t.Fatalf("sanitize failed: %+v", c)
	}

	b, _ := json.Marshal(DefaultConfig())
	if !json.Valid(b) {
		t.Fatal("default config not marshalable")
	}
}
