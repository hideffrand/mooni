package system

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// runPower initiates reboot/shutdown via passwordless sudo, falling back to
// systemd-logind. Returns quickly; the shutdown itself completes shortly after.
func runPower(action string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var candidates [][]string
	switch action {
	case "reboot":
		candidates = [][]string{
			{"sudo", "-n", "systemctl", "reboot"},
			{"loginctl", "reboot"},
		}
	case "shutdown":
		candidates = [][]string{
			{"sudo", "-n", "systemctl", "poweroff"},
			{"loginctl", "poweroff"},
		}
	case "lock":
		// Lock the desktop session. The non-sudo variant only works when the
		// agent runs inside the user's session; under the systemd service the
		// sudo variant (root, all sessions) is the one that can succeed.
		candidates = [][]string{
			{"loginctl", "lock-session"},
			{"sudo", "-n", "loginctl", "lock-sessions"},
		}
	default:
		return fmt.Errorf("unknown power action %q", action)
	}

	var errs []string
	for _, cmd := range candidates {
		err := exec.CommandContext(ctx, cmd[0], cmd[1:]...).Run()
		if err == nil {
			return nil
		}
		errs = append(errs, fmt.Sprintf("%s: %v", strings.Join(cmd, " "), err))
	}

	return errors.New(strings.Join(errs, "; "))
}
