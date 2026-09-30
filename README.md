# iSide

iSide is a Vercel-ready IPA installer frontend and Home Screen PWA manager.

## Current working features

- Professional responsive iSide interface.
- iPhone/iPad-first flow that asks the user to add iSide to the Home Screen before choosing an IPA.
- Local IPA inspection in the browser:
  - app display name
  - bundle identifier
  - version/build
  - minimum iOS version
  - app icon when a usable PNG is present
- Optional GitHub repository source for update tracking.
- iSide Manager stores managed-app records locally on the device.
- GitHub release checks for apps where the user supplied a repository.
- Signing-authority status / expiry display when returned by the signing backend.
- Notification permission and on-open/manual update/expiry notifications.
- PWA manifest and service worker.
- SEO metadata, robots and sitemap.

## Important boundary

The website does **not** contain or ship signing certificates, private keys, leaked enterprise credentials, or Apple Account passwords. Native iOS installation still requires an authorized signing/provisioning service.

The UI intentionally reports **Signing service not connected** until the two server-side signing environment variables are configured.

## Signing backend contract

iSide avoids sending a large IPA through a Vercel Serverless Function. The frontend first creates a small signing session, then uploads the IPA directly to storage supplied by your signing backend.

### 1. Create session

`POST /v1/signing/session`

Request example:

```json
{
  "app": {
    "name": "Example",
    "bundleId": "com.example.app",
    "version": "1.0.0",
    "build": "1"
  },
  "updateSource": {
    "type": "github",
    "repo": "owner/repository"
  }
}
```

Response:

```json
{
  "sessionId": "unique-id",
  "uploadUrl": "https://object-storage.example/presigned-upload",
  "uploadMethod": "PUT",
  "uploadHeaders": {}
}
```

### 2. Start signing

`POST /v1/signing/complete`

```json
{ "sessionId": "unique-id" }
```

Response:

```json
{ "status": "processing" }
```

### 3. Poll status

`GET /v1/signing/status?sessionId=unique-id`

Processing:

```json
{ "status": "processing" }
```

Ready:

```json
{
  "status": "ready",
  "installUrl": "YOUR_IOS_INSTALL_URL",
  "signing": {
    "authority": "Display name",
    "status": "valid",
    "expiresAt": "2026-12-31T23:59:59Z"
  }
}
```

The backend is responsible for returning an installation URL that is valid for the signing/provisioning method it is authorized to use.

## Vercel deployment

1. Import `anshdeepofficial1/iSide` into Vercel.
2. Framework preset: **Next.js**.
3. Root directory: repository root.
4. Add `NEXT_PUBLIC_SITE_URL`.
5. Add signing variables only when the real signing service exists:
   - `ISIDE_SIGNING_API_URL`
   - `ISIDE_SIGNING_API_TOKEN`
6. Deploy.

Without the signing variables, the site still deploys and IPA analysis + Manager work, but native Sign & Install remains disabled honestly.

## Notifications

The current PWA can show notifications when the Manager is open/checking. Reliable notifications while the PWA is completely closed require a Web Push subscription backend. That should be the next server-side phase rather than pretending client JavaScript can schedule permanent iOS notifications.
