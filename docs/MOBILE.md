# Android and iOS builds

The source is JavaScript, Expo SDK 58 and React Native 0.88. Expo Router controls navigation. SecureStore protects native session tokens; SQLite provides local cache/packing-scan persistence; Expo Camera handles QR scans with manual fallback.

## Development

Start the API from the repo root with `npm run demo`, then use a matching SDK 58 development client/Expo Go client and `npm run mobile`. Set the API address as described in the README. `localhost` on a physical phone means the phone, not the laptop.

If Metro reports macOS watcher limits, install/configure Watchman in your normal development environment, or inspect a static React Native web preview:

```sh
cd mobile
EXPO_PUBLIC_API_URL=http://localhost:4000 npx expo export --platform web
cd ..
node scripts/preview-mobile.mjs
```

Open http://localhost:8081. This previews shared React Native screens in the browser. It does not verify native SQLite, SecureStore or device-camera behavior. Add an explicit origin to WEB_ORIGINS if you use another preview hostname/port.

## JavaScript bundle check

```sh
npm run mobile:export
```

This creates Hermes bundles for Android/iOS and the React Native web export. It is not an APK or signed iOS archive.

## Native Android

With Android SDK, compatible NDK/CMake, JDK and an emulator/device configured. On macOS, if terminal Java is not configured but Android Studio is installed, use its bundled JDK before running the commands below:

```sh
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

The tested local Android toolchain used SDK platform 37.0, build tools 37.0.0, NDK 27.1.12297006 and CMake 3.22.1. Those missing components were added alongside the existing SDK versions on this machine; existing versions were preserved.

```sh
cd mobile
npx expo prebuild --platform android
npx expo run:android
```

The project explicitly uses Android compile SDK 37 / build tools 37.0.0 and target SDK 36, as required by Expo SDK 58. The SDK manager platform package is named `platforms;android-37.0` (including the minor version). Native directories are generated and ignored. Customize app.json/app.config.js and config plugins rather than hand-editing generated code.

The default local/pilot configuration permits an HTTP LAN API. APP_VARIANT=production disables Android cleartext and removes the iOS arbitrary-load exception; provide a real HTTPS API address for that build.

For a classroom APK through Expo services, after signing in to **your own** Expo account:

```sh
cd mobile
npx eas-cli@latest build --platform android --profile preview
```

The preview profile produces an APK. The production profile sets APP_VARIANT=production. The app’s connection settings permit pointing a pilot APK at your own running API after installation. No Expo account/token is embedded in this repo.

## iOS

Use `npx expo run:ios` with a working Xcode simulator/runtime, or `npx eas-cli@latest build --platform ios --profile production` with your own Expo/Apple signing setup. Physical iOS installation and store submission need the appropriate credentials and provisioning. Bundle validation alone does not verify an installed iOS app.

Camera QR scanning needs a physical-device check. The app requests permission when the user opens the scanner; it has a denial explanation and manual-code fallback. QR values can be found in the staff web manifest under “Manual scan code” for a hardware-free demonstration.

## macOS synced-folder builds

Build native iOS projects from a checkout outside cloud-synced Desktop/Documents folders. macOS File Provider can attach Finder metadata to generated frameworks, which causes nested framework signing to fail with “resource fork, Finder information, or similar detritus not allowed”. A clean local checkout outside the synced folder avoids copying this metadata into build products. The app source does not need to be changed for this environment issue.

## Run the published iOS simulator app

Download `LaundryTrack-ios-simulator-arm64.zip` from the pilot release. On an Apple Silicon Mac, extract it to a nonsynced temporary directory, boot an iOS Simulator in Xcode/Simulator, and run:

```sh
ditto -x -k artifacts/LaundryTrack-ios-simulator-arm64.zip /tmp/laundrytrack-simulator-app
xcrun simctl install booted /tmp/laundrytrack-simulator-app/LaundryTrack.app
xcrun simctl launch booted com.samikshajangid.laundrytrack
```

Keep the API running. The simulator uses `http://localhost:4000` by default. The archive has bundled JavaScript and does not need Metro for this pilot run. It cannot be installed on a physical iPhone; use a matching Expo client or your own Apple provisioning/build setup there.
