(() => {
"use strict";
const CATALOG_URL="/browser/sites.json";
const $=id=>document.getElementById(id);
const address=$("address"),frame=$("pageFrame"),newTabView=$("newTab"),errorPage=$("errorPage");
let sites={},tabs=[],activeTab=0,deferredInstall=null,toastTimer;
const current=()=>tabs[activeTab];
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2200)}
function normalizeAddress(value){
 let raw=value.trim();if(!raw)return "new-tab";
 if(raw==="about:blank"||raw==="browser://newtab")return "new-tab";
 if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw))raw="https://"+raw;
 try{return new URL(raw).hostname.toLowerCase().replace(/^www\./,"")}catch{return raw.toLowerCase()}
}
function displayAddress(key){return key==="new-tab"?"":key}
function setStatus(text){$("statusText").textContent=text}
function updateControls(){
 const t=current();$("tabCount").textContent=tabs.length;
 $("backButton").disabled=t.index<=0;$("forwardButton").disabled=t.index>=t.history.length-1;
 address.value=displayAddress(t.key);$("pageTitle").textContent=t.title||"New tab";
}
function showView(which){newTabView.hidden=which!=="home";frame.hidden=which!=="frame";errorPage.hidden=which!=="error"}
function renderHome(){
 showView("home");$("pageTitle").textContent="New tab";setStatus("Ready");
}
function renderError(message){
 showView("error");$("errorMessage").textContent=message;setStatus("Page not found");
}
function resolveHtmlUrl(path,key){
 // Relative htmlurl values are resolved inside /browser/.
 return new URL(path,location.origin+"/browser/").href;
}
async function renderEntry(key,entry){
 const t=current();
 try{
  if(typeof entry.iframe==="string"){
   showView("frame");frame.removeAttribute("srcdoc");frame.src=entry.iframe;
   t.title=key==="new-tab"?"New tab":key;setStatus("Loading "+key+"…");
  }else if(typeof entry.html==="string"){
   showView("frame");frame.removeAttribute("src");frame.srcdoc=entry.html;
   t.title=key==="new-tab"?"New tab":key;setStatus("Loaded "+key);
  }else if(typeof entry.htmlurl==="string"){
   showView("frame");frame.removeAttribute("src");setStatus("Loading "+key+"…");
   const response=await fetch(resolveHtmlUrl(entry.htmlurl,key),{cache:"no-store"});
   if(!response.ok)throw new Error("HTTP "+response.status);
   frame.srcdoc=await response.text();t.title=key==="new-tab"?"New tab":key;setStatus("Loaded "+key);
  }else{throw new Error("This site entry has no html, iframe, or htmlurl property.")}
 }catch(error){renderError("Could not load this page: "+error.message)}
 updateControls();
}
async function loadKey(key,push=true){
 const t=current();key=key||"new-tab";
 if(push){t.history=t.history.slice(0,t.index+1);t.history.push(key);t.index=t.history.length-1}
 t.key=key;updateControls();$("securityIcon").textContent=key==="new-tab"?"lock":"info";
 if(key==="new-tab"){
  if(sites["new-tab"])await renderEntry("new-tab",sites["new-tab"]);
  else{t.title="New tab";renderHome();updateControls()}
  return;
 }
 const entry=sites[key];
if (!entry) {
  if (sites["err-not-found"]) await renderEntry("err-not-found", sites["err-not-found"]);
  else {
    t.title = key;
    renderError("The address \"" + key + "\" is not listed in the database.");
    updateControls();
  }
  return;
}
 await renderEntry(key,entry);
}
function navigate(value){const key=normalizeAddress(value);loadKey(key,true);$("menuPanel").hidden=true}
function newTab(){tabs.push({key:"new-tab",title:"New tab",history:["new-tab"],index:0});activeTab=tabs.length-1;renderHome();updateControls();$("tabsPanel").hidden=true}
function goBack(){const t=current();if(t.index>0){t.index--;loadKey(t.history[t.index],false)}}
function goForward(){const t=current();if(t.index<t.history.length-1){t.index++;loadKey(t.history[t.index],false)}}
function reload(){const t=current();if(t.key==="new-tab"){renderHome();return}loadKey(t.key,false)}
function renderTabs(){
 const list=$("tabsList");list.replaceChildren();
 tabs.forEach((t,i)=>{const card=document.createElement("div");card.className="tab-card";
 const open=document.createElement("button");open.className="tab-open";open.textContent=t.title||t.key||"New tab";open.onclick=()=>{activeTab=i;$("tabsPanel").hidden=true;loadKey(t.key,false)};
 const close=document.createElement("button");close.className="tab-close";close.textContent="×";close.setAttribute("aria-label","Close tab");close.onclick=()=>{tabs.splice(i,1);if(!tabs.length)newTab();else{if(activeTab>=tabs.length)activeTab=tabs.length-1;else if(i<activeTab)activeTab--;loadKey(current().key,false)}renderTabs();updateControls()};
 card.append(open,close);list.append(card)});
}
async function loadCatalog(){
 try{const r=await fetch(CATALOG_URL,{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);sites=await r.json();
 const shortcuts=$("siteShortcuts");shortcuts.replaceChildren();
 Object.keys(sites).filter(k=>k!=="new-tab"&&k!=="err-not-found").forEach(key=>{const b=document.createElement("button");b.className="shortcut";b.textContent=key;b.onclick=()=>navigate(key);shortcuts.append(b)});
 if(!shortcuts.children.length)shortcuts.textContent="No sites are listed yet.";
 }catch(e){$("siteShortcuts").textContent="Could not load the site directory ("+e.message+")."}
}
$("goButton").onclick=()=>navigate(address.value);
address.addEventListener("keydown",e=>{if(e.key==="Enter"){navigate(address.value);address.blur()}});
$("homeGo").onclick=()=>navigate($("homeSearch").value);
$("homeSearch").addEventListener("keydown",e=>{if(e.key==="Enter")navigate($("homeSearch").value)});
$("homeButton").onclick=()=>loadKey("new-tab",true);
$("backButton").onclick=goBack;$("forwardButton").onclick=goForward;$("reloadButton").onclick=reload;
$("errorHome").onclick=()=>loadKey("new-tab",true);
$("menuButton").onclick=()=>{$("menuPanel").hidden=!$("menuPanel").hidden;$("tabsPanel").hidden=true};
$("tabsButton").onclick=()=>{renderTabs();$("tabsPanel").hidden=false;$("menuPanel").hidden=true};
$("closeTabs").onclick=()=>$("tabsPanel").hidden=true;
$("newTabButton").onclick=newTab;
$("menuPanel").addEventListener("click",e=>{const action=e.target.dataset.action;if(!action)return;$("menuPanel").hidden=true;
 if(action==="newtab")newTab();
 if(action==="bookmarks")toast("Tap a site shortcut on the new tab page to open it.");
 if(action==="share"){if(navigator.share)navigator.share({title:current().title||"Browser",url:location.href}).catch(()=>{});else toast("Sharing is not supported on this device.")}
 if(action==="install"){if(deferredInstall)deferredInstall.prompt();else toast("Use your browser menu and choose Add to Home Screen or Install.")}
 if(action==="about")toast(`Browser V${window.beaver || "unk"}`);
});
if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
tabs=[{key:"new-tab",title:"New tab",history:["new-tab"],index:0}];
loadCatalog();renderHome();updateControls();
})();
