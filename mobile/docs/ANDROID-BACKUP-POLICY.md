# Android backup policy (QR-RELEASE-002A)

Written for the project owner and the security reviewer.

## What the app stores

All user data lives in the WebView's `localStorage` (one LevelDB directory, `app_webview/Default/Local Storage/`). Keys, from `mobile/src/local-store.ts`:

| Key                                                  | Content                                          | Sensitivity                       |
| ---------------------------------------------------- | ------------------------------------------------ | --------------------------------- |
| `qr.reflections`                                     | the user's own written reflections               | **private; the user's own words** |
| `qr.bookmarks.ayahs`, `qr.favorites.surahs`          | bookmarks and favourite surahs                   | personal                          |
| `qr.reading.lastSurah`, `qr.reading.position`        | where the user stopped reading                   | personal                          |
| `qr.settings.*`, `qr.reader.*`, `qr.onboarding.done` | language, theme, text size, motion, start screen | low                               |

Not stored on the device by the user: the Quran database is a bundled read-only asset loaded into memory; there are no accounts, tokens or secrets; there is no audio feature today, so no audio files or downloads exist.

## What changed (before and after)

Before: Android 12+ cloud backup and device transfer, and Android 11 and lower Auto Backup, all copied the whole `Local Storage` directory, **including private reflections, to the user's cloud backup** (encrypted only when the device has a screen lock on 12+).

After:

| Case                                       | Behaviour                                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Android 12+ cloud backup                   | **Nothing is uploaded.** Every domain is excluded explicitly (an element without includes would otherwise back up everything)             |
| Android 12+ device-to-device transfer      | The `Local Storage` directory **is copied**, so bookmarks, position, preferences and reflections follow the user to a new phone they hold |
| Android 11 and lower (`fullBackupContent`) | **Nothing is backed up.** That schema cannot tell cloud from device transfer, and reflections share one directory with the rest           |
| `allowBackup`                              | stays `true` (it is what lets device transfer work); the rules above carry the policy                                                     |

Why a directory-level rule: LevelDB cannot be split by key, so reflections cannot be excluded alone. Trade-off: after a factory reset a user no longer gets bookmarks back from the cloud. Alternatives for the owner: (a) move reflections into a separate store that is excluded, keeping bookmarks in cloud backup (needs a storage migration and a test); (b) accept cloud backup of everything with the lock-screen requirement (previous behaviour).

## Verification

- XML well formed; Android lint (`lintDebug`): 0 errors and no backup-related warning.
- Smoke suite on the isolated emulator (API 35) with the final APK: 52/52 (three consecutive runs).
- **Not verified dynamically:** the emulator's local backup transport rejected the app's package for both the old and the new rules (`PFTBT: Error -1002`), so the actual contents of a backup could not be inspected. The policy is therefore verified from the rules and lint only. Real-device or Google-transport testing is still needed.
