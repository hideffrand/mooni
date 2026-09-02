package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"mooni-backend/internal/alerts"
	"mooni-backend/internal/auth"
	"mooni-backend/internal/cache"
	"mooni-backend/internal/config"
	"mooni-backend/internal/dto"
	"mooni-backend/internal/files"
	"mooni-backend/internal/media"
	"mooni-backend/internal/pairing"
	"mooni-backend/internal/system"
	"mooni-backend/internal/thumbs"
)

func main() {
	pairFlag := flag.Bool("pair", false, "print a pairing code for the mobile app and exit (no server started)")
	nameFlag := flag.String("name", "", "device name to embed in the pairing code (default: hostname)")
	hostFlag := flag.String("host", "", "override the host/IP embedded in the pairing code (default: auto-detect Tailscale IP)")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	if *pairFlag {
		runPair(cfg, *nameFlag, *hostFlag)
		return
	}

	// Optional Redis cache: unconfigured or unreachable -> run uncached.
	c := cache.New(cfg.RedisAddr, cfg.RedisPassword)
	if c.Enabled() {
		if err := c.Ping(context.Background()); err != nil {
			log.Printf("redis unreachable (%v) - falling back to in-process cache", err)
			c.Close()
			c = cache.New("", "")
		} else {
			log.Printf("redis cache enabled (%s)", cfg.RedisAddr)
		}
	} else {
		log.Println("no redis configured - using in-process cache")
	}

	thumbGen := thumbs.New(thumbDir())

	// File routes live on their own mux, wrapped with the API key check.
	fileMux := http.NewServeMux()
	svc := files.NewService(cfg.RootDir, c)
	fileHandler := files.NewHandler(svc, cfg.MaxUploadBytes, thumbGen)
	fileHandler.Register(fileMux)
	protectedFiles := auth.RequireAPIKey(cfg.APIKey, fileMux)

	// System endpoints read host info - same API key check.
	systemMux := http.NewServeMux()
	sysHandler := system.NewHandler(cfg.RootDir, c)
	sysHandler.Register(systemMux)

	// Threshold alerts monitor stats and push via Expo; no-op until enabled.
	alertStore := alerts.NewStore(alerts.DefaultPath())
	alerts.NewHandler(alertStore).Register(systemMux)
	go alerts.NewMonitor(cfg.RootDir, alertStore).Run(context.Background())

	protectedSystem := auth.RequireAPIKey(cfg.APIKey, systemMux)

	// Health check is public; everything under /api/files|media|system requires the key.
	outer := http.NewServeMux()
	outer.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})
	outer.Handle("/api/files/", protectedFiles)
	if cfg.MediaDir != "" {
		// Optional media library behind MOONI_MEDIA_DIR, same auth wrapper.
		mediaMux := http.NewServeMux()
		mediaHandler := media.NewHandler(
			media.NewService(cfg.MediaDir, c, thumbGen),
			cfg.MaxUploadBytes,
		)
		mediaHandler.Register(mediaMux)
		outer.Handle("/api/media/", auth.RequireAPIKey(cfg.APIKey, mediaMux))
		log.Printf("media library enabled (%s)", cfg.MediaDir)
	}
	outer.Handle("/api/system/", protectedSystem)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           logRequests(outer),
		ReadHeaderTimeout: 30 * time.Second,
		// No body ReadTimeout: a 2 GiB upload over a slow link takes minutes.
		WriteTimeout: 0, // large downloads/streaming can take a while
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("mooni backend")
	log.Printf("  root dir : %s", cfg.RootDir)
	log.Printf("  listening: :%s", cfg.Port)
	log.Fatal(srv.ListenAndServe())
}

// runPair prints a pairing code the mobile app can paste to add this device.
func runPair(cfg *config.Config, name, hostOverride string) {
	if name == "" {
		if h, err := os.Hostname(); err == nil {
			name = h
		} else {
			name = "Mooni"
		}
	}

	host := hostOverride
	if host == "" {
		ip, err := pairing.TailscaleIPv4()
		if err != nil {
			ip, err = pairing.LANIPv4()
		}
		if err != nil {
			fmt.Fprintf(os.Stderr, "Could not detect a reachable IP (%v).\n", err)
			fmt.Fprintf(os.Stderr, "Printing a code for 127.0.0.1 (won't work from a phone) - re-run with -host <ip-or-hostname>, e.g.:\n")
			fmt.Fprintf(os.Stderr, "  ./mooni-backend -pair -host 100.x.x.x\n")
			host = "127.0.0.1"
		} else {
			host = ip
		}
	}

	baseURL := fmt.Sprintf("http://%s:%s", host, cfg.Port)
	code := pairing.Encode(dto.PairingPayload{
		Name:    name,
		BaseURL: baseURL,
		APIKey:  cfg.APIKey,
	})

	qr, err := pairing.TerminalQR(code)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Warning: could not render QR code (%v). Falling back to text code only.\n", err)
	}

	fmt.Println()
	if qr != "" {
		fmt.Println("Scan this QR from the app (Add Device > Scan QR):")
		fmt.Println()
		fmt.Println(qr)
	}
	fmt.Println("Or paste manually (Add Device > Paste Code):")
	fmt.Println()
	fmt.Println(code)
	fmt.Println()
	fmt.Printf("(device: %q, server: %s)\n", name, baseURL)
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

// thumbDir returns the thumbnail disk-cache location, outside any indexed
// library root.
func thumbDir() string {
	if home, err := os.UserHomeDir(); err == nil {
		return filepath.Join(home, ".mooni", "thumbs")
	}
	return filepath.Join(os.TempDir(), "mooni-thumbs")
}
