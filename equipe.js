/* Feuille « Stats équipe » : service, attaque, réception, bloc, défense, par joueur.
   Les joueurs et leur ordre sont propres à chaque set (copiés du set précédent). */
(function(){
"use strict";
const SETS=[1,2,3];
const CATS = {
  srv:{ lab:"Service", btn:[["A","Ace"],["I","En jeu"],["E","Erreur"]] },
  att:{ lab:"Attaque", btn:[["K","Kill"],["I","En jeu"],["E","Erreur"]] },
  rec:{ lab:"Réception", btn:[[0,"0"],[2,"2"],[3,"3"]] },
  blk:{ lab:"Bloc", btn:[["G","Gagné"],["T","Touché"]] },
  def:{ lab:"Défense", btn:[["R","Réussie"],["E","Manquée"]] }
};
const COLS=[
  {k:"srv",v:"A",l:"Ace",c:"q-M"},{k:"srv",v:"I",l:"Jeu",c:"q-N"},{k:"srv",v:"E",l:"Err",c:"q-X"},
  {k:"att",v:"K",l:"Kill",c:"q-M"},{k:"att",v:"I",l:"Jeu",c:"q-N"},{k:"att",v:"E",l:"Err",c:"q-X"},
  {k:"rec",v:0,l:"0",c:"r-0"},{k:"rec",v:2,l:"2",c:"r-2"},{k:"rec",v:3,l:"3",c:"r-3"},
  {k:"blk",v:"G",l:"Gagné",c:"q-M"},{k:"blk",v:"T",l:"Touché",c:"q-N"},
  {k:"def",v:"R",l:"Réus.",c:"q-M"},{k:"def",v:"E",l:"Manq.",c:"q-X"}
];
const GROUPS=[{id:"srv",l:"Service",sh:"Serv.",ks:["srv"]},{id:"att",l:"Attaque",sh:"Att.",ks:["att"]},{id:"rec",l:"Réception",sh:"Réc.",ks:["rec"]},{id:"bd",l:"Bloc · Déf.",sh:"B · D",ks:["blk","def"]}];
const VALID={srv:["A","I","E"],att:["K","I","E"],rec:[0,2,3],blk:["G","T"],def:["R","E"]};

function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function blank(settings){
  const players=((settings&&settings.players)||[]).map(p=>({id:p.id,num:p.num,name:p.name}));
  return { opp:"", date:today(), view:1, players, lineups:{}, events:[] };
}
const filt=(d,s)=>d.events.filter(e=>s==="all"||e.s===s);
// Les anciennes valeurs (attaque bloquée, réception 1) sont ignorées
const ok=e=>VALID[e.k]&&VALID[e.k].includes(e.v);
function stats(E){
  E=E.filter(ok);
  const c=(k,v)=>E.filter(e=>e.k===k&&(v===undefined||e.v===v)).length;
  const srv={n:c("srv"),A:c("srv","A"),I:c("srv","I"),E:c("srv","E")};
  const att={n:c("att"),K:c("att","K"),I:c("att","I"),E:c("att","E")};
  const rec={n:c("rec"),c:{0:c("rec",0),2:c("rec",2),3:c("rec",3)}}; rec.plus=rec.c[2]+rec.c[3];
  const blk={G:c("blk","G"),T:c("blk","T")};
  const def={R:c("def","R"),E:c("def","E")};
  return {srv,att,rec,blk,def};
}
const PCT=(a,b)=>b?Math.round(100*a/b)+" %":"–";
const played=d=>SETS.filter(s=>d.events.some(e=>e.s===s));
const pName=(d,id)=>{ if(id==null) return "Non attribué"; const p=d.players.find(x=>x.id===id); return p?((p.num!==""&&p.num!=null?"#"+p.num+" ":"")+(p.name||"Joueur")):"Joueur retiré"; };
const activeIds=d=>d.players.filter(p=>!p.out).map(p=>p.id);
function lineup(d,s){
  d.lineups=d.lineups||{};
  if(!d.lineups[s]){
    let prev=null; for(let k=s-1;k>=1;k--){ if(d.lineups[k]){ prev=d.lineups[k]; break; } }
    d.lineups[s]=(prev||activeIds(d)).filter(id=>d.players.some(p=>p.id===id&&!p.out));
  }
  return d.lineups[s];
}
// Joueurs à afficher : ordre du set, plus ceux qui ont des stats dans ce set sans y être
function rowsFor(d,scope){
  const E=filt(d,scope);
  let ids;
  if(scope==="all"){
    const used=new Set(); SETS.forEach(s=>((d.lineups||{})[s]||[]).forEach(id=>used.add(id))); E.forEach(e=>used.add(e.p));
    ids=d.players.map(p=>p.id).filter(id=>used.has(id));
    if(!ids.length) ids=activeIds(d);
  } else ids=[...lineup(d,scope)];
  E.forEach(e=>{ if(e.p!=null && !ids.includes(e.p)) ids.push(e.p); });
  if(E.some(e=>e.p==null)) ids.push(null);
  return ids;
}
const setsOf=(d,id)=>SETS.filter(s=>((d.lineups||{})[s]||[]).includes(id)||d.events.some(e=>e.s===s&&e.p===id));
function summary(sheet){
  const d=sheet.data, s=stats(d.events), n=played(d).length;
  return { empty:!d.events.length&&!d.opp, resume:(n?n+" set"+(n>1?"s":"")+" · ":"")+"Service "+PCT(s.srv.A+s.srv.I,s.srv.n)+" en jeu · Kill "+PCT(s.att.K,s.att.n)+" · Réc. 2+ "+PCT(s.rec.plus,s.rec.n) };
}

function mount(root, sheet, ctx){
  const d=sheet.data, U=ctx.util, $=U.$, esc=U.esc, pct=U.pct;
  if(!SETS.includes(d.view)&&d.view!=="all") d.view=1;
  d.players=d.players||[]; d.lineups=d.lineups||{};
  let correct=false, sView=null;
  let cat = window.matchMedia && matchMedia("(max-width:760px)").matches ? "srv" : "all";
  root.innerHTML=
  '<div class="meta c2"><label class="f" for="opp">Adversaire<input type="text" id="opp" placeholder="Équipe" autocomplete="off"></label><label class="f" for="date">Date<input type="date" id="date"></label></div>'+
  '<div class="bar"><div class="seg" id="sets"></div><div class="seg" id="cats"></div>'+
    '<div class="tools"><button class="btn" id="undo" type="button" aria-label="Annuler la dernière action">↶<span class="t"> Annuler</span></button>'+
    '<button class="btn" id="correct" type="button" aria-pressed="false" aria-label="Mode correction">−1<span class="t"> Corriger</span></button>'+
    '<button class="btn" id="lineupbtn" type="button">Joueurs</button>'+
    '<button class="btn stats" id="stats" type="button">Stats</button>'+
    '<button class="btn primary" id="pdf" type="button">PDF</button></div></div>'+
  '<section class="card" id="gridcard"><div class="tscroll"><table class="tgrid" id="tgrid"></table></div><div class="sub" id="ghint"></div></section>'+
  '<dialog class="statsdlg" id="sdlg" aria-labelledby="sd-t"><div class="sd-head"><h2 id="sd-t">Statistiques</h2><div class="seg" id="sd-scope"></div><button class="btn" type="button" id="sd-close">Fermer</button></div><div class="sd-body" id="sd-body"></div></dialog>';

  const changed=()=>ctx.changed();
  function act(p,k,v,key){
    if(d.view==="all"){ U.toast("Choisis un set pour saisir"); return; }
    if(correct){
      for(let i=d.events.length-1;i>=0;i--){ const e=d.events[i];
        if(e.s===d.view&&e.k===k&&e.v===v&&e.p===p){ d.events.splice(i,1); changed(); render(); U.toast("−1 retiré"); return; } }
      U.toast("Rien à retirer ici"); return;
    }
    d.events.push({s:d.view,p,k,v,t:Date.now()}); changed(); U.vibrate(); render();
    const f=root.querySelector('[data-key="'+key+'"]'); if(f){ f.classList.remove("flash"); void f.offsetWidth; f.classList.add("flash"); }
  }
  function seg(id,cap,items,cur,pick){
    const box=$(id); box.innerHTML=cap?'<span class="cap">'+cap+'</span>':'';
    items.forEach(it=>{ const b=document.createElement("button"); b.type="button"; if(it.sh) b.innerHTML='<span class="l">'+it.l+'</span><span class="s">'+it.sh+'</span>'; else b.textContent=it.l; b.setAttribute("aria-pressed",String(cur===it.v)); b.onclick=()=>pick(it.v); box.appendChild(b); });
  }

  function render(){
    seg("sets","Set",[...SETS.map(s=>({v:s,l:String(s)})),{v:"all",l:"Match"}],d.view,v=>{d.view=v; if(v!=="all"){ const had=!!d.lineups[v]; lineup(d,v); if(!had && d.players.length) changed(); } render();});
    seg("cats","Voir",[{v:"all",l:"Tout"},...GROUPS.map(g=>({v:g.id,l:g.l,sh:g.sh}))],cat,v=>{cat=v;render();});
    const E=filt(d,d.view);
    const groups=cat==="all"?GROUPS:GROUPS.filter(g=>g.id===cat);
    const cols=COLS.filter(c=>groups.some(g=>g.ks.includes(c.k)));
    const ids=rowsFor(d,d.view);
    $("gridcard").classList.toggle("lock",d.view==="all");
    $("tgrid").className="tgrid"+(cat==="all"?" all":" one");
    $("lineupbtn").disabled=d.view==="all";

    let h='<colgroup><col class="cn">'+cols.map(()=>'<col>').join('')+'</colgroup><thead><tr class="grp"><th></th>';
    groups.forEach(g=>{ const n=cols.filter(c=>g.ks.includes(c.k)).length; h+=g.id==="bd"?'<th colspan="2" class="gs">Bloc</th><th colspan="2" class="gs">Défense</th>':'<th colspan="'+n+'" class="gs">'+g.l+'</th>'; });
    h+='</tr><tr class="sl"><th></th>';
    cols.forEach((c,i)=>{ const first=i===0||cols[i-1].k!==c.k; h+='<th class="'+(first?"g0":"")+'">'+c.l+'</th>'; });
    h+='</tr></thead><tbody>';
    if(!ids.length) h+='<tr><td colspan="'+(cols.length+1)+'" class="sub" style="text-align:left;padding:16px 4px">'+(d.players.length?'Aucun joueur dans ce set. Touche « Joueurs » pour choisir qui joue et dans quel ordre.':'Touche « Joueurs » pour inscrire l’équipe. La liste est gardée pour les prochaines feuilles.')+'</td></tr>';
    ids.forEach(id=>{
      const PE=E.filter(e=>e.p===id), p=d.players.find(x=>x.id===id);
      h+='<tr><th class="pn" scope="row">'+(p&&p.num!==""&&p.num!=null?'<b>'+esc(p.num)+'</b>':'')+'<span class="nm">'+esc(p?(p.name||"Joueur"):pName(d,id))+'</span></th>';
      cols.forEach((c,i)=>{ const first=i===0||cols[i-1].k!==c.k; const n=PE.filter(e=>e.k===c.k&&e.v===c.v).length;
        const key=(id||"x")+"-"+c.k+"-"+c.v;
        h+='<td class="'+(first?"g0":"")+'"><button type="button" class="tc '+c.c+'" data-p="'+esc(id||"")+'" data-k="'+c.k+'" data-v="'+c.v+'" data-key="'+esc(key)+'" aria-label="'+esc((p&&p.name)||"")+' '+CATS[c.k].lab+' '+c.l+'">'+(n||"")+'</button></td>'; });
      h+='</tr>';
    });
    h+='</tbody><tfoot><tr><th class="pn" scope="row"><span>Équipe</span></th>';
    cols.forEach((c,i)=>{ const first=i===0||cols[i-1].k!==c.k; h+='<td class="'+(first?"g0":"")+'">'+E.filter(e=>e.k===c.k&&e.v===c.v).length+'</td>'; });
    h+='</tr></tfoot>';
    $("tgrid").innerHTML=h;
    $("tgrid").querySelectorAll(".tc").forEach(b=>b.onclick=()=>{ const k=b.dataset.k; act(b.dataset.p||null,k,k==="rec"?+b.dataset.v:b.dataset.v,b.dataset.key); });
    $("ghint").textContent=d.view==="all"?"Vue du match : choisis un set pour saisir.":"Une touche = +1 pour ce joueur. Réception : 3 parfaite · 2 jouable · 0 ace subi. « Joueurs » règle qui joue ce set et dans quel ordre.";
  }

  /* ---------- Joueurs du set : qui joue et dans quel ordre ---------- */
  function editLineup(){
    const s=d.view; if(s==="all") return;
    let order=[...lineup(d,s)];
    const draw=()=>{
      const box=document.getElementById("lineupbox");
      const off=d.players.filter(p=>!p.out&&!order.includes(p.id));
      const row=(id,i,inSet)=>{ const p=d.players.find(x=>x.id===id); if(!p) return "";
        return '<div class="lr'+(inSet?'':' off')+'">'+
          (inSet?'<button type="button" class="mv" data-up="'+i+'" aria-label="Monter" '+(i===0?'disabled':'')+'>↑</button><button type="button" class="mv" data-dn="'+i+'" aria-label="Descendre" '+(i===order.length-1?'disabled':'')+'>↓</button>':'<span></span><span></span>')+
          '<span class="nm">'+(p.num?'<b>'+esc(p.num)+'</b>':'')+esc(p.name||"Joueur")+'</span>'+
          '<button type="button" class="tg" data-tg="'+esc(id)+'" aria-pressed="'+inSet+'" aria-label="'+(inSet?'Retirer du set':'Ajouter au set')+'">'+(inSet?'✓':'+')+'</button></div>'; };
      box.innerHTML=(order.length?'<div class="sec">Dans le set '+s+' · dans l’ordre</div>'+order.map((id,i)=>row(id,i,true)).join(""):'<div class="sec">Personne dans ce set pour l’instant</div>')+
        (off.length?'<div class="sec">Pas dans ce set</div>'+off.map(p=>row(p.id,-1,false)).join(""):'');
      box.querySelectorAll("[data-up]").forEach(b=>b.onclick=()=>{ const i=+b.dataset.up; [order[i-1],order[i]]=[order[i],order[i-1]]; draw(); });
      box.querySelectorAll("[data-dn]").forEach(b=>b.onclick=()=>{ const i=+b.dataset.dn; [order[i+1],order[i]]=[order[i],order[i+1]]; draw(); });
      box.querySelectorAll("[data-tg]").forEach(b=>b.onclick=()=>{ const id=b.dataset.tg; if(order.includes(id)) order=order.filter(x=>x!==id); else order.push(id); draw(); });
    };
    const prev=s>1?(d.lineups[s-1]||null):null;
    U.dialog("Joueurs du set "+s,'<p class="sub">Coche qui joue ce set et place-les dans l’ordre voulu avec ↑ ↓. Chaque set a sa propre liste.</p><div class="lineup" id="lineupbox"></div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'+(prev?'<button type="button" class="btn sm" id="lcopy">Copier le set '+(s-1)+'</button>':'')+'<button type="button" class="btn sm" id="lroster">Modifier l’équipe (noms, numéros)</button></div>',[
      {label:"Annuler"},
      {label:"Enregistrer",primary:true,run:()=>{ d.lineups[s]=order; changed(); render(); }}]);
    draw();
    if(prev) document.getElementById("lcopy").onclick=()=>{ order=prev.filter(id=>d.players.some(p=>p.id===id&&!p.out)); draw(); };
    document.getElementById("lroster").onclick=()=>{ document.getElementById("dlg").close(); editRoster(); };
  }

  /* ---------- Équipe : noms et numéros ---------- */
  function editRoster(){
    const list=d.players.filter(p=>!p.out).map(p=>({...p}));
    const rowHTML=(p,i)=>'<div class="r" data-i="'+i+'"><input type="text" inputmode="numeric" placeholder="#" value="'+esc(p.num??"")+'" data-f="num" aria-label="Numéro"><input type="text" placeholder="Nom" value="'+esc(p.name||"")+'" data-f="name" aria-label="Nom"><button type="button" class="btn sm danger" data-rm aria-label="Retirer">✕</button></div>';
    const draw=()=>{ const box=document.getElementById("rosterbox"); box.innerHTML=list.map(rowHTML).join("")||'<div class="sub">Aucun joueur.</div>';
      box.querySelectorAll(".r").forEach(r=>{ const i=+r.dataset.i;
        r.querySelectorAll("input[type=text]").forEach(inp=>inp.oninput=()=>{ list[i][inp.dataset.f]=inp.value; });
        r.querySelector("[data-rm]").onclick=()=>{ list.splice(i,1); draw(); }; }); };
    U.dialog("Équipe",'<p class="sub">Numéro et nom de chaque joueur. La liste est gardée pour les prochaines feuilles. Un nouveau joueur est ajouté à la fin du set en cours.</p><div class="roster" id="rosterbox"></div><button type="button" class="btn sm" id="addp" style="margin-top:8px">+ Ajouter un joueur</button>',[
      {label:"Annuler"},
      {label:"Enregistrer",primary:true,run:()=>{
        const before=new Set(d.players.map(p=>p.id));
        const clean=list.filter(p=>(p.name||"").trim()||String(p.num||"").trim()).map(p=>({id:p.id||U.uid(),num:String(p.num||"").trim(),name:(p.name||"").trim()}));
        const keep=new Set(clean.map(p=>p.id));
        const removed=d.players.filter(p=>!keep.has(p.id)&&d.events.some(e=>e.p===p.id)).map(p=>({...p,out:true}));
        d.players=[...clean,...removed];
        Object.keys(d.lineups).forEach(s=>{ d.lineups[s]=d.lineups[s].filter(id=>keep.has(id)); });
        const added=clean.filter(p=>!before.has(p.id)).map(p=>p.id);
        if(d.view!=="all"){ const l=lineup(d,d.view); added.forEach(id=>{ if(!l.includes(id)) l.push(id); }); }
        ctx.saveSettings({players:clean});
        changed(); render();
      }}]);
    draw();
    document.getElementById("addp").onclick=()=>{ list.push({id:U.uid(),num:"",name:""}); draw(); const ins=document.querySelectorAll("#rosterbox input[data-f=num]"); ins.length&&ins[ins.length-1].focus(); };
    if(!list.length) document.getElementById("addp").click();
  }

  /* ---------- Panneau des stats ---------- */
  function kv(k,v,dd){ return '<div class="kv"><span class="k">'+esc(k)+'</span><span class="v">'+v+'</span><span class="d">'+esc(dd||"")+'</span></div>'; }
  function renderStats(){
    seg("sd-scope","",[...SETS.map(s=>({v:s,l:"Set "+s})),{v:"all",l:"Match"}],sView,v=>{sView=v;renderStats();});
    const E=filt(d,sView), S=stats(E);
    let o='<div class="statrow">'+kv("Service en jeu",pct(S.srv.A+S.srv.I,S.srv.n),S.srv.n+" services")+kv("Kill",pct(S.att.K,S.att.n),S.att.K+" sur "+S.att.n+" attaques")+
      kv("Attaques traversées",pct(S.att.K+S.att.I,S.att.n),"Kills + en jeu")+kv("Réception 2+",pct(S.rec.plus,S.rec.n),S.rec.n+" réceptions")+kv("Blocs gagnés",S.blk.G,"Touchés : "+S.blk.T)+'</div>';
    o+='<div class="two even"><section class="card"><h3>Service</h3><div class="statrow">'+kv("Total",S.srv.n)+kv("Aces",S.srv.A,pct(S.srv.A,S.srv.n))+kv("En jeu",S.srv.I,pct(S.srv.I,S.srv.n))+kv("Erreurs",S.srv.E,pct(S.srv.E,S.srv.n))+'</div></section>'+
      '<section class="card"><h3>Attaque</h3><div class="statrow">'+kv("Total",S.att.n)+kv("Kills",S.att.K,pct(S.att.K,S.att.n))+kv("En jeu",S.att.I,"Traversées : "+pct(S.att.K+S.att.I,S.att.n))+kv("Erreurs",S.att.E,pct(S.att.E,S.att.n))+'</div></section></div>';
    o+='<div class="two even"><section class="card"><h3>Réception</h3><div class="statrow">'+[0,2,3].map(n=>kv("Note "+n,pct(S.rec.c[n],S.rec.n),S.rec.c[n]+" sur "+S.rec.n)).join("")+kv("2 et plus",pct(S.rec.plus,S.rec.n),S.rec.plus+" sur "+S.rec.n)+'</div></section>'+
      '<section class="card"><h3>Bloc et défense</h3><div class="statrow">'+kv("Blocs gagnés",S.blk.G)+kv("Blocs touchés",S.blk.T)+kv("Déf. réussies",S.def.R)+kv("Déf. manquées",S.def.E)+'</div></section></div>';
    const ids=rowsFor(d,sView);
    const line=(lab,s,sets)=>'<tr><td>'+esc(lab)+'</td>'+(sView==="all"?'<td>'+sets+'</td>':'')+
      '<td class="sep">'+s.srv.n+'</td><td>'+s.srv.A+'</td><td>'+s.srv.I+'</td><td>'+s.srv.E+'</td><td>'+pct(s.srv.A+s.srv.I,s.srv.n)+'</td>'+
      '<td class="sep">'+s.att.n+'</td><td>'+s.att.K+'</td><td>'+s.att.I+'</td><td>'+s.att.E+'</td><td>'+pct(s.att.K,s.att.n)+'</td><td>'+pct(s.att.K+s.att.I,s.att.n)+'</td><td>'+pct(s.att.E,s.att.n)+'</td>'+
      '<td class="sep">'+s.rec.n+'</td><td>'+pct(s.rec.c[0],s.rec.n)+'</td><td>'+pct(s.rec.c[2],s.rec.n)+'</td><td>'+pct(s.rec.c[3],s.rec.n)+'</td><td>'+pct(s.rec.plus,s.rec.n)+'</td>'+
      '<td class="sep">'+s.blk.G+'</td><td>'+s.blk.T+'</td><td class="sep">'+s.def.R+'</td><td>'+s.def.E+'</td></tr>';
    o+='<section class="card"><h3>Par joueur</h3><div class="tscroll"><table class="st"><thead><tr class="grp"><th></th>'+(sView==="all"?'<th></th>':'')+'<th colspan="5" class="sep">Service</th><th colspan="7" class="sep">Attaque</th><th colspan="5" class="sep">Réception</th><th colspan="2" class="sep">Bloc</th><th colspan="2" class="sep">Défense</th></tr>'+
      '<tr><th>Joueur</th>'+(sView==="all"?'<th>Sets</th>':'')+'<th class="sep">Tot</th><th>Ace</th><th>Jeu</th><th>Err</th><th>% jeu</th><th class="sep">Tot</th><th>Kill</th><th>Jeu</th><th>Err</th><th>% kill</th><th>% trav.</th><th>% err</th><th class="sep">Nb</th><th>% 0</th><th>% 2</th><th>% 3</th><th>% 2+</th><th class="sep">Gagné</th><th>Touché</th><th class="sep">Réus.</th><th>Manq.</th></tr></thead><tbody>'+
      ids.map(id=>line(pName(d,id),stats(E.filter(e=>e.p===id)),setsOf(d,id).join(" · "))).join("")+'</tbody><tfoot>'+line("Équipe",S,"").replace('<tr>','<tr>')+'</tfoot></table></div></section>';
    $("sd-body").innerHTML=o;
  }
  $("stats").onclick=()=>{ sView=d.view; renderStats(); try{ $("sdlg").showModal(); }catch(e){ $("sdlg").setAttribute("open",""); } };
  $("sd-close").onclick=()=>$("sdlg").close();

  $("opp").value=d.opp||""; $("date").value=d.date||"";
  $("opp").addEventListener("input",e=>{ d.opp=e.target.value; changed(); });
  $("date").addEventListener("change",e=>{ d.date=e.target.value; changed(); });
  $("undo").onclick=()=>{
    let idx=-1; for(let i=d.events.length-1;i>=0;i--){ if(d.view==="all"||d.events[i].s===d.view){ idx=i; break; } }
    if(idx<0){ U.toast("Rien à annuler"); return; }
    const e=d.events[idx], b=(CATS[e.k]?CATS[e.k].btn:[]).find(x=>x[0]===e.v);
    d.events.splice(idx,1); changed(); render(); U.toast("Annulé : "+(CATS[e.k]?CATS[e.k].lab:"")+" "+(b?b[1]:e.v)+" ("+pName(d,e.p)+")");
  };
  $("correct").onclick=()=>{ correct=!correct; $("correct").setAttribute("aria-pressed",String(correct)); document.body.classList.toggle("correct",correct); U.toast(correct?"Mode correction : chaque touche retire 1":"Saisie normale"); };
  $("lineupbtn").onclick=()=>{ if(!d.players.length) editRoster(); else editLineup(); };
  $("pdf").onclick=()=>ctx.exportPDF();
  if(d.view!=="all") lineup(d,d.view);
  render();
  if(!d.players.length) editRoster();
}

/* ---------- Rapport PDF (paysage) : page 1 = match complet, puis une page identique par set ---------- */
function pdfFor(d, team, layout){
  const R=window.VSReport({landscape:true}), {doc,M,CW,C,P,mix}=R;
  function miniBox(x,y0,w,h,title,lines){
    R.fill(C.soft); doc.roundedRect(x,y0,w,h,6,6,"F");
    R.font("bold",9,C.accent); doc.text(title.toUpperCase(),x+10,y0+15);
    lines.forEach((l,i)=>{ const yy=y0+31+i*13;
      R.font("normal",8.5,C.muted); doc.text(l[0],x+10,yy);
      R.font("bold",9.5,l[2]||C.ink); doc.text(String(l[1]),x+w-10,yy,{align:"right"}); });
  }
  // E : actions ; ids : joueurs (dans l'ordre) ; extra : colonne en plus {h, get(id)}
  function body(E, label, ids, extra){
    const S=stats(E);
    R.title("Équipe · "+label);
    const n=5, gap=8, bw=(CW-(n-1)*gap)/n, h=96, y0=R.y;
    miniBox(M,y0,bw,h,"Service",[["Total",S.srv.n],["Aces",S.srv.A,C.M],["En jeu",S.srv.I],["Erreurs",S.srv.E,C.X],["% en jeu",P(S.srv.A+S.srv.I,S.srv.n),C.accent]]);
    miniBox(M+(bw+gap),y0,bw,h,"Attaque",[["Total · kills",S.att.n+" · "+S.att.K],["En jeu · erreurs",S.att.I+" · "+S.att.E],["% kill",P(S.att.K,S.att.n),C.M],["% traversées",P(S.att.K+S.att.I,S.att.n),C.accent],["% erreur",P(S.att.E,S.att.n),C.X]]);
    miniBox(M+2*(bw+gap),y0,bw,h,"Réception",[["Nombre",S.rec.n],["% de 0",P(S.rec.c[0],S.rec.n),C.X],["% de 2",P(S.rec.c[2],S.rec.n)],["% de 3",P(S.rec.c[3],S.rec.n),C.M],["% 2 et plus",P(S.rec.plus,S.rec.n),C.accent]]);
    miniBox(M+3*(bw+gap),y0,bw,h,"Bloc",[["Blocs gagnés",S.blk.G,C.M],["Blocs touchés",S.blk.T]]);
    miniBox(M+4*(bw+gap),y0,bw,h,"Défense",[["Réussies",S.def.R,C.M],["Manquées",S.def.E,C.X]]);
    R.y=y0+h+12;
    R.title("Par joueur · "+label,"% trav. = (kills + en jeu) / attaques · % 2+ = réceptions de 2 et 3");
    const showSets=!!extra;
    const cols=[{h:"Joueur",w:3.2}];
    if(showSets) cols.push({h:extra.h,w:1.2});
    [["Tot",1],["Ace",1,C.M],["Jeu",1],["Err",1,C.X],["% jeu",1.25]].forEach(([h2,w,c])=>cols.push({h:h2,w,color:c,group:"Service"}));
    [["Tot",1],["Kill",1,C.M],["Jeu",1],["Err",1,C.X],["% kill",1.25],["% trav.",1.3],["% err",1.25]].forEach(([h2,w,c])=>cols.push({h:h2,w,color:c,group:"Attaque"}));
    [["Nb",1],["% 0",1.15,C.X],["% 2",1.15],["% 3",1.15,C.M],["% 2+",1.2]].forEach(([h2,w,c])=>cols.push({h:h2,w,color:c,group:"Réception"}));
    [["Gagné",1.2,C.M],["Touché",1.25]].forEach(([h2,w,c])=>cols.push({h:h2,w,color:c,group:"Bloc"}));
    [["Réus.",1.15,C.M],["Manq.",1.15,C.X]].forEach(([h2,w,c])=>cols.push({h:h2,w,color:c,group:"Défense"}));
    const line=(lab,s,sets)=>{ const r=[lab]; if(showSets) r.push(sets);
      r.push(s.srv.n,s.srv.A,s.srv.I,s.srv.E,P(s.srv.A+s.srv.I,s.srv.n), s.att.n,s.att.K,s.att.I,s.att.E,P(s.att.K,s.att.n),P(s.att.K+s.att.I,s.att.n),P(s.att.E,s.att.n),
        s.rec.n,P(s.rec.c[0],s.rec.n),P(s.rec.c[2],s.rec.n),P(s.rec.c[3],s.rec.n),P(s.rec.plus,s.rec.n), s.blk.G,s.blk.T, s.def.R,s.def.E); return r; };
    const rows=ids.map(id=>line(pName(d,id).slice(0,24),stats(E.filter(e=>e.p===id)),extra?extra.get(id):""));
    rows.push(line("Équipe",S,""));
    R.table(cols,rows,{boldLast:true,rh:15,fs:8,hfs:6.3});
  }
  return layout(R, body);
}
function pdf(sheet, team){
  const d=sheet.data;
  return pdfFor(d, team, (R, body)=>{
    const sets=played(d);
    const opp=(d.opp?"contre "+d.opp:"Adversaire non précisé")+"  ·  "+(d.date||"");
    R.header("STATS ÉQUIPE",opp,team,"Sets joués : "+sets.length);
    body(filt(d,"all"),"match complet",rowsFor(d,"all"),{h:"Sets",get:id=>setsOf(d,id).join(" ")});
    sets.forEach(s=>{ R.newPage(); R.subHeader("SET "+s,opp,team); body(filt(d,s),"set "+s,rowsFor(d,s)); });
    return R.finish("Stats équipe · "+team+(d.opp?" · contre "+d.opp:"")+" · "+(d.date||""));
  });
}

/* ---------- Rapport récapitulatif de plusieurs matchs ---------- */
// Les joueurs sont regroupés par numéro et nom, d'un match à l'autre.
function recap(sheets, team, title){
  sheets=[...sheets].sort((a,b)=>(a.data.date||"").localeCompare(b.data.date||""));
  const key=p=>(String(p.num||"").trim()+"|"+String(p.name||"").trim().toLowerCase());
  const v={players:[],events:[],lineups:{}};
  const matchesOf={};
  const perMatch=sheets.map((sh,mi)=>{
    const d=sh.data, map={};
    (d.players||[]).forEach(p=>{ const k=key(p); map[p.id]=k; if(!v.players.some(x=>x.id===k)) v.players.push({id:k,num:p.num,name:p.name}); });
    const ev=(d.events||[]).map(e=>({...e,p:e.p==null?null:(map[e.p]||e.p),m:mi}));
    ev.forEach(e=>{ if(e.p!=null){ (matchesOf[e.p]=matchesOf[e.p]||new Set()).add(mi); } });
    v.events.push(...ev);
    return {sh,ev};
  });
  v.players.sort((a,b)=>(parseInt(a.num)||999)-(parseInt(b.num)||999));
  const ids=v.players.map(p=>p.id).filter(id=>matchesOf[id]);
  if(v.events.some(e=>e.p==null)) ids.push(null);
  const dates=sheets.map(x=>x.data.date).filter(Boolean).sort();
  const period=dates.length?(dates[0]===dates[dates.length-1]?dates[0]:dates[0]+" au "+dates[dates.length-1]):"";
  return pdfFor(v, team, (R, body)=>{
    const {C,P}=R;
    R.header("RÉCAPITULATIF ÉQUIPE",(title||"Plusieurs matchs")+(period?"  ·  "+period:""),team,sheets.length+" match"+(sheets.length>1?"s":""));
    body(v.events,"tous les matchs",ids,{h:"Matchs",get:id=>id&&matchesOf[id]?matchesOf[id].size:""});
    R.newPage(); R.subHeader("PAR MATCH",(title||"")+(period?"  ·  "+period:""),team);
    R.title("Résultats de l’équipe à chaque match");
    const line=(lab,s)=>[lab,s.srv.n,P(s.srv.A+s.srv.I,s.srv.n),s.srv.A,s.att.n,P(s.att.K,s.att.n),P(s.att.K+s.att.I,s.att.n),P(s.att.E,s.att.n),s.rec.n,P(s.rec.c[0],s.rec.n),P(s.rec.plus,s.rec.n),s.blk.G,s.blk.T,s.def.R,s.def.E];
    const rows=perMatch.map(({sh,ev})=>line(((sh.data.date||"").slice(5).replace("-","/")+" "+(sh.data.opp||"Adversaire ?")).slice(0,34),stats(ev)));
    rows.push(line("Tous les matchs",stats(v.events)));
    R.table([{h:"Match",w:3.6},{h:"Tot",w:1,group:"Service"},{h:"% jeu",w:1.2,group:"Service"},{h:"Aces",w:1,group:"Service",color:C.M},
      {h:"Tot",w:1,group:"Attaque"},{h:"% kill",w:1.2,group:"Attaque",color:C.M},{h:"% trav.",w:1.25,group:"Attaque"},{h:"% err",w:1.2,group:"Attaque",color:C.X},
      {h:"Nb",w:1,group:"Réception"},{h:"% 0",w:1.1,group:"Réception",color:C.X},{h:"% 2+",w:1.15,group:"Réception"},
      {h:"Gagné",w:1.15,group:"Bloc",color:C.M},{h:"Touché",w:1.2,group:"Bloc"},{h:"Réus.",w:1.1,group:"Défense",color:C.M},{h:"Manq.",w:1.1,group:"Défense",color:C.X}],
      rows,{boldLast:true,rh:17,fs:8.5,hfs:6.5});
    return R.finish("Récapitulatif équipe · "+team+(title?" · "+title:""));
  });
}

window.EquipeSheet={ blank, mount, summary, pdf, recap };
})();
