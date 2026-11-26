(() => {
"use strict";
const $ = id => document.getElementById(id);
const canvas = $("gameCanvas"), ctx = canvas.getContext("2d");
const overlay = $("overlay"), hud = $("hud"), touchControls = $("touchControls");
const TILE=40, GRAVITY=1700, MOVE=540, JUMP=690;
const ASSET = {
 dial:"/icons/dial.png", headphones:"/icons/headphones.png", phone:"/icons/phone.png",
 downloads:"/icons/downloads.png", chicken:"/icons/chicken.png", browser:"/icons/browser.png"
};
const images={};
Object.entries(ASSET).forEach(([k,src])=>{const im=new Image();im.src=src;images[k]=im;});
const state={mode:"menu",level:1,world:1,score:0,phones:0,best:+localStorage.getItem("dialRollBest")||0,
 camera:0,keys:{left:false,right:false,jump:false},last:0,theme:"auto",seed:"",customWorld:null,editor:null,worldWidth:150,
 player:null,solids:[],entities:[],particles:[],crushTimer:0,invuln:0,worldPhones:0};
const isMobile=matchMedia("(pointer:coarse)").matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
if(isMobile) touchControls.hidden=false;
function resize(){const dpr=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect();canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
new ResizeObserver(resize).observe(canvas);resize();
function hashString(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function currentTheme(){if(state.theme!=="auto")return state.theme;if(state.level%5===0)return"dark";if(state.level%3===0)return"snow";return"light"}
function themeColors(){const t=currentTheme();return t==="dark"?{bg:"#101820",floor:"#689F38",brick:"#17232b",q:"#99D8F0"}:t==="snow"?{bg:"#e7f4f7",floor:"#99D8F0",brick:"#b4d9e3",q:"#99D8F0"}:{bg:"#f3f3f3",floor:"linear-gradient",brick:"#26343d",q:"#99D8F0"}}
function setMenu(which){overlay.hidden=false;["mainMenu","levelMenu","editorMenu","messageMenu"].forEach(id=>$(id).hidden=id!==which);$("menuTitle").textContent=which==="editorMenu"?"MAP EDITOR":which==="levelMenu"?"LEVEL SELECT":which==="messageMenu"?"DIAL ROLL":"DIAL ROLL";$("menuSubtitle").hidden=which!=="mainMenu";}
function startLevel(level=1,seed=null,custom=null){state.level=level;state.world=Math.ceil(level/5);state.seed=seed||"world-"+state.world;state.customWorld=custom;state.score=state.score||0;state.camera=0;state.crushTimer=0;state.invuln=0;buildLevel();state.mode="playing";overlay.hidden=true;hud.hidden=false;$("pauseButton").hidden=false;updateHud();state.last=performance.now();}
function addSolid(x,y,type="ground"){state.solids.push({x,y,w:1,h:1,type});}
function addEntity(type,x,y,extra={}){state.entities.push({type,x:x*TILE+TILE/2,y:y*TILE+TILE/2,vx:0,vy:0,w:type==="phone"?18:28,h:type==="phone"?18:28,alive:true,...extra});}
function buildLevel(){
 state.solids=[];state.entities=[];state.particles=[];const floorY=9,width=150;state.worldWidth=width;
 for(let x=0;x<width;x++)addSolid(x,floorY);
 // Classic platforming rhythm, with increasingly varied gaps and platforms.
 for(let x=13;x<width-10;x+=18){const y=6+(x%3===0?0:1);for(let j=0;j<3;j++)addSolid(x+j,y,"brick");addSolid(x+1,y-2,"question");}
 const random=rng(hashString(state.seed+":"+state.level));
 const chickenWorld=state.level===12||state.level===8||state.level===10;
 const chickenHeavy=state.level===10;
 for(let x=9;x<width-8;x+=Math.max(4,Math.floor(8-random()*3))){
   if(chickenWorld||state.level>5||random()<.35)addEntity("chicken",x,floorY-1,{vx:-65});
   else if(random()<.65)addEntity("headphone",x,floorY-1,{vx:65});
 }
 if(state.level===10){for(let x=5;x<width-5;x+=3)addEntity("chicken",x,floorY-1,{vx:-75});}
 for(let x=18;x<width-8;x+=Math.floor(9+random()*7)){
   addEntity("phone",x,floorY-2);
   if(random()<.35)addEntity("download",x+2,floorY-3);
 }
 // First five stages are a recognizable beginner route, with the fifth dark.
 if(state.level<=5){for(let x=5;x<width-8;x+=20){addSolid(x,7,"brick");addSolid(x+1,7,"brick");addSolid(x+2,7,"question");}}
 if(state.level===2||state.level===4){for(let x=7;x<width-5;x+=4)addEntity("chicken",x,floorY-1,{vx:-80});}
 if(state.level===5){for(let x=6;x<width-5;x+=5)addEntity("headphone",x,floorY-1,{vx:95});}
 addSolid(width-5,6,"brick");addSolid(width-5,7,"brick");
 state.player={x:2*TILE,y:floorY*TILE-18,r:18,vx:0,vy:0,onGround:false,scale:1,skin:"dial",facing:1,dead:false};
 state.worldPhones=0;
}
function updateHud(){$("worldLabel").textContent=`${state.world}-${((state.level-1)%5)+1}`;$("scoreLabel").textContent=String(state.score).padStart(6,"0");$("phoneLabel").textContent=state.phones;$("bestLabel").textContent=String(state.best).padStart(6,"0");$("themeLabel").textContent=currentTheme().toUpperCase()+" HOLO";}
function rectHit(a,b){return a.x-a.w/2<b.x+b.w/2&&a.x+a.w/2>b.x-b.w/2&&a.y-a.h/2<b.y+b.h/2&&a.y+a.h/2>b.y-b.h/2}
function solidAt(px,py){return state.solids.find(s=>px>=s.x*TILE&&px<(s.x+1)*TILE&&py>=s.y*TILE&&py<(s.y+1)*TILE)}
function playerBox(){const p=state.player,r=p.r*p.scale;return{x:p.x,y:p.y,w:r*2,h:r*2}}
function hitQuestion(s){if(s.type==="question"&&!s.used){s.used=true;addEntity("phone",s.x,s.y-1);state.score+=100;}}
function update(dt){
 const p=state.player;if(!p)return;
 const left=state.keys.left,right=state.keys.right;
 if(left){p.vx-=MOVE*dt;p.facing=-1}else if(right){p.vx+=MOVE*dt;p.facing=1}else p.vx*=Math.pow(.0008,dt);
 p.vx=Math.max(-260,Math.min(260,p.vx));
 if(state.keys.jump&&p.onGround){p.vy=-JUMP;p.onGround=false}
 p.vy=Math.min(1000,p.vy+GRAVITY*dt);
 p.x+=p.vx*dt;
 // Circular player collision against solid tile AABBs.
 const pr=p.r*p.scale;
 for(const s of state.solids){const cx=s.x*TILE+TILE/2,cy=s.y*TILE+TILE/2,dx=p.x-cx,dy=p.y-cy;
   const nx=Math.max(-TILE/2,Math.min(dx,TILE/2)),ny=Math.max(-TILE/2,Math.min(dy,TILE/2));
   const ox=dx-nx,oy=dy-ny,dist=Math.hypot(ox,oy);
   if(dist<pr){if(Math.abs(ox)>Math.abs(oy)){p.x=cx+nx+(ox<0?-pr:pr);p.vx=0;}else{p.y=cy+ny+(oy<0?-pr:pr);if(oy<0){if(s.type==="question")hitQuestion(s);p.vy=0;p.onGround=true;}else p.vy=0;}}
 }
 p.onGround=false;
 p.y+=p.vy*dt;
 for(const s of state.solids){const box={x:s.x*TILE+TILE/2,y:s.y*TILE+TILE/2,w:TILE,h:TILE};const pb=playerBox();if(rectHit(pb,box)){
   const prevBottom=p.y-p.vy*dt+pr,top=box.y-TILE/2;
   if(p.vy>=0&&prevBottom<=top+10){p.y=top-pr;p.vy=0;p.onGround=true;}
   else if(p.vy<0&&p.y<box.y){p.y=box.y+TILE/2+pr;p.vy=0;if(s.type==="question")hitQuestion(s);}
   else{const dir=p.x<box.x?-1:1;p.x=box.x+dir*(TILE/2+pr);p.vx=0;}
 }}
 if(p.y>canvas.clientHeight+500){p.x=2*TILE;p.y=7*TILE;p.vx=p.vy=0;p.scale=1;state.invuln=1.2;}
 const cameraTarget=Math.max(0,p.x-canvas.clientWidth*.36);state.camera+=(cameraTarget-state.camera)*Math.min(1,dt*7);
 state.crushTimer=Math.max(0,state.crushTimer-dt);state.invuln=Math.max(0,state.invuln-dt);
 for(const e of state.entities){if(!e.alive)continue;
   if(e.type==="phone"||e.type==="download"){e.vy+=GRAVITY*dt;e.y+=e.vy*dt;const floor=solidAt(e.x,e.y+e.h/2);if(floor){e.y=floor.y*TILE-e.h/2;e.vy=0;}}
   else{e.x+=e.vx*dt;const ahead=e.x+Math.sign(e.vx||1)*18,wall=solidAt(ahead,e.y);if(wall){e.vx*=-1;e.facing=Math.sign(e.vx);} }
   const eb={x:e.x,y:e.y,w:e.w,h:e.h},pb=playerBox();
   if(rectHit(pb,eb)){
     if(e.type==="phone"){e.alive=false;state.phones++;state.worldPhones++;state.score+=200;}
     else if(e.type==="chicken"){e.alive=false;state.phones+=2;state.score+=300;burst(e.x,e.y,"#99D8F0");}
     else if(e.type==="download"){e.alive=false;p.scale=p.scale<1.5?1.5:2;state.crushTimer=p.scale>=2?30:0;state.score+=500;}
     else if(e.type==="headphone"){
       if(state.crushTimer>0&&p.scale>=1.9){e.alive=false;state.score+=500;burst(e.x,e.y,"#8bc34a");}
       else if(state.invuln<=0){if(p.scale>1){p.scale=1;state.invuln=1.3;e.alive=false;}else{p.dead=true;state.score=Math.max(0,state.score-100);p.x=2*TILE;p.y=7*TILE;p.vx=p.vy=0;state.invuln=1.8;}}
     }
   }
 }
 // 2x form crushes enemies for thirty seconds.
 if(p.scale>=1.9&&state.crushTimer<=0)state.crushTimer=30;
 if(p.x>(state.worldWidth-8)*TILE){state.score+=1000;state.best=Math.max(state.best,state.score);localStorage.setItem("dialRollBest",state.best);state.level++;startLevel(state.level,state.seed);return;}
 state.particles=state.particles.filter(q=>q.life>0);for(const q of state.particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=500*dt;q.life-=dt;}
 updateHud();
}
function burst(x,y,color){for(let i=0;i<9;i++){const a=Math.random()*Math.PI*2;state.particles.push({x,y,vx:Math.cos(a)*130,vy:Math.sin(a)*130,life:.5,color});}}
function drawImage(key,x,y,w,h,flip=false){const im=images[key];if(im&&im.complete&&im.naturalWidth){ctx.save();if(flip){ctx.translate(x+w,y);ctx.scale(-1,1);ctx.drawImage(im,0,0,w,h)}else ctx.drawImage(im,x,y,w,h);ctx.restore();return true;}return false;}
function draw(){
 const w=canvas.clientWidth,h=canvas.clientHeight,t=currentTheme(),dark=t==="dark",snow=t==="snow";
 ctx.clearRect(0,0,w,h);if(dark){const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,"#000000");bg.addColorStop(1,"#272d33");ctx.fillStyle=bg;}
 else if(snow){const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,"#f3f3f3");bg.addColorStop(1,"#dceff4");ctx.fillStyle=bg;}
 else ctx.fillStyle="#f3f3f3";ctx.fillRect(0,0,w,h);
 // Subtle horizon tint for Holitas.
 if(snow){const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,"#f3f3f3");g.addColorStop(1,"#d8f0f7");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
 const cam=state.camera,colors=themeColors();
 for(const s of state.solids){const x=s.x*TILE-cam,y=s.y*TILE;
   if(x<-TILE||x>w+TILE)continue;
   if(s.type==="ground"){if(dark)ctx.fillStyle="#689F38";
   else if(snow)ctx.fillStyle="#99D8F0";
   else{const floorGrad=ctx.createLinearGradient(0,y,0,y+TILE);floorGrad.addColorStop(0,"#f5f5f5");floorGrad.addColorStop(1,"#e6e6e6");ctx.fillStyle=floorGrad;}
   ctx.fillRect(x,y,TILE,TILE);ctx.fillStyle=dark?"#8bc34a":snow?"#c6eff8":"#ffffff";ctx.fillRect(x,y,TILE,5);ctx.strokeStyle=dark?"#4c7c2a":"#cbd4d6";ctx.strokeRect(x+.5,y+.5,TILE-1,TILE-1);}
   else if(s.type==="question"){ctx.fillStyle="#99D8F0";ctx.fillRect(x,y,TILE,TILE);ctx.strokeStyle="#fff";ctx.lineWidth=3;ctx.strokeRect(x+2,y+2,TILE-4,TILE-4);ctx.fillStyle="#fff";ctx.font="bold 27px Arial";ctx.textAlign="center";ctx.fillText(s.used?"·":"?",x+20,y+29);}
   else{ctx.fillStyle=dark?"#17232b":"#26343d";ctx.fillRect(x,y,TILE,TILE);ctx.fillStyle="#ffffff20";ctx.fillRect(x+3,y+3,TILE-6,4);ctx.strokeStyle="#0005";ctx.strokeRect(x+.5,y+.5,TILE-1,TILE-1);}
 }
 for(const e of state.entities){if(!e.alive)continue;const x=e.x-cam-e.w/2,y=e.y-e.h/2;let key=e.type;
   if(key==="headphone"){key="headphones";if(!drawImage(key,x,y,e.w,e.h,e.vx<0)){drawFallback("♫",x,y,e.w,e.h,"#e35b54");}}
   else if(key==="chicken"){if(!drawImage(key,x,y,e.w+8,e.h+8,e.vx>0)){drawFallback("🐔",x,y,e.w+8,e.h+8,"#e4a43b");}}
   else if(key==="phone"){if(!drawImage(key,x,y,e.w,e.h)){drawFallback("▣",x,y,e.w,e.h,"#4a90e2");}}
   else if(key==="download"){if(!drawImage("downloads",x,y,e.w+8,e.h+8)){drawFallback("↓",x,y,e.w+8,e.h+8,"#5da5e8");}}
 }
 const p=state.player;if(p){const r=p.r*p.scale,x=p.x-cam-r,y=p.y-r;
   const skin=p.skin==="globe"?"browser":"dial";
   if(state.invuln<=0||Math.floor(performance.now()/100)%2===0){if(!drawImage(skin,x,y,r*2,r*2)){drawFallback("◉",x,y,r*2,r*2,"#4e9bb1");}}
 }
 for(const q of state.particles){ctx.globalAlpha=Math.max(0,q.life*2);ctx.fillStyle=q.color;ctx.fillRect(q.x-cam,q.y,4,4);ctx.globalAlpha=1;}
 if(state.mode==="playing"&&state.crushTimer>0){ctx.fillStyle="#26343dcc";ctx.fillRect(w-130,12,116,25);ctx.fillStyle="#fff";ctx.font="bold 11px Arial";ctx.textAlign="center";ctx.fillText("CRUSH "+Math.ceil(state.crushTimer)+"s",w-72,29);}
}
function drawFallback(txt,x,y,w,h,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x+w/2,y+h/2,Math.min(w,h)/2,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.font=`bold ${Math.max(14,h*.65)}px Arial`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(txt,x+w/2,y+h/2);ctx.textBaseline="alphabetic";}
function loop(now){const dt=Math.min(.033,(now-state.last)/1000||0);state.last=now;if(state.mode==="playing")update(dt);draw();requestAnimationFrame(loop)}
requestAnimationFrame(loop);
function pause(){if(state.mode==="playing"){state.mode="paused";$("menuSubtitle").textContent="Game paused.";setMenu("messageMenu");$("messageText").textContent="Take a breather. Your run is waiting."; $("messageContinue").textContent="Resume";}else if(state.mode==="paused"){state.mode="playing";overlay.hidden=true;state.last=performance.now();}}
$("playButton").onclick=()=>{state.score=0;state.phones=0;startLevel(1,"world-1");};
$("editorButton").onclick=()=>{openEditor();setMenu("editorMenu");};
$("levelsButton").onclick=()=>setMenu("levelMenu");
$("levelBackButton").onclick=()=>setMenu("mainMenu");
$("generateButton").onclick=()=>{const seed=$("seedInput").value.trim()||"random-world";state.theme=$("themeSelect").value;const worlds=window.DIAL_WORLDS||{};const match=worlds[seed.toLowerCase()];state.score=0;state.phones=0;startLevel(match?.level||1,seed,match||null);if(seed.toLowerCase()==="browser")state.browserHint=true;};
$("pauseButton").onclick=pause;
$("messageContinue").onclick=()=>{if(state.mode==="paused"){state.mode="playing";overlay.hidden=true;state.last=performance.now();}else{state.mode="playing";overlay.hidden=true;}};
$("messageHome").onclick=()=>{state.mode="menu";hud.hidden=true;$("pauseButton").hidden=true;setMenu("mainMenu");};
window.addEventListener("keydown",e=>{if(["ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault();if(e.code==="ArrowLeft"||e.code==="KeyA")state.keys.left=true;if(e.code==="ArrowRight"||e.code==="KeyD")state.keys.right=true;if(e.code==="Space"||e.code==="ArrowUp"||e.code==="KeyW")state.keys.jump=true;if(e.code==="Escape")pause();});
window.addEventListener("keyup",e=>{if(e.code==="ArrowLeft"||e.code==="KeyA")state.keys.left=false;if(e.code==="ArrowRight"||e.code==="KeyD")state.keys.right=false;if(e.code==="Space"||e.code==="ArrowUp"||e.code==="KeyW")state.keys.jump=false;});
document.querySelectorAll("[data-control]").forEach(b=>{const k=b.dataset.control;const down=e=>{e.preventDefault();state.keys[k]=true};const up=e=>{e.preventDefault();state.keys[k]=false};b.addEventListener("pointerdown",down);["pointerup","pointercancel","pointerleave"].forEach(ev=>b.addEventListener(ev,up));});
function openEditor(){const cols=19,rows=9;state.editor=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>y===8?"ground":"empty"));for(let x=0;x<cols;x++)state.editor[8][x]="ground";drawEditor();}
function drawEditor(){const c=$("editorCanvas"),g=c.getContext("2d"),grid=state.editor;if(!grid)return;const cw=c.width/grid[0].length,ch=c.height/grid.length;g.clearRect(0,0,c.width,c.height);grid.forEach((row,y)=>row.forEach((v,x)=>{g.fillStyle=v==="ground"?"#99D8F0":v==="brick"?"#26343d":v==="question"?"#8dd8eb":"#eaf0f2";g.fillRect(x*cw,y*ch,cw,ch);g.strokeStyle="#9aabb1";g.strokeRect(x*cw,y*ch,cw,ch);if(v!=="empty"&&v!=="ground"){g.fillStyle=v==="phone"?"#2979c5":v==="chicken"?"#d69a35":v==="headphone"?"#d9534f":"#fff";g.font="bold 15px Arial";g.textAlign="center";g.fillText(({brick:"▦",question:"?",phone:"▣",headphone:"♫",chicken:"♟",download:"↓"})[v],x*cw+cw/2,y*ch+ch*.68);}}));}
$("editorCanvas").addEventListener("pointerdown",e=>{const r=e.currentTarget.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*19),y=Math.floor((e.clientY-r.top)/r.height*9);if(state.editor[y]){state.editor[y][x]=$("editorTool").value;drawEditor();}});
function editorWorld(){const grid=state.editor,solids=[],entities=[];grid.forEach((row,y)=>row.forEach((v,x)=>{if(["ground","brick","question"].includes(v))solids.push({x,y,type:v});else if(v!=="empty")entities.push({type:v,x,y});}));return{name:$("worldNameInput").value||"Custom World",width:Math.max(30,grid[0].length),height:grid.length,solids,entities,theme:"light"};}
function downloadJSON(obj,name){const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
$("editorExport").onclick=()=>{const w=editorWorld();downloadJSON({[w.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")]:w},"worlds.json");};
$("editorTest").onclick=()=>{const w=editorWorld();startLevel(1,w.name,w);};
$("editorBackButton").onclick=()=>setMenu("mainMenu");
function loadDefinedWorld(world){state.solids=[];state.entities=[];state.worldWidth=Math.max(30,world.width||30);for(const s of world.solids||[])addSolid(s.x,s.y,s.type);for(const e of world.entities||[])addEntity(e.type,e.x,e.y);state.player={x:2*TILE,y:7*TILE,r:18,vx:0,vy:0,onGround:false,scale:1,skin:"dial",facing:1};}
const originalBuild=buildLevel;
buildLevel=function(){if(state.customWorld&&state.customWorld.solids){loadDefinedWorld(state.customWorld);return;}originalBuild();};
const worldsUrl="worlds.json";
fetch(worldsUrl).then(r=>r.ok?r.json():{}).then(data=>{window.DIAL_WORLDS=data;}).catch(()=>{window.DIAL_WORLDS={};});
const oldUpdateHud=updateHud;
updateHud=function(){oldUpdateHud();if(state.browserHint&&state.phones>=3&&state.player){state.player.skin="globe";state.browserHint=false;state.score+=1000;}};
setMenu("mainMenu");
})();