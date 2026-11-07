import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
const app=initializeApp(firebaseConfig),db=getFirestore(app),$=id=>document.getElementById(id);
const id=new URLSearchParams(location.search).get("id");
function showError(msg){$("recipientName").textContent="আয়োজনটি পাওয়া যায়নি";$("customMessage").textContent=msg;$("ageLine").textContent="";document.title="Birthday page not found";}
if(!id||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(id)){showError("জন্মদিনের লিংকটি সঠিক নয়। অনুগ্রহ করে লিংকটি পরীক্ষা করুন।");}
else{
  onSnapshot(doc(db,"wishes",id),snap=>{
    if(!snap.exists()){showError("জন্মদিনের পাতাটি মুছে ফেলা হয়েছে অথবা লিংকটি ভুল।");return;}
    const d=snap.data();
    const textDefaults={topLabel:"বিশেষ একটি দিন • বিশেষ একজন মানুষ",greetingTitle:"শুভ জন্মদিন",overlayTitle:"একটি সুন্দর চমক অপেক্ষা করছে!",overlayMessage:"নিচের বোতামে চাপ দিয়ে আয়োজন, গান ও আতশবাজি শুরু করুন।",startButtonText:"🎉 উদযাপন শুরু করুন",overlayNote:"আপনি বোতামে চাপ দেওয়ার পরই গান বাজবে।",ageText:"বছর পূর্তির আনন্দ উদযাপন",attachmentLabel:"📎 সংযুক্ত ফাইল খুলুন",cakeTitle:"মনের ইচ্ছা পূরণের কামনা করুন ✨",cakeInstruction:"প্রতিটি মোমবাতিতে চাপ দিন অথবা সবগুলো নিভিয়ে দিন।",blowButtonText:"🌬️ সব মোমবাতি নিভিয়ে দিন",relightButtonText:"🕯️ আবার জ্বালান",cakeMessageText:"মনে মনে একটি ইচ্ছা করুন, তারপর মোমবাতি নিভিয়ে দিন!",footerText:"ভালোবাসায় তৈরি ❤️ আপনার বিশেষ দিনের জন্য"};
    Object.entries(textDefaults).forEach(([key,fallback])=>{const el=$(key);if(el)el.textContent=d[key]||fallback;});
    $("recipientName").textContent=d.recipientName||"আপনাকে!";
    $("customMessage").textContent=d.message||"আপনার দিনটি ভালোবাসা, হাসি ও সুন্দর স্মৃতিতে ভরে উঠুক।";
    $("ageLine").textContent=d.age!==null&&d.age!==undefined?`${d.age} ${d.ageText||textDefaults.ageText}`:"";
    document.title=`${d.eventName||"শুভেচ্ছা"} — ${d.recipientName||""}`;
    if(d.attachmentUrl){$("attachmentLink").href=d.attachmentUrl;$("attachmentLink").classList.remove("hidden");}else{$("attachmentLink").classList.add("hidden");}
    if(d.audioUrl){$("birthdayAudio").src=d.audioUrl;$("birthdayAudio").classList.remove("hidden");}else{$("birthdayAudio").removeAttribute("src");$("birthdayAudio").classList.add("hidden");}
    if(d.photoUrl){$("recipientPhoto").src=d.photoUrl;$("recipientPhoto").classList.remove("hidden");$("photoFallback").classList.add("hidden");}
    else{$("recipientPhoto").classList.add("hidden");$("photoFallback").classList.remove("hidden");}
  },err=>showError("জন্মদিনের আয়োজনটি লোড করা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।"));
}

// Candles: tap individually; blow button turns all flames off.
function extinguish(c){c.classList.add("out");}
document.querySelectorAll(".candle").forEach(c=>c.addEventListener("click",()=>{extinguish(c);if([...document.querySelectorAll(".candle")].every(x=>x.classList.contains("out")))$("cakeMessage").textContent="আপনার মনের ইচ্ছা পূরণ হোক! 🎉";}));
function blowAll(){document.querySelectorAll(".candle").forEach(extinguish);$("cakeMessage").textContent="আপনার মনের ইচ্ছা পূরণ হোক! ✨";}
$("blowBtn").onclick=blowAll;$("cake").onclick=e=>{if(e.target.closest(".candle"))return;const c=[...document.querySelectorAll(".candle")].find(x=>!x.classList.contains("out"));if(c)extinguish(c);if([...document.querySelectorAll(".candle")].every(x=>x.classList.contains("out")))$("cakeMessage").textContent="শুভ জন্মদিন! 🎊";};
$("relightBtn").onclick=()=>{document.querySelectorAll(".candle").forEach(c=>c.classList.remove("out"));$("cakeMessage").textContent="মোমবাতিগুলো আবার জ্বলে উঠেছে!";};

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
