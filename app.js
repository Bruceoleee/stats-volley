/* Stats volley — cœur de l'app : connexion, stockage, synchro, navigation. */
(function(){
"use strict";
const CFG = window.APP_CONFIG || {};
const DEMO = !CFG.supabaseUrl || /VOTRE/.test(CFG.supabaseUrl) || !window.supabase;
const TEAM = CFG.teamName || "Mon équipe";

/* ---------- Utilitaires partagés ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pct = (a,b) => b ? Math.round(100*a/b) + " %" : "–";
const today = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r=Math.random()*16|0; return (c==="x"?r:(r&3|8)).toString(16); }));
const vibrate = () => { try{ navigator.vibrate && navigator.vibrate(12); }catch(e){} };
const lsGet = k => { try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } };
const lsSet = (k,v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
let toastT;
function toast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),1800); }
function showError(what, e){
  const msg=(e&&(e.message||e.error_description||e.msg))||String(e);
  const code=e&&(e.code||e.status)?" ["+(e.code||e.status)+"]":"";
  dialog(what,'<p>Message technique à transmettre :</p><p style="font-family:ui-monospace,monospace;font-size:13px;background:var(--bg);padding:8px;border-radius:8px;word-break:break-word">'+esc(msg+code)+'</p>',[{label:"Fermer",primary:true}]);
}
function dialog(title, bodyHTML, actions){
  const d=$("dlg"); $("dlg-title").textContent=title; $("dlg-body").innerHTML=bodyHTML;
  const acts=$("dlg-acts"); acts.innerHTML="";
  actions.forEach(a=>{ const b=document.createElement("button"); b.type="button"; b.className="btn"+(a.primary?" primary":"")+(a.danger?" danger":""); b.textContent=a.label;
    b.onclick=async()=>{ if(a.run){ const keep=await a.run(b); if(keep) return; } d.close(); }; acts.appendChild(b); });
  try{ d.showModal(); }catch(e){ d.setAttribute("open",""); }
  return d;
}
const MOIS=["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
function dateParts(iso){ if(!iso) return {d:"–",m:""}; const [y,m,d]=iso.split("-"); return {d:String(+d), m:MOIS[+m-1]||"", y}; }

/* ---------- Stockage : Supabase ou démo locale ---------- */
function supaApi(){
  const db = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth:{ persistSession:true, autoRefreshToken:true, storageKey:"stats-volley-auth" } });
  const chk = ({data,error}) => { if(error) throw error; return data; };
  return {
    async signedIn(){ const {data}=await db.auth.getSession(); return !!(data && data.session); },
    async signIn(pw){ const {error}=await db.auth.signInWithPassword({ email:CFG.teamEmail, password:pw }); if(error) throw error; },
    async signOut(){ await db.auth.signOut(); },
    async list(){ return chk(await db.from("feuilles").select("id,type,date,adversaire,resume,updated_at").order("date",{ascending:false}).order("updated_at",{ascending:false})); },
    async get(id){ return chk(await db.from("feuilles").select("*").eq("id",id).maybeSingle()); },
    async save(row){ chk(await db.from("feuilles").upsert(row)); },
    async remove(id){ chk(await db.from("feuilles").delete().eq("id",id)); },
    async getSettings(){ const r=chk(await db.from("reglages").select("data").eq("id","equipe").maybeSingle()); return (r && r.data) || {}; },
    async saveSettings(data){ chk(await db.from("reglages").upsert({ id:"equipe", data })); }
  };
}
function demoApi(){
  const K="stats-volley-demo";
  const all=()=>lsGet(K)||{feuilles:{},reglages:{}};
  const put=v=>lsSet(K,v);
  return {
    async signedIn(){ return true; }, async signIn(){}, async signOut(){},
    async list(){ return Object.values(all().feuilles).map(({data,...r})=>r).sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.updated_at||"").localeCompare(a.updated_at||"")); },
    async get(id){ return all().feuilles[id]||null; },
    async save(row){ const v=all(); v.feuilles[row.id]=row; put(v); },
    async remove(id){ const v=all(); delete v.feuilles[id]; put(v); },
    async getSettings(){ return all().reglages.equipe||{}; },
    async saveSettings(data){ const v=all(); v.reglages.equipe=data; put(v); }
  };
}
const api = DEMO ? demoApi() : supaApi();

/* ---------- Synchro : chaque modification part en ligne, file d'attente si hors ligne ---------- */
let pending = lsGet("sv-pending") || {};
let syncState = "ok", flushT = null, retryT = null, flushing = false;
const syncListeners = new Set();
function setSync(s){ syncState=s; syncListeners.forEach(f=>f(s)); }
function syncLabel(s){
  if(DEMO) return ["Mode démo","wait"];
  return s==="ok"?["✓ Enregistré","ok"]:s==="saving"?["Envoi…","wait"]:s==="offline"?["Hors ligne · en attente","err"]:["Reconnexion requise","err"];
}
function queueSave(row){
  row.updated_at = new Date().toISOString();
  pending[row.id] = row; lsSet("sv-pending", pending);
  lsSet("sv-sheet-"+row.id, row);
  setSync("saving");
  clearTimeout(flushT); flushT = setTimeout(flush, 500);
}
async function flush(){
  if(flushing) return; flushing = true;
  clearTimeout(retryT);
  try{
    for(const id of Object.keys(pending)){
      const row = pending[id];
      try{ await api.save(row); if(pending[id]===row){ delete pending[id]; lsSet("sv-pending", pending); } }
      catch(e){
        const auth = e && (e.status===401 || /JWT|auth|permission|row-level/i.test(e.message||""));
        setSync(auth?"auth":"offline");
        retryT = setTimeout(flush, 10000);
        return;
      }
    }
    setSync("ok");
  } finally { flushing = false; if(Object.keys(pending).length && syncState==="ok") flush(); }
}
window.addEventListener("online", flush);
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible" && Object.keys(pending).length) flush(); });

async function loadSheet(id){
  if(pending[id]) return pending[id];
  try{ const r = await api.get(id); if(r){ lsSet("sv-sheet-"+id, r); return r; } }
  catch(e){ const c=lsGet("sv-sheet-"+id); if(c) { toast("Hors ligne : copie de l’appareil"); return c; } throw e; }
  return lsGet("sv-sheet-"+id);
}
async function listSheets(){
  let rows=[];
  try{ rows = await api.list(); lsSet("sv-list", rows); }
  catch(e){ rows = lsGet("sv-list") || []; console.error(e); showError("Lecture impossible", e); }
  // Fusionner ce qui attend d'être envoyé
  Object.values(pending).forEach(p=>{ const {data,...r}=p; const i=rows.findIndex(x=>x.id===p.id); if(i>=0) rows[i]=r; else rows.unshift(r); });
  return rows;
}
async function deleteSheet(id){
  delete pending[id]; lsSet("sv-pending", pending);
  try{ localStorage.removeItem("sv-sheet-"+id); }catch(e){}
  await api.remove(id);
}

/* Réglages (noms des passeurs, liste des joueurs) */
let settings = lsGet("sv-settings") || {};
async function loadSettings(){ try{ settings = Object.assign({}, await api.getSettings()); lsSet("sv-settings", settings); }catch(e){} return settings; }
async function saveSettings(patch){ settings = Object.assign({}, settings, patch); lsSet("sv-settings", settings); try{ await api.saveSettings(settings); }catch(e){} }

/* ---------- Écrans ---------- */
const app = $("app");
const MODULES = { passeurs: window.PasseursSheet, equipe: window.EquipeSheet };
const TYPE_LAB = { passeurs:"Passeurs", equipe:"Équipe" };
let current = null; // feuille ouverte

function topbar(title, opts){
  opts = opts || {};
  const [lab, cls] = syncLabel(syncState);
  return '<div class="topbar"><button class="back" type="button" data-go="'+(opts.back||"accueil")+'">‹ '+(opts.backLabel||"Accueil")+'</button>'+
    '<div class="ttl">'+esc(title)+'</div><span class="sync '+cls+'" id="syncpill">'+esc(lab)+'</span></div>';
}
syncListeners.add(s=>{ const p=$("syncpill"); if(!p) return; const [lab,cls]=syncLabel(s); p.textContent=lab; p.className="sync "+cls;
  if(s==="auth") showLogin(true); });
function bindGo(root){ root.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go)); }
function go(h){ if(location.hash.slice(1)===h) route(); else location.hash = h; }

function renderHome(){
  app.innerHTML =
  '<div class="wrap home">'+
    '<div class="brand"><img src="icon-192.png" alt=""><div><h1>Stats volley</h1><div class="sub">'+esc(TEAM)+'</div></div></div>'+
    (DEMO?'<div class="notice warn">Mode démo : les données restent sur cet appareil. Remplis config.js pour les enregistrer en ligne.</div>':'')+
    '<div class="homegrid">'+
      '<button class="hbtn main" type="button" data-new="passeurs"><span class="ico">P</span><span class="txt"><span class="lab">Stats passeurs</span><span class="desc">Nouvelle feuille : qualité et position des passes, hors système, réception adverse</span></span></button>'+
      '<button class="hbtn" type="button" data-new="equipe"><span class="ico a">É</span><span class="txt"><span class="lab">Stats équipe</span><span class="desc">Nouvelle feuille : service, attaque, réception, bloc et défense par joueur</span></span></button>'+
      '<button class="hbtn" type="button" data-go="enregistrements"><span class="ico b">≡</span><span class="txt"><span class="lab">Enregistrements</span><span class="desc">Toutes les feuilles : rouvrir, continuer, rapport PDF</span></span></button>'+
    '</div>'+
    '<div class="recent" id="recent"></div>'+
    '<div class="homefoot"><span id="syncfoot"></span>'+(DEMO?'':'<button class="linkbtn" type="button" id="logout">Se déconnecter de cet appareil</button>')+'</div>'+
  '</div>';
  bindGo(app);
  app.querySelectorAll("[data-new]").forEach(b=>b.onclick=()=>newSheet(b.dataset.new));
  if($("logout")) $("logout").onclick=()=>dialog("Se déconnecter ?","<p>Il faudra entrer le mot de passe d’équipe pour revenir sur cet appareil.</p>",[{label:"Annuler"},{label:"Se déconnecter",danger:true,run:async()=>{ await api.signOut(); showLogin(); }}]);
  $("syncfoot").textContent = Object.keys(pending).length ? Object.keys(pending).length+" feuille(s) en attente d’envoi" : "";
  listSheets().then(rows=>{
    const box=$("recent"); if(!box) return;
    const last=rows.slice(0,3);
    box.innerHTML = last.length ? '<h3>Récents</h3><div class="rec-list">'+last.map(itemHTML).join("")+'</div>' : "";
    bindItems(box);
  });
}

function itemHTML(r){
  const d=dateParts(r.date);
  const f=folderOf(r.id);
  return '<div class="rec-item" data-id="'+esc(r.id)+'" data-type="'+esc(r.type)+'">'+
    '<div class="date"><b>'+d.d+'</b><span>'+d.m+'</span></div>'+
    '<button class="main" type="button" data-open aria-label="Ouvrir"><span class="opp"><span class="badge '+esc(r.type)+'">'+(TYPE_LAB[r.type]||r.type)+'</span>'+(r.adversaire?"vs "+esc(r.adversaire):"Adversaire non précisé")+'</span><span class="sub">'+(f?'<span class="fchip">'+esc(f.name)+'</span>':'')+esc(r.resume||"")+'</span></button>'+
    '<div class="acts"><button class="btn sm" type="button" data-pdf>PDF</button></div></div>';
}
function bindItems(root){
  root.querySelectorAll(".rec-item").forEach(el=>{
    const id=el.dataset.id, type=el.dataset.type;
    el.querySelector("[data-open]").onclick=()=>go(type+"/"+id);
    el.querySelector("[data-pdf]").onclick=async(e)=>{ const b=e.currentTarget; b.disabled=true; try{ const s=await loadSheet(id); await exportPDF(s); }catch(err){ toast("Impossible d’ouvrir la feuille"); } b.disabled=false; };
  });
}

/* ---------- Explorateur : dossiers et sous-dossiers (gardés dans les réglages partagés) ---------- */
const folders=()=>settings.folders||[];
const fById=id=>folders().find(f=>f.id===id)||null;
const folderOf=id=>{ const fid=(settings.sheetFolder||{})[id]; return fid?fById(fid):null; };
const parentOf=f=>f&&f.parent&&fById(f.parent)?f.parent:null;
const childFolders=pid=>folders().filter(f=>parentOf(f)===(pid||null)).sort((a,b)=>a.name.localeCompare(b.name,"fr"));
const sheetFolderId=id=>{ const fid=(settings.sheetFolder||{})[id]; return fid&&fById(fid)?fid:null; };
function descendants(fid){ const out=[]; const walk=p=>childFolders(p).forEach(f=>{ out.push(f.id); walk(f.id); }); walk(fid); return out; }
function pathTo(fid){ const p=[]; let f=fById(fid); while(f){ p.unshift(f); f=fById(parentOf(f)); } return p; }
function folderTreeOptions(exclude){
  const out=[]; const walk=(pid,depth)=>childFolders(pid).forEach(f=>{ if(exclude&&exclude.has(f.id)) return; out.push({f,depth}); walk(f.id,depth+1); }); walk(null,0); return out;
}
function askName(title, initial, cb){
  dialog(title,'<label class="f" for="fname">Nom du dossier<input type="text" id="fname" autocomplete="off" placeholder="ex. Tournoi Chicoutimi 22 nov."></label>',[
    {label:"Annuler"},
    {label:"Enregistrer",primary:true,run:()=>{ const v=$("fname").value.trim(); if(!v){ toast("Écris un nom"); return true; } cb(v); }}]);
  $("fname").value=initial||""; setTimeout(()=>$("fname").focus(),50);
}
function newFolder(parent, cb){ askName("Nouveau dossier","",name=>{ const f={id:uid(),name,parent:parent||null}; saveSettings({folders:[...folders(),f]}); cb&&cb(f); }); }
// Déplacer des feuilles et/ou des dossiers vers un dossier choisi dans l'arbre
function moveDialog(sheetIds, folderIds, onDone){
  const exclude=new Set(); folderIds.forEach(id=>{ exclude.add(id); descendants(id).forEach(x=>exclude.add(x)); });
  const n=sheetIds.length+folderIds.length;
  const opts=[{f:{id:"",name:"Enregistrements"},depth:0,root:true},...folderTreeOptions(exclude).map(o=>({...o,depth:o.depth+1}))];
  dialog(n>1?"Déplacer "+n+" éléments vers…":"Déplacer vers…",
    '<div class="tree">'+opts.map(o=>'<button type="button" class="treerow" data-dest="'+esc(o.f.id)+'" style="padding-left:'+(10+o.depth*20)+'px"><span class="ficon'+(o.root?' root':'')+'" aria-hidden="true"></span>'+esc(o.f.name)+'</button>').join("")+'</div>'+
    '<button type="button" class="btn sm" id="mvnew" style="margin-top:8px">+ Nouveau dossier à la racine</button>',
    [{label:"Annuler"}]);
  const apply=dest=>{
    const m={...(settings.sheetFolder||{})}; sheetIds.forEach(id=>{ if(dest) m[id]=dest; else delete m[id]; });
    const fl=folders().map(f=>folderIds.includes(f.id)?{...f,parent:dest||null}:f);
    saveSettings({sheetFolder:m,folders:fl}); $("dlg").close();
    toast("Déplacé dans « "+(dest?fById(dest).name:"Enregistrements")+" »"); onDone&&onDone();
  };
  document.querySelectorAll("#dlg [data-dest]").forEach(b=>b.onclick=()=>apply(b.dataset.dest));
  $("mvnew").onclick=()=>{ $("dlg").close(); newFolder(null,f=>apply(f.id)); };
}

let filter="all", selecting=false, selected=new Set(), cachedRows=null;
async function renderRecords(folderId){
  folderId=folderId&&fById(folderId)?folderId:(folderId||null);
  app.innerHTML='<div class="wrap explorer">'+topbar("Enregistrements")+
    '<div class="crumbs" id="crumbs"></div><div class="xbar" id="xbar"></div><div class="xlist" id="xlist"><div class="empty">Chargement…</div></div><div class="selbar" id="selbar" hidden></div></div>';
  bindGo(app);
  if(cachedRows) draw(); // affichage immédiat, puis mise à jour
  await loadSettings();
  if(folderId && !fById(folderId)){ go("enregistrements"); return; }
  cachedRows = await listSheets();
  draw();

  function draw(){
    const rows=cachedRows||[];
    const here=folderId||null;
    const deepIds=here?[here,...descendants(here)]:null;
    const countIn=fid=>{ const ids=[fid,...descendants(fid)]; return rows.filter(r=>ids.includes(sheetFolderId(r.id))).length; };
    // Fil d'Ariane
    const path=here?pathTo(here):[];
    $("crumbs").innerHTML='<button type="button" class="crumb'+(here?'':' cur')+'" data-goto="" data-drop="">Enregistrements</button>'+
      path.map((f,i)=>'<span class="sepc" aria-hidden="true">›</span><button type="button" class="crumb'+(i===path.length-1?' cur':'')+'" data-goto="'+esc(f.id)+'" data-drop="'+esc(f.id)+'">'+esc(f.name)+'</button>').join("");
    $("crumbs").querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>{ if(!b.classList.contains("cur")) go("enregistrements"+(b.dataset.goto?"/"+b.dataset.goto:"")); });
    // Barre d'outils
    const sheetsHere=rows.filter(r=>sheetFolderId(r.id)===here&&(filter==="all"||r.type===filter));
    const sub=childFolders(here);
    const fobj=here?fById(here):null;
    $("xbar").innerHTML='<div class="seg"><span class="cap">Type</span>'+[["all","Toutes"],["passeurs","Passeurs"],["equipe","Équipe"]].map(([v,l])=>'<button type="button" data-f="'+v+'" aria-pressed="'+(filter===v)+'">'+l+'</button>').join("")+'</div>'+
      '<div class="xtools"><button class="btn" type="button" id="xnew">+ Dossier</button>'+
      '<button class="btn" type="button" id="xsel" aria-pressed="'+selecting+'">'+(selecting?'Terminer':'Sélectionner')+'</button>'+
      '<button class="btn primary" type="button" id="xrecap">Rapport récapitulatif</button>'+
      (fobj?'<button class="btn" type="button" id="xmore" aria-label="Options du dossier">⋯</button>':'')+'</div>';
    $("xbar").querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{ filter=b.dataset.f; draw(); });
    $("xnew").onclick=()=>newFolder(here,()=>draw());
    $("xsel").onclick=()=>{ selecting=!selecting; selected.clear(); draw(); };
    $("xrecap").onclick=()=>{ const pool=rows.filter(r=>(here?deepIds.includes(sheetFolderId(r.id)):true)); if(!pool.length){ toast("Aucune feuille ici"); return; } recapDialog(pool, fobj?fobj.name:""); };
    if(fobj) $("xmore").onclick=()=>folderMenu(fobj);
    // Contenu : dossiers puis feuilles
    let h='';
    sub.forEach(f=>{ const n=countIn(f.id), nf=childFolders(f.id).length;
      h+='<div class="xrow folder" data-fid="'+esc(f.id)+'" data-drop="'+esc(f.id)+'">'+
        (selecting?'<span class="xcheck"></span>':'')+
        '<button type="button" class="xmain" data-openf="'+esc(f.id)+'"><span class="ficon" aria-hidden="true"></span><span class="xtxt"><span class="xname">'+esc(f.name)+'</span><span class="sub">'+n+' feuille'+(n>1?'s':'')+(nf?' · '+nf+' dossier'+(nf>1?'s':''):'')+'</span></span><span class="chev" aria-hidden="true">›</span></button>'+
        (selecting?'':'<button type="button" class="btn sm ghost" data-fmenu="'+esc(f.id)+'" aria-label="Options du dossier">⋯</button>')+'</div>'; });
    sheetsHere.forEach(r=>{ const dp=dateParts(r.date), chk=selected.has(r.id);
      h+='<div class="xrow sheet'+(chk?' sel':'')+'" data-id="'+esc(r.id)+'" data-type="'+esc(r.type)+'"'+(selecting?'':' draggable="true"')+'>'+
        (selecting?'<label class="xcheck"><input type="checkbox" data-pick="'+esc(r.id)+'" '+(chk?'checked':'')+' aria-label="Sélectionner"></label>':'')+
        '<button type="button" class="xmain" data-open><span class="doc '+esc(r.type)+'" aria-hidden="true">'+(r.type==="passeurs"?"P":"É")+'</span><span class="xtxt"><span class="xname">'+(r.adversaire?"vs "+esc(r.adversaire):"Adversaire non précisé")+'</span><span class="sub">'+dp.d+' '+dp.m+(dp.y?' '+dp.y:'')+' · '+(TYPE_LAB[r.type]||"")+' · '+esc(r.resume||"")+'</span></span></button>'+
        (selecting?'':'<div class="acts"><button class="btn sm" type="button" data-pdf>PDF</button><button class="btn sm ghost" type="button" data-smenu aria-label="Options de la feuille">⋯</button></div>')+'</div>'; });
    if(!sub.length && !sheetsHere.length) h='<div class="empty">'+(here?'Ce dossier est vide. Utilise « Déplacer » sur une feuille pour l’y placer, ou crée un sous-dossier.':'Aucune feuille pour l’instant. Crée-en une depuis l’accueil.')+'</div>';
    $("xlist").innerHTML=h;
    // Actions
    $("xlist").querySelectorAll("[data-openf]").forEach(b=>b.onclick=()=>{ if(selecting){ const id=b.dataset.openf; selected.has("f:"+id)?selected.delete("f:"+id):selected.add("f:"+id); draw(); return; } go("enregistrements/"+b.dataset.openf); });
    $("xlist").querySelectorAll("[data-fmenu]").forEach(b=>b.onclick=()=>folderMenu(fById(b.dataset.fmenu)));
    $("xlist").querySelectorAll(".xrow.sheet").forEach(el=>{
      const id=el.dataset.id, type=el.dataset.type;
      el.querySelector("[data-open]").onclick=()=>{ if(selecting){ selected.has(id)?selected.delete(id):selected.add(id); draw(); return; } go(type+"/"+id); };
      const pk=el.querySelector("[data-pick]"); if(pk) pk.onchange=()=>{ pk.checked?selected.add(id):selected.delete(id); draw(); };
      const pdf=el.querySelector("[data-pdf]"); if(pdf) pdf.onclick=async(e)=>{ const b=e.currentTarget; b.disabled=true; try{ const s=await loadSheet(id); await exportPDF(s); }catch(err){ toast("Impossible d’ouvrir la feuille"); } b.disabled=false; };
      const sm=el.querySelector("[data-smenu]"); if(sm) sm.onclick=()=>sheetMenu(rows.find(r=>r.id===id));
      el.addEventListener("dragstart",e=>{ e.dataTransfer.setData("text/plain",id); el.classList.add("dragging"); });
      el.addEventListener("dragend",()=>el.classList.remove("dragging"));
    });
    // Glisser-déposer (ordinateur) vers un dossier ou le fil d'Ariane
    document.querySelectorAll("#xlist [data-drop], #crumbs [data-drop]").forEach(t=>{
      t.addEventListener("dragover",e=>{ e.preventDefault(); t.classList.add("over"); });
      t.addEventListener("dragleave",()=>t.classList.remove("over"));
      t.addEventListener("drop",e=>{ e.preventDefault(); t.classList.remove("over"); const id=e.dataTransfer.getData("text/plain"); if(!id) return;
        const dest=t.dataset.drop||""; const m={...(settings.sheetFolder||{})}; if(dest) m[id]=dest; else delete m[id]; saveSettings({sheetFolder:m});
        toast("Déplacé dans « "+(dest?fById(dest).name:"Enregistrements")+" »"); draw(); });
    });
    // Folders selected via their row in selection mode
    if(selecting) $("xlist").querySelectorAll(".xrow.folder").forEach(el=>{ const on=selected.has("f:"+el.dataset.fid); el.classList.toggle("sel",on); const c=el.querySelector(".xcheck"); if(c) c.classList.toggle("on",on); });
    // Barre de sélection
    const sb=$("selbar");
    document.body.classList.toggle("selecting",selecting);
    if(selecting){
      const sIds=[...selected].filter(x=>!x.startsWith("f:")), fIds=[...selected].filter(x=>x.startsWith("f:")).map(x=>x.slice(2));
      const n=sIds.length+fIds.length;
      sb.hidden=false;
      sb.innerHTML='<span class="selcount">'+(n?n+' sélectionné'+(n>1?'s':''):'Touche des éléments pour les sélectionner')+'</span>'+
        '<button class="btn" type="button" id="sall">Tout</button>'+
        '<button class="btn" type="button" id="smove" '+(n?'':'disabled')+'>Déplacer</button>'+
        '<button class="btn primary" type="button" id="srecap" '+(sIds.length?'':'disabled')+'>Rapport</button>'+
        '<button class="btn danger" type="button" id="sdel" '+(sIds.length&&!fIds.length?'':'disabled')+'>Supprimer</button>';
      $("sall").onclick=()=>{ sheetsHere.forEach(r=>selected.add(r.id)); sub.forEach(f=>selected.add("f:"+f.id)); draw(); };
      $("smove").onclick=()=>moveDialog(sIds,fIds,()=>{ selected.clear(); draw(); });
      $("srecap").onclick=()=>recapDialog(rows.filter(r=>sIds.includes(r.id)), fobj?fobj.name:"");
      $("sdel").onclick=()=>dialog("Supprimer "+sIds.length+" feuille"+(sIds.length>1?"s":"")+" ?","<p>Elles seront effacées pour tous les appareils. Cette action est définitive.</p>",[{label:"Annuler"},{label:"Supprimer",danger:true,run:async()=>{
        const m={...(settings.sheetFolder||{})}; let fail=0;
        for(const id of sIds){ try{ await deleteSheet(id); delete m[id]; cachedRows=cachedRows.filter(r=>r.id!==id); }catch(e){ fail++; } }
        saveSettings({sheetFolder:m}); selected.clear(); toast(fail?"Certaines feuilles n’ont pas pu être supprimées (hors ligne ?)":"Supprimé"); draw(); }}]);
    } else { sb.hidden=true; sb.innerHTML=""; }
  }
  function folderMenu(f){
    dialog("Dossier « "+f.name+" »","",[
      {label:"Renommer",run:()=>{ setTimeout(()=>askName("Renommer le dossier",f.name,name=>{ saveSettings({folders:folders().map(x=>x.id===f.id?{...x,name}:x)}); draw(); }),0); }},
      {label:"Déplacer",run:()=>{ setTimeout(()=>moveDialog([],[f.id],()=>draw()),0); }},
      {label:"Supprimer",danger:true,run:()=>{ setTimeout(()=>dialog("Supprimer « "+f.name+" » ?","<p>Les feuilles et les sous-dossiers ne sont pas supprimés : ils remontent dans le dossier parent.</p>",[{label:"Annuler"},{label:"Supprimer le dossier",danger:true,run:()=>{
        const up=parentOf(f); const m={...(settings.sheetFolder||{})}; Object.keys(m).forEach(k=>{ if(m[k]===f.id){ if(up) m[k]=up; else delete m[k]; } });
        const fl=folders().filter(x=>x.id!==f.id).map(x=>x.parent===f.id?{...x,parent:up}:x);
        saveSettings({folders:fl,sheetFolder:m}); if(folderId===f.id) go("enregistrements"+(up?"/"+up:"")); else draw(); }}]),0); }},
      {label:"Fermer"}]);
  }
  function sheetMenu(r){
    if(!r) return;
    dialog((r.adversaire?"vs "+r.adversaire:"Feuille")+" · "+(TYPE_LAB[r.type]||""),"",[
      {label:"Ouvrir",primary:true,run:()=>{ go(r.type+"/"+r.id); }},
      {label:"Déplacer",run:()=>{ setTimeout(()=>moveDialog([r.id],[],()=>draw()),0); }},
      {label:"Supprimer",danger:true,run:()=>{ setTimeout(()=>dialog("Supprimer cette feuille ?","<p>Elle sera effacée pour tous les appareils. Cette action est définitive.</p>",[{label:"Annuler"},{label:"Supprimer",danger:true,run:async()=>{
        try{ await deleteSheet(r.id); const m={...(settings.sheetFolder||{})}; delete m[r.id]; saveSettings({sheetFolder:m}); cachedRows=cachedRows.filter(x=>x.id!==r.id); toast("Feuille supprimée"); draw(); }catch(e){ toast("Suppression impossible hors ligne"); } }}]),0); }},
      {label:"Fermer"}]);
  }
}

/* ---------- Rapport récapitulatif de plusieurs feuilles ---------- */
function recapDialog(rows, folderName){
  const has=t=>rows.some(x=>x.type===t);
  let type=filter!=="all"&&has(filter)?filter:(rows.filter(x=>x.type==="passeurs").length>=rows.filter(x=>x.type==="equipe").length?"passeurs":"equipe");
  let picked=new Set(rows.map(x=>x.id));
  const body=()=>{
    const list=rows.filter(x=>x.type===type);
    return '<div class="seg" style="margin-bottom:8px">'+["passeurs","equipe"].map(t=>'<button type="button" data-rt="'+t+'" aria-pressed="'+(type===t)+'" '+(has(t)?'':'disabled')+'>'+TYPE_LAB[t]+'</button>').join("")+'</div>'+
      '<label class="f" for="rtitle">Titre du rapport<input type="text" id="rtitle" autocomplete="off" placeholder="ex. Tournoi du 22 novembre"></label>'+
      '<div class="sec" style="margin-top:10px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Feuilles à inclure</div>'+
      '<div class="picklist">'+list.map(x=>{ const dp=dateParts(x.date); return '<label class="pick"><input type="checkbox" data-pk="'+esc(x.id)+'" '+(picked.has(x.id)?'checked':'')+'><span><b>'+dp.d+' '+dp.m+'</b> '+(x.adversaire?"vs "+esc(x.adversaire):"Adversaire non précisé")+'</span></label>'; }).join("")+'</div>';
  };
  const d=dialog("Rapport récapitulatif",'<div id="rbody"></div>',[
    {label:"Annuler"},
    {label:"Créer le PDF",primary:true,run:async(btn)=>{
      const ids=rows.filter(x=>x.type===type&&picked.has(x.id)).map(x=>x.id);
      if(!ids.length){ toast("Choisis au moins une feuille"); return true; }
      if(!window.jspdf){ toast("Le module PDF n’est pas chargé (réseau ?)"); return true; }
      btn.disabled=true; btn.textContent="Préparation…";
      try{
        const sheets=[]; for(const id of ids){ const s=await loadSheet(id); if(s) sheets.push(s); }
        const title=$("rtitle").value.trim()||folderName||"";
        const blob=MODULES[type].recap(sheets, TEAM, title);
        await saveBlob(blob,"Récap "+TYPE_LAB[type].toLowerCase()+" "+(title?title.replace(/[\\/:*?"<>|]+/g,"")+" ":"")+today()+".pdf");
        return false;
      }catch(e){ console.error(e); toast("Le rapport n’a pas pu être créé"); }
      btn.disabled=false; btn.textContent="Créer le PDF"; return true;
    }}]);
  const draw=()=>{ const t=$("rtitle")?$("rtitle").value:folderName; $("rbody").innerHTML=body(); $("rtitle").value=t||"";
    $("rbody").querySelectorAll("[data-rt]").forEach(b=>b.onclick=()=>{ type=b.dataset.rt; draw(); });
    $("rbody").querySelectorAll("[data-pk]").forEach(c=>c.onchange=()=>{ if(c.checked) picked.add(c.dataset.pk); else picked.delete(c.dataset.pk); }); };
  draw();
}

async function newSheet(type){
  const M=MODULES[type]; await loadSettings();
  const sheet={ id:uid(), type, date:today(), adversaire:"", resume:"", data:M.blank(settings) };
  lsSet("sv-sheet-"+sheet.id, sheet);
  go(type+"/"+sheet.id);
}

async function openSheet(type, id){
  const M=MODULES[type];
  app.innerHTML='<div class="wrap">'+topbar(TYPE_LAB[type])+'<div class="empty">Chargement…</div></div>'; bindGo(app);
  let sheet=null;
  try{ sheet = await loadSheet(id); }catch(e){}
  if(!sheet){ app.querySelector(".empty").textContent="Feuille introuvable."; return; }
  current = sheet;
  app.innerHTML='<div class="wrap">'+topbar(TYPE_LAB[type]+(sheet.adversaire?" · "+sheet.adversaire:""))+'<div id="sheet" style="display:flex;flex-direction:column;gap:12px"></div></div>';
  bindGo(app);
  M.mount($("sheet"), sheet, {
    changed(){ // appelé après chaque action
      const s=M.summary(sheet); sheet.resume=s.resume; sheet.adversaire=sheet.data.opp||""; sheet.date=sheet.data.date||null;
      const ttl=app.querySelector(".topbar .ttl"); if(ttl) ttl.textContent=TYPE_LAB[type]+(sheet.adversaire?" · "+sheet.adversaire:"");
      if(!s.empty || sheet._saved){ sheet._saved=true; const {_saved,...row}=sheet; queueSave(row); }
    },
    exportPDF:()=>exportPDF(sheet),
    settings, saveSettings, team:TEAM,
    util:{ $, esc, pct, toast, dialog, vibrate, uid }
  });
}

async function exportPDF(sheet){
  const M=MODULES[sheet.type];
  if(!window.jspdf){ toast("Le module PDF n’est pas chargé (réseau ?)"); return; }
  let blob;
  try{ blob = M.pdf(sheet, TEAM); }catch(e){ console.error(e); toast("Le PDF n’a pas pu être créé"); return; }
  const fname = "Stats "+TYPE_LAB[sheet.type].toLowerCase()+" "+(sheet.adversaire?sheet.adversaire.replace(/[\\/:*?"<>|]+/g,"")+" ":"")+(sheet.date||"")+".pdf";
  return saveBlob(blob, fname);
}
async function saveBlob(blob, fname){
  if(window.claude && typeof window.claude.use==="function"){
    try{ const dl=await window.claude.use("downloads"); if(dl){ await dl.save({filename:fname,data:blob}); return; } }
    catch(e){ if(e && e.code==="declined") return; }
  }
  const file = new File([blob], fname, { type:"application/pdf" });
  // iPhone/iPad : feuille de partage (Enregistrer dans Fichiers, AirDrop, courriel…)
  const touch = window.matchMedia && matchMedia("(pointer:coarse)").matches;
  if(touch && navigator.canShare && navigator.canShare({ files:[file] })){
    try{ await navigator.share({ files:[file], title:fname }); return; }
    catch(e){ if(e && e.name==="AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=fname; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 30000);
}

/* ---------- Connexion ---------- */
function showLogin(expired){
  app.innerHTML='<div class="login"><div class="brand"><img src="icon-192.png" alt=""><div><h1>Stats volley</h1><div class="sub">'+esc(TEAM)+'</div></div></div>'+
    '<form id="lf"><label class="f" for="pw">Mot de passe d’équipe<input type="password" id="pw" autocomplete="current-password" required></label>'+
    '<div class="err" id="lerr">'+(expired?"Session expirée, entre le mot de passe à nouveau.":"")+'</div>'+
    '<button class="btn primary" type="submit" id="lbtn">Entrer</button>'+
    '<div class="sub">À faire une seule fois par appareil.</div></form></div>';
  $("lf").onsubmit=async e=>{
    e.preventDefault(); $("lbtn").disabled=true; $("lerr").textContent="";
    try{ await api.signIn($("pw").value); await loadSettings(); flush(); route(); }
    catch(err){ $("lerr").textContent = /fetch|network/i.test(err.message||"") ? "Pas de réseau. Réessaie quand tu es connecté." : "Mot de passe incorrect."; }
    $("lbtn").disabled=false;
  };
  setTimeout(()=>{ const p=$("pw"); p && p.focus(); }, 50);
}

/* ---------- Navigation ---------- */
async function route(){
  document.body.classList.remove("correct","selecting"); selected.clear();
  const h=location.hash.slice(1)||"accueil";
  const [view,id]=h.split("/");
  window.scrollTo(0,0);
  if(view==="enregistrements") return renderRecords(id||null);
  if((view==="passeurs"||view==="equipe") && id) return openSheet(view,id);
  renderHome();
}
window.addEventListener("hashchange", route);

(async function start(){
  let ok=false;
  try{ ok = await api.signedIn(); }catch(e){ ok = !!lsGet("stats-volley-auth"); }
  if(!ok){ showLogin(); return; }
  loadSettings(); flush(); route();
})();

if("serviceWorker" in navigator && location.protocol==="https:"){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }
})();
