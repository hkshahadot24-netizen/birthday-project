# জন্মদিন স্টুডিও — ব্যক্তিগত জন্মদিন উদযাপন প্ল্যাটফর্ম

## যা যা আছে
- যেকোনো Google/Gmail অ্যাকাউন্ট দিয়ে লগইন।
- প্রথম লগইনে স্বয়ংক্রিয় ব্যক্তিগত প্রোফাইল তৈরি।
- প্রত্যেক ব্যবহারকারী শুধু নিজের জন্মদিনের আয়োজন দেখতে, তৈরি, সম্পাদনা ও মুছতে পারবেন।
- প্রতিটি আয়োজনের আলাদা শেয়ার লিংক, QR কোড ও প্রিভিউ।
- বাংলা নাম ও বাংলা শুভেচ্ছাবার্তা।
- জন্মদিনের পাতায় কেক, মোমবাতি, আতশবাজি এবং Web Audio-তে তৈরি Happy Birthday সুর।
- Admin পেজ থেকে ImgBB-তে ছবি আপলোড; ImgBB-এর Direct Image URL স্বয়ংক্রিয়ভাবে `photoUrl` হিসেবে Wish Link-এ সংরক্ষিত হয়।
- Admin ফর্মে কোনো Direct Image URL, Audio URL, Attachment URL বা সাধারণ ফাইল আপলোড ফিল্ড নেই—শুধু ছবি আপলোড করা যায়।

## ImgBB ছবি আপলোড
- `admin.js`-এ দেওয়া ImgBB API Key ব্যবহার করে `https://api.imgbb.com/1/upload`-এ ছবি পাঠানো হয়।
- শুধু image MIME type গ্রহণ করা হয়; সর্বোচ্চ ফাইল সাইজ ৮ MB।
- ছবি আপলোড সফল হলে API response-এর `data.url` (Direct Image URL) preview-তে দেখানো হয় এবং আয়োজন Save করলে Firestore-এর `wishes/{id}.photoUrl`-এ সংরক্ষণ হয়।
- `wish.html` / `wish.js` আগের মতো `photoUrl` পড়ে জন্মদিনের পাতায় ছবি দেখায়। পুরোনো Wish ডকুমেন্টের `photoUrl`-ও কাজ করবে।
- API Key ব্রাউজারের JavaScript-এ থাকায় ওয়েবসাইটের সোর্স থেকে দেখা সম্ভব। এটি ImgBB API Key-এর স্বাভাবিক client-side ব্যবহারের সীমাবদ্ধতা। Key-টির অপব্যবহার নজরে রাখুন; প্রয়োজন হলে ImgBB থেকে key rotate করুন। আরও গোপন রাখতে চাইলে পরবর্তীতে server-side proxy/Cloudflare Worker দিয়ে upload করাতে হবে।

## Firebase সেটআপ
Firebase প্রজেক্ট: `birthday-wish-15e13`

1. Firebase Console → Authentication → Sign-in method থেকে Google চালু করুন।
2. Authentication → Settings → Authorized domains-এ আপনার GitHub Pages / hosting domain যোগ করুন।
3. Firestore Database → Rules-এ এই ZIP-এর `firestore.rules` ফাইলের সম্পূর্ণ কোড Publish করুন।
4. Realtime Database এই অ্যাপ ব্যবহার করে না; `database.rules.json` শুধু অপ্রয়োজনীয় RTDB অ্যাক্সেস বন্ধ রাখে।

### ব্যক্তিগত ডেটা সুরক্ষা
- `users/{uid}` প্রোফাইল শুধু সংশ্লিষ্ট ব্যবহারকারী পড়তে/লিখতে পারবেন।
- `wishes`-এ প্রতিটি নতুন ডকুমেন্টে `ownerUid` থাকে।
- লগইন করা ব্যবহারকারী শুধু নিজের `ownerUid`-এর আয়োজন তালিকাভুক্ত/পরিবর্তন/মুছতে পারবেন।
- শেয়ার লিংকের জন্য নির্দিষ্ট একটি `wishes/{id}` ডকুমেন্ট পাবলিকভাবে পড়া যায়। তাই সেখানে গোপন তথ্য লিখবেন না।

## GitHub Pages / Hosting
রিপোজিটরির root-এ ZIP-এর ফাইলগুলো আপলোড করুন। `index.html` অবশ্যই repository root-এ থাকতে হবে; অতিরিক্ত সাবফোল্ডারে রাখলে root URL-এ 404 দেখাতে পারে।

প্রকাশিত সাইটের URL আপনার hosting domain অনুযায়ী হবে। Firebase Authentication-এর Authorized domains-এ সেই domain যোগ করুন।

## লোকাল টেস্ট
এই ফোল্ডারে টার্মিনাল খুলে চালান:
```bash
python -m http.server 8000
```
তারপর `http://localhost:8000/` খুলুন। Google Login কাজ করাতে Firebase Authentication-এ `localhost` Authorized domain হিসেবে যোগ করুন।

## পুরোনো ডেটা ও সামঞ্জস্য
- আগে তৈরি Wish ডকুমেন্টে `ownerUid` না থাকলে সেগুলো ব্যক্তিগত তালিকায় আসবে না। সঠিক মালিকানা যাচাই করে `ownerUid` যোগ করতে হবে।
- পুরোনো ডেটায় `audioUrl` বা `attachmentUrl` থাকলে Wish Page সেগুলো প্রদর্শন করতে পারে; নতুন Admin ফর্মে এ ধরনের লিংক যোগ বা পরিবর্তনের কোনো বক্স নেই।
- `upload-config.js` ও `cloudflare-worker/` পুরোনো GitHub Assets upload ব্যবস্থার অবশিষ্ট ফাইল; নতুন Admin uploader এগুলো ব্যবহার করে না।
