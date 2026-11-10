import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { imgbbConfig } from "./imgbb-config.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});
const $=id=>document.getElementById(id);
const loginPanel=$("loginPanel"),appPanel=$("appPanel"),form=$("wishForm");
let editingId=null;
let selectedPhotoFile=null;
let localPhotoPreviewUrl=null;

function slugify(value){
  const slug=value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48);
  // বাংলা নাম থেকে ASCII slug তৈরি না হলে নিরাপদ স্বয়ংক্রিয় আইডি দিন।
  return slug || `birthday-${new Date().toISOString().slice(0,10)}-${Math.random().toString(36).slice(2,7)}`;
}
function safeText(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function shareUrl(id){return new URL(`./wish.html?id=${encodeURIComponent(id)}`,location.href).href;}

$("googleLoginBtn").onclick=async()=>{
  $("loginError").textContent="Google অ্যাকাউন্টে প্রবেশের উইন্ডো খোলা হচ্ছে...";
  try{await signInWithPopup(auth,provider);}
  catch(err){
    const messages={
      "auth/popup-closed-by-user":"লগইন উইন্ডো বন্ধ করা হয়েছে।",
      "auth/unauthorized-domain":"Firebase Authentication-এ এই ওয়েবসাইটের ডোমেইন অনুমোদন করুন।",
      "auth/popup-blocked":"ব্রাউজার পপ-আপ আটকে দিয়েছে। পপ-আপ অনুমতি দিয়ে আবার চেষ্টা করুন।",
      "auth/network-request-failed":"ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
      "auth/operation-not-allowed":"Firebase Console থেকে Google Sign-in চালু করুন।"
    };
    $("loginError").textContent=messages[err.code]||`লগইন করা যায়নি: ${err.message}`;
  }
};
$("logoutBtn").onclick=()=>signOut(auth);

onAuthStateChanged(auth,async user=>{
  if(!user){loginPanel.classList.remove("hidden");appPanel.classList.add("hidden");$("logoutBtn").classList.add("hidden");return;}
  try{
    await createOrUpdateProfile(user);
    renderProfile(user);
    loginPanel.classList.add("hidden");appPanel.classList.remove("hidden");$("logoutBtn").classList.remove("hidden");
    await loadWishes(user.uid);
  }catch(err){
    $("loginError").textContent=`আপনার ব্যক্তিগত ড্যাশবোর্ড খোলা যায়নি: ${err.message||"আবার চেষ্টা করুন।"}`;
    appPanel.classList.add("hidden");loginPanel.classList.remove("hidden");
  }
});

async function createOrUpdateProfile(user){
  const ref=doc(db,"users",user.uid),snap=await getDoc(ref);
  const profile={
    uid:user.uid,
    displayName:user.displayName||"Google ব্যবহারকারী",
    email:user.email||"",
    photoURL:user.photoURL||null,
    lastLoginAt:serverTimestamp()
  };
  if(!snap.exists())profile.createdAt=serverTimestamp();
  await setDoc(ref,profile,{merge:true});
}
function renderProfile(user){
  const name = user.displayName || "Google ব্যবহারকারী";
  const nameEl = $("profileName");
  const emailEl = $("profileEmail");
  const photoEl = $("profilePhoto");
  // Keep the workspace resilient if a profile element is omitted in a future layout edit.
  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = user.email || "";
  if (photoEl) {
    photoEl.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=312e81&color=fff`;
    photoEl.alt = `${name} profile photo`;
  }
}

$("recipientName").addEventListener("input",()=>{if(!editingId&&!$("slug").dataset.manual)$("slug").value=slugify($("recipientName").value);});
$("slug").addEventListener("input",()=>{$("slug").dataset.manual="1";});
$("resetBtn").onclick=()=>{form.reset();editingId=null;selectedPhotoFile=null;clearLocalPhotoPreview();$("photoUrl").value="";$("photoDeleteUrl").value="";renderPhotoPreview("");$("slug").dataset.manual="";$("saveBtn").textContent="✨ জন্মদিনের পাতা তৈরি করুন";$("formTitle").textContent="নতুন শুভেচ্ছা তৈরি করুন";$("formStatus").textContent="";$("uploadStatus").textContent="";};

form.addEventListener("submit",async e=>{
  e.preventDefault();const user=auth.currentUser;if(!user)return;
  const name=$("recipientName").value.trim(),id=$("slug").value.trim(),photo=$("photoUrl").value.trim();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)){$("formStatus").textContent="সঠিক শেয়ার আইডি দিন। ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও হাইফেন ব্যবহার করুন।";return;}
  if(photo&&!/^https:\/\/\S+$/i.test(photo)){$("formStatus").textContent="ছবির লিংক https:// দিয়ে শুরু হতে হবে।";return;}
  const data={ownerUid:user.uid,eventName:"শুভ জন্মদিন",recipientName:name,senderName:$("senderName").value.trim(),age:$("age").value?Number($("age").value):null,birthDate:$("birthDate").value||null,message:$("message").value.trim(),photoUrl:photo||null,photoDeleteUrl:$("photoDeleteUrl").value.trim()||null,audioUrl:$("audioUrl").value.trim()||null,attachmentUrl:$("attachmentUrl").value.trim()||null,slug:id,updatedAt:serverTimestamp()};
  if(!name||!data.senderName||!data.message){$("formStatus").textContent="জন্মদিনের নাম, প্রেরকের নাম ও শুভেচ্ছাবার্তা লিখুন।";return;}
  $("saveBtn").disabled=true;$("formStatus").textContent="সংরক্ষণ করা হচ্ছে...";
  try{
    const ref=doc(db,"wishes",id),existing=await getDoc(ref);
    if(existing.exists()&&existing.data().ownerUid!==user.uid)throw new Error("এই শেয়ার আইডিটি অন্য একজন ব্যবহার করছেন। অন্য আইডি দিন।");
    if(existing.exists()&&editingId!==id)throw new Error("এই শেয়ার আইডিটি আপনার অন্য একটি আয়োজনে ব্যবহৃত হয়েছে। অন্য আইডি দিন।");
    if(editingId&&editingId!==id)throw new Error("পুরোনো লিংক সচল রাখতে বিদ্যমান শেয়ার আইডি পরিবর্তন করা যাবে না।");
    if(!existing.exists())data.createdAt=serverTimestamp();
    await setDoc(ref,data,{merge:true});
    $("formStatus").textContent="সফলভাবে সংরক্ষণ হয়েছে।";form.reset();editingId=null;selectedPhotoFile=null;clearLocalPhotoPreview();$("photoUrl").value="";$("photoDeleteUrl").value="";renderPhotoPreview("");$("slug").dataset.manual="";$("saveBtn").textContent="✨ জন্মদিনের পাতা তৈরি করুন";$("formTitle").textContent="নতুন শুভেচ্ছা তৈরি করুন";$("uploadStatus").textContent="";await loadWishes(user.uid);
  }catch(err){$("formStatus").textContent=err.message||"আয়োজনটি সংরক্ষণ করা যায়নি।";}
  finally{$("saveBtn").disabled=false;}
});

async function loadWishes(uid){
  const q=query(collection(db,"wishes"),where("ownerUid","==",uid));
  const snap=await getDocs(q);
  const items=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  $("projectCount").textContent=`${items.length}টি আয়োজন`;
  $("wishRows").innerHTML=items.length?items.map(w=>`<article class="rounded-2xl border border-white/10 bg-white/[.035] p-3 sm:p-4">
    <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-[11px] text-pink-300 font-bold">🎂 শুভ জন্মদিন</p><h4 class="font-bold text-lg truncate mt-1">${safeText(w.recipientName)}</h4><p class="text-xs text-slate-400 mt-1">${w.age!==null&&w.age!==undefined?`${w.age} বছর`:'বয়স উল্লেখ নেই'} · ID: <span class="font-mono">${safeText(w.id)}</span></p></div><span class="text-xl">🎈</span></div>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
      <button data-action="copy" data-id="${safeText(w.id)}" class="btn bg-white/10 text-xs">লিংক কপি</button>
      <button data-action="preview" data-id="${safeText(w.id)}" class="btn bg-white/10 text-xs">প্রিভিউ</button>
      <button data-action="qr" data-id="${safeText(w.id)}" class="btn bg-white/10 text-xs">QR কোড</button>
      <button data-action="edit" data-id="${safeText(w.id)}" class="btn bg-indigo-500/20 text-indigo-100 text-xs">সম্পাদনা</button>
      <button data-action="delete" data-id="${safeText(w.id)}" class="btn bg-rose-500/15 text-rose-200 text-xs">মুছে ফেলুন</button>
    </div></article>`).join(''):'<div class="text-center py-10"><div class="text-4xl mb-3">🎂</div><p class="font-semibold">এখনো কোনো জন্মদিনের পাতা তৈরি করেননি</p><p class="text-xs text-slate-400 mt-1">বাম পাশের ফর্ম পূরণ করে প্রথম আয়োজনটি তৈরি করুন।</p></div>';
}
$("wishRows").addEventListener("click",async e=>{
  const b=e.target.closest("button[data-action]");if(!b)return;
  const user=auth.currentUser;if(!user)return;
  const id=b.dataset.id,action=b.dataset.action,url=shareUrl(id);
  try{
    if(action==="copy"){await navigator.clipboard.writeText(url);b.textContent="কপি হয়েছে";setTimeout(()=>b.textContent="লিংক কপি",1300);}
    if(action==="preview")window.open(url,"_blank","noopener,noreferrer");
    if(action==="qr")showQr(url);
    if(action==="delete"&&confirm(`"${id}" জন্মদিনের পাতাটি মুছে ফেলবেন? এটি আর ফিরিয়ে আনা যাবে না।`)){await deleteDoc(doc(db,"wishes",id));await loadWishes(user.uid);}
    if(action==="edit"){
      const s=await getDoc(doc(db,"wishes",id));if(!s.exists()||s.data().ownerUid!==user.uid)return;
      const d=s.data();editingId=id;
      const fields=["recipientName","senderName","age","birthDate","message","photoUrl","audioUrl","attachmentUrl"];
      fields.forEach(k=>{if($(k))$(k).value=d[k]??"";});$("photoDeleteUrl").value=d.photoDeleteUrl||"";selectedPhotoFile=null;clearLocalPhotoPreview();renderPhotoPreview(d.photoUrl||"");$("photoFile").value="";$("uploadStatus").textContent=d.photoUrl?"আগের ছবি সংযুক্ত আছে। নতুন ছবি নির্বাচন করে পরিবর্তন করতে পারবেন।":"";$("slug").value=id;
      $("formTitle").textContent="শুভেচ্ছার পাতা সম্পাদনা করুন";$("saveBtn").textContent="পরিবর্তন সংরক্ষণ করুন";$("formStatus").textContent=`সম্পাদনা করছেন: ${id}`;window.scrollTo({top:0,behavior:"smooth"});
    }
  }catch(err){alert(err.message||"কাজটি সম্পন্ন করা যায়নি।");}
});
function showQr(url){$("qrCanvas").innerHTML="";new QRCode($("qrCanvas"),{text:url,width:240,height:240,colorDark:"#111827",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H});$("qrUrl").textContent=url;$("qrDialog").showModal();}
$("closeQr").onclick=()=>$("qrDialog").close();
$("downloadQr").onclick=()=>{const canvas=$("qrCanvas").querySelector("canvas"),img=$("qrCanvas").querySelector("img"),source=canvas||img;if(!source)return;const a=document.createElement("a");a.href=canvas?canvas.toDataURL("image/png"):img.src;a.download="birthday-qr.png";a.click();};


// ImgBB image-only upload flow. Other file-upload services are intentionally removed.
function clearLocalPhotoPreview(){
  if(localPhotoPreviewUrl){URL.revokeObjectURL(localPhotoPreviewUrl);localPhotoPreviewUrl=null;}
}
function renderPhotoPreview(url){
  const wrap=$("photoPreviewWrap"),img=$("photoPreview"),link=$("photoOpenLink"),deleteBtn=$("deleteHostedPhotoBtn");
  if(url){
    img.src=url;link.href=url;wrap.classList.remove("hidden");
    deleteBtn.classList.toggle("hidden",!$("photoDeleteUrl").value.trim());
  }else{
    img.removeAttribute("src");link.href="#";wrap.classList.add("hidden");deleteBtn.classList.add("hidden");
  }
}
$("photoFile").addEventListener("change",()=>{
  const file=$("photoFile").files?.[0];selectedPhotoFile=file||null;clearLocalPhotoPreview();
  if(!file){renderPhotoPreview($("photoUrl").value);return;}
  if(!file.type.startsWith("image/")){$("uploadStatus").textContent="শুধু ছবির ফাইল নির্বাচন করুন।";$("photoFile").value="";selectedPhotoFile=null;return;}
  if(file.size>32*1024*1024){$("uploadStatus").textContent="ছবির আকার ৩২ MB-এর বেশি। ছোট ছবি নির্বাচন করুন।";$("photoFile").value="";selectedPhotoFile=null;return;}
  localPhotoPreviewUrl=URL.createObjectURL(file);renderPhotoPreview(localPhotoPreviewUrl);
  $("uploadStatus").textContent="প্রিভিউ প্রস্তুত। আপলোড করতে নিচের বোতামে চাপ দিন।";
});
$("removePhotoBtn").addEventListener("click",()=>{
  clearLocalPhotoPreview();selectedPhotoFile=null;$("photoFile").value="";$("photoUrl").value="";$("photoDeleteUrl").value="";
  renderPhotoPreview("");$("uploadStatus").textContent="ছবিটি এই জন্মদিনের পাতা থেকে সরানো হয়েছে। পরিবর্তন স্থায়ী করতে পাতাটি সংরক্ষণ করুন।";
});
$("deleteHostedPhotoBtn").addEventListener("click",()=>{
  const deleteUrl=$("photoDeleteUrl").value.trim();
  if(!deleteUrl){$("uploadStatus").textContent="এই ছবির ImgBB ডিলেট লিংক সংরক্ষিত নেই।";return;}
  if(!confirm("ImgBB-এর ডিলেট পেজ খুলবেন? সেখানে ডিলেট নিশ্চিত করতে হবে।"))return;
  window.open(deleteUrl,"_blank","noopener,noreferrer");
  $("uploadStatus").textContent="ImgBB-এর নতুন ট্যাবে ডিলেট নিশ্চিত করুন। এরপর এখানে ‘ছবি সরান’ চাপ দিয়ে জন্মদিনের পাতাটি সংরক্ষণ করুন।";
});
$("uploadPhotoBtn").addEventListener("click",()=>{
  const user=auth.currentUser,file=selectedPhotoFile,status=$("uploadStatus"),btn=$("uploadPhotoBtn");
  if(!user){status.textContent="আগে Google অ্যাকাউন্ট দিয়ে প্রবেশ করুন।";return;}
  if(!file){status.textContent="প্রথমে একটি ছবি নির্বাচন করুন।";return;}
  if(!imgbbConfig.apiKey){status.textContent="ImgBB API Key পাওয়া যায়নি। imgbb-config.js পরীক্ষা করুন।";return;}
  if(file.size>32*1024*1024){status.textContent="ছবির আকার ৩২ MB-এর বেশি।";return;}
  btn.disabled=true;$("uploadProgressWrap").classList.remove("hidden");$("uploadProgressBar").style.width="0%";$("uploadProgressText").textContent="আপলোড শুরু হচ্ছে...";status.textContent="ImgBB-তে ছবি আপলোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...";
  const body=new FormData();body.append("image",file,file.name);
  const xhr=new XMLHttpRequest();xhr.open("POST",`https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbConfig.apiKey)}`);
  xhr.responseType="json";xhr.upload.onprogress=e=>{
    if(e.lengthComputable){const pct=Math.round(e.loaded/e.total*100);$("uploadProgressBar").style.width=pct+"%";$("uploadProgressText").textContent=`আপলোড হচ্ছে: ${pct}%`;}
    else $("uploadProgressText").textContent="ছবি আপলোড হচ্ছে...";
  };
  xhr.onload=()=>{
    try{
      const result=xhr.response||JSON.parse(xhr.responseText||"{}");
      if(xhr.status<200||xhr.status>=300||!result.success||!result.data?.url)throw new Error(result.error?.message||`ImgBB আপলোড ব্যর্থ হয়েছে (HTTP ${xhr.status})।`);
      clearLocalPhotoPreview();$("photoUrl").value=result.data.url;$("photoDeleteUrl").value=result.data.delete_url||"";
      selectedPhotoFile=null;$("photoFile").value="";renderPhotoPreview(result.data.url);
      $("uploadProgressBar").style.width="100%";$("uploadProgressText").textContent="আপলোড সম্পন্ন: ১০০%";
      status.textContent="ছবি সফলভাবে আপলোড হয়েছে এবং জন্মদিনের পাতায় যুক্ত হয়েছে। পরিবর্তন স্থায়ী করতে পাতাটি সংরক্ষণ করুন।";
    }catch(err){status.textContent=err.message||"ছবি আপলোড করা যায়নি।";}
    finally{btn.disabled=false;}
  };
  xhr.onerror=()=>{status.textContent="নেটওয়ার্ক সমস্যার কারণে আপলোড হয়নি। ইন্টারনেট পরীক্ষা করে আবার চেষ্টা করুন।";btn.disabled=false;};
  xhr.onabort=()=>{status.textContent="আপলোড বাতিল করা হয়েছে।";btn.disabled=false;};
  xhr.send(body);
});
