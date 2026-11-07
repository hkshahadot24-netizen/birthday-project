# Birthday Celebration & Admin Platform — Multi-user + GitHub Assets

## Preserved platform features
- Google popup authentication (any Google account can sign in).
- Automatic private profile creation at `users/{uid}`.
- Each account sees and manages only its own birthday projects.
- Shareable live birthday pages, QR download, copy link, preview, edit and delete.
- Cake/candle interaction, fireworks and original synthesized celebration tune.
- Optional uploaded audio playback and public attachment link.

## Firebase project
The supplied Firebase configuration is retained in `firebase-config.js` for project `birthday-wish-15e13`.

### Authentication
1. Firebase Console → Authentication → Sign-in method → enable Google.
2. Set a support email and add your hosting domain under Authorized domains.

### Cloud Firestore Rules
Publish the complete contents of `firestore.rules` in Firebase Console → Firestore Database → Rules.
- Public visitors can read one exact wish document for a shared URL.
- Signed-in users can list, create, update and delete only their own wishes.
- User profiles are private and each user can access only their own profile.

### Realtime Database Rules
The current application does not use Firebase Realtime Database. To avoid accidentally exposing an unused database, publish `database.rules.json` in Realtime Database → Rules. It denies all reads and writes. If RTDB is added later, define a dedicated data schema and least-privilege rules first.

## GitHub Assets upload via Cloudflare Worker
Target repository: `hkshahadot24-netizen/birthday-project` (branch `main`). Uploaded assets are placed under:
- `Assets/Images/{firebase-uid}/...`
- `Assets/Audio/{firebase-uid}/...`
- `Assets/Files/{firebase-uid}/...`

The browser sends the current Firebase ID token to the Worker. The Worker verifies the token signature and Firebase project claims before accepting the upload. The GitHub token is never sent to the browser; store it as a Cloudflare Worker Secret named `GITHUB_TOKEN`.

### Deploy the Worker (Cloudflare Dashboard — no local tooling required)
1. Open Cloudflare Dashboard → Workers & Pages → Create → Worker.
2. Name it `birthday-assets-uploader` and deploy a starter Worker.
3. Open the Worker → Edit code. Copy all code from `cloudflare-worker/src/index.js` in this project and replace the starter code. Save and Deploy.
4. Open Worker → Settings → Variables and Secrets → Add a Secret:
   - Name: `GITHUB_TOKEN`
   - Value: a GitHub fine-grained personal access token.
5. The GitHub token must be limited to repository `birthday-project` and have **Contents: Read and write** permission. Do not place it in this project or commit it.
6. In Worker Settings → Variables, add these values if they are not already in `wrangler.toml`:
   - `GITHUB_OWNER` = `hkshahadot24-netizen`
   - `GITHUB_REPO` = `birthday-project`
   - `GITHUB_BRANCH` = `main`
   - `FIREBASE_PROJECT_ID` = `birthday-wish-15e13`
   - `ALLOWED_ORIGINS` = `https://hkshahadot24-netizen.github.io,http://localhost:8000,http://127.0.0.1:8000`
7. Save and deploy. Copy the Worker URL, e.g. `https://birthday-assets-uploader.<your-subdomain>.workers.dev`.
8. The deployed Worker URL is already filled in `upload-config.js` as `https://birthday-assets-uploader.hkshahadot24.workers.dev` (without `/upload`). If you ever rename the Worker, update that value and commit the file to GitHub Pages.

### Upload behavior
- Image files → `Assets/Images/` and their URL is inserted into the Photo URL field.
- Audio files → `Assets/Audio/` and their URL is inserted into the Audio URL field. Public wish pages play uploaded audio after the visitor taps Start.
- Supported other files → `Assets/Files/` and their URL is inserted into Attachment URL. Public wish pages show an attachment link.
- Maximum upload size: 8 MB per file.
- Allowed types: Common image/audio formats; PDF, TXT, CSV, ZIP, DOC/DOCX, XLS/XLSX, PPT/PPTX, MP4, MOV and WEBM, plus other non-executable file types with a safe extension. Executable/script/HTML/SVG types are blocked for public-hosting safety.
- Uploads are attributed to the authenticated Firebase UID. GitHub repository branch must be `main`; change `GITHUB_BRANCH` in Worker settings if your default branch differs.

## Local test
Serve the site using a local HTTP server (ES modules do not run from `file://`):
```bash
python -m http.server 8000
```
Open `http://localhost:8000/admin.html`. For local upload testing, `http://localhost:8000` is already included in the Worker CORS allowlist.

## Important
- GitHub Pages deployment can take a short time after an asset commit. The Worker returns the raw GitHub URL, which can be used immediately after GitHub accepts the file.
- The repository must allow the token to write contents. A fine-grained token with access only to this repository is recommended.
- Never expose `GITHUB_TOKEN`, Firebase service-account JSON, or other server credentials in frontend files.
- Existing wishes created before multi-user ownership was added may lack `ownerUid`; migrate those documents using a trusted admin process if they should appear in a user's workspace.
- The public wish viewer intentionally allows direct reads by document ID. Do not store private information in wish documents.


## Latest compatibility fix
The root `index.html` and `admin.html` now both include the signed-in Google profile elements
(`profileName`, `profileEmail`, and `profilePhoto`) required by the workspace renderer.
The profile renderer also checks that these elements exist before updating them.
