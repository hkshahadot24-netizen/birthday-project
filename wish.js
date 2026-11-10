import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage, ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";
const app=initializeApp(firebaseConfig),db=getFirestore(app),storage=getStorage(app),$=id=>document.getElementById(id);
const id=new URLSearchParams(location.search).get("id");
function showError(msg){$("recipientName").textContent="আয়োজনটি পাওয়া যায়নি";$("customMessage").textContent=msg;$("ageLine").textContent="";document.title="Birthday page not found";}
if(!id||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(id)){showError("জন্মদিনের লিংকটি সঠিক নয়। অনুগ্রহ করে লিংকটি পরীক্ষা করুন।");}
else{
  onSnapshot(doc(db,"wishes",id),async snap=>{
    if(!snap.exists()){showError("জন্মদিনের পাতাটি মুছে ফেলা হয়েছে অথবা লিংকটি ভুল।");return;}
    const d=snap.data();
    const textDefaults={topLabel:"বিশেষ একটি দিন • বিশেষ একজন মানুষ",greetingTitle:"শুভ জন্মদিন",overlayTitle:"একটি সুন্দর চমক অপেক্ষা করছে!",overlayMessage:"নিচের বোতামে চাপ দিয়ে আয়োজন, গান ও আতশবাজি শুরু করুন।",startButtonText:"🎉 উদযাপন শুরু করুন",overlayNote:"আপনি বোতামে চাপ দেওয়ার পরই গান বাজবে।",ageText:"বছর পূর্তির আনন্দ উদযাপন",attachmentLabel:"📎 সংযুক্ত ফাইল খুলুন",cakeTitle:"মনের ইচ্ছা পূরণের কামনা করুন ✨",cakeInstruction:"প্রতিটি মোমবাতিতে চাপ দিন অথবা সবগুলো নিভিয়ে দিন।",blowButtonText:"🌬️ সব মোমবাতি নিভিয়ে দিন",relightButtonText:"🕯️ আবার জ্বালান",cakeMessageText:"মনে মনে একটি ইচ্ছা করুন, তারপর মোমবাতি নিভিয়ে দিন!",footerText:"ভালোবাসায় তৈরি ❤️ আপনার বিশেষ দিনের জন্য"};
    // রিসিভার পেইজটি স্থায়ীভাবে জন্মদিনের থিমে থাকবে; ড্যাশবোর্ডে অতিরিক্ত কনটেন্ট কাস্টমাইজেশন নেই।
    $("recipientName").textContent=d.recipientName||"আপনাকে!";
    const senderName=(d.senderName||"").trim();
    $("senderNameDisplay").textContent=senderName;
    $("senderNameDisplay").style.display=senderName?"":"none";
    $("customMessage").textContent=d.message||"হোক না এই বিশেষ দিন আপনার জন্যই আনন্দময়, সুখ ও সফলতায় ভরা।";
    $("ageLine").textContent=d.age!==null&&d.age!==undefined?`${d.age} ${textDefaults.ageText}`:"";
    document.title=`শুভ জন্মদিন — ${d.recipientName||""}`;
    if(d.attachmentUrl){$("attachmentLink").href=d.attachmentUrl;$("attachmentLink").classList.remove("hidden");}else{$("attachmentLink").classList.add("hidden");}
    if(d.audioUrl){$("birthdayAudio").src=d.audioUrl;$("birthdayAudio").classList.remove("hidden");}else{$("birthdayAudio").removeAttribute("src");$("birthdayAudio").classList.add("hidden");}
    const photoEl=$("recipientPhoto"),frame=$("photoFrame");
    const hidePhoto=()=>frame.classList.add("hidden");
    const showPhoto=()=>frame.classList.remove("hidden");
    photoEl.onload=showPhoto;
    photoEl.onerror=hidePhoto;
    photoEl.referrerPolicy="no-referrer";
    photoEl.decoding="async";
    photoEl.loading="eager";
    const rawPhoto=typeof d.photoUrl==="string"?d.photoUrl.trim():"";
    if(rawPhoto){
      try{
        let photoUrl=rawPhoto;
        if(photoUrl.startsWith("gs://")){
          photoUrl=await getDownloadURL(storageRef(storage,photoUrl));
        }
        const parsed=new URL(photoUrl,location.href);
        if(!["https:","http:"].includes(parsed.protocol))throw new Error("Unsupported image URL");
        if(parsed.hostname.endsWith("googleusercontent.com")&&parsed.searchParams.has("sz"))parsed.searchParams.set("sz","512");
        photoEl.src=parsed.href;
        if(photoEl.complete&&photoEl.naturalWidth>0)showPhoto();
      }catch(_){hidePhoto();}
    }else{
      photoEl.removeAttribute("src");
      hidePhoto();
    }
  },err=>showError("জন্মদিনের আয়োজনটি লোড করা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।"));
}

// Candles: touch, manual blow button, or real microphone blow detection.
const candleNodes=[...document.querySelectorAll(".candle")];
let micStream=null,micContext=null,micFrame=0,micActive=false,blowStartedAt=0;
let wishHideTimer=0, extinguishedCount=0;
const candleWishes=[
  "আপনার জীবনের প্রতিটি সকাল বয়ে আনুক নতুন আশা ও আনন্দ।",
  "আপনার সব স্বপ্ন একে একে সত্যি হয়ে উঠুক।",
  "সুস্থতা, শান্তি ও ভালোবাসায় ভরে উঠুক প্রতিটি দিন।",
  "আপনার প্রতিটি পদক্ষেপে আসুক সাফল্য ও সম্মান।",
  "হাসি, সুখ আর প্রিয়জনের ভালোবাসা থাকুক সারাজীবন।"
];
function showCandleWish(){
  const pop=$("candleWishPop"),text=$("candleWishText");
  if(!pop||!text)return;
  const wish=candleWishes[Math.min(extinguishedCount,candleWishes.length-1)];
  extinguishedCount++;
  text.textContent=wish;
  pop.classList.remove("show");
  // restart the entrance transition for every candle.
  void pop.offsetWidth;
  pop.classList.add("show");
  clearTimeout(wishHideTimer);
  wishHideTimer=setTimeout(()=>pop.classList.remove("show"),4200);
}
function stopMic(message=""){
  micActive=false;
  if(micFrame)cancelAnimationFrame(micFrame);
  micFrame=0;
  if(micStream){micStream.getTracks().forEach(track=>track.stop());micStream=null;}
  if(micContext){micContext.close().catch(()=>{});micContext=null;}
  const btn=$("micBlowBtn");
  if(btn){btn.classList.remove("listening");btn.textContent="🎙️ মাইক্রোফোন চালু করুন";}
  if(message&&$("micStatus"))$("micStatus").textContent=message;
}
function extinguish(c){
  if(!c||c.classList.contains("out"))return;
  c.classList.add("out");
  showCandleWish();
  if(candleNodes.every(x=>x.classList.contains("out"))){
    $("cakeMessage").textContent="আপনার মনের সব ইচ্ছা পূরণ হোক! ❤️";
    stopMic("✨ সব মোমবাতি নিভে গেছে!");
  }
}
function extinguishAllWithWishes(){
  stopMic();
  const remaining=candleNodes.filter(c=>!c.classList.contains("out"));
  remaining.forEach((c,index)=>setTimeout(()=>extinguish(c),index*850));
  if(!remaining.length)$("cakeMessage").textContent="সব মোমবাতি ইতিমধ্যে নিভে গেছে। আবার জ্বালিয়ে নতুন করে ইচ্ছা করুন।";
}
candleNodes.forEach(c=>c.addEventListener("click",()=>extinguish(c)));
$("blowBtn").onclick=extinguishAllWithWishes;
$("cake").onclick=e=>{if(e.target.closest(".candle"))return;const c=candleNodes.find(x=>!x.classList.contains("out"));if(c)extinguish(c);};

function micErrorMessage(err){
  const secure=window.isSecureContext||location.hostname==="localhost";
  if(!secure)return "নিরাপদ HTTPS সংযোগ ছাড়া মাইক্রোফোন চালু হবে না। GitHub Pages-এর https:// লিংক দিয়ে খুলুন।";
  switch(err?.name){
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "মাইক্রোফোনের অনুমতি ব্লক করা আছে। Chrome-এর ঠিকানা বারের 🔒 আইকন → Site settings → Microphone → Allow করুন। এরপর পেজ Reload করে আবার চাপ দিন।";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "কোনো মাইক্রোফোন পাওয়া যায়নি। কম্পিউটার/ফোনের মাইক্রোফোন সংযুক্ত আছে কি না দেখুন।";
    case "NotReadableError":
    case "TrackStartError":
      return "মাইক্রোফোন অন্য কোনো অ্যাপ ব্যবহার করছে। অন্য অ্যাপ বন্ধ করে আবার চেষ্টা করুন।";
    case "OverconstrainedError":
      return "মাইক্রোফোনের অডিও সেটিং সমর্থিত নয়। সাধারণ অডিও মোডে আবার চেষ্টা করুন।";
    case "SecurityError":
      return "ব্রাউজারের নিরাপত্তা নীতিতে মাইক্রোফোন বন্ধ আছে। Site settings থেকে Microphone Allow করুন।";
    default:
      return `মাইক্রোফোন চালু হয়নি (${err?.name||"Unknown error"}). Chrome Site settings-এ Microphone Allow করে আবার চেষ্টা করুন।`;
  }
}
async function startMicBlow(){
  if(!window.isSecureContext&&location.hostname!=="localhost"){
    $("micStatus").textContent=micErrorMessage({name:"SecurityError"});return;
  }
  if(!navigator.mediaDevices||typeof navigator.mediaDevices.getUserMedia!=="function"){
    $("micStatus").textContent="এই ব্রাউজার মাইক্রোফোন সমর্থন করছে না। Chrome-এর সর্বশেষ সংস্করণে HTTPS লিংক খুলুন।";return;
  }
  const btn=$("micBlowBtn");
  btn.disabled=true;
  btn.textContent="⏳ অনুমতি চাওয়া হচ্ছে…";
  $("micStatus").textContent="ব্রাউজারের Microphone Allow বার্তাটি এলে Allow নির্বাচন করুন।";
  try{
    stopMic();
    // Request permission from this direct button click; use the widest compatible audio constraint.
    try{
      micStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    }catch(firstError){
      // Retry once with explicit basic constraints for browsers/devices that reject audio:true.
      if(firstError?.name==="OverconstrainedError"||firstError?.name==="TypeError"){
        micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false},video:false});
      }else throw firstError;
    }
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)throw new Error("AudioContext unavailable");
    micContext=new AC();
    if(micContext.state==="suspended")await micContext.resume();
    const source=micContext.createMediaStreamSource(micStream);
    const analyser=micContext.createAnalyser();
    analyser.fftSize=2048;analyser.smoothingTimeConstant=.2;source.connect(analyser);
    const samples=new Uint8Array(analyser.fftSize);
    const freq=new Uint8Array(analyser.frequencyBinCount);
    micActive=true;blowStartedAt=0;
    btn.disabled=false;
    btn.classList.add("listening");
    btn.textContent="🎙️ শুনছে… ফুঁ দিন";
    $("micStatus").textContent="মাইক্রোফোন চালু হয়েছে—এবার কেকের দিকে ১–২ সেকেন্ড ফুঁ দিন।";
    const detect=()=>{
      if(!micActive||!micContext)return;
      analyser.getByteTimeDomainData(samples);
      analyser.getByteFrequencyData(freq);
      let sum=0;for(let i=0;i<samples.length;i++){const v=(samples[i]-128)/128;sum+=v*v;}
      const rms=Math.sqrt(sum/samples.length);
      let high=0,total=0;for(let i=2;i<freq.length;i++){const v=freq[i];total+=v;if(i>freq.length*.18)high+=v;}
      const airy=total>0&&(high/total)>.32;
      if(rms>.025&&airy){
        if(!blowStartedAt)blowStartedAt=performance.now();
        if(performance.now()-blowStartedAt>420){extinguishAllWithWishes();return;}
      }else blowStartedAt=0;
      micFrame=requestAnimationFrame(detect);
    };
    detect();
  }catch(err){
    stopMic();
    $("micStatus").textContent=micErrorMessage(err);
  }finally{
    btn.disabled=false;
    if(!micActive&&btn.textContent==="⏳ অনুমতি চাওয়া হচ্ছে…")btn.textContent="🎙️ মাইক্রোফোন চালু করুন";
  }
}
$("micBlowBtn").onclick=()=>micActive?stopMic("মাইক্রোফোন বন্ধ করা হয়েছে।"):startMicBlow();
$("relightBtn").onclick=()=>{
  stopMic("মোমবাতি আবার জ্বালানো হয়েছে।");
  extinguishedCount=0;
  clearTimeout(wishHideTimer);
  $("candleWishPop")?.classList.remove("show");
  candleNodes.forEach(c=>c.classList.remove("out"));
  $("cakeMessage").textContent="মোমবাতিগুলো আবার জ্বলে উঠেছে।";
};
// "Happy Birthday to You" সুরটি Web Audio দিয়ে তৈরি; বাইরের অডিও ফাইল লাগে না।
let audioCtx=null,musicTimer=null,musicOn=false;
function startMusic(){
  const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
  if(audioCtx){audioCtx.close().catch(()=>{});}
  audioCtx=new AudioContext();
  // মূল পরিচিত সুর: G G A G C B / G G A G D C / G G G E C B A / F F E C D C
  const beat=0.34;
  const melody=[
    [392,1],[392,1],[440,2],[392,2],[523.25,2],[493.88,3],
    [392,1],[392,1],[440,2],[392,2],[587.33,2],[523.25,3],
    [392,1],[392,1],[783.99,2],[659.25,2],[523.25,2],[493.88,2],[440,3],
    [698.46,1],[698.46,1],[659.25,2],[523.25,2],[587.33,2],[523.25,4]
  ];
  let i=0;musicOn=true;
  const play=()=>{
    if(!musicOn||!audioCtx)return;
    const [hz,beats]=melody[i];
    const now=audioCtx.currentTime,osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
    osc.type="triangle";osc.frequency.setValueAtTime(hz,now);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.12,now+.025);
    gain.gain.setValueAtTime(.12,now+beat*beats*.78);
    gain.gain.exponentialRampToValueAtTime(.0001,now+beat*beats*.92);
    osc.connect(gain).connect(audioCtx.destination);osc.start(now);osc.stop(now+beat*beats);
    i=(i+1)%melody.length;musicTimer=setTimeout(play,beat*beats*1000);
  };
  audioCtx.resume().then(play).catch(()=>{});
}
// Canvas fireworks
const canvas=$("fireworks"),ctx=canvas.getContext("2d");let particles=[],raf=null;
function resize(){canvas.width=innerWidth*devicePixelRatio;canvas.height=innerHeight*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);}
addEventListener("resize",resize);resize();
function burst(){const x=Math.random()*innerWidth,y=Math.random()*innerHeight*.58+30,hue=Math.random()*360;for(let n=0;n<65;n++){const a=Math.PI*2*n/65,s=Math.random()*4+1.2;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:70+Math.random()*25,hue});}}
function frame(){ctx.clearRect(0,0,innerWidth,innerHeight);if(Math.random()<.045)burst();particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=.035;p.vx*=.99;p.life--;ctx.globalAlpha=Math.min(1,p.life/35);ctx.fillStyle=`hsl(${p.hue} 100% 68%)`;ctx.beginPath();ctx.arc(p.x,p.y,2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;raf=requestAnimationFrame(frame);}
function startFireworks(){if(!raf)frame();}
// Start the celebration only after the receiver taps the start button.
$("startBtn").addEventListener("click",()=>{
  $("startOverlay").classList.add("hidden");
  startMusic();
  startFireworks();
});
