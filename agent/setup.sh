#!/usr/bin/env bash
# Mooni backend - interactive setup.
# Runs after the curl installer (or from a checkout). Picks folders, generates
# a random API key, detects a reachable IP (Tailscale first, then the LAN IP),
# and prints a QR + pairing code the mobile app can scan to connect.
set -euo pipefail

CONFIG_DIR="$HOME/.mooni"
CONFIG_FILE="$CONFIG_DIR/config.env"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Locate the binary: next to this script (~/.mooni/bin when curl-installed,
# the repo dir when run from a checkout), else on PATH.
BIN_PATH=""
for cand in "$SCRIPT_DIR/mooni-backend" "$HOME/.local/bin/mooni-backend"; do
  if [[ -x "$cand" ]]; then
    BIN_PATH="$cand"
    break
  fi
done
if [[ -z "$BIN_PATH" ]] && command -v mooni-backend >/dev/null 2>&1; then
  BIN_PATH="$(command -v mooni-backend)"
fi
if [[ -z "$BIN_PATH" ]]; then
  err "Could not find the 'mooni-backend' binary. Install it first:"
  err "  curl -fsSL https://raw.githubusercontent.com/hideffrand/mooni/main/agent/install.sh | bash"
  exit 1
fi

# Colors strip automatically when stdout isn't a terminal (piped output,
# logs, CI) or when NO_COLOR is set.
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  BOLD=$'\e[1m'; DIM=$'\e[2m'
  CYAN=$'\e[36m'; YELLOW=$'\e[33m'; GREEN=$'\e[32m'; RED=$'\e[31m'
  RESET=$'\e[0m'
else
  BOLD=""; DIM=""; CYAN=""; YELLOW=""; GREEN=""; RED=""; RESET=""
fi

say() { printf '\n%s%s── %s ──%s\n' "$CYAN" "$BOLD" "$1" "$RESET"; }
ok() { printf '%s%s✓%s %s\n' "$GREEN" "$BOLD" "$RESET" "$1"; }
warn() { printf '%s%s!%s %s\n' "$YELLOW" "$BOLD" "$RESET" "$1"; }
err() { printf '%s%s✗ %s%s\n' "$RED" "$BOLD" "$1" "$RESET" >&2; }
dim() { printf '%s%s%s\n' "$DIM" "$1" "$RESET"; }

# Renders the banner two-tone: solid blocks get BT (bold color), all
# other glyphs get DT (dim). Char-by-char so UTF-8 is handled correctly.
_render_art() {
  local line out prev t i c
  while IFS= read -r line; do
    out=""; prev="s"
    for ((i=0; i<${#line}; i++)); do
      c="${line:i:1}"
      case "$c" in
        █) t="b" ;;
        " ") t="$prev" ;;
        *) t="d" ;;
      esac
      if [[ "$t" != "$prev" ]]; then
        [[ "$t" == "b" ]] && out+="$BT" || out+="$DT"
        prev="$t"
      fi
      out+="$c"
    done
    printf '%s%s\n' "$out" "$RESET"
  done <<< "$1"
}

banner() {
  printf '\n'
  local art
  art=$(cat <<'EOF'
███╗   ███╗ ██████╗  ██████╗  ██████╗ ███╗   ██╗██╗
████╗ ████║██╔═══██╗██╔═══██╗██╔═══██╗████╗  ██║██║
██╔████╔██║██║   ██║██║   ██║██║   ██║██╔██╗ ██║██║
██║╚██╔╝██║██║   ██║██║   ██║██║   ██║██║╚██╗██║██║
██║ ╚═╝ ██║╚██████╔╝╚██████╔╝╚██████╔╝██║ ╚████║██║
╚═╝     ╚═╝ ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚═╝
EOF
)
  if [[ -n "$CYAN" ]]; then
    BT="$BOLD$CYAN" DT="$DIM" _render_art "$art"
  else
    printf '%s\n' "$art"
  fi
  dim "  backend setup"
}

banner

confirm() {
  local prompt="$1" default="$2" ans def
  # The capital letter is the default (e.g. [Y/n] defaults to Y, [y/N] to N).
  if [[ "$default" =~ [A-Z] ]]; then
    def="${BASH_REMATCH[0]}"
  else
    def="${default:0:1}"
  fi
  read -rp "$prompt [$default] " ans
  ans="${ans:-$def}"
  [[ "$ans" =~ ^[Yy]$ ]]
}

# Windows Subsystem for Linux affects setup in two ways:
#   - systemd (PID 1) is not running unless enabled in /etc/wsl.conf
#   - default NAT networking means a phone on the LAN can't reach the WSL IP
IS_WSL=0
if grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then
  IS_WSL=1
  warn "Windows WSL detected."
fi

# systemd runs as PID 1 on a normal Linux box, and on WSL only when
# /etc/wsl.conf has [boot] systemd=true.
HAS_SYSTEMD=0
if [[ -d /run/systemd/system ]]; then
  HAS_SYSTEMD=1
fi

# 1. Prepare the config dir and load any previous config
say "1/7 Load config"
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  dim "Previous config found at $CONFIG_FILE"
else
  dim "No config yet; a new one will be created."
fi

# 2. Folder the app is allowed to manage
say "2/7 Folders"
echo "Note: the app gets full read/write/delete access to whatever folder you pick."

if [[ -n "${MOONI_ROOT_DIR:-}" && -d "${MOONI_ROOT_DIR:-}" ]]; then
  echo "Current root dir (from previous config): $MOONI_ROOT_DIR"
  if ! confirm "Use this folder again?" "Y/n"; then
    MOONI_ROOT_DIR=""
  fi
fi

if [[ -z "${MOONI_ROOT_DIR:-}" ]]; then
  SUGGESTIONS=()
  for d in Documents Downloads Pictures Music Videos Desktop; do
    if [[ -d "$HOME/$d" ]]; then
      SUGGESTIONS+=("$HOME/$d")
    fi
  done
  CUSTOM_OPTION=$(( ${#SUGGESTIONS[@]} + 1 ))

  echo
  echo "Pick the folder the app is allowed to manage:"
  for i in "${!SUGGESTIONS[@]}"; do
    echo "  $((i+1))) ${SUGGESTIONS[$i]}"
  done
  echo "  $CUSTOM_OPTION) Type a custom path"
  read -rp "Choice [$CUSTOM_OPTION]: " CHOICE
  if [[ "$CHOICE" =~ ^[0-9]+$ ]] && (( CHOICE >= 1 && CHOICE <= ${#SUGGESTIONS[@]} )); then
    MOONI_ROOT_DIR="${SUGGESTIONS[$((CHOICE-1))]}"
    ok "Using: $MOONI_ROOT_DIR"
  else
    read -rp "Custom path (the app may access this folder): " ROOT_INPUT
    MOONI_ROOT_DIR="${ROOT_INPUT:-$HOME/mooni-storage}"
  fi
fi
mkdir -p "$MOONI_ROOT_DIR"
ok "Root dir: $MOONI_ROOT_DIR"

# Optional: Photos-style media library in a separate folder (images/videos only)
if [[ -n "${MOONI_MEDIA_DIR:-}" && -d "${MOONI_MEDIA_DIR:-}" ]]; then
  echo "Current media dir (from previous config): $MOONI_MEDIA_DIR"
  if ! confirm "Keep the media library in this folder?" "Y/n"; then
    MOONI_MEDIA_DIR=""
  fi
fi

if [[ -z "${MOONI_MEDIA_DIR:-}" ]]; then
  if confirm "Enable a separate Photos-style media library (images & videos in one folder)?" "y/N"; then
    read -rp "Media folder path [$HOME/Pictures]: " MEDIA_INPUT
    MOONI_MEDIA_DIR="${MEDIA_INPUT:-$HOME/Pictures}"
    mkdir -p "$MOONI_MEDIA_DIR"
    ok "Media dir: $MOONI_MEDIA_DIR"
  else
    dim "Media library disabled."
  fi
fi

# 3. API key (reuse the previous one if it exists)
say "3/7 API key"
if [[ -z "${MOONI_API_KEY:-}" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    MOONI_API_KEY="$(openssl rand -hex 24)"
  else
    MOONI_API_KEY="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
  ok "Generated a new API key."
else
  dim "Reusing the existing API key."
fi
# 4. Port
say "4/7 Port"
DEFAULT_PORT="${MOONI_PORT:-8080}"
read -rp "Backend port [$DEFAULT_PORT]: " PORT_INPUT
MOONI_PORT="${PORT_INPUT:-$DEFAULT_PORT}"

# 5. Device name (shown in the app)
say "5/7 Device name"
DEFAULT_NAME="$(hostname)"
read -rp "Device name (shown in the app) [$DEFAULT_NAME]: " NAME_INPUT
DEVICE_NAME="${NAME_INPUT:-$DEFAULT_NAME}"

# 6. Save the config (for reuse + the systemd service)
say "6/7 Save config"
cat > "$CONFIG_FILE" <<EOF
MOONI_ROOT_DIR=$MOONI_ROOT_DIR
MOONI_API_KEY=$MOONI_API_KEY
MOONI_PORT=$MOONI_PORT
EOF
if [[ -n "${MOONI_MEDIA_DIR:-}" ]]; then
  echo "MOONI_MEDIA_DIR=$MOONI_MEDIA_DIR" >> "$CONFIG_FILE"
fi
chmod 600 "$CONFIG_FILE"
ok "Config saved to $CONFIG_FILE (mode 600)"

# 7. IP for the pairing code (Tailscale -> manual -> auto LAN IP in the backend)
say "7/7 Detect IP"
if ! command -v tailscale >/dev/null 2>&1; then
  err "Tailscale is not installed - a Tailscale IP is required for the pairing code."
  err "Install Tailscale first (https://tailscale.com/download), log in with 'tailscale up',"
  err "then run this script again."
  exit 1
fi
TS_IP=""
if TS_IP="$(tailscale ip -4 2>/dev/null || true)" && [[ -n "$TS_IP" ]]; then
  ok "Tailscale IP detected: $TS_IP"
else
  err "Tailscale is installed but not running or not logged in - the phone won't be able to"
  err "reach this machine. Run 'tailscale up' to log in, then run this script again."
  exit 1
fi

if [[ "$IS_WSL" == "1" ]]; then
  echo
  warn "WSL networking note: the phone must be able to reach this machine."
  echo "  - With default NAT networking, the auto-detected IP is the WSL VM's NAT"
  echo "    address, which the phone cannot reach directly. Fix it one of these ways:"
  echo "      1) Mirrored networking - create %UserProfile%\\.wslconfig containing:"
  echo "           [wsl2]"
  echo "           networkingMode=mirrored"
  echo "         then 'wsl --shutdown' from Windows and reopen this terminal. The"
  echo "         pairing code below then uses the Windows host's LAN IP."
  echo "      2) Port forwarding on Windows (run in an admin prompt):"
  echo "           netsh interface portproxy add v4tov4 listenaddress=0.0.0.0"
  echo "             listenport=$MOONI_PORT connectaddress=<WSL IP> connectport=$MOONI_PORT"
  echo "      3) Tailscale on both machines (auto-detected if installed)."
  echo
fi

# Optional: install as a systemd service (auto-start on boot)
if confirm "Run automatically at boot via systemd?" "y/N"; then
  if [[ "$HAS_SYSTEMD" != "1" ]]; then
    warn "systemd is not running as PID 1 here - the service can't be installed."
    if [[ "$IS_WSL" == "1" ]]; then
      echo "In WSL, enable systemd first - add to /etc/wsl.conf:"
      echo "  [boot]"
      echo "  systemd=true"
      echo "then run 'wsl --shutdown' from Windows and reopen this terminal."
    fi
    echo "Run manually instead:"
    echo "  source $CONFIG_FILE && $BIN_PATH"
  else
  SERVICE_FILE="/etc/systemd/system/mooni-backend.service"
  sudo bash -c "cat > $SERVICE_FILE" <<EOF
[Unit]
Description=Mooni Backend
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
User=$USER
EnvironmentFile=$CONFIG_FILE
ExecStart=$BIN_PATH
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable --now mooni-backend
  ok "systemd service active. Check status: sudo systemctl status mooni-backend"
  fi
else
  dim "Skipping systemd. Run manually with:"
  echo "  source $CONFIG_FILE && $BIN_PATH"
fi

# Optional: grant passwordless sudo so the app's Reboot/Shutdown buttons work.
# Skipped on WSL: systemctl reboot/poweroff would only restart/shut down the
# WSL distro, never the Windows host, so the rule would be useless there.
if [[ "$IS_WSL" == "1" ]]; then
  warn "Skipping power control (WSL): the app's Reboot/Shutdown can't reboot Windows"
  warn "from inside WSL. Reboot Windows from the Windows side (e.g. 'shutdown /r')."
elif confirm "Allow the app to reboot/shutdown this machine (needs sudo)?" "y/N"; then
  SYSTEMCTL="$(command -v systemctl)"
  if [[ -z "$SYSTEMCTL" ]]; then
    warn "systemctl not found - power control not configured."
  else
    SUDOERS_FILE="/etc/sudoers.d/mooni-power"
    LOGINCTL="$(command -v loginctl)"
    SUDOERS_CMDS="$SYSTEMCTL reboot, $SYSTEMCTL poweroff"
    # loginctl grant only exists for the lock fallback; skip if not installed.
    if [[ -n "$LOGINCTL" ]]; then
      SUDOERS_CMDS+=", $LOGINCTL lock-sessions"
    fi
    sudo bash -c "printf '%s ALL=(ALL) NOPASSWD: %s\\n' \"$USER\" \"$SUDOERS_CMDS\" > $SUDOERS_FILE"
    sudo chmod 440 "$SUDOERS_FILE"
    if ! sudo visudo -cf "$SUDOERS_FILE"; then
      sudo rm -f "$SUDOERS_FILE"
      warn "Sudoers rule invalid - removed. Power control not configured."
    else
      ok "Power control enabled: passwordless sudo for $SYSTEMCTL reboot/poweroff."
    fi
  fi
fi

# Print the pairing code (QR + text) to scan or paste from the app
say "Pairing Code"
export MOONI_ROOT_DIR MOONI_API_KEY MOONI_PORT
PAIR_ARGS=(-pair -name "$DEVICE_NAME")
if [[ -n "$TS_IP" ]]; then
  PAIR_ARGS+=(-host "$TS_IP")
fi
"$BIN_PATH" "${PAIR_ARGS[@]}" | tee "$CONFIG_DIR/last-pairing-code.txt"
chmod 600 "$CONFIG_DIR/last-pairing-code.txt"

cat <<EOF

${DIM}The code above is also saved to: $CONFIG_DIR/last-pairing-code.txt${RESET}
Open the app on your phone -> 'Add Device' -> 'Paste Code' -> paste that code.

${DIM}To generate a pairing code again anytime (e.g. for someone else's phone):${RESET}
  ${CYAN}source $CONFIG_FILE && $BIN_PATH -pair -name "Name of Phone"${RESET}
EOF