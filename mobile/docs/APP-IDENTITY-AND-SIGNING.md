# Mobile application identity and signing plan (QR-RELEASE-002A)

Written for the project owner. Nothing in this document was changed in the project: no bundle identifier, no signing setting, no developer-account setting.

## Current identifiers

| Place                                                                                   | Value                                                                |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Capacitor `appId` (`capacitor.config.ts`)                                               | `com.quranroots.app`                                                 |
| Android `applicationId` and `namespace`, Java package, `strings.xml` package and scheme | `com.quranroots.app`                                                 |
| iOS `PRODUCT_BUNDLE_IDENTIFIER` (app target)                                            | `com.quranroots.mobilefeasibility`                                   |
| iOS UI-test target                                                                      | `com.quranroots.mobilefeasibility.uitests`                           |
| iOS signing                                                                             | automatic, identity "iPhone Developer", **no development team set**  |
| Android release signing                                                                 | none configured (debug key only); `versionCode 1`, `versionName 1.0` |

## Is `com.quranroots.app` suitable for both?

Yes, technically: reverse-DNS of the project's domain, lower case, valid on both stores, and already used by Android and Capacitor. Notes:

- The domain `quranroots.com` exists (public WHOIS: created 2020-05-14, registrar Squarespace Domains II, DNS on DigitalOcean). I could **not** verify that the project owner holds it; reverse-DNS identifiers are conventional, not enforced, by either store.
- Public availability checks are inconclusive by nature: the Google Play page for `com.quranroots.app` returns 404 and the iTunes lookup returns no result, which only means no **published** app uses it. Neither store reveals identifiers reserved inside developer consoles. Availability is only confirmed by registering it.
- The last component `app` is generic but valid. Changing the choice later is possible only before the first store submission.

## Migration implications (nothing has shipped)

- iOS: changing `mobilefeasibility` to `app` touches the app and UI-test targets, the UI-test README and simulator scripts. No user data migration is needed because no release exists. The WebView origin (`capacitor://localhost`) does not depend on the bundle identifier, so saved settings behave the same.
- **After** the first App Store Connect record or Play upload, the identifier is permanent. Treat the decision as final before creating either listing.
- Android already uses the preferred value, so only iOS and documentation change.

## Apple requirements (open; none done)

Apple Developer Program membership (paid, annual; check the current fee) with the account holder's identity; an explicit App ID for the chosen bundle identifier; a team ID in the project; an Apple Distribution certificate and an App Store provisioning profile (automatic signing can manage these once the team is set); an App Store Connect app record; export-compliance answer (the app makes no network connection and uses no custom cryptography; set `ITSAppUsesNonExemptEncryption` accordingly); App Privacy answers (no data collected); age rating; a privacy policy URL; screenshots at the required sizes; review notes. Content note: the app displays Quranic text, so the legal attribution screen and source credits should be reviewed first.

## Google Play requirements (open; none done)

Google Play Console developer account (one-time registration fee; check the current amount and the identity-verification steps); an upload keystore generated and stored offline with a recovery plan; enrolment in Play App Signing; a release build as an Android App Bundle (`bundleRelease`) with an incremented `versionCode`; target API level at the current store minimum (the app targets 36); Data safety form (no data collected, no sharing); content rating questionnaire; privacy policy URL; store listing assets (icon, feature graphic, screenshots); testing-track requirements for new personal accounts, if any apply.

## Decisions needed from the owner

1. Confirm `com.quranroots.app` as the permanent identifier for both platforms and that the project holds the domain.
2. Approve the iOS rename (a small, separate change) and the Apple developer team to attach.
3. Approve account creation and fees (not authorised today).
4. Decide who holds the Android upload key and the Apple account (organisation vs individual) before submission.
