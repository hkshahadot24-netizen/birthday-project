import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { uploadConfig } from "./upload-config.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});
const $=id=>document.getElementById(id);
const loginPanel=$("loginPanel"),appPanel=$("appPanel"),form=$("wishForm");
let editingId=null;

function slugify(value){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);}
function safeText(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function shareUrl(id){return new URL(`./wish.html?id=${encodeURIComponent(id)}`,location.href).href;}

$("googleLoginBtn").onclick=async()=>{
  $("loginError").textContent="Opening Google sign-in...";
  try{await signInWithPopup(auth,provider);}
  catch(err){$("loginError").textContent=err.code==="auth/popup-closed-by-user"?"Sign-in window was closed.":err.message;}
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
    $("loginError").textContent=`Could not open your workspace: ${err.message||"Please try again."}`;
    appPanel.classList.add("hidden");loginPanel.classList.remove("hidden");
  }
});

async function createOrUpdateProfile(user){
  const ref=doc(db,"users",user.uid),snap=await getDoc(ref);
  const profile={
    uid:user.uid,
    displayName:user.displayName||"Google user",
    email:user.email||"",
    photoURL:user.photoURL||null,
    lastLoginAt:serverTimestamp()
  };
  if(!snap.exists())profile.createdAt=serverTimestamp();
  await setDoc(ref,profile,{merge:true});
}
function renderProfile(user){
  $("profileName").textContent=user.displayName||"Google user";
  $("profileEmail").textContent=user.email||"";
  $("profilePhoto").src=user.photoURL||`https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName||"User")}&background=312e81&color=fff`;
}

$("recipientName").addEventListener("input",()=>{if(!editingId&&!$("slug").dataset.manual)$("slug").value=slugify($("recipientName").value);});
$("slug").addEventListener("input",()=>{$("slug").dataset.manual="1";});
$("resetBtn").onclick=()=>{form.reset();editingId=null;$("slug").dataset.manual="";$("saveBtn").textContent="✨ Create birthday page";$("formStatus").textContent="";};

form.addEventListener("submit",async e=>{
  e.preventDefault();const user=auth.currentUser;if(!user)return;
  const name=$("recipientName").value.trim(),id=$("slug").value.trim(),photo=$("photoUrl").value.trim();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)){$("formStatus").textContent="Use a valid ID: lowercase letters, numbers and hyphens.";return;}
  if(photo&&!/^https:\/\/\S+$/i.test(photo)){$("formStatus").textContent="Photo URL must start with https://";return;}
  const data={ownerUid:user.uid,recipientName:name,age:$("age").value?Number($("age").value):null,birthDate:$("birthDate").value||null,message:$("message").value.trim(),photoUrl:photo||null,audioUrl:$("audioUrl").value.trim()||null,attachmentUrl:$("attachmentUrl").value.trim()||null,slug:id,updatedAt:serverTimestamp()};
  if(!name||!data.message){$("formStatus").textContent="Name and message are required.";return;}
  $("saveBtn").disabled=true;$("formStatus").textContent="Saving...";
  try{
    const ref=doc(db,"wishes",id),existing=await getDoc(ref);
    if(existing.exists()&&existing.data().ownerUid!==user.uid)throw new Error("This share ID is already used by another account. Choose another ID.");
    if(existing.exists()&&editingId!==id)throw new Error("That share ID is already in your workspace. Choose another.");
    if(editingId&&editingId!==id)throw new Error("Changing an existing share ID is disabled to protect old links.");
    if(!existing.exists())data.createdAt=serverTimestamp();
    await setDoc(ref,data,{merge:true});
    $("formStatus").textContent="Saved successfully.";form.reset();editingId=null;$("slug").dataset.manual="";$("saveBtn").textContent="✨ Create birthday page";await loadWishes(user.uid);
  }catch(err){$("formStatus").textContent=err.message||"Could not save this project.";}
  finally{$("saveBtn").disabled=false;}
});

async function loadWishes(uid){
  const q=query(collection(db,"wishes"),where("ownerUid","==",uid));
  const snap=await getDocs(q);
  const items=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  $("projectCount").textContent=`${items.length} project${items.length===1?"":"s"}`;
  $("wishRows").innerHTML=items.length?items.map(w=>`<tr class="border-b border-white/10 align-top">
    <td class="py-4 pr-3"><div class="font-semibold">${safeText(w.recipientName)}</div><div class="text-xs text-slate-400">${w.age??"—"} years</div></td>
    <td class="py-4 pr-3 font-mono text-cyan-200">${safeText(w.id)}</td>
    <td class="py-4"><div class="flex flex-wrap gap-2">
      <button data-action="copy" data-id="${safeText(w.id)}" class="rounded-lg bg-white/10 px-2 py-1">Copy link</button>
      <button data-action="qr" data-id="${safeText(w.id)}" class="rounded-lg bg-white/10 px-2 py-1">QR</button>
      <button data-action="preview" data-id="${safeText(w.id)}" class="rounded-lg bg-white/10 px-2 py-1">Preview</button>
      <button data-action="edit" data-id="${safeText(w.id)}" class="rounded-lg bg-indigo-500/30 px-2 py-1">Edit</button>
      <button data-action="delete" data-id="${safeText(w.id)}" class="rounded-lg bg-rose-500/20 text-rose-200 px-2 py-1">Delete</button>
    </div></td></tr>`).join(""):'<tr><td colspan="3" class="py-8 text-center text-slate-400">You have not created any birthday projects yet.</td></tr>';
}
$("wishRows").addEventListener("click",async e=>{
  const b=e.target.closest("button[data-action]");if(!b)return;
  const user=auth.currentUser;if(!user)return;
  const id=b.dataset.id,action=b.dataset.action,url=shareUrl(id);
  try{
    if(action==="copy"){await navigator.clipboard.writeText(url);b.textContent="Copied!";setTimeout(()=>b.textContent="Copy link",1300);}
    if(action==="preview")window.open(url,"_blank","noopener,noreferrer");
    if(action==="qr")showQr(url);
    if(action==="delete"&&confirm(`Delete birthday page "${id}"? This cannot be undone.`)){await deleteDoc(doc(db,"wishes",id));await loadWishes(user.uid);}
    if(action==="edit"){
      const s=await getDoc(doc(db,"wishes",id));if(!s.exists()||s.data().ownerUid!==user.uid)return;
      const d=s.data();editingId=id;$("recipientName").value=d.recipientName||"";$("age").value=d.age??"";$("birthDate").value=d.birthDate||"";
      $("message").value=d.message||"";$("photoUrl").value=d.photoUrl||"";$("audioUrl").value=d.audioUrl||"";$("attachmentUrl").value=d.attachmentUrl||"";$("slug").value=id;
      $("saveBtn").textContent="Save changes";$("formStatus").textContent=`Editing ${id}`;window.scrollTo({top:0,behavior:"smooth"});
    }
  }catch(err){alert(err.message||"Action failed.");}
});
function showQr(url){$("qrCanvas").innerHTML="";new QRCode($("qrCanvas"),{text:url,width:240,height:240,colorDark:"#111827",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H});$("qrUrl").textContent=url;$("qrDialog").showModal();}
$("closeQr").onclick=()=>$("qrDialog").close();
$("downloadQr").onclick=()=>{const canvas=$("qrCanvas").querySelector("canvas"),img=$("qrCanvas").querySelector("img"),source=canvas||img;if(!source)return;const a=document.createElement("a");a.href=canvas?canvas.toDataURL("image/png"):img.src;a.download="birthday-qr.png";a.click();};


// Secure GitHub Assets uploader. GitHub credentials live only in Cloudflare Worker secrets.
$("uploadAssetBtn").addEventListener("click", async () => {
  const user=auth.currentUser, file=$("assetFile").files?.[0], status=$("uploadStatus"), btn=$("uploadAssetBtn");
  if(!user){status.textContent="Please sign in first.";return;}
  if(!file){status.textContent="Choose an image, audio or supported file first.";return;}
  if(!uploadConfig.workerUrl || !/^https:\/\//i.test(uploadConfig.workerUrl)){
    status.textContent="Cloudflare Worker URL is missing. Set workerUrl in upload-config.js after deploying the Worker.";return;
  }
  const category=file.type.startsWith("image/")?"Images":file.type.startsWith("audio/")?"Audio":"Files";
  if(file.size>8*1024*1024){status.textContent="File is larger than 8 MB. Please choose a smaller file.";return;}
  btn.disabled=true;status.textContent="Uploading securely to GitHub Assets...";
  try{
    const token=await user.getIdToken(true), body=new FormData();body.append("file",file);body.append("category",category);
    const endpoint=uploadConfig.workerUrl.replace(/\/$/,"")+"/upload";
    const response=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${token}`},body});
    const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||`Upload failed (${response.status}).`);
    if(category==="Images")$("photoUrl").value=result.url;
    else if(category==="Audio")$("audioUrl").value=result.url;
    else $("attachmentUrl").value=result.url;
    status.innerHTML=`Uploaded: <a class="underline text-cyan-200 break-all" target="_blank" rel="noopener" href="${safeText(result.url)}">${safeText(result.path)}</a><br>URL added to the matching project field. Save the birthday project to publish it.`;
    $("assetFile").value="";
  }catch(err){status.textContent=err.message||"Upload failed.";}
  finally{btn.disabled=false;}
});
