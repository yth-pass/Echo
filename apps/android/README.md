# Echo Android (`apps/android`)

Phase 1 **demo shell** after web client validation ([P1-13](../../docs/Phase1-Demo-Roadmap-Echo.md)). Kotlin + Jetpack Compose + Hilt + Retrofit targeting the same REST base as `echo/` (`http://10.0.2.2:4000/v1` on emulator).

## Structure

- `settings.gradle.kts` — single `:app` module
- `app/src/main/java/com/echo/app/` — `MainActivity`, `EchoApp`, placeholder tabs

## Build (requires Android SDK)

```bash
cd apps/android
./gradlew assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`

## API base URL

Edit `app/build.gradle.kts` `buildConfigField` `API_BASE_URL` for staging vs local emulator.

## CI

See [`.github/workflows/android-apk.yml`](../../.github/workflows/android-apk.yml) for debug APK artifact build (unsigned).
