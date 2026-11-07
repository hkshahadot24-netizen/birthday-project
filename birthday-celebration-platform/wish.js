import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
const app=initializeApp(firebaseConfig),db=getFirestore(app),$=id=>document.getElementById(id);
const id=new URLSearchParams(location.search).get("id");
function showError(msg){$("recipientName").textContent="Celebration not found";$("customMessage").textContent=msg;$("ageLine").textContent="";document.title="Birthday page not found";}
if(!id||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(id)){showError("This birthday link is invalid. Please check the shared URL.");}
else{
  onSnapshot(doc(db,"wishes",id),snap=>{
    if(!snap.exists()){showError("This birthday page may have been removed or the link is incorrect.");return;}
    const d=snap.data();$("recipientName").textContent=d.recipientName||"You";
    $("customMessage").textContent=d.message||"Wishing you a wonderful birthday!";
    $("ageLine").textContent=d.age!==null&&d.age!==undefined?`Celebrating ${d.age} wonderful years`:"";
    document.title=`Happy Birthday ${d.recipientName||""}`;
    if(d.photoUrl){$("recipientPhoto").src=d.photoUrl;$("recipientPhoto").classList.remove("hidden");$("photoFallback").classList.add("hidden");}
    else{$("recipientPhoto").classList.add("hidden");$("photoFallback").classList.remove("hidden");}
  },err=>showError("Unable to load this celebration. Please try again later."));
}

// Candles: tap individually; blow button turns all flames off.
function extinguish(c){c.classList.add("out");}
document.querySelectorAll(".candle").forEach(c=>c.addEventListener("click",()=>{extinguish(c);if([...document.querySelectorAll(".candle")].every(x=>x.classList.contains("out")))$("cakeMessage").textContent="Your wish is on its way! 🎉";}));
function blowAll(){document.querySelectorAll(".candle").forEach(extinguish);$("cakeMessage").textContent="Make that wish come true! ✨";}
$("blowBtn").onclick=blowAll;$("cake").onclick=e=>{if(e.target.closest(".candle"))return;const c=[...document.querySelectorAll(".candle")].find(x=>!x.classList.contains("out"));if(c)extinguish(c);if([...document.querySelectorAll(".candle")].every(x=>x.classList.contains("out")))$("cakeMessage").textContent="Happy birthday! 🎊";};
$("relightBtn").onclick=()=>{document.querySelectorAll(".candle").forEach(c=>c.classList.remove("out"));$("cakeMessage").textContent="Candles are glowing again!";};

// Original synthesized celebratory melody using Web Audio; no external copyrighted audio.
let audioCtx=null,musicTimer=null,musicOn=false;
function startMusic(){
  const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
  audioCtx=new AudioContext();const notes=[523.25,659.25,783.99,659.25,587.33,698.46,880,698.46,523.25,659.25,783.99,1046.5];
  let i=0;musicOn=true;
  const play=()=>{if(!musicOn)return;const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type="sine";osc.frequency.value=notes[i%notes.length];gain.gain.setValueAtTime(.0001,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.07,audioCtx.currentTime+.03);gain.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.34);osc.connect(gain).connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+.36);i++;musicTimer=setTimeout(play,390);};play();
}
$("startBtn").onclick=async()=>{$("startOverlay").classList.add("hidden");startMusic();startFireworks();};

// Canvas fireworks
const canvas=$("fireworks"),ctx=canvas.getContext("2d");let particles=[],raf=null;
function resize(){canvas.width=innerWidth*devicePixelRatio;canvas.height=innerHeight*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);}
addEventListener("resize",resize);resize();
function burst(){const x=Math.random()*innerWidth,y=Math.random()*innerHeight*.58+30,hue=Math.random()*360;for(let n=0;n<65;n++){const a=Math.PI*2*n/65,s=Math.random()*4+1.2;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:70+Math.random()*25,hue});}}
function frame(){ctx.clearRect(0,0,innerWidth,innerHeight);if(Math.random()<.045)burst();particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=.035;p.vx*=.99;p.life--;ctx.globalAlpha=Math.min(1,p.life/35);ctx.fillStyle=`hsl(${p.hue} 100% 68%)`;ctx.beginPath();ctx.arc(p.x,p.y,2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;raf=requestAnimationFrame(frame);}
function startFireworks(){if(!raf)frame();}