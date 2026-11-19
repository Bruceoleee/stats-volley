/* Feuille « Stats équipe » : service, attaque, réception, bloc, défense, par joueur. */
(function(){
"use strict";
const SETS=[1,2,3];
const CATS = {
  srv:{ lab:"Service", btn:[["A","Ace","q-M"],["I","En jeu","q-N"],["E","Erreur","q-X"]] },
  att:{ lab:"Attaque", btn:[["K","Kill","q-M"],["I","En jeu","q-N"],["E","Erreur","q-X"],["B","Bloquée","q-J"]] },
  rec:{ lab:"Réception", btn:[[0,"0","r-0"],[1,"1","r-1"],[2,"2","r-2"],[3,"3","r-3"]] },
  blk:{ lab:"Bloc", btn:[["G","Bloc gagnant","q-M"],["T","Touche","q-N"]] },
  def:{ lab:"Défense", btn:[["R","Réussie","q-M"],["E","Manquée","q-X"]] }
};
function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function blank(settings){
  const players=((settings&&settings.players)||[]).map(p=>({id:p.id,num:p.num,name:p.name}));
  return { opp:"", date:today(), view:1, players, events:[] };
}
const filt=(d,s)=>d.events.filter(e=>s==="all"||e.s===s);
const byP=(E,p)=>p==="T"?E:E.filter(e=>e.p===p);
function stats(E){
  const c=(k,v)=>E.filter(e=>e.k===k&&(v===undefined||e.v===v)).length;
  const srv={n:c("srv"),A:c("srv","A"),I:c("srv","I"),E:c("srv","E")};
  const att={n:c("att"),K:c("att","K"),I:c("att","I"),E:c("att","E"),B:c("att","B")};
  const rr=E.filter(e=>e.k==="rec"); const rec={n:rr.length,c:[0,1,2,3].map(n=>rr.filter(e=>e.v===n).length),avg:rr.length?rr.reduce((s,e)=>s+e.v,0)/rr.length:null};
  const blk={G:c("blk","G"),T:c("blk","T")};
  const def={n:c("def"),R:c("def","R"),E:c("def","E")};
  return {srv,att,rec,blk,def,
    srvIn:srv.n?(srv.A+srv.I)/srv.n:null, attEff:att.n?(att.K-att.E-att.B)/att.n:null, defPct:def.n?def.R/def.n:null};
}
const fmtEff=v=>v==null?"–":(v>=0?"":"-")+Math.abs(v).toFixed(3).replace(/^0/,"");
const played=d=>SETS.filter(s=>d.events.some(e=>e.s===s));
const pName=(d,id)=>{ if(id==null) return "Non attribué"; const p=d.players.find(x=>x.id===id); return p?((p.num!==""&&p.num!=null?"#"+p.num+" ":"")+(p.name||"Joueur")):"Joueur retiré"; };
function playerRows(d,E){
  const ids=d.players.filter(p=>(!p.out&&!p.abs)||E.some(e=>e.p===p.id)).map(p=>p.id);
  if(E.some(e=>e.p==null)) ids.push(null);
  return ids;
}
function summary(sheet){
  const d=sheet.data, s=stats(d.events), n=played(d).length;
  return { empty:!d.events.length&&!d.opp, resume:(n?n+" set"+(n>1?"s":"")+" · ":"")+"Service "+(s.srvIn==null?"–":Math.round(s.srvIn*100)+" %")+" · Attaque "+fmtEff(s.attEff)+" · Réc. "+(s.rec.avg==null?"–":s.rec.avg.toFixed(2)) };
}

const COLS=[
  {k:"srv",v:"A",l:"Ace",c:"q-M"},{k:"srv",v:"I",l:"Jeu",c:"q-N"},{k:"srv",v:"E",l:"Err",c:"q-X"},
  {k:"att",v:"K",l:"Kill",c:"q-M"},{k:"att",v:"I",l:"Jeu",c:"q-N"},{k:"att",v:"E",l:"Err",c:"q-X"},{k:"att",v:"B",l:"Blq",c:"q-J"},
  {k:"rec",v:0,l:"0",c:"r-0"},{k:"rec",v:1,l:"1",c:"r-1"},{k:"rec",v:2,l:"2",c:"r-2"},{k:"rec",v:3,l:"3",c:"r-3"},
  {k:"blk",v:"G",l:"Gagn.",c:"q-M"},{k:"blk",v:"T",l:"Touche",c:"q-N"},
  {k:"def",v:"R",l:"Réus.",c:"q-M"},{k:"def",v:"E",l:"Manq.",c:"q-X"}
];
const GROUPS=[{id:"srv",l:"Service",sh:"Serv.",ks:["srv"]},{id:"att",l:"Attaque",sh:"Att.",ks:["att"]},{id:"rec",l:"Réception",sh:"Réc.",ks:["rec"]},{id:"bd",l:"Bloc · Déf.",sh:"B · D",ks:["blk","def"]}];
const GLAB={srv:"Service",att:"Attaque",rec:"Réception",blk:"Bloc",def:"Défense"};

function mount(root, sheet, ctx){
  const d=sheet.data, U=ctx.util, $=U.$, esc=U.esc, pct=U.pct;
  if(!SETS.includes(d.view)&&d.view!=="all") d.view=1;
  d.players=d.players||[];
  let correct=false;
  let cat = window.matchMedia && matchMedia("(max-width:760px)").matches ? "srv" : "all";
  root.innerHTML=
  '<div class="meta c2"><label class="f" for="opp">Adversaire<input type="text" id="opp" placeholder="Équipe" autocomplete="off"></label><label class="f" for="date">Date<input type="date" id="date"></label></div>'+
  '<div class="bar"><div class="seg" id="sets"></div><div class="seg" id="cats"></div>'+
    '<div class="tools"><button class="btn" id="undo" type="button" aria-label="Annuler la dernière action">↶<span class="t"> Annuler</span></button>'+
    '<button class="btn" id="correct" type="button" aria-pressed="false" aria-label="Mode correction">−1<span class="t"> Corriger</span></button>'+
    '<button class="btn" id="roster" type="button" aria-label="Joueurs">✎<span class="t"> Joueurs</span></button>'+
    '<button class="btn primary" id="pdf" type="button">PDF<span class="t"> Rapport</span></button></div></div>'+
  '<div class="tiles" id="tiles"></div>'+
  '<section class="card" id="gridcard"><div class="tscroll"><table class="tgrid" id="tgrid"></table></div>'+
  '<div class="sub" id="ghint"></div></section>';

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
    const box=$(id); box.innerHTML='<span class="cap">'+cap+'</span>';
    items.forEach(it=>{ const b=document.createElement("button"); b.type="button"; if(it.sh) b.innerHTML='<span class="l">'+it.l+'</span><span class="s">'+it.sh+'</span>'; else b.textContent=it.l; b.setAttribute("aria-pressed",String(cur===it.v)); b.onclick=()=>pick(it.v); box.appendChild(b); });
  }
  const statOf=(g,s)=> g==="srv"?(s.srvIn==null?"–":Math.round(s.srvIn*100)+" %"):g==="att"?fmtEff(s.attEff):g==="rec"?(s.rec.avg==null?"–":s.rec.avg.toFixed(2)):(s.defPct==null?"–":Math.round(s.defPct*100)+" %");
  const statLab={srv:"% en jeu",att:"Eff.",rec:"Moy.",bd:"Déf. %"};

  function render(){
    seg("sets","Set",[...SETS.map(s=>({v:s,l:String(s)})),{v:"all",l:"Match"}],d.view,v=>{d.view=v;render();});
    seg("cats","Voir",[{v:"all",l:"Tout"},...GROUPS.map(g=>({v:g.id,l:g.l,sh:g.sh}))],cat,v=>{cat=v;render();});
    const E=filt(d,d.view), S=stats(E);
    const tiles=[["Service en jeu",S.srvIn==null?"–":Math.round(S.srvIn*100)+" %","Aces : "+S.srv.A+" · erreurs : "+S.srv.E],["Attaque",fmtEff(S.attEff),"Eff. · kills : "+S.att.K+"/"+S.att.n],
      ["Réception",S.rec.avg==null?"–":S.rec.avg.toFixed(2),"Moyenne /3 · "+S.rec.n+" réc."],["Bloc",S.blk.G,"Gagnants · touches : "+S.blk.T],["Défense",S.defPct==null?"–":Math.round(S.defPct*100)+" %",S.def.R+" réussies sur "+S.def.n]];
    $("tiles").innerHTML=tiles.map(t=>'<div class="tile"><div class="k">'+esc(t[0])+'</div><div class="v">'+t[1]+'</div><div class="d">'+esc(t[2])+'</div></div>').join("");

    const groups=cat==="all"?GROUPS:GROUPS.filter(g=>g.id===cat);
    const cols=COLS.filter(c=>groups.some(g=>g.ks.includes(c.k)));
    const showStat=cat!=="all";
    const ids=d.players.filter(p=>!p.out&&!p.abs).map(p=>p.id);
    E.forEach(e=>{ if(!ids.includes(e.p)) ids.push(e.p); }); // joueurs retirés/absents qui ont des stats
    const uniq=[...new Set(ids)];
    $("gridcard").classList.toggle("lock",d.view==="all");
    $("tgrid").className="tgrid"+(cat==="all"?" all":" one");

    let h='<colgroup><col class="cn">'+cols.map(()=>'<col>').join('')+(showStat?'<col class="cst">':'')+'</colgroup><thead><tr class="grp"><th></th>';
    groups.forEach(g=>{ const n=cols.filter(c=>g.ks.includes(c.k)).length; h+=g.id==="bd"?'<th colspan="2" class="gs">Bloc</th><th colspan="2" class="gs">Défense</th>':'<th colspan="'+n+'" class="gs">'+g.l+'</th>'; });
    if(showStat) h+='<th class="gs"></th>';
    h+='</tr><tr class="sl"><th></th>';
    cols.forEach((c,i)=>{ const first=i===0||cols[i-1].k!==c.k; h+='<th class="'+(first?"g0":"")+'">'+c.l+'</th>'; });
    if(showStat) h+='<th class="g0">'+statLab[cat]+'</th>';
    h+='</tr></thead><tbody>';
    if(!uniq.length) h+='<tr><td colspan="'+(cols.length+2)+'" class="sub" style="text-align:left;padding:16px 4px">Ajoute les joueurs avec le bouton ✎ Joueurs. Ils restent gardés pour les prochaines feuilles.</td></tr>';
    uniq.forEach(id=>{
      const PE=E.filter(e=>e.p===id), ps=stats(PE);
      const p=d.players.find(x=>x.id===id);
      h+='<tr><th class="pn" scope="row">'+(p&&p.num!==""&&p.num!=null?'<b>'+esc(p.num)+'</b>':'')+'<span class="nm">'+esc(p?(p.name||"Joueur"):pName(d,id))+'</span></th>';
      cols.forEach((c,i)=>{ const first=i===0||cols[i-1].k!==c.k; const n=PE.filter(e=>e.k===c.k&&e.v===c.v).length;
        const key=(id||"x")+"-"+c.k+"-"+c.v;
        h+='<td class="'+(first?"g0":"")+'"><button type="button" class="tc '+c.c+'" data-p="'+esc(id||"")+'" data-k="'+c.k+'" data-v="'+c.v+'" data-key="'+esc(key)+'" aria-label="'+esc((p&&p.name)||"")+' '+GLAB[c.k]+' '+c.l+'">'+(n||"")+'</button></td>'; });
      if(showStat) h+='<td class="g0 st">'+statOf(cat,ps)+'</td>';
      h+='</tr>';
    });
    h+='</tbody><tfoot><tr><th class="pn" scope="row"><span>Équipe</span></th>';
    cols.forEach((c,i)=>{ const first=i===0||cols[i-1].k!==c.k; h+='<td class="'+(first?"g0":"")+'">'+E.filter(e=>e.k===c.k&&e.v===c.v).length+'</td>'; });
    if(showStat) h+='<td class="g0 st">'+statOf(cat,S)+'</td>';
    h+='</tr></tfoot>';
    $("tgrid").innerHTML=h;
    $("tgrid").querySelectorAll(".tc").forEach(b=>b.onclick=()=>{ const k=b.dataset.k; act(b.dataset.p||null,k,k==="rec"?+b.dataset.v:b.dataset.v,b.dataset.key); });
    $("ghint").textContent=d.view==="all"?"Vue du match : choisis un set pour saisir.":"Une touche = +1 pour ce joueur. Réception : 3 = parfaite, 0 = ace subi. Eff. attaque = (kills - erreurs - bloquées) / tentatives.";
  }

  function editRoster(){
    const list=d.players.filter(p=>!p.out).map(p=>({...p}));
    const rowHTML=(p,i)=>'<div class="r" data-i="'+i+'"><input type="text" inputmode="numeric" placeholder="#" value="'+esc(p.num??"")+'" data-f="num" aria-label="Numéro"><input type="text" placeholder="Nom" value="'+esc(p.name||"")+'" data-f="name" aria-label="Nom">'+
      '<label class="pres"><input type="checkbox" data-f="pres" '+(p.abs?"":"checked")+'> Présent</label><button type="button" class="btn sm danger" data-rm aria-label="Retirer">✕</button></div>';
    const draw=()=>{ const box=document.getElementById("rosterbox"); box.innerHTML=list.map(rowHTML).join("")||'<div class="sub">Aucun joueur.</div>';
      box.querySelectorAll(".r").forEach(r=>{ const i=+r.dataset.i;
        r.querySelectorAll("input[type=text]").forEach(inp=>inp.oninput=()=>{ list[i][inp.dataset.f]=inp.value; });
        r.querySelector("input[type=checkbox]").onchange=e=>{ list[i].abs=!e.target.checked; };
        r.querySelector("[data-rm]").onclick=()=>{ list.splice(i,1); draw(); }; }); };
    U.dialog("Joueurs",'<p class="sub">Décoche « Présent » pour cacher un joueur absent dans ce match. La liste est gardée pour les prochaines feuilles.</p><div class="roster" id="rosterbox"></div><button type="button" class="btn sm" id="addp" style="margin-top:8px">+ Ajouter un joueur</button>',[
      {label:"Annuler"},
      {label:"Enregistrer",primary:true,run:()=>{
        const clean=list.filter(p=>(p.name||"").trim()||String(p.num||"").trim()).map(p=>({id:p.id||U.uid(),num:String(p.num||"").trim(),name:(p.name||"").trim(),abs:!!p.abs}));
        clean.sort((a,b)=>(parseInt(a.num)||999)-(parseInt(b.num)||999));
        const keep=new Set(clean.map(p=>p.id));
        const removed=d.players.filter(p=>!keep.has(p.id)&&d.events.some(e=>e.p===p.id)).map(p=>({...p,out:true}));
        d.players=[...clean,...removed];
        ctx.saveSettings({players:clean.map(({abs,...p})=>p)});
        changed(); render();
      }}]);
    draw();
    document.getElementById("addp").onclick=()=>{ list.push({id:U.uid(),num:"",name:""}); draw(); const ins=document.querySelectorAll("#rosterbox input[data-f=num]"); ins.length&&ins[ins.length-1].focus(); };
    if(!list.length) document.getElementById("addp").click();
  }

  $("opp").value=d.opp||""; $("date").value=d.date||"";
  $("opp").addEventListener("input",e=>{ d.opp=e.target.value; changed(); });
  $("date").addEventListener("change",e=>{ d.date=e.target.value; changed(); });
  $("undo").onclick=()=>{
    let idx=-1; for(let i=d.events.length-1;i>=0;i--){ if(d.view==="all"||d.events[i].s===d.view){ idx=i; break; } }
    if(idx<0){ U.toast("Rien à annuler"); return; }
    const e=d.events[idx], b=CATS[e.k].btn.find(x=>x[0]===e.v);
    d.events.splice(idx,1); changed(); render(); U.toast("Annulé : "+CATS[e.k].lab+" "+(b?b[1]:e.v)+" ("+pName(d,e.p)+")");
  };
  $("correct").onclick=()=>{ correct=!correct; $("correct").setAttribute("aria-pressed",String(correct)); document.body.classList.toggle("correct",correct); U.toast(correct?"Mode correction : chaque touche retire 1":"Saisie normale"); };
  $("roster").onclick=editRoster;
  $("pdf").onclick=()=>ctx.exportPDF();
  render();
  if(!d.players.length) editRoster();
}

/* ---------- Rapport PDF ---------- */
function pdf(sheet, team){
  const d=sheet.data, R=window.VSReport(), {doc,M,CW,C,P}=R;
  const sets=played(d), Eall=filt(d,"all"), S=stats(Eall);
  const cols=[{h:"Joueur",w:3},
    {h:"Tot",w:1,group:"Service"},{h:"Ace",w:1,group:"Service",color:C.M},{h:"Err",w:1,group:"Service",color:C.X},
    {h:"Tot",w:1,group:"Attaque"},{h:"Kill",w:1,group:"Attaque",color:C.M},{h:"Err",w:1,group:"Attaque",color:C.X},{h:"Blq",w:1,group:"Attaque",color:C.J},{h:"Eff",w:1.3,group:"Attaque"},
    {h:"Nb",w:1,group:"Réception"},{h:"Moy",w:1.2,group:"Réception"},
    {h:"Gagn.",w:1.2,group:"Bloc"},{h:"Touche",w:1.3,group:"Bloc"},
    {h:"Réus.",w:1.2,group:"Défense"},{h:"Manq.",w:1.2,group:"Défense"}];
  const line=(lab,s)=>[lab,s.srv.n,s.srv.A,s.srv.E,s.att.n,s.att.K,s.att.E,s.att.B,fmtEff(s.attEff),s.rec.n,s.rec.avg==null?"–":s.rec.avg.toFixed(2),s.blk.G,s.blk.T,s.def.R,s.def.E];
  const ptable=E=>{ const rows=playerRows(d,E).map(id=>line(pName(d,id).slice(0,22),stats(E.filter(e=>e.p===id)))); rows.push(line("Équipe",stats(E))); R.table(cols,rows,{boldLast:true,rh:16,fs:8.5,hfs:6.5}); };
  const boxes=s=>{ R.ensure(170); const bw=(CW-12)/2;
    R.statBox(M,R.y,bw,"Service",s.srvIn==null?"–":Math.round(s.srvIn*100)+" %","en jeu · "+s.srv.n+" services",[["Aces : "+s.srv.A,C.M],["En jeu : "+s.srv.I,C.accent],["Erreurs : "+s.srv.E,C.X]]);
    R.statBox(M+bw+12,R.y,bw,"Attaque",fmtEff(s.attEff),"efficacité · "+s.att.n+" attaques",[["Kills : "+s.att.K+" ("+P(s.att.K,s.att.n)+")",C.M],["Erreurs : "+s.att.E,C.X],["Bloquées : "+s.att.B,C.J]]);
    R.y+=84;
    R.recBox(M,R.y,bw,"Notre réception",s.rec,[C.X,C.J,C.A,C.M]);
    R.statBox(M+bw+12,R.y,bw,"Bloc et défense",s.blk.G+" blocs","gagnants · "+s.blk.T+" touches",[["Défense réussie : "+s.def.R,C.M],["Défense manquée : "+s.def.E,C.X],["Taux : "+(s.defPct==null?"–":Math.round(s.defPct*100)+" %"),C.ink]]);
    R.y+=88; };

  R.header("STATS ÉQUIPE",(d.opp?"contre "+d.opp:"Adversaire non précisé")+"  ·  "+(d.date||""),team,"Sets joués : "+sets.length+" (deux de trois)");
  R.tiles([["Service en jeu",S.srvIn==null?"–":Math.round(S.srvIn*100)+" %","aces : "+S.srv.A],["Attaque",fmtEff(S.attEff),"kills : "+S.att.K+" / "+S.att.n],
    ["Réception",S.rec.avg==null?"–":S.rec.avg.toFixed(2),"moyenne sur 3"],["Blocs gagnants",S.blk.G,"touches : "+S.blk.T],["Défense",S.defPct==null?"–":Math.round(S.defPct*100)+" %",S.def.R+" sur "+S.def.n]]);
  R.title("Équipe · match complet"); boxes(S);
  R.title("Par joueur · match complet","Eff. attaque = (kills - erreurs - bloquées) / tentatives",60); ptable(Eall);
  sets.forEach(s=>{ const E=filt(d,s), ss=stats(E);
    R.title("Set "+s,"Service "+(ss.srvIn==null?"–":Math.round(ss.srvIn*100)+" %")+" · attaque "+fmtEff(ss.attEff)+" · réception "+(ss.rec.avg==null?"–":ss.rec.avg.toFixed(2)),80); ptable(E); });
  return R.finish("Stats équipe · "+team+(d.opp?" · contre "+d.opp:"")+" · "+(d.date||""));
}

window.EquipeSheet={ blank, mount, summary, pdf };
})();
