# AGENTS.md

Monorepo-lite of two **independent** projects, tracked by one root git repo (no CI, no lint):

- `mobile/` - Expo (SDK 54) + React Native 0.81 + TypeScript mobile app.
- `agent/` - Go 1.22+ HTTP API. External deps: `go-qrcode` (terminal QR in `-pair` mode) and `go-redis/v9` (optional: Redis-backed response caching via `MOONI_REDIS_ADDR`/`MOONI_REDIS_PASSWORD`; unset → in-process cache with same semantics, lost on restart).

## Verify / build

Backend (no env vars needed for build/vet/test):
```bash
cd agent && go vet ./... && go test ./... && go build -o mooni-backend .
```
Go tests: `internal/files/cache_test.go`, `internal/media/media_test.go`, `internal/system/confirm_test.go`, `internal/system/stats_test.go`.

App - no lint script. Typecheck is the real gate; a jest suite exists too:
```bash
cd mobile && npm install && npx tsc --noEmit
npm test   # jest-expo; single component test in __tests__/
```
`jest.setup.js` mocks AsyncStorage/SecureStore/clipboard/font - don't add test setup elsewhere. `package-lock.json` IS committed. Dev server: `npx expo start` (Expo Go).
Share-sheet uploads (`ShareUploadScreen`, `expo-share-intent`; intent filters in `app.json`) only work in a real build - the Android intent filters don't exist in Expo Go, so test them via `eas build --profile preview` or `npx expo run:android`.

## Backend runtime (gotcha)

Server **refuses to start** without env: `MOONI_ROOT_DIR` and `MOONI_API_KEY` are required; `MOONI_PORT` optional (default 8080).
- Optional: `MOONI_MEDIA_DIR` (a dedicated folder for the Photos-style media library; unset → `/api/media/*` not registered). `install.sh` prompts for it during setup; you can also add it to `~/.mooni/config.env` by hand (the dir must already exist). `MOONI_REDIS_ADDR`/`MOONI_REDIS_PASSWORD` (Redis cache; unset → in-process cache). Thumbnails are cached on disk under `~/.mooni/thumbs/`.
- One-shot setup + pairing: `./install.sh` (installs Go if missing, generates key, writes `~/.mooni/config.env` mode 600, optional systemd service, optionally adds a scoped passwordless-sudo rule for `systemctl reboot`/`poweroff` in `/etc/sudoers.d/mooni-power`, prints QR/pairing code). On WSL it detects the env: skips the systemd service when systemd isn't PID 1, skips the power-control sudoers rule (can't reboot Windows from WSL), and prints mirrored-networking/portproxy guidance so the phone can reach the server.
- Uninstall: `./uninstall.sh` (stops/removes the systemd service and sudoers rule, removes the binary and `~/.mooni` config; lists the paired storage folder and only deletes it if the user picks that option AND types `DELETE` - never automatically).
- Quick rerun after setup: `source ~/.mooni/config.env && go run .`
- Regenerate pairing code any time: `./mooni-backend -pair -name "..." [-host <ip>]` (auto-detects Tailscale IP via `tailscale ip -4`, falls back to LAN IP, then `127.0.0.1`).

Go 1.22 method-routing patterns are used (`mux.HandleFunc("GET /api/files/list", ...)`) - won't compile on older Go.

## Cross-repo contract: pairing code (MUST stay in sync)

`MOONI1:<base64(JSON{name,baseUrl,apiKey})>` encoded in two places:
- app: `src/utils/pairingCode.ts`
- backend: `internal/pairing/pairing.go`

Change the format in one → change the other. App code uses global `btoa`/`atob` (RN 0.74+ Hermes) - do NOT reintroduce a `Buffer` fallback (not a global in RN).

## Security invariants (don't weaken)

- All `/api/files/*`, `/api/media/*` and `/api/system/*` require header `X-API-Key` (constant-time compare, `internal/auth/middleware.go`). `GET /api/health` is public. New `/api/system/*` endpoints must go through the same auth wrapper (they read the host).
- Every user path is sandboxed to `MOONI_ROOT_DIR` via `internal/fsutil/path.go` `Resolve()` - blocks `..`, absolute paths, AND symlinks pointing outside root (existing-path symlinks are resolved and re-checked). Upload filenames go through `filepath.Base`. Keep this boundary intact; new endpoints must go through `Resolve`.
- App stores device API keys in `expo-secure-store`, NOT AsyncStorage (`DevicesContext` writes them per-device under `mooni.apikey.<id>`). The AsyncStorage device list is keyless; `DevicesContext` migrates any legacy inline key on load.
- `/api/files/preview` streams via `http.ServeContent` (HTTP Range support enables video scrubbing) - don't replace with a plain file handler.
- Media viewer images use `GET /api/media/preview?...&tier=large` (cached 2560px JPEG from the thumbnail cache; falls back to the original on any decode failure). Videos always stream the original. Keep the fallback path intact.
- Media thumbnails are warmed **in the background**: `media.Service.WarmAll` (hooked into `GET /api/media/list`, 2min in-process cooldown) and `WarmPaths` (on upload) feed `thumbs.Generator`'s bounded queue (`WarmIfMissing` drops on overflow, `WarmWait` blocks for full-library passes; the queue shares the same 4-way semaphore as on-demand generation). The warm pass skips the 2560px tier for videos/webp - the viewer streams the original for those. Don't generate thumbs synchronously in request handlers beyond the first `Get()` cache miss.
- Media lists are tuned for perceived speed: grid `SectionList` and viewer `FlatList` use small `initialNumToRender`/`windowSize` batches; viewer image pages paint the grid's cached thumb behind the large tier (`PinchZoomImage placeholderUri`) and video pages show it as a poster until expo-video reports `readyToPlay`; viewer prefetches both neighbor images. Keep `removeClippedSubviews` off in the viewer (it unmounts transformed children during drag-dismiss on Android).
- Max upload 2 GiB (`MaxUploadBytes`). Backend serves at most `MOONI_ROOT_DIR`; a pairing code contains the API key and must be treated like a password. `install.sh` keeps `~/.mooni/` at 700 and `last-pairing-code.txt` at 600.
- The app talks **plain HTTP** (`http://...`, no TLS) to LAN/Tailscale IPs. `app.json` sets Android `usesCleartextTraffic: true` via the `expo-build-properties` plugin - don't remove it or pairing/preview breaks.

## Conventions

- All paths are root-relative, forward-slashed (see `fsutil.ToRelative` and app `src/types/index.ts` `FileEntry`).
- UI text, error messages, READMEs, and install.sh prompts are in English - keep new user-facing strings English.
- App architecture: `src/api` (axios client + file ops + system/power + media + alerts), `src/context/DevicesContext.tsx` (persisted devices via AsyncStorage, API keys via SecureStore) and `ThemeContext.tsx` (dark/light, persisted in AsyncStorage key `mooni.theme.v1`), `src/navigation/RootNavigator.tsx`, `src/screens/`, `src/screens/components/` (`PromptModal`, `ActionSheet`, `TypeToConfirmModal`, `PinchZoomImage`, `FileTypeIcon`).
- Navigation: initial route is **Home** when a device is active, else **DeviceList**. Stack: DeviceList → AddDevice / ScanQR, Home → FileBrowser → FilePreview / Settings, Home → Media → MediaViewer, plus a `ShareUpload` modal pushed by `ShareIntentGate` (RootNavigator.tsx) when the app opens from the system share sheet. New screens must pull colors from `useTheme()` (theme-aware), not hardcode.
- App is **Android-first** - don't add iOS-only APIs (no `ActionSheetIOS`, no iOS-only styling). Long-press menus use the custom `ActionSheet` component because Android's `Alert` caps at 3 buttons.
- File-type visuals (thumbnails vs colored ext badges vs glyphs) come from `src/utils/fileTypes.ts` + the shared `FileTypeIcon` component - don't re-implement per-screen icon mapping (ShareUploadScreen's `ionIconFor` uses the same util).
- App downloads/uploads stream via `expo-file-system` (`downloadAsync`/`uploadAsync`), not axios, for large files.
- Power control (reboot/shutdown from Home) IS implemented. It's gated by the
  phone's device lock (fingerprint/PIN via `expo-local-authentication`, in
  `mobile/src/utils/biometricAuth.ts`; type-to-confirm fallback when the phone
  has no lock set) AND a short-lived single-use `X-Confirm-Token`: the app
  calls `POST /api/system/confirm-token` right before the power request, and
  the backend consumes that token in `agent/internal/system/confirm.go`
  (`issue`/`consume`), so a leaked API key or replayed request alone can't
  reboot/shutdown the machine. Power still relies on the passwordless-sudo
  rule for the actual `systemctl reboot`/`poweroff`.
- NOT implemented - don't assume they exist: docker manager, systemd service control, wake-on-LAN, remote terminal/SSH.
