# TecEscola Android mirror

The app in `tecescola/` is a Bubblewrap Trusted Web Activity (TWA) that opens the existing TecEscola web application at `https://admin.grupotec.dev.br`. It is a web mirror, not a second backend or a locally stored student-data client.

## Local debug build

Requirements: JDK 17 and Android SDK with the platform/build tools used by the Gradle project.

```powershell
cd android/tecescola
.\gradlew.bat assembleDebug
```

The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk` and uses Android's local debug signing configuration. Do not distribute it as a release build.

## Release gates

- `br.com.grupotec.tecescola` is provisional and must be confirmed by the product owner before any store release; package IDs cannot be changed after an app is published.
- No release keystore or signing password is included. Configure a protected release key only in the authorized release pipeline, and never commit it.
- Full-screen TWA verification requires `https://admin.grupotec.dev.br/.well-known/assetlinks.json` containing the final package ID and SHA-256 fingerprint of the release signing certificate. Do not publish a debug fingerprint as production DAL.
- The web manifest and icons must be deployed at the production URLs already referenced by `twa-manifest.json` before validating the TWA against production.
- Bubblewrap warns that TWA apps are incompatible with applications targeting children under 13. Since TecEscola serves school students, confirm the intended Play Store audience and policy approach before publication.

The PWA service worker caches only same-origin, versioned `/assets/` GET requests without query strings or authorization headers. It never caches API, authentication, storage, or student-specific responses. The offline page does not expose or persist account data.
