//go:build windows

package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"time"
)

func main() {
	var (
		doInstall   = flag.Bool("install", false, "install the agent (copy, config, boot task) and exit")
		doUninstall = flag.Bool("uninstall", false, "remove the boot task and agent files, then exit")
		once        = flag.Bool("once", false, "collect and send one report now, print it, exit")
		url         = flag.String("url", "", "report endpoint (persisted on -install)")
		key         = flag.String("key", "", "API key header value (persisted on -install)")
		tenant      = flag.String("tenant", "", "tenant id (persisted on -install)")
		minutes     = flag.Int("interval", 0, "report interval in minutes (persisted on -install)")
		showVersion = flag.Bool("version", false, "print version and exit")
	)
	flag.Parse()

	if *showVersion {
		fmt.Printf("z_mdm_agent %s\n", version)
		return
	}

	cfg := loadConfig()
	if *url != "" {
		cfg.URL = *url
	}
	if *key != "" {
		cfg.APIKey = *key
	}
	if *tenant != "" {
		cfg.Tenant = *tenant
	}
	if *minutes > 0 {
		cfg.IntervalMinutes = *minutes
	}

	switch {
	case *doUninstall:
		if err := uninstall(); err != nil {
			log.Fatalf("uninstall: %v", err)
		}
		fmt.Println("z_mdm_agent removed")
	case *doInstall:
		if err := install(cfg); err != nil {
			log.Fatalf("install: %v", err)
		}
		fmt.Printf("z_mdm_agent %s installed; reporting to %s\n", version, cfg.URL)
	case *once:
		initLogging()
		body, err := cycle(cfg, true)
		if err != nil {
			fmt.Fprintf(os.Stderr, "report failed: %v\n", err)
			fmt.Println(string(body))
			os.Exit(1)
		}
	default:
		initLogging()
		runForever(cfg)
	}
}

// runForever is the daemon loop started by the boot task.
func runForever(cfg Config) {
	log.Printf("z_mdm_agent %s starting; endpoint=%s interval=%s", version, cfg.URL, cfg.interval())
	failures := 0
	for {
		ok := func() bool {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("cycle panic: %v", r)
				}
			}()
			if _, err := cycle(cfg, false); err != nil {
				log.Printf("report failed: %v", err)
				return false
			}
			log.Printf("report sent")
			return true
		}()

		if !ok {
			// Boot before network/DHCP: retry quickly, then fall back to interval.
			failures++
			wait := time.Duration(2*failures) * time.Minute
			if wait > 15*time.Minute {
				wait = 15 * time.Minute
			}
			time.Sleep(wait)
			continue
		}
		failures = 0

		// Jitter keeps a factory image from hammering the endpoint in lockstep.
		jitter := time.Duration(rand.Int63n(int64(10 * time.Minute)))
		time.Sleep(cfg.interval() + jitter)
		cfg = loadConfig() // pick up config.json edits without a restart
	}
}

// cycle collects, sends, and on failure spools for the next attempt.
func cycle(cfg Config, echo bool) ([]byte, error) {
	r, err := collect(cfg)
	if err != nil {
		return nil, err
	}
	if echo {
		pretty, _ := json.MarshalIndent(r, "", "  ")
		fmt.Println(string(pretty))
	}
	return report(cfg, r)
}
