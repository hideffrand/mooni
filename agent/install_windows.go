//go:build windows

package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
)

const taskName = "ZyrexMDM"

func exePath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Abs(exe)
}

func run(name string, args ...string) error {
	out, err := exec.Command(name, args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s %v: %v: %s", name, args, err, out)
	}
	return nil
}

// install copies the binary and config into %ProgramData%\zyrex-mdm and
// registers a boot task running as SYSTEM. Re-running upgrades in place.
func install(cfg Config) error {
	self, err := exePath()
	if err != nil {
		return err
	}
	dir := dataDir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	target := filepath.Join(dir, filepath.Base(self))
	if self != target {
		if err := copyFile(self, target); err != nil {
			return err
		}
	}
	if err := saveConfig(cfg); err != nil {
		return err
	}
	// Restrict the data dir (API key lives there) to SYSTEM + Administrators.
	_ = run("icacls", dir, "/inheritance:r",
		"/grant:r", "SYSTEM:(OI)(CI)F", "Administrators:(OI)(CI)F")

	// Remove then create: upgrades must not leave a stale command line.
	_ = run("schtasks", "/Delete", "/TN", taskName, "/F")
	if err := run("schtasks", "/Create",
		"/TN", taskName,
		"/TR", `"`+target+`"`,
		"/SC", "ONSTART",
		"/RU", "SYSTEM",
		"/RL", "HIGHEST",
		"/F"); err != nil {
		return err
	}
	return run("schtasks", "/Run", "/TN", taskName)
}

// uninstall stops the task and removes the agent directory. The task is killed
// by deleting it, so no separate /End is needed.
func uninstall() error {
	_ = run("schtasks", "/Delete", "/TN", taskName, "/F")
	return os.RemoveAll(dataDir())
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o700)
	if err != nil {
		return err
	}
	defer out.Close()
	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}
