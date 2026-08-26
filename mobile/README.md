# Mooni Control - Mobile App

Expo + React Native + TypeScript. Typecheck-clean (`npx tsc --noEmit`).
**Target: Android first** - iOS is not a priority yet.

## Features

- **Multi-device**: store several "devices" (laptops/servers running Linux)
  and switch between them easily from the **My Devices** screen.
- **Setup without typing anything**: the **Add Device** screen has a
  "Paste Code" mode with two options - **Scan QR** (point your camera at the
  QR printed by `install.sh` on the backend terminal) or **paste the pairing
  code** manually / from the clipboard. The name/URL/API key are filled in
  automatically from either method. You never need to know your Tailscale IP
  or what an API key even is. "Manual" mode is still there for people who
  prefer to fill everything in themselves.
- **Key security**: each device's API key is stored encrypted via
  `expo-secure-store` (Android Keystore), not in AsyncStorage.
- **File Browser**: list folders, navigate into subfolders, pull-to-refresh,
  create new folders, upload files, and long-press an item for Rename / Copy /
  Move / Delete. Rows and grid cards show server thumbnails for images/videos
  and colored extension badges for document types (PDF/XLS/ZIP/...) via the
  shared `FileTypeIcon` component. The long-press menu uses the app's own
  `ActionSheet` component (not `Alert`) because `Alert` on Android only
  supports 3 buttons.
- **File Preview**: preview images & videos (streaming, with seek support
  because the backend uses HTTP Range); other files can be downloaded and
  shared (share sheet) to other apps on the phone. Multi-select downloads land
  in `Downloads/mooni` on the phone when possible, inside the app otherwise.
- **Media (Photos-style library)**: a dedicated media timeline over a separate
  folder on the server - a date-grouped grid of thumbnails, top-level album
  strip for drilling into library subfolders, a full-screen viewer you swipe
  through (pinch-to-zoom on images with drag-down-to-dismiss, inline video
  playback with seek), long-press multi-select with bulk download/delete, and
  gallery upload (multi-pick from the photo picker). The viewer loads images
  from the backend's cached 2560px `tier=large` preview instead of multi-MB
  originals and prefetches the next image while you look at the current one.
  Requires the backend to be started with `MOONI_MEDIA_DIR`; otherwise the
  screen shows a "not enabled" notice.
- **Home dashboard (first screen)**: live system health - CPU, memory, disk,
  load average, uptime, process count, and temperature - auto-refreshing
  every few seconds, with the selected device's name in the header.
- **Device switcher**: with more than one device paired, a row of chips at
  the top of the dashboard switches which machine you're viewing (tap to
  switch, "+" to add another).
- **Power Control**: Reboot and Shutdown buttons on the dashboard. Each is
  guarded by the phone's device lock - confirm, then unlock with your
  fingerprint/PIN (system prompt). If the phone has no lock set, it falls back
  to a type-to-confirm modal - a random token (e.g. `RAVEN-HARBOR-42`) must be
  typed before the request is sent. The backend also requires a short-lived
  single-use confirm token, so the API key alone can't trigger a power action.
- **Settings → Preferences → Appearance**: switch between Dark and Light
  theme. The choice is persisted on the device (AsyncStorage) and applies
  app-wide - screens, modals, headers, and the status bar.
- **Alerts**: set CPU/RAM/disk/temperature thresholds per device (Settings →
  Alerts); the backend watches them and pushes an Expo notification when one
  is crossed. Requires notifications permission on the phone; thresholds are
  stored server-side in `~/.mooni/alerts.json`.

## How to distribute to other people (no coding needed)

1. You (the admin) run `./install.sh` on the backend → you get a QR code +
   pairing code text in the terminal.
2. If the other person is near you: they just open the app, tap **Add Device**
   → **Scan QR Code**, and point the camera at your terminal screen. Done.
3. If they're remote (can't scan): send them the pairing code text (chat,
   shared note, etc. - treat it like a password, since it contains the API
   key), and they paste it in "Paste Code" mode.
4. Install the app (via Expo Go for development, or the APK from
   `eas build` for production) if it isn't installed yet.

There's no "enter your Tailscale IP manually" or "enter your API key
manually" step for the end user - it's all wrapped up in the single code they
paste.

## Expo Go vs Development Build

All the dependencies in this project (`expo-camera`, `expo-file-system`,
`expo-secure-store`, `expo-image-picker`, etc.) are standard native modules
already bundled in **Expo Go** - so you can just run `npx expo start` and scan
the Metro QR with the **Expo Go** app from the Play Store, no build needed.

If you later want a **development build** (custom native code, or to make
notifications/etc. closer to production), the project is ready:

```bash
npx expo install expo-dev-client   # already in package.json
eas build --platform android --profile development
# or a local build (needs Android Studio/SDK installed):
npx expo run:android
```

Then start Metro with:

```bash
npm run start:dev-client
```

## Development setup (Expo Go)

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone (make sure the phone and the
laptop running the Metro bundler are on the same network while developing -
for everyday use the app connects to the backend via Tailscale, not Metro, so
they don't need to share a network).

## Folder structure

```
src/
  api/             axios client + API functions (list, upload, system/power, media, alerts)
  context/         DevicesContext - saved devices (AsyncStorage) &
                   each device's API key (expo-secure-store)
  navigation/      React Navigation stack: DeviceList → AddDevice / ScanQR,
                   Home → FileBrowser → FilePreview / Settings → Alerts / Legal,
                   Home → Media → MediaViewer, plus the ShareUpload modal
                   (opened by ShareIntentGate when sharing files into the app)
  screens/         HomeScreen (dashboard: stats + device switcher + power),
                   DeviceListScreen, AddDeviceScreen, ScanQRScreen,
                   FileBrowserScreen, FilePreviewScreen, SettingsScreen,
                   AlertSettingsScreen (thresholds), LegalScreen (terms/privacy),
                   ShareUploadScreen (system share-sheet target),
                   MediaScreen (Photos-style timeline + albums + multi-select),
                   MediaViewerScreen (full-screen swipeable viewer)
  screens/components/  PromptModal (input dialog), ActionSheet (long-press menu,
                   Android-safe), TypeToConfirmModal (type-a-token power confirm),
                   PinchZoomImage (pinch/pan/double-tap zoom on expo-image),
                   FileTypeIcon (thumbnail / extension badge / glyph per file type)
  utils/           encode/decode pairing code (must stay in sync with internal/pairing in the backend),
                   fileTypes.ts - extension → icon/badge/thumbnail mapping
  types/           shared TypeScript types
```

## Build APK (Android target)

Use [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npm install -g eas-cli
eas build --platform android
```

## Build your own APK from source (trust nothing prebuilt)

Don't want to install an APK that someone else built? Build it yourself from
this repo - the APK is compiled on your own machine from the exact source in
`mobile/`, so you're trusting the code, not a binary.

Two ways to build it: locally with Gradle (no Expo account needed), or via
Expo's cloud build (EAS) if you'd rather not install Android Studio.

**Option A - local Gradle build (no accounts, fully offline)**

Prerequisites (one-time):

- Node.js 18+ and npm
- JDK 17 (`java -version`)
- Android SDK - easiest via
  [Android Studio](https://developer.android.com/studio) (SDK Platform +
  command-line tools); make sure `ANDROID_HOME` is set.

Build:

```bash
git clone <repo-url> mooni
cd mooni/mobile
npm install
npx expo prebuild --platform android   # generates the android/ project locally
cd android
./gradlew assembleRelease             # first run downloads Gradle + SDK deps - be patient
```

**Option B - EAS cloud build (no Android SDK needed)**

Everything runs on Expo's build servers; you only need Node.js and a free
[Expo account](https://expo.dev/signup). Note this does send your source up to
Expo's servers to be compiled there - use Option A if you don't want that.

```bash
cd mobile
npm install
npm install -g eas-cli
eas login                                # your Expo account
eas init                                 # links this repo to your own EAS project
eas build --platform android --profile preview
```

The build prints a link to download the APK (or install it on a connected
device). `--profile preview` is already configured in `eas.json` to produce an
installable APK.

The APK lands at `android/app/build/outputs/apk/release/app-release.apk`,
signed with the debug keystore - fine for personal sideloading. (If you want a
real release keystore, see the "Caution" comment in
`android/app/build.gradle`.)

Install it: copy the APK to your phone and open it (Android asks to allow
installing from that source), or from a USB-connected device:

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

Then pair as usual: **Add Device → Scan QR** (point at the backend's
`install.sh` terminal output) or paste a pairing code.

## Next-feature roadmap (not implemented yet)

Reboot/shutdown power control is done (dashboard buttons, gated by the phone's
device lock - fingerprint/PIN - with a type-to-confirm fallback when the phone
has no lock set). What's still ahead, in suggested order:

1. **Wake-on-LAN** - a UDP magic packet sent from the app to turn on a
   powered-off machine (no backend needed - the point is to wake a machine
   that's off).
2. **Docker Manager** & **Systemd Service Control** - via the Unix socket
   `/var/run/docker.sock` and `systemctl` (needs a restricted shell and a
   service whitelist to stay safe).
3. **Custom Script Launcher** & **Remote Terminal/SSH** - the most sensitive;
   Remote Terminal is best done with a real SSH client in the app connecting
   to your Mint SSH server (safer and more battle-tested than re-inventing a
   shell in the Go backend).
