/* Feuille « Stats passeurs ». */
(function(){
"use strict";
const POS = [
  {id:"4", lab:"4", sub:"Gauche"},
  {id:"3", lab:"3", sub:"Centre"},
  {id:"2", lab:"2", sub:"Opposé"},
  {id:"P", lab:"Pipe", sub:"Arrière"},
  {id:"1", lab:"1", sub:"Arr. droit"}
];
const Q = [{id:"M",lab:"Marquée",sh:"Marq."},{id:"A",lab:"Attaquable",sh:"Attaq."},{id:"J",lab:"Jouable",sh:"Joua."},{id:"X",lab:"Manquée",sh:"Manq."}];
const QLAB = Object.fromEntries(Q.map(q=>[q.id,q.lab]));
const POSLAB = Object.fromEntries(POS.map(p=>[p.id,p.lab]));
const SETS = [1,2,3];
const ZONES = { "4":[10,22,100,88], "3":[110,22,100,88], "2":[210,22,100,88], "5":[10,110,100,178], "P":[110,110,100,178], "1":[210,110,100,178] };
const SETTER = [222,34];

function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function blank(settings){ return { opp:"", date:today(), n1:(settings&&settings.n1)||"", n2:(settings&&settings.n2)||"", view:1, who:1, events:[] }; }
const nameOf = (d,w) => (w===1?d.n1:d.n2) || ("Passeur "+w);
const filt = (d,s) => d.events.filter(e=>s==="all"||e.s===s);
function passStats(E, who){
  const p=E.filter(e=>e.k==="p" && (who==="both"||e.w===who));
  const c=(pos,q)=>p.filter(e=>(pos==null||e.pos===pos)&&(q==null||e.q===q)).length;
  const byPos={};
  POS.forEach(x=>{ const n=c(x.id,null); byPos[x.id]={ n, eff:n?(c(x.id,"M")+c(x.id,"A"))/n:0, M:c(x.id,"M"),A:c(x.id,"A"),J:c(x.id,"J"),X:c(x.id,"X") }; });
  return { total:p.length, M:c(null,"M"),A:c(null,"A"),J:c(null,"J"),X:c(null,"X"), byPos };
}
const hsStats = E => { const h=E.filter(e=>e.k==="h"); const R=h.filter(e=>e.r==="R").length; return {n:h.length,R,X:h.length-R}; };
const recStats = E => { const r=E.filter(e=>e.k==="r"); const c=[0,1,2,3].map(n=>r.filter(e=>e.n===n).length); return {n:r.length,c,avg:r.length?r.reduce((s,e)=>s+e.n,0)/r.length:null}; };
const played = d => SETS.filter(s=>d.events.some(e=>e.s===s));

function summary(sheet){
  const d=sheet.data, p=passStats(d.events,"both"), sets=played(d).length;
  return { empty: !d.events.length && !d.opp, resume: (sets?sets+" set"+(sets>1?"s":"")+" · ":"")+p.total+" passes · "+(p.total?Math.round(100*(p.M+p.A)/p.total):0)+" % efficaces" };
}

function courtSVG(s){
  const max=Math.max(1,...POS.map(p=>s.byPos[p.id].n));
  let g='';
  Object.keys(ZONES).forEach(z=>{
    const [x,y,w,h]=ZONES[z];
    g+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="var(--court)"/>';
    if(z==="5"){ g+='<text x="'+(x+w/2)+'" y="'+(y+h/2+5)+'" text-anchor="middle" font-size="13" fill="var(--muted)">—</text>'; return; }
    const b=s.byPos[z], share=s.total?b.n/s.total:0, a=b.n?0.15+0.75*(b.n/max):0, dark=a>0.55;
    const cx=x+w/2, cy=(z==="P"||z==="1")?y+h/2+4:y+h/2+6, sc=dark?'var(--accent-ink)':'var(--muted)';
    if(a) g+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="var(--accent)" fill-opacity="'+a.toFixed(2)+'"/>';
    const lx=z==="2"?x+w-7:x+7;
    g+='<text x="'+lx+'" y="'+(y+15)+'" text-anchor="'+(z==="2"?"end":"start")+'" font-size="11" font-weight="600" fill="'+sc+'">'+(z==="P"?"PIPE":"ZONE "+z)+'</text>';
    g+='<text x="'+cx+'" y="'+cy+'" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="30" fill="'+(dark?'var(--accent-ink)':'var(--ink)')+'">'+(s.total?Math.round(share*100)+'%':'–')+'</text>';
    g+='<text x="'+cx+'" y="'+(cy+16)+'" text-anchor="middle" font-size="11" fill="'+sc+'">'+b.n+' passe'+(b.n>1?'s':'')+'</text>';
    if(b.n) g+='<text x="'+cx+'" y="'+(cy+29)+'" text-anchor="middle" font-size="11" fill="'+sc+'">'+Math.round(b.eff*100)+' % eff.</text>';
  });
  return '<svg viewBox="0 0 320 300" role="img" aria-label="Répartition des passes par position">'+g+
    '<g stroke="var(--panel)" stroke-width="2"><line x1="110" y1="22" x2="110" y2="288"/><line x1="210" y1="22" x2="210" y2="288"/><line x1="10" y1="110" x2="310" y2="110"/></g>'+
    '<line x1="10" y1="110" x2="310" y2="110" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="6 4" opacity=".5"/>'+
    '<rect x="10" y="22" width="300" height="266" fill="none" stroke="var(--ink)" stroke-width="2"/>'+
    '<line x1="2" y1="21" x2="318" y2="21" stroke="var(--ink)" stroke-width="5"/>'+
    '<text x="160" y="13" text-anchor="middle" font-size="10" fill="var(--muted)" letter-spacing="2">FILET</text>'+
    '<circle cx="'+SETTER[0]+'" cy="'+SETTER[1]+'" r="9" fill="var(--hi)" stroke="var(--ink)" stroke-width="1.5"/><text x="'+SETTER[0]+'" y="'+(SETTER[1]+4)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#141a26">P</text></svg>';
}

function mount(root, sheet, ctx){
  const d=sheet.data, U=ctx.util, $=U.$, esc=U.esc, pct=U.pct;
  if(!SETS.includes(d.view) && d.view!=="all") d.view=1;
  let correct=false;
  root.innerHTML =
  '<div class="meta">'+
    '<label class="f" for="opp">Adversaire<input type="text" id="opp" placeholder="Équipe" autocomplete="off"></label>'+
    '<label class="f" for="date">Date<input type="date" id="date"></label>'+
    '<label class="f" for="n1">Passeur 1<input type="text" id="n1" placeholder="Nom" autocomplete="off"></label>'+
    '<label class="f" for="n2">Passeur 2<input type="text" id="n2" placeholder="Nom" autocomplete="off"></label>'+
  '</div>'+
  '<div class="bar"><div class="seg" id="sets"></div><div class="seg" id="setters"></div>'+
    '<div class="tools"><button class="btn" id="undo" type="button" aria-label="Annuler la dernière action">↶<span class="t"> Annuler</span></button>'+
    '<button class="btn" id="correct" type="button" aria-pressed="false" aria-label="Mode correction">−1<span class="t"> Corriger</span></button>'+
    '<button class="btn primary" id="pdf" type="button">PDF<span class="t"> Rapport</span></button></div></div>'+
  '<div class="tiles" id="tiles"></div>'+
  '<section class="card" id="passcard"><div class="card-head"><h2>Passes en système · <span class="who" id="who"></span></h2><span class="sub" id="hint"></span></div>'+
    '<div class="passwrap"><table class="setgrid" id="grid"></table><div class="courtbox"><div id="court"></div><div class="cap2">Part des passes envoyées à chaque position · efficacité = marquées + attaquables</div></div></div></section>'+
  '<div class="two">'+
    '<section class="card" id="hscard"><div class="card-head"><h2>Hors système</h2><span class="sub" id="hs-pct"></span></div><div class="bigrow c2" id="hs"></div></section>'+
    '<section class="card adv" id="reccard"><div class="card-head"><h2>Réception adverse</h2><span class="sub">Toute l’équipe adverse</span></div>'+
      '<div class="bigrow c4" id="rec"></div><div class="distrib" id="distrib" aria-hidden="true"></div><div class="stat-line" id="rec-stats"></div>'+
      '<div class="legend"><b>3</b><span>Parfaite, toutes les options</span><b>2</b><span>Bonne, options limitées</span><b>1</b><span>Mauvaise, hors système</span><b>0</b><span>Ace ou renvoi direct</span></div></section>'+
  '</div>';

  const changed = () => ctx.changed();
  function act(ev, key){
    if(d.view==="all"){ U.toast("Choisis un set pour saisir"); return; }
    if(ev.k==="p"){ if(d.who==="both"){ U.toast("Choisis le passeur pour saisir"); return; } ev.w=d.who; }
    if(correct){
      for(let i=d.events.length-1;i>=0;i--){ const e=d.events[i];
        if(e.s===d.view && e.k===ev.k && e.pos===ev.pos && e.q===ev.q && e.r===ev.r && e.n===ev.n && e.w===ev.w){ d.events.splice(i,1); changed(); render(); U.toast("−1 retiré"); return; } }
      U.toast("Rien à retirer ici"); return;
    }
    ev.s=d.view; ev.t=Date.now(); d.events.push(ev); changed(); U.vibrate(); render();
    const f=root.querySelector('[data-key="'+key+'"]'); if(f){ f.classList.remove("flash"); void f.offsetWidth; f.classList.add("flash"); }
  }
  function seg(id, cap, items, cur, pick){
    const box=$(id); box.innerHTML='<span class="cap">'+cap+'</span>';
    items.forEach(it=>{ const b=document.createElement("button"); b.type="button"; b.textContent=it.lab; b.setAttribute("aria-pressed",String(cur===it.v)); b.onclick=()=>pick(it.v); box.appendChild(b); });
  }
  function render(){
    seg("sets","Set",[...SETS.map(s=>({v:s,lab:String(s)})),{v:"all",lab:"Match"}],d.view,v=>{d.view=v;render();});
    seg("setters","Passeur",[{v:1,lab:nameOf(d,1)},{v:2,lab:nameOf(d,2)},{v:"both",lab:"Les deux"}],d.who,v=>{d.who=v;render();});
    const E=filt(d,d.view), s=passStats(E,d.who), h=hsStats(E), r=recStats(E);
    const label=d.who==="both"?"les deux":nameOf(d,d.who);
    const tiles=[["Passes · "+label,s.total,"Manquées : "+s.X],["Marquées",pct(s.M,s.total),s.M+" sur "+s.total],["Efficacité",pct(s.M+s.A,s.total),"Marquées + attaquables"],
      ["Hors système",pct(h.R,h.n),h.R+" réussies sur "+h.n],["Réception adv.",r.avg==null?"–":r.avg.toFixed(2),"Moyenne /3 · "+r.n+" réc."]];
    $("tiles").innerHTML=tiles.map(t=>'<div class="tile"><div class="k">'+esc(t[0])+'</div><div class="v">'+t[1]+'</div><div class="d">'+esc(t[2])+'</div></div>').join("");
    $("who").textContent=d.who==="both"?nameOf(d,1)+" + "+nameOf(d,2):nameOf(d,d.who);
    $("passcard").classList.toggle("lock",d.view==="all"||d.who==="both");
    $("hscard").classList.toggle("lock",d.view==="all"); $("reccard").classList.toggle("lock",d.view==="all");
    $("hint").textContent=d.view==="all"?"Vue du match : choisis un set pour saisir":d.who==="both"?"Vue combinée : choisis un passeur pour saisir":"Ligne = position visée · colonne = qualité";
    let html='<colgroup><col class="c-row">'+Q.map(()=>'<col>').join("")+'<col class="c-tot"></colgroup><thead><tr><th></th>'+
      Q.map(q=>'<th class="colhead-'+q.id+'"><span class="l">'+q.lab+'</span><span class="s">'+q.sh+'</span></th>').join("")+'<th>Total</th></tr></thead><tbody>';
    POS.forEach(pos=>{ const b=s.byPos[pos.id];
      html+='<tr><th class="row" scope="row">'+pos.lab+'<small>'+pos.sub+'</small></th>'+
        Q.map(q=>'<td><button type="button" class="cell q-'+q.id+'" data-key="p-'+pos.id+'-'+q.id+'" data-pos="'+pos.id+'" data-q="'+q.id+'" aria-label="'+pos.lab+' '+q.lab+'">'+b[q.id]+'</button></td>').join("")+
        '<td class="tot">'+b.n+'<small>'+(b.n?Math.round(b.eff*100)+' % eff.':'&nbsp;')+'</small></td></tr>'; });
    html+='<tr class="foot"><th class="row" scope="row">Total</th>'+Q.map(q=>'<td class="tot">'+s[q.id]+'<small>'+pct(s[q.id],s.total)+'</small></td>').join("")+'<td class="tot">'+s.total+'<small>'+pct(s.M+s.A,s.total)+' eff.</small></td></tr></tbody>';
    $("grid").innerHTML=html;
    $("grid").querySelectorAll(".cell").forEach(b=>b.onclick=()=>act({k:"p",pos:b.dataset.pos,q:b.dataset.q},b.dataset.key));
    $("court").innerHTML=courtSVG(s);
    $("hs").innerHTML='<button type="button" class="big q-M" data-key="h-R"><span class="n">'+h.R+'</span><span class="lab">Réussie</span></button><button type="button" class="big q-X" data-key="h-X"><span class="n">'+h.X+'</span><span class="lab">Manquée</span></button>';
    $("hs-pct").textContent=h.n?pct(h.R,h.n)+" réussies sur "+h.n:"Toute l’équipe";
    $("hs").querySelectorAll(".big").forEach(b=>b.onclick=()=>act({k:"h",r:b.dataset.key.slice(2)},b.dataset.key));
    $("rec").innerHTML=[0,1,2,3].map(n=>'<button type="button" class="big r-'+n+'" data-key="r-'+n+'" data-n="'+n+'" aria-label="Réception '+n+'"><span class="lab huge">'+n+'</span><span class="n" style="font-size:20px">'+r.c[n]+'</span></button>').join("");
    $("rec").querySelectorAll(".big").forEach(b=>b.onclick=()=>act({k:"r",n:+b.dataset.n},b.dataset.key));
    const col=["var(--q-m)","var(--q-a)","var(--q-j)","var(--q-x)"];
    $("distrib").innerHTML=r.n?[0,1,2,3].map(n=>'<span style="width:'+(100*r.c[n]/r.n)+'%;background:'+col[n]+'"></span>').join(""):"";
    $("rec-stats").innerHTML='<span>Moyenne <b>'+(r.avg==null?"–":r.avg.toFixed(2))+'</b> / 3</span><span>Parfaites <b>'+pct(r.c[3],r.n)+'</b></span><span>Hors syst. (0-1) <b>'+pct(r.c[0]+r.c[1],r.n)+'</b></span>';
  }
  $("opp").value=d.opp||""; $("date").value=d.date||""; $("n1").value=d.n1||""; $("n2").value=d.n2||"";
  $("opp").addEventListener("input",e=>{ d.opp=e.target.value; changed(); });
  $("date").addEventListener("change",e=>{ d.date=e.target.value; changed(); });
  ["n1","n2"].forEach(k=>{
    $(k).addEventListener("input",e=>{ d[k]=e.target.value; changed(); render(); });
    $(k).addEventListener("change",()=>ctx.saveSettings({n1:d.n1,n2:d.n2}));
  });
  $("undo").onclick=()=>{
    let idx=-1; for(let i=d.events.length-1;i>=0;i--){ if(d.view==="all"||d.events[i].s===d.view){ idx=i; break; } }
    if(idx<0){ U.toast("Rien à annuler"); return; }
    const e=d.events[idx];
    const txt=e.k==="p"?"Passe "+POSLAB[e.pos]+" "+QLAB[e.q]+" ("+nameOf(d,e.w)+")":e.k==="h"?"Hors système "+(e.r==="R"?"réussie":"manquée"):"Réception "+e.n;
    d.events.splice(idx,1); changed(); render(); U.toast("Annulé : "+txt);
  };
  $("correct").onclick=()=>{ correct=!correct; $("correct").setAttribute("aria-pressed",String(correct)); document.body.classList.toggle("correct",correct); U.toast(correct?"Mode correction : chaque touche retire 1":"Saisie normale"); };
  $("pdf").onclick=()=>ctx.exportPDF();
  render();
}

/* ---------- Rapport PDF ---------- */
function pdf(sheet, team){
  const d=sheet.data, R=window.VSReport(), {doc,M,CW,C,mix,P}=R;
  const sets=played(d), Eall=filt(d,"all"), st=passStats(Eall,"both"), h=hsStats(Eall), r=recStats(Eall);
  const name=w=>nameOf(d,w);

  function court(x,y0,w,s,label){
    const k=w/320, X=v=>x+v*k, Y=v=>y0+v*k;
    R.font("bold",10,C.ink); doc.text(label,x+w/2,y0-6,{align:"center"});
    const max=Math.max(1,...POS.map(p=>s.byPos[p.id].n));
    Object.keys(ZONES).forEach(z=>{
      const [zx,zy,zw,zh]=ZONES[z];
      if(z==="5"){ R.fill([238,242,248]); doc.rect(X(zx),Y(zy),zw*k,zh*k,"F"); return; }
      const b=s.byPos[z], a=b.n?0.15+0.75*(b.n/max):0, dark=a>0.55, tc=dark?C.white:C.muted;
      R.fill(a?mix(C.accent,a):[238,242,248]); doc.rect(X(zx),Y(zy),zw*k,zh*k,"F");
      const cx=X(zx+zw/2), cy=Y((z==="P"||z==="1")?zy+zh/2+10:zy+zh/2+12);
      R.font("bold",6.5,tc); if(z==="2") doc.text("ZONE 2",X(zx+zw-6),Y(zy+14),{align:"right"}); else doc.text(z==="P"?"PIPE":"ZONE "+z,X(zx+6),Y(zy+14));
      R.font("bold",15,dark?C.white:C.ink); doc.text(s.total?Math.round(100*b.n/s.total)+"%":"–",cx,cy,{align:"center"});
      R.font("normal",6.5,tc); doc.text(b.n+(b.n?" · "+Math.round(b.eff*100)+"% eff.":""),cx,cy+10,{align:"center"});
    });
    R.draw(C.white); doc.setLineWidth(1.2); doc.line(X(110),Y(22),X(110),Y(288)); doc.line(X(210),Y(22),X(210),Y(288)); doc.line(X(10),Y(110),X(310),Y(110));
    R.draw(C.ink); doc.setLineWidth(1); doc.rect(X(10),Y(22),300*k,266*k,"S"); doc.setLineWidth(2.5); doc.line(X(2),Y(21),X(318),Y(21));
    R.fill(C.hi); doc.circle(X(SETTER[0]),Y(SETTER[1]),5,"F"); R.font("bold",6,C.ink); doc.text("P",X(SETTER[0]),Y(SETTER[1])+2.2,{align:"center"});
    R.font("normal",8,C.muted); doc.text(s.total+" passes · "+P(s.M+s.A,s.total)+" eff.",x+w/2,Y(300)+8,{align:"center"});
  }
  const passTable=E=>R.table([{h:"Passeur",w:2.2},{h:"Passes",w:1},{h:"Marquée",w:1,color:C.M},{h:"Attaquable",w:1.15,color:C.A},{h:"Jouable",w:1,color:C.J},{h:"Manquée",w:1,color:C.X},{h:"% marquée",w:1.1},{h:"% efficace",w:1.1}],
    [1,2,"both"].map(w=>{ const s=passStats(E,w); return [w==="both"?"Total":name(w),s.total,s.M,s.A,s.J,s.X,P(s.M,s.total),P(s.M+s.A,s.total)]; }),{boldLast:true});
  const posTable=E=>{ const s1=passStats(E,1), s2=passStats(E,2), t=passStats(E,"both");
    const rows=POS.map(p=>[p.lab+" · "+p.sub,s1.byPos[p.id].n,s2.byPos[p.id].n,t.byPos[p.id].n,P(t.byPos[p.id].n,t.total),t.byPos[p.id].n?Math.round(t.byPos[p.id].eff*100)+" %":"–"]);
    rows.push(["Total",s1.total,s2.total,t.total,t.total?"100 %":"–",P(t.M+t.A,t.total)]);
    R.table([{h:"Position",w:2.4},{h:name(1).slice(0,12),w:1.1},{h:name(2).slice(0,12),w:1.1},{h:"Total",w:.9},{h:"Répartition",w:1.2},{h:"Efficacité",w:1.1}],rows,{boldLast:true,rh:17}); };
  const hsRec=E=>{ const hh=hsStats(E), rr=recStats(E); R.ensure(84); const bw=(CW-12)/2;
    R.statBox(M,R.y,bw,"Hors système",P(hh.R,hh.n),"de réussite",[["Réussies : "+hh.R,C.M],["Manquées : "+hh.X,C.X]]);
    R.recBox(M+bw+12,R.y,bw,"Réception adverse",rr,[C.M,C.A,C.J,C.X]); R.y+=88; };

  R.header("STATS PASSEURS", (d.opp?"contre "+d.opp:"Adversaire non précisé")+"  ·  "+(d.date||""), team+" · sets joués : "+sets.length+" (deux de trois)", "Passeurs : "+name(1)+" et "+name(2));
  R.tiles([["Passes en système",st.total,"Manquées : "+st.X],["Marquées",P(st.M,st.total),st.M+" sur "+st.total],["Efficacité",P(st.M+st.A,st.total),"marquées + attaquables"],
    ["Hors système",P(h.R,h.n),h.R+" sur "+h.n],["Réception adverse",r.avg==null?"–":r.avg.toFixed(2),"moyenne sur 3"]]);
  R.title("Passeur en système · match complet"); passTable(Eall);
  R.title("Répartition par position","Intensité = part des passes · P = position du passeur",175);
  const cw=(CW-2*28)/3, cy0=R.y+14;
  court(M,cy0,cw,passStats(Eall,1),name(1)); court(M+cw+28,cy0,cw,passStats(Eall,2),name(2)); court(M+2*(cw+28),cy0,cw,st,"Les deux passeurs");
  R.y=cy0+cw*300/320+14;
  posTable(Eall);
  R.title("Hors système et réception adverse",null,84); hsRec(Eall);
  sets.forEach((s,i)=>{ if(i===0){ doc.addPage(); R.y=M; } const E=filt(d,s); R.ensure(330);
    R.title("Set "+s, passStats(E,"both").total+" passes en système"); passTable(E); posTable(E); hsRec(E); R.y+=6; });
  return R.finish("Stats passeurs · "+team+(d.opp?" · contre "+d.opp:"")+" · "+(d.date||""));
}

window.PasseursSheet = { blank, mount, summary, pdf };
})();
