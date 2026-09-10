#!/usr/bin/env bash
# Mooni agent - one-command curl installer.
# Mirrored to web/public/install.sh - keep both in sync.
# Non-interactive bootstrap: downloads a prebuilt binary (or builds from a
# checkout), installs it, then hands off to the interactive setup script.
# Safe for `curl ... | bash` - nothing here reads from stdin.
set -euo pipefail

REPO="hideffrand/mooni"
BIN_NAME="mooni-backend"
CONFIG_DIR="$HOME/.mooni"
BIN_DIR="$HOME/.local/bin"
VERSION="latest"
RUN_SETUP="auto"

usage() {
  cat <<'EOF'
Usage: install.sh [options]

Options:
  --bin-dir <dir>   install the binary here (default: ~/.local/bin)
  --version <tag>   release tag to install, e.g. v0.1.0 (default: latest)
  --setup <mode>    after install: auto (run setup) | skip (default: auto)
  -h, --help        show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bin-dir) BIN_DIR="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --setup) RUN_SETUP="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

say() { printf '\n=== %s ===\n' "$1"; }

# --- Platform check ---------------------------------------------------------
if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Mooni's agent only runs on Linux. Detected: $(uname -s)" >&2
  exit 1
fi
case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

# Detect the install.sh location so a `bash agent/install.sh` run inside a
# checkout builds from source instead of downloading. Under `curl | bash`
# BASH_SOURCE is empty, so this resolves to the current directory (which
# won't be a checkout) - the download path is used.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" && pwd 2>/dev/null || pwd)"
mkdir -p "$BIN_DIR" "$CONFIG_DIR/bin"
chmod 700 "$CONFIG_DIR"

install_bin() { install -m 0755 "$1" "$BIN_DIR/$BIN_NAME"; }

if [[ -f "$SCRIPT_DIR/go.mod" && -f "$SCRIPT_DIR/main.go" ]]; then
  say "Build from source (git checkout detected)"
  if ! command -v go >/dev/null 2>&1; then
    echo "Go compiler not found - needed to build from a checkout." >&2
    echo "Install Go (https://go.dev/dl/) or use the curl installer." >&2
    exit 1
  fi
  ( cd "$SCRIPT_DIR" && go build -trimpath -o "$BIN_DIR/$BIN_NAME" . )
  echo "Built: $BIN_DIR/$BIN_NAME"
  SETUP_SRC="$SCRIPT_DIR/setup.sh"
  UNINSTALL_SRC="$SCRIPT_DIR/uninstall.sh"
else
  say "Download release ($ARCH)"
  if [[ "$VERSION" == "latest" ]]; then
    BASE="https://github.com/$REPO/releases/latest/download"
  else
    BASE="https://github.com/$REPO/releases/download/$VERSION"
  fi
  PKG="mooni-backend-linux-$ARCH.tar.gz"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  curl -fsSL "$BASE/$PKG" -o "$TMP/$PKG"
  curl -fsSL "$BASE/checksums.txt" -o "$TMP/checksums.txt"
  echo "Verifying sha256 checksum..."
  ( cd "$TMP" && grep " $PKG\$" checksums.txt | sha256sum -c - >/dev/null )
  tar -xzf "$TMP/$PKG" -C "$TMP"
  install_bin "$TMP/$BIN_NAME"
  echo "Installed: $BIN_DIR/$BIN_NAME"
  SETUP_SRC="$TMP/setup.sh"
  UNINSTALL_SRC="$TMP/uninstall.sh"
fi

# Install setup.sh (and uninstall.sh) so they survive without the repo.
install -m 0755 "$SETUP_SRC" "$CONFIG_DIR/bin/setup.sh"
install -m 0755 "$UNINSTALL_SRC" "$CONFIG_DIR/bin/uninstall.sh"

# Make sure the bin dir is on PATH (only if it isn't already).
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  for RC in "$HOME/.bashrc" "$HOME/.profile"; do
    if [[ -f "$RC" ]] && ! grep -qF "export PATH=\"$BIN_DIR:\$PATH\"" "$RC"; then
      printf '\nexport PATH="%s:$PATH"\n' "$BIN_DIR" >> "$RC"
    fi
  done
  echo
  echo "Added $BIN_DIR to your PATH in ~/.bashrc (and ~/.profile)."
  echo "Open a new terminal (or run: export PATH=\"$BIN_DIR:\$PATH\") so"
  echo "'mooni-backend' is available on your PATH."
fi

say "Installed"
echo "  binary  : $BIN_DIR/$BIN_NAME"
echo "  setup   : $CONFIG_DIR/bin/setup.sh"
echo "  uninstall: $CONFIG_DIR/bin/uninstall.sh"
echo
echo "Next step - run the interactive setup to pick folders and pair your phone:"
echo "  bash $CONFIG_DIR/bin/setup.sh"

if [[ "$RUN_SETUP" == "auto" ]]; then
  echo
  echo "Running interactive setup now..."
  bash "$CONFIG_DIR/bin/setup.sh"
elif [[ "$RUN_SETUP" != "skip" ]]; then
  echo "unknown --setup value: $RUN_SETUP" >&2
  exit 1
fi