# BananaTape Android scaffold

This directory contains the additive native Android scaffold for BananaTape. It does not move or replace the root web/CLI product.

## App identity

- Application id: `app.bananatape.mobile`
- Package namespace: `app.bananatape.mobile`
- UI toolkit: Kotlin and Jetpack Compose
- First screen: `BananaTape` title with an empty project list
- Current scope: native mobile editor shell with local project creation, Toss-style UI surfaces, and prompt-driven OpenAI image generation when the user enters an API key.

## Permissions

The app requests network access for explicit OpenAI image generation. The Android instrumented test checks that the first-launch app requests only network among provider/gallery/storage permissions:

- `android.permission.INTERNET`
- no `android.permission.READ_MEDIA_IMAGES`
- no `android.permission.READ_EXTERNAL_STORAGE`
- no `android.permission.WRITE_EXTERNAL_STORAGE`
- no `app.bananatape.mobile.permission.PROVIDER`

## Local Gradle invocation

The project includes `apps/android/gradlew`, a small project-local bootstrap script that downloads and runs Gradle `8.14.3` into `apps/android/.gradle/wrapper/` when no local distribution exists. This keeps the plan command shape working even when no system `gradle` executable is installed.

Gradle caches, wrapper downloads, build outputs, APKs, dex files, generated reports, and Android Studio local files are ignored by `apps/android/.gitignore`. Preserve source/config files in this directory and copied task evidence under `.omo/evidence/mobile-native-port/android/gradle-reports/`; do not commit regenerated `apps/android/.gradle/`, `apps/android/build/`, or `apps/android/app/build/` contents.

Run from the repository root:

```bash
apps/android/gradlew -p apps/android testDebugUnitTest
```

## Android emulator commands

Installed AVDs can be listed with:

```bash
emulator -list-avds
```

Expected local AVDs for this task:

```text
Pixel_7_API_36
Pixel_9_Pro_XL_API_36_1
```

Boot the requested Pixel 7 AVD:

```bash
emulator -avd Pixel_7_API_36 -no-snapshot -no-audio -no-window
```

Wait for boot and confirm API level:

```bash
adb wait-for-device
adb shell getprop sys.boot_completed
adb devices
adb shell getprop ro.build.version.sdk
```

Run connected tests:

```bash
apps/android/gradlew -p apps/android connectedDebugAndroidTest
```

## Evidence

- Task summary: `.omo/evidence/mobile-native-port/task-11-android-scaffold.txt`
- Copied Gradle reports: `.omo/evidence/mobile-native-port/android/gradle-reports/`
- Unit report: `.omo/evidence/mobile-native-port/android/gradle-reports/testDebugUnitTest/index.html`
- Connected report: `.omo/evidence/mobile-native-port/android/gradle-reports/connectedDebugAndroidTest/index.html`
- Connected XML/log output: `.omo/evidence/mobile-native-port/android/gradle-reports/connectedDebugAndroidTest-results/`

## Verified commands

On 2026-07-03, these commands passed from the repository root:

```bash
apps/android/gradlew -p apps/android testDebugUnitTest
apps/android/gradlew -p apps/android connectedDebugAndroidTest
```

The connected test run used `Pixel_7_API_36` with Android API `36`.
