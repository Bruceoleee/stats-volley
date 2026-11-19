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
  catch(e){ rows = lsGet("sv-list") || []; toast("Hors ligne : liste de l’appareil"); }
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
    '<div class="brand"><img src="icons/icon-192.png" alt=""><div><h1>Stats volley</h1><div class="sub">'+esc(TEAM)+'</div></div></div>'+
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
  return '<div class="rec-item" data-id="'+esc(r.id)+'" data-type="'+esc(r.type)+'">'+
    '<div class="date"><b>'+d.d+'</b><span>'+d.m+'</span></div>'+
    '<button class="main" type="button" data-open aria-label="Ouvrir"><span class="opp"><span class="badge '+esc(r.type)+'">'+(TYPE_LAB[r.type]||r.type)+'</span>'+(r.adversaire?"vs "+esc(r.adversaire):"Adversaire non précisé")+'</span><span class="sub">'+esc(r.resume||"")+'</span></button>'+
    '<div class="acts"><button class="btn sm" type="button" data-pdf>PDF</button><button class="btn sm danger" type="button" data-del aria-label="Supprimer">✕</button></div></div>';
}
function bindItems(root){
  root.querySelectorAll(".rec-item").forEach(el=>{
    const id=el.dataset.id, type=el.dataset.type;
    el.querySelector("[data-open]").onclick=()=>go(type+"/"+id);
    el.querySelector("[data-pdf]").onclick=async(e)=>{ const b=e.currentTarget; b.disabled=true; try{ const s=await loadSheet(id); await exportPDF(s); }catch(err){ toast("Impossible d’ouvrir la feuille"); } b.disabled=false; };
    el.querySelector("[data-del]").onclick=()=>dialog("Supprimer cette feuille ?","<p>Elle sera effacée pour tous les appareils. Cette action est définitive.</p>",[
      {label:"Annuler"},{label:"Supprimer",danger:true,run:async()=>{ try{ await deleteSheet(id); el.remove(); toast("Feuille supprimée"); }catch(e){ toast("Suppression impossible hors ligne"); } }}]);
  });
}

let filter="all";
async function renderRecords(){
  app.innerHTML='<div class="wrap">'+topbar("Enregistrements")+
    '<div class="filters" id="filters"></div><div class="rec-list" id="list"><div class="empty">Chargement…</div></div></div>';
  bindGo(app);
  const rows = await listSheets();
  const draw=()=>{
    $("filters").innerHTML=[["all","Toutes"],["passeurs","Passeurs"],["equipe","Équipe"]].map(([v,l])=>'<button class="chip-btn" type="button" data-f="'+v+'" aria-pressed="'+(filter===v)+'">'+l+'</button>').join("");
    $("filters").querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{ filter=b.dataset.f; draw(); });
    const r=rows.filter(x=>filter==="all"||x.type===filter);
    $("list").innerHTML = r.length ? r.map(itemHTML).join("") : '<div class="empty">Aucune feuille pour l’instant. Crée-en une depuis l’accueil.</div>';
    bindItems($("list"));
  };
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
  if(window.claude && typeof window.claude.use==="function"){
    try{ const dl=await window.claude.use("downloads"); if(dl){ await dl.save({filename:fname,data:blob}); return; } }
    catch(e){ if(e && e.code==="declined") return; }
  }
  const file = new File([blob], fname, { type:"application/pdf" });
  // iPhone/iPad : feuille de partage (Enregistrer dans Fichiers, AirDrop, courriel…)
  if(navigator.canShare && navigator.canShare({ files:[file] })){
    try{ await navigator.share({ files:[file], title:fname }); return; }
    catch(e){ if(e && e.name==="AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=fname; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 30000);
}

/* ---------- Connexion ---------- */
function showLogin(expired){
  app.innerHTML='<div class="login"><div class="brand"><img src="icons/icon-192.png" alt=""><div><h1>Stats volley</h1><div class="sub">'+esc(TEAM)+'</div></div></div>'+
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
  document.body.classList.remove("correct");
  const h=location.hash.slice(1)||"accueil";
  const [view,id]=h.split("/");
  window.scrollTo(0,0);
  if(view==="enregistrements") return renderRecords();
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
