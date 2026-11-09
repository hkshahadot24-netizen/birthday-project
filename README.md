# জন্মদিন স্টুডিও — ব্যক্তিগত জন্মদিন উদযাপন প্ল্যাটফর্ম

## যা যা আছে
- যেকোনো Google/Gmail অ্যাকাউন্ট দিয়ে নিরাপদ লগইন।
- প্রথম লগইনে স্বয়ংক্রিয় ব্যক্তিগত প্রোফাইল তৈরি।
- সফল লগইনের সময়, ডিভাইস/ব্রাউজার, ভাষা ও টাইমজোনসহ ব্যক্তিগত লগইন ইতিহাস সংরক্ষণ এবং ড্যাশবোর্ডে সর্বশেষ ১০টি এন্ট্রি দেখা।
- প্রত্যেক ব্যবহারকারী শুধু নিজের জন্মদিনের আয়োজন দেখতে, তৈরি, সম্পাদনা ও মুছতে পারবেন।
- প্রতিটি আয়োজনের আলাদা শেয়ার লিংক, QR কোড, প্রিভিউ।
- বাংলা নাম ও বাংলা শুভেচ্ছাবার্তা।
- জন্মদিনের পাতায় কেক, মোমবাতি, আতশবাজি এবং "Happy Birthday to You" সুর।
- ইচ্ছা করলে নিজস্ব অডিও ও অতিরিক্ত ফাইলের লিংক ব্যবহার।
- ছবি, অডিও ও ফাইল GitHub রিপোজিটরির `Assets` ফোল্ডারে আপলোড।

## Firebase সেটআপ
Firebase প্রজেক্ট: `birthday-wish-15e13`

1. Firebase Console → Authentication → Sign-in method থেকে Google চালু করুন।
2. Authentication → Settings → Authorized domains-এ `hkshahadot24-netizen.github.io` যোগ করুন।
3. Firestore Database → Rules-এ এই ZIP-এর `firestore.rules` ফাইলের সম্পূর্ণ কোড Publish করুন।
4. Realtime Database এই অ্যাপ ব্যবহার করে না; `database.rules.json` শুধু অপ্রয়োজনীয় RTDB অ্যাক্সেস বন্ধ রাখে।

### ব্যক্তিগত ডেটা সুরক্ষা
- `users/{uid}` প্রোফাইল শুধু সংশ্লিষ্ট ব্যবহারকারী পড়তে/লিখতে পারবেন।
- `users/{uid}/loginHistory/{entryId}` ইতিহাস শুধু সংশ্লিষ্ট ব্যবহারকারী পড়তে পারবেন; নতুন এন্ট্রি তৈরি করা যাবে, পুরোনো এন্ট্রি ক্লায়েন্ট থেকে পরিবর্তন/মুছতে পারবে না।
- `wishes`-এ প্রতিটি নতুন ডকুমেন্টে `ownerUid` থাকে।
- লগইন করা ব্যবহারকারী শুধু নিজের `ownerUid`-এর আয়োজন তালিকাভুক্ত/পরিবর্তন/মুছতে পারবেন।
- শেয়ার লিংকের জন্য নির্দিষ্ট একটি `wishes/{id}` ডকুমেন্ট পাবলিকভাবে পড়া যায়। তাই সেখানে গোপন তথ্য লিখবেন না।


### নির্ধারিত ঠিকানা
- Worker: `https://birthday-assets-uploader.hkshahadot24.workers.dev`
- Upload API: `https://birthday-assets-uploader.hkshahadot24.workers.dev/upload`
- GitHub repository: `hkshahadot24-netizen/birthday-project`
- Branch: `main`
- Firebase project: `birthday-wish-15e13`


### Cloudflare-এ যা যাচাই করবেন
Cloudflare Dashboard → Workers & Pages → `birthday-assets-uploader` → Settings → Variables and Secrets:

**Variables**
- `GITHUB_OWNER` = `hkshahadot24-netizen`
- `GITHUB_REPO` = `birthday-project`
- `GITHUB_BRANCH` = `main`
- `FIREBASE_PROJECT_ID` = `birthday-wish-15e13`
- `ALLOWED_ORIGINS` = `https://hkshahadot24-netizen.github.io,http://localhost:8000,http://127.0.0.1:8000`

**Secret**
- `GITHUB_TOKEN` = আপনার GitHub Fine-grained Personal Access Token

GitHub Token-এর জন্য:
1. Repository access-এ শুধু `birthday-project` নির্বাচন করুন।
2. Repository permissions → Contents → **Read and write** দিন।

### Worker কোড আপডেট
এই ZIP-এর `cloudflare-worker/src/index.js` ফাইলের সম্পূর্ণ কোড কপি করুন।
Cloudflare Dashboard → Workers & Pages → `birthday-assets-uploader` → Edit code-এ পুরোনো কোড সম্পূর্ণ বদলে নতুন কোড Paste করে **Deploy** করুন।
Dashboard-এর Variables/Secret মুছবেন না; শুধু কোড Deploy করুন।

### আপলোডের গন্তব্য

সর্বোচ্চ ফাইল সাইজ ৮ MB। সফল আপলোড হলে ফাইলের URL স্বয়ংক্রিয়ভাবে সংশ্লিষ্ট Photo / Audio / Attachment ঘরে বসবে। এরপর জন্মদিনের আয়োজনটি Save করতে হবে।

### আপলোড ব্যর্থ হলে
নতুন Worker কোড Deploy করার পর অ্যাপ থেকে আবার আপলোড করুন। ত্রুটির বার্তায় HTTP Status দেখাবে:
- **401**: লগইন টোকেন অনুপস্থিত/মেয়াদোত্তীর্ণ — আবার Google Login করুন।
- **403 / Origin**: `ALLOWED_ORIGINS`-এ সাইটের ঠিকানা হুবহু যোগ করুন। URL-এ শেষে `/` দেবেন না।
- **502 / GitHub 401**: `GITHUB_TOKEN` ভুল বা মেয়াদোত্তীর্ণ।
- **502 / GitHub 403**: Token-এ `birthday-project` রিপোজিটরির Contents: Read and write অনুমতি নেই অথবা rate limit।
- **502 / GitHub 404**: Owner, Repository বা Branch-এর নাম ভুল।
- **413**: ফাইল ৮ MB-এর বেশি।
- **415**: ফাইলের ধরন অনুমোদিত নয়।

## GitHub Pages
রিপোজিটরির `birthday-project`-এর `main` branch-এ এই ZIP-এর ভেতরের ফাইলগুলো আপলোড করুন। `index.html` অবশ্যই repository root-এ থাকতে হবে; `birthday-celebration-platform/` নামে অতিরিক্ত সাবফোল্ডারের ভেতরে থাকলে root URL-এ 404 দেখাতে পারে।

প্রকাশিত সাইট:
`https://hkshahadot24-netizen.github.io/birthday-project/`

## লোকাল টেস্ট
এই ফোল্ডারে টার্মিনাল খুলে চালান:
```bash
python -m http.server 8000
```
তারপর `http://localhost:8000/` খুলুন।

## পুরোনো ডেটা
মাল্টি-ইউজার ব্যবস্থা চালুর আগে তৈরি পুরোনো wish ডকুমেন্টে `ownerUid` না থাকলে সেগুলো ব্যক্তিগত তালিকায় আসবে না। সঠিক মালিকানা যাচাই করে Trusted Admin প্রক্রিয়ায় `ownerUid` যোগ না করা পর্যন্ত সেগুলো পরিবর্তনযোগ্য নয়।


## ছবি আপলোড (imgbb)

- ড্যাশবোর্ডে শুধু ছবি আপলোডের সুবিধা রাখা হয়েছে।
- ছবি নির্বাচন করে **ছবি আপলোড করুন** চাপলে সরাসরি imgbb-তে আপলোড হবে; আলাদা করে কোনো ছবি-লিংক লিখতে হবে না।
- সর্বোচ্চ ফাইল সাইজ ৮ MB।
- imgbb API key `admin.js`-এ ব্যবহৃত হয়েছে। ব্রাউজার থেকে সরাসরি আপলোডের ক্ষেত্রে API key ব্যবহারকারীর কাছে দৃশ্যমান হতে পারে; প্রয়োজন হলে imgbb ড্যাশবোর্ড থেকে key rotate করুন এবং production-এ server-side proxy ব্যবহার করুন।
- আগের তৈরি birthday wish-এ সংরক্ষিত `photoUrl`, `audioUrl` ও `attachmentUrl` ডেটা অক্ষত থাকবে; নতুন admin form-এ আর audio/document upload বা URL entry দেখানো হবে না।
