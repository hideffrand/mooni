#!/usr/bin/env bash
# Mooni backend - one-command setup.
# Builds the server, generates a random API key, detects a reachable IP
# (Tailscale first, then the LAN IP), and prints a QR + pairing code the
# mobile app can scan to connect.
set -euo pipefail

CONFIG_DIR="$HOME/.mooni"
CONFIG_FILE="$CONFIG_DIR/config.env"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_PATH="$SCRIPT_DIR/mooni-backend"

say() { printf '\n=== %s ===\n' "$1"; }

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
  echo "Windows WSL detected."
fi

# systemd runs as PID 1 on a normal Linux box, and on WSL only when
# /etc/wsl.conf has [boot] systemd=true.
HAS_SYSTEMD=0
if [[ -d /run/systemd/system ]]; then
  HAS_SYSTEMD=1
fi

echo "Mooni Backend - Setup"
echo "======================="

# 1. Make sure Go is available
say "1/8 Check Go"
if ! command -v go >/dev/null 2>&1; then
  echo "Go compiler not found."
  if confirm "Install 'golang-go' via apt now?" "Y/n"; then
    sudo apt update && sudo apt install -y golang-go
  else
    echo "Install Go first (https://go.dev/dl/), then run this script again."
    exit 1
  fi
fi

# 2. Prepare the config dir and load any previous config
say "2/8 Load config"
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  echo "Previous config found at $CONFIG_FILE"
else
  echo "No config yet; a new one will be created."
fi

# 3. Folder the app is allowed to manage
say "3/8 Folders"
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
    echo "Using: $MOONI_ROOT_DIR"
  else
    read -rp "Custom path (the app may access this folder): " ROOT_INPUT
    MOONI_ROOT_DIR="${ROOT_INPUT:-$HOME/mooni-storage}"
  fi
fi
mkdir -p "$MOONI_ROOT_DIR"
echo "Root dir: $MOONI_ROOT_DIR"

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
    echo "Media dir: $MOONI_MEDIA_DIR"
  else
    echo "Media library disabled."
  fi
fi

# 4. API key (reuse the previous one if it exists)
say "4/8 API key"
if [[ -z "${MOONI_API_KEY:-}" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    MOONI_API_KEY="$(openssl rand -hex 24)"
  else
    MOONI_API_KEY="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
  echo "Generated a new API key."
else
  echo "Reusing the existing API key."
fi

# 5. Port
say "5/8 Port"
DEFAULT_PORT="${MOONI_PORT:-8080}"
read -rp "Backend port [$DEFAULT_PORT]: " PORT_INPUT
MOONI_PORT="${PORT_INPUT:-$DEFAULT_PORT}"

# 6. Device name (shown in the app)
say "6/8 Device name"
DEFAULT_NAME="$(hostname)"
read -rp "Device name (shown in the app) [$DEFAULT_NAME]: " NAME_INPUT
DEVICE_NAME="${NAME_INPUT:-$DEFAULT_NAME}"

# 7. Save the config (for reuse + the systemd service) and build
say "7/8 Save config & build"
cat > "$CONFIG_FILE" <<EOF
MOONI_ROOT_DIR=$MOONI_ROOT_DIR
MOONI_API_KEY=$MOONI_API_KEY
MOONI_PORT=$MOONI_PORT
EOF
if [[ -n "${MOONI_MEDIA_DIR:-}" ]]; then
  echo "MOONI_MEDIA_DIR=$MOONI_MEDIA_DIR" >> "$CONFIG_FILE"
fi
chmod 600 "$CONFIG_FILE"
echo "Config saved to $CONFIG_FILE (mode 600)"

echo "Building..."
go build -o "$BIN_PATH" .
echo "Build finished: $BIN_PATH"

# 8. IP for the pairing code (Tailscale -> manual -> auto LAN IP in the backend)
say "8/8 Detect IP"
if ! command -v tailscale >/dev/null 2>&1; then
  echo "Tailscale is not installed - a Tailscale IP is required for the pairing code."
  echo "Install Tailscale first (https://tailscale.com/download), log in with 'tailscale up',"
  echo "then run this script again."
  exit 1
fi
TS_IP=""
if TS_IP="$(tailscale ip -4 2>/dev/null || true)" && [[ -n "$TS_IP" ]]; then
  echo "Tailscale IP detected: $TS_IP"
else
  echo "Tailscale is installed but not running or not logged in - the phone won't be able to"
  echo "reach this machine. Run 'tailscale up' to log in, then run this script again."
  exit 1
fi

if [[ "$IS_WSL" == "1" ]]; then
  echo
  echo "WSL networking note: the phone must be able to reach this machine."
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
    echo "systemd is not running as PID 1 here - the service can't be installed."
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
  echo "systemd service active. Check status: sudo systemctl status mooni-backend"
  fi
else
  echo "Skipping systemd. Run manually with:"
  echo "  source $CONFIG_FILE && $BIN_PATH"
fi

# Optional: grant passwordless sudo so the app's Reboot/Shutdown buttons work.
# Skipped on WSL: systemctl reboot/poweroff would only restart/shut down the
# WSL distro, never the Windows host, so the rule would be useless there.
if [[ "$IS_WSL" == "1" ]]; then
  echo "Skipping power control (WSL): the app's Reboot/Shutdown can't reboot Windows"
  echo "from inside WSL. Reboot Windows from the Windows side (e.g. 'shutdown /r')."
elif confirm "Allow the app to reboot/shutdown this machine (needs sudo)?" "y/N"; then
  SYSTEMCTL="$(command -v systemctl)"
  if [[ -z "$SYSTEMCTL" ]]; then
    echo "systemctl not found - power control not configured."
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
      echo "Sudoers rule invalid - removed. Power control not configured."
    else
      echo "Power control enabled: passwordless sudo for $SYSTEMCTL reboot/poweroff."
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

The code above is also saved to: $CONFIG_DIR/last-pairing-code.txt
Open the app on your phone -> 'Add Device' -> 'Paste Code' -> paste that code.

To generate a pairing code again anytime (e.g. for someone else's phone):
  source $CONFIG_FILE && ./mooni-backend -pair -name "Name of Phone"
EOF
