package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

const psFixture = `{"machine_guid":"1f2e3d4c","hostname":"ZYREX-01","manufacturer":"ZYREX",
"model":"NB-15","serial":"SN123","cpu":"Intel(R) Core(TM) i5","cores":8,"ram_mb":16384,
"disk_total_gb":512.0,"disk_free_gb":400.5,"os":"Microsoft Windows 11 Pro","build":"22631",
"arch":"AMD64","uptime_s":3600,"activation_status":1,"activation_name":"Windows(R), Professional edition","grace_days":0}`

func TestParseInventory(t *testing.T) {
	p, dev, act, err := parseInventory([]byte(psFixture))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if p.MachineGUID != "1f2e3d4c" || dev.Model != "NB-15" || dev.RAMMB != 16384 {
		t.Fatalf("bad inventory: %+v / %+v", p, dev)
	}
	if act.Status != "licensed" || act.Code != 1 || act.GraceDays != 0 {
		t.Fatalf("bad activation: %+v", act)
	}
	if _, _, _, err := parseInventory([]byte(`{"hostname":"x"}`)); err == nil {
		t.Fatal("expected error without machine_guid")
	}
}

func TestActivationName(t *testing.T) {
	cases := map[int]string{0: "unlicensed", 1: "licensed", 4: "non_genuine_grace", 6: "extended_grace", 99: "unknown"}
	for code, want := range cases {
		if got := activationName(code); got != want {
			t.Fatalf("activationName(%d) = %q, want %q", code, got, want)
		}
	}
}

func TestPostHeadersAndBody(t *testing.T) {
	var gotKey, gotType, gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.Header.Get("X-API-Key")
		gotType = r.Header.Get("Content-Type")
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
	}))
	defer srv.Close()

	cfg := Config{URL: srv.URL, APIKey: "secret", Tenant: "zyrex"}
	if err := post(cfg, []byte(`{"device_id":"abc"}`)); err != nil {
		t.Fatalf("post: %v", err)
	}
	if gotKey != "secret" || gotType != "application/json" || gotBody != `{"device_id":"abc"}` {
		t.Fatalf("unexpected request: key=%q type=%q body=%q", gotKey, gotType, gotBody)
	}
}

func TestPostErrorOnNon2xx(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusBadRequest)
	}))
	defer srv.Close()
	if err := post(Config{URL: srv.URL}, []byte(`{}`)); err == nil {
		t.Fatal("expected error on 400")
	}
}

func TestSpoolFlush(t *testing.T) {
	t.Setenv("ZYREX_DATA_DIR", t.TempDir())
	var hits int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hits++ }))
	defer srv.Close()

	spool([]byte(`{"a":1}`))
	spool([]byte(`{"a":2}`))
	flushSpool(Config{URL: srv.URL})

	entries, _ := os.ReadDir(spoolDir())
	if hits != 2 || len(entries) != 0 {
		t.Fatalf("hits=%d spool_left=%d", hits, len(entries))
	}
}
