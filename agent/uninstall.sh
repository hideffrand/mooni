#!/usr/bin/env bash
# Mooni agent - one-command uninstall.
# Removes the systemd service (if installed), the built binary, and the
# config folder (~/.mooni). The storage folder is only deleted if the user
# explicitly picks that option AND types DELETE - never automatically.
set -euo pipefail

CONFIG_DIR="$HOME/.mooni"
CONFIG_FILE="$CONFIG_DIR/config.env"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Locate the binary across both layouts: next to this script (repo checkout),
# else in the curl installer's default bin dir, else on PATH.
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
SERVICE_NAME="mooni-backend"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

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
    BT="$BOLD$RED" DT="$DIM" _render_art "$art"
  else
    printf '%s\n' "$art"
  fi
  dim "  uninstaller"
}

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

# Remember the storage folder before anything gets deleted (it's only stored
# in the config file, which may be removed below).
STORAGE_DIR=""
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  STORAGE_DIR="${MOONI_ROOT_DIR:-}"
fi

banner

# 1. Stop & remove the systemd service
say "1/4 Stop & remove the systemd service"
if systemctl list-unit-files 2>/dev/null | grep -q "^${SERVICE_NAME}\."; then
  sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  sudo systemctl disable "$SERVICE_NAME" 2>/dev/null || true
  sudo rm -f "$SERVICE_FILE"
  sudo systemctl daemon-reload
  ok "systemd service removed."
else
  dim "No systemd service installed - nothing to do."
fi

# Remove the passwordless-sudo rule that powered the app's Reboot/Shutdown.
if [[ -f /etc/sudoers.d/mooni-power ]]; then
  sudo rm -f /etc/sudoers.d/mooni-power
  ok "Removed the power-control sudoers rule."
fi

# 2. Remove the built binary
say "2/4 Remove the built binary"
if [[ -f "$BIN_PATH" ]]; then
  rm -f "$BIN_PATH"
  ok "Removed: $BIN_PATH"
else
  dim "No binary found."
fi

# 3. The shared storage folder is never deleted automatically - it's your
#    data. Uninstall only removes the service, binary, and config. The menu
#    below lets you OPT IN to deleting the files, by number, and only after
#    typing DELETE (an ambiguous "type the path" prompt is gone).
say "3/4 Paired storage folder"
if [[ -n "$STORAGE_DIR" && -d "$STORAGE_DIR" ]]; then
  echo
  echo "Paired folders:"
  echo "  [1] $STORAGE_DIR"
  echo
  echo "What should uninstall do with the files in it?"
  echo "  1) Keep all files - just uninstall (recommended)"
  echo "  2) Uninstall AND permanently delete all files in [1]"
  read -rp "Choose [1]: " choice
  case "${choice:-1}" in
    2)
      echo
      printf '%s%sWARNING: this permanently deletes everything in:%s\n' "$RED" "$BOLD" "$RESET"
      printf '%s%s  %s%s\n' "$RED" "$BOLD" "$STORAGE_DIR" "$RESET"
      read -rp "Type DELETE to confirm (anything else keeps the files): " confirm_word
      if [[ "$confirm_word" == "DELETE" ]]; then
        rm -rf "$STORAGE_DIR"
        ok "Deleted: $STORAGE_DIR"
      else
        dim "Aborted - files kept."
      fi
      ;;
    *)
      dim "Keeping all files."
      ;;
  esac
else
  dim "No storage folder configured."
fi

# 4. Remove the config folder (API key + saved pairing codes + the installed
#    setup.sh) - this is what "unpairs" the phones.
say "4/4 Remove the config folder"
if [[ -d "$CONFIG_DIR" ]]; then
  if confirm "Remove $CONFIG_DIR (config + API key + saved pairing codes)?" "Y/n"; then
    rm -rf "$CONFIG_DIR"
    ok "Removed: $CONFIG_DIR"
  else
    dim "Kept: $CONFIG_DIR"
  fi
else
  dim "No config folder found."
fi

cat <<EOF

${GREEN}${BOLD}Uninstall complete.${RESET}
${DIM}- If you chose "keep files", everything under the storage folder is untouched.
- Existing pairing codes on phones stop working now that the service is
  stopped and the API key is deleted.
- Go was left installed (it's a general tool). Remove it manually if you want:
  sudo apt remove golang-go${RESET}
EOF
