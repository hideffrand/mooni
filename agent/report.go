package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"time"
)

const (
	maxSpoolFiles = 200
	httpTimeout   = 30 * time.Second
)

var httpClient = &http.Client{Timeout: httpTimeout}

// post sends one report. Returns an error on non-2xx or transport failure.
func post(cfg Config, body []byte) error {
	ctx, cancel := context.WithTimeout(context.Background(), httpTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.URL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "z_mdm_agent/"+version)
	if cfg.APIKey != "" {
		req.Header.Set("X-API-Key", cfg.APIKey)
	}
	if cfg.Tenant != "" {
		req.Header.Set("X-Tenant", cfg.Tenant)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	msg, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return fmt.Errorf("server returned %s: %s", resp.Status, bytes.TrimSpace(msg))
	}
	return nil
}

func spoolDir() string { return filepath.Join(dataDir(), "spool") }

// spool keeps a failed report on disk (bounded) and drops the oldest overflow.
func spool(body []byte) {
	dir := spoolDir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		log.Printf("spool: %v", err)
		return
	}
	name := fmt.Sprintf("%d.json", time.Now().UnixNano())
	if err := os.WriteFile(filepath.Join(dir, name), body, 0o600); err != nil {
		log.Printf("spool write: %v", err)
		return
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) > maxSpoolFiles {
		names := make([]string, 0, len(entries))
		for _, e := range entries {
			names = append(names, e.Name())
		}
		sort.Strings(names)
		for _, n := range names[:len(names)-maxSpoolFiles] {
			_ = os.Remove(filepath.Join(dir, n))
		}
	}
}

// flushSpool retries spooled reports oldest-first, stopping at the first
// failure so ordering is preserved for the next cycle.
func flushSpool(cfg Config) {
	entries, err := os.ReadDir(spoolDir())
	if err != nil {
		return
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)
	for _, n := range names {
		p := filepath.Join(spoolDir(), n)
		body, err := os.ReadFile(p)
		if err != nil {
			_ = os.Remove(p)
			continue
		}
		if err := post(cfg, body); err != nil {
			log.Printf("spool replay %s: %v", n, err)
			return
		}
		_ = os.Remove(p)
		log.Printf("spool replay %s: sent", n)
	}
}

// report sends now or spools for the next cycle.
func report(cfg Config, r Report) ([]byte, error) {
	flushSpool(cfg)
	body, err := json.Marshal(r)
	if err != nil {
		return nil, err
	}
	if err := post(cfg, body); err != nil {
		spool(body)
		return body, err
	}
	return body, nil
}

// publicIP asks an external echo service for the egress IP; the collector
// server resolves the actual location from that (or from the request source).
func publicIP(cfg Config) string {
	if cfg.IPURL == "" {
		return ""
	}
	resp, err := httpClient.Get(cfg.IPURL)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ""
	}
	var v struct {
		IP string `json:"ip"`
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 256)).Decode(&v) == nil && net.ParseIP(v.IP) != nil {
		return v.IP
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64))
	return string(bytes.TrimSpace(body))
}

// lanIPs lists non-loopback IPv4 addresses (fallback localisation signal).
func lanIPs() []string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return nil
	}
	var out []string
	for _, a := range addrs {
		n, ok := a.(*net.IPNet)
		if !ok || n.IP.IsLoopback() {
			continue
		}
		if ip4 := n.IP.To4(); ip4 != nil {
			out = append(out, ip4.String())
		}
	}
	sort.Strings(out)
	return out
}
