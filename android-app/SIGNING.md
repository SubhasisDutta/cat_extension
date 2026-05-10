# Signing & release walkthrough

Everything you need to ship Fat Orange Cat to the Play Store.

## TL;DR

```bash
# one-time
keytool -genkeypair -v -keystore android-app/keystores/fat-orange-cat.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias fat-orange-cat
cp android-app/keystore.properties.template android-app/keystore.properties
# edit keystore.properties with your passwords + alias

# every release
cd android-app
./scripts/build-release.sh
# upload dist/fat-orange-cat-vX.Y.Z-N.aab to Play Console
```

## One-time setup

### 1. Create a Google Play developer account

- Sign up at <https://play.google.com/console/> (one-time $25 fee).
- Verify identity (Google now requires government ID for new developer
  accounts).

### 2. Generate the upload keystore

The upload keystore is what Google Play uses to verify *who* uploaded each
release. Once Play has it on file, all future releases for the same app
listing must be signed with it. **If you lose it, you cannot ship updates
to the same listing** — you'd have to publish a brand-new app.

```bash
mkdir -p android-app/keystores
keytool -genkeypair -v \
  -keystore android-app/keystores/fat-orange-cat.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias fat-orange-cat
```

`keytool` will prompt for:

- A keystore password — pick a strong one, save it in your password manager.
- A key password (the passphrase for the alias inside the keystore). It can
  be the same as the keystore password.
- Distinguished name fields (CN, O, OU, L, ST, C). Use your real-ish name
  and country code; these end up embedded in the certificate but are not
  shown to end users.

Validity 10000 days ≈ 27 years. Google requires at least 25 years for
Play Store uploads.

### 3. Wire the credentials into Gradle

```bash
cd android-app
cp keystore.properties.template keystore.properties
$EDITOR keystore.properties
```

Fill in:

```properties
storeFile=keystores/fat-orange-cat.jks
storePassword=<the keystore password from step 2>
keyAlias=fat-orange-cat
keyPassword=<the key password from step 2>
```

The path is relative to `android-app/`. The Gradle build resolves it via
`rootProject.file(...)`.

### 4. Back up the keystore

The single biggest mistake you can make is to lose this `.jks` file. Belt
and suspenders:

- Copy it to your password manager as a file attachment (1Password,
  Bitwarden, etc.).
- Copy it to an encrypted volume on a backup drive.
- **Do NOT commit it to git.** Both the keystore and `keystore.properties`
  are in `android-app/.gitignore`. Confirm with `git status` before each
  commit.

If you ever lose access to the upload keystore, Google Play has a "key
reset" flow but it requires you to email Play support, prove you own the
listing, and wait ~3 business days before they accept a new key. Plan to
not need this.

### 5. Enroll in Play App Signing (recommended)

When you upload the first AAB to Play Console, Google offers Play App
Signing. Accept it. Mechanically:

- You sign the AAB with the **upload key** (your `.jks`).
- Google re-signs the APKs delivered to users with their own **app signing
  key**.
- If your upload key ever leaks, you can rotate it. The app signing key
  stays the same, so user upgrades still work seamlessly.

This is now the default for new apps and there's no good reason to opt
out.

## Each release

```bash
cd android-app

# 1. Bump the version. Two fields in app/build.gradle.kts:
#    versionCode = N (integer, must increase every upload)
#    versionName = "X.Y.Z" (semantic, shown to users)
# Play Console rejects re-uploads with the same versionCode.

# 2. Build the AAB.
./scripts/build-release.sh
# or, if you want a sideloadable APK too:
./scripts/build-release.sh --apk

# 3. Sanity check.
ls -lh dist/
# fat-orange-cat-v0.1.0-1.aab     ~5 MB
# (~5 MB is normal for a Compose app with WebView; AAB does on-device split)

# 4. Upload to Play Console.
# https://play.google.com/console/  ->  Fat Orange Cat
# -> Production -> Create new release -> upload the .aab
# -> fill in "What's new in this version" -> save -> review -> rollout

# 5. Tag the release locally.
git tag v$(grep -oE 'versionName *= *"[^"]+"' app/build.gradle.kts | sed -E 's/.*"([^"]+)".*/\1/')
git push origin --tags
```

## Verifying a build

After `bundleRelease` completes, you can inspect the AAB:

```bash
# Confirm it's signed with the right key.
jarsigner -verify -verbose dist/fat-orange-cat-v0.1.0-1.aab

# Or use bundletool to extract APKs and install one for smoke testing:
bundletool build-apks --bundle=dist/fat-orange-cat-v0.1.0-1.aab \
  --output=/tmp/foc.apks --ks=keystores/fat-orange-cat.jks \
  --ks-key-alias=fat-orange-cat
bundletool install-apks --apks=/tmp/foc.apks
```

(`bundletool` is a separate Google download, optional.)

## Common failures

- **"`keystore.properties is missing`" from `build-release.sh`** — you didn't
  copy the template. Run `cp keystore.properties.template keystore.properties`
  and fill it in.
- **"Failed to read key" / "Wrong password"** — the `keyPassword` or
  `storePassword` in `keystore.properties` doesn't match what you set with
  `keytool`. Re-check both.
- **"Version code XX has already been used"** in Play Console — bump
  `versionCode` in `app/build.gradle.kts` and rebuild. The integer must
  strictly increase across all uploads.
- **"App Bundle was signed with the wrong key"** — you uploaded an AAB
  signed with a different keystore than the one Play has on file. If this
  is intentional (rotating keys), you have to go through Google's
  upload-key reset flow first.
- **"INSTALL_FAILED_VERSION_DOWNGRADE" when sideloading** — a release APK
  with `applicationIdSuffix` (debug builds) won't conflict, but if you
  install a release APK over a debug install with the same applicationId,
  uninstall first.

## Why AAB, not APK

Google Play has required AAB for new apps since August 2021. The AAB
format ships per-language, per-density, per-ABI APK splits to each
device. The user downloads ~30% less than they would with a universal
APK. For Fat Orange Cat the savings are minimal (it's tiny), but Play
won't accept anything else for new uploads.

For local testing, `--apk` produces a universal release-signed APK you
can `adb install`.
