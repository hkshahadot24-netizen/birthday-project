# Birthday Celebration & Admin Platform — Multi-user Google Login

## Features
- Google/Gmail popup authentication (any Google account can sign in).
- First successful sign-in automatically creates `users/{uid}` profile with display name, Gmail, profile photo, created timestamp and last login timestamp.
- Each account has a private workspace. The Admin home page shows only its own birthday projects.
- Every wish stores `ownerUid`; Firestore rules enforce ownership for listing, editing and deleting.
- Public wish viewer remains available through shareable URLs.
- QR download, copy link, preview, edit, delete, cake/candles, synthesized music and fireworks.

## Firebase project configuration
The supplied Firebase config is already placed in `firebase-config.js` for project `birthday-wish-15e13`.

## Firebase setup
1. Firebase Console > Authentication > Sign-in method > enable **Google**.
2. Choose a support email for the Google provider.
3. Authentication > Settings > Authorized domains: add the domain where the app is hosted. Localhost is typically included for local testing.
4. Create/enable Firestore Database.
5. Open Firestore Database > Rules, paste the complete `firestore.rules` from this ZIP and Publish.

There is no fixed administrator Gmail allowlist. Any Google account that successfully authenticates receives its own profile and can create/manage only its own projects.

## Data structure
- `users/{firebaseAuthUid}`: `uid`, `displayName`, `email`, `photoURL`, `createdAt`, `lastLoginAt`
- `wishes/{uniqueSlug}`: `ownerUid`, `slug`, `recipientName`, `age`, `birthDate`, `message`, `photoUrl`, `createdAt`, `updatedAt`

## Run locally
Serve the folder over HTTP (ES modules do not run correctly from file://):
```bash
python -m http.server 8000
```
Open `http://localhost:8000/admin.html`.

## Important migration note for previously created projects
The earlier single-admin version saved wish documents without `ownerUid`. Those old documents will not appear in any user's personal project list and cannot be edited/deleted under the new ownership rules. To migrate, use a trusted admin process to add the correct `ownerUid` to each old wish document in Firestore. Do not make ownership fields editable by public clients.

## Security notes
- Firestore rules—not the JavaScript UI—enforce account isolation.
- The `wishes` query is scoped by `where("ownerUid", "==", currentUser.uid)`.
- Public users can `get` an individual wish document for a share link, but cannot list the collection or write documents.
- Never expose Firebase service account credentials in frontend code.
- Enable Firebase App Check, use HTTPS, configure authorized domains, and monitor Firestore usage before production.
- A slug is globally unique because it is the Firestore document ID. If another account already owns it, the new account must choose a different slug.
