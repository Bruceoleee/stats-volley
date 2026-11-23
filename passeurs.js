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
// Réception adverse : notes 0, 2 et 3 (les anciennes notes 1 sont ignorées)
const RN=[0,2,3];
const recStats = E => { const r=E.filter(e=>e.k==="r"&&RN.includes(e.n)); const c={}; RN.forEach(n=>c[n]=r.filter(e=>e.n===n).length); return {n:r.length,c,plus:c[2]+c[3]}; };
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
  let correct=false, sView=null;
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
    '<button class="btn stats" id="stats" type="button">Stats</button>'+
    '<button class="btn primary" id="pdf" type="button">PDF</button></div></div>'+
  '<section class="card" id="passcard"><div class="card-head"><h2>Passes en système · <span class="who" id="who"></span></h2><span class="sub" id="hint"></span></div>'+
    '<table class="setgrid big-grid" id="grid"></table></section>'+
  '<div class="two even">'+
    '<section class="card" id="hscard"><div class="card-head"><h2>Hors système</h2><span class="sub">Toute l’équipe</span></div><div class="bigrow c2" id="hs"></div></section>'+
    '<section class="card adv" id="reccard"><div class="card-head"><h2>Réception adverse</h2><span class="sub">3 parfaite · 2 jouable · 0 ace ou retour direct</span></div>'+
      '<div class="bigrow c3" id="rec"></div></section>'+
  '</div>'+
  '<dialog class="statsdlg" id="sdlg" aria-labelledby="sd-t"><div class="sd-head"><h2 id="sd-t">Statistiques</h2><div class="seg" id="sd-scope"></div><button class="btn" type="button" id="sd-close">Fermer</button></div><div class="sd-body" id="sd-body"></div></dialog>';

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
    const box=$(id); box.innerHTML=cap?'<span class="cap">'+cap+'</span>':'';
    items.forEach(it=>{ const b=document.createElement("button"); b.type="button"; b.textContent=it.lab; b.setAttribute("aria-pressed",String(cur===it.v)); b.onclick=()=>pick(it.v); box.appendChild(b); });
  }
  function render(){
    seg("sets","Set",[...SETS.map(s=>({v:s,lab:String(s)})),{v:"all",lab:"Match"}],d.view,v=>{d.view=v;render();});
    seg("setters","Passeur",[{v:1,lab:nameOf(d,1)},{v:2,lab:nameOf(d,2)},{v:"both",lab:"Les deux"}],d.who,v=>{d.who=v;render();});
    const E=filt(d,d.view), s=passStats(E,d.who), h=hsStats(E), r=recStats(E);
    $("who").textContent=d.who==="both"?nameOf(d,1)+" + "+nameOf(d,2):nameOf(d,d.who);
    $("passcard").classList.toggle("lock",d.view==="all"||d.who==="both");
    $("hscard").classList.toggle("lock",d.view==="all"); $("reccard").classList.toggle("lock",d.view==="all");
    $("hint").textContent=d.view==="all"?"Vue du match : choisis un set pour saisir":d.who==="both"?"Vue combinée : choisis un passeur pour saisir":"Ligne = position visée · colonne = qualité";
    let html='<colgroup><col class="c-row">'+Q.map(()=>'<col>').join("")+'<col class="c-tot"></colgroup><thead><tr><th></th>'+
      Q.map(q=>'<th class="colhead-'+q.id+'"><span class="l">'+q.lab+'</span><span class="s">'+q.sh+'</span></th>').join("")+'<th>Total</th></tr></thead><tbody>';
    POS.forEach(pos=>{ const b=s.byPos[pos.id];
      html+='<tr><th class="row" scope="row">'+pos.lab+'<small>'+pos.sub+'</small></th>'+
        Q.map(q=>'<td><button type="button" class="cell q-'+q.id+'" data-key="p-'+pos.id+'-'+q.id+'" data-pos="'+pos.id+'" data-q="'+q.id+'" aria-label="'+pos.lab+' '+q.lab+'">'+b[q.id]+'</button></td>').join("")+
        '<td class="tot">'+b.n+'</td></tr>'; });
    html+='<tr class="foot"><th class="row" scope="row">Total</th>'+Q.map(q=>'<td class="tot">'+s[q.id]+'</td>').join("")+'<td class="tot">'+s.total+'</td></tr></tbody>';
    $("grid").innerHTML=html;
    $("grid").querySelectorAll(".cell").forEach(b=>b.onclick=()=>act({k:"p",pos:b.dataset.pos,q:b.dataset.q},b.dataset.key));
    $("hs").innerHTML='<button type="button" class="big q-M" data-key="h-R"><span class="n">'+h.R+'</span><span class="lab">Réussie</span></button><button type="button" class="big q-X" data-key="h-X"><span class="n">'+h.X+'</span><span class="lab">Manquée</span></button>';
    $("hs").querySelectorAll(".big").forEach(b=>b.onclick=()=>act({k:"h",r:b.dataset.key.slice(2)},b.dataset.key));
    $("rec").innerHTML=RN.map(n=>'<button type="button" class="big r-'+n+'" data-key="r-'+n+'" data-n="'+n+'" aria-label="Réception adverse '+n+'"><span class="lab huge">'+n+'</span><span class="n" style="font-size:20px">'+r.c[n]+'</span></button>').join("");
    $("rec").querySelectorAll(".big").forEach(b=>b.onclick=()=>act({k:"r",n:+b.dataset.n},b.dataset.key));
  }

  /* ---------- Panneau des stats ---------- */
  function kv(k,v,dd){ return '<div class="kv"><span class="k">'+esc(k)+'</span><span class="v">'+v+'</span><span class="d">'+esc(dd||"")+'</span></div>'; }
  function renderStats(){
    seg("sd-scope","",[...SETS.map(s=>({v:s,lab:"Set "+s})),{v:"all",lab:"Match"}],sView,v=>{sView=v;renderStats();});
    const E=filt(d,sView), st=passStats(E,"both"), h=hsStats(E), r=recStats(E);
    let o='<div class="statrow">'+kv("Passes en système",st.total,"Manquées : "+st.X)+kv("Marquées",pct(st.M,st.total),st.M+" sur "+st.total)+kv("Efficacité",pct(st.M+st.A,st.total),"Marquées + attaquables")+
      kv("Hors système",pct(h.R,h.n),h.R+" réussies sur "+h.n)+kv("Réc. adverse 2+",pct(r.plus,r.n),r.n+" réceptions")+'</div>';
    o+='<section class="card"><h3>Par passeur</h3><div class="tscroll"><table class="st"><thead><tr><th>Passeur</th><th>Passes</th><th>Marquée</th><th>Attaquable</th><th>Jouable</th><th>Manquée</th><th>% marquée</th><th>% efficace</th></tr></thead><tbody>'+
      [1,2].map(w=>{ const p=passStats(E,w); return '<tr><td>'+esc(nameOf(d,w))+'</td><td>'+p.total+'</td><td>'+p.M+'</td><td>'+p.A+'</td><td>'+p.J+'</td><td>'+p.X+'</td><td>'+pct(p.M,p.total)+'</td><td>'+pct(p.M+p.A,p.total)+'</td></tr>'; }).join("")+
      '</tbody><tfoot><tr><td>Total</td><td>'+st.total+'</td><td>'+st.M+'</td><td>'+st.A+'</td><td>'+st.J+'</td><td>'+st.X+'</td><td>'+pct(st.M,st.total)+'</td><td>'+pct(st.M+st.A,st.total)+'</td></tr></tfoot></table></div></section>';
    o+='<section class="card"><h3>Répartition par position</h3><div class="courts">'+
      [[1,nameOf(d,1)],[2,nameOf(d,2)],["both","Les deux"]].map(([w,l])=>'<figure><figcaption>'+esc(l)+'</figcaption>'+courtSVG(passStats(E,w))+'</figure>').join("")+'</div>';
    const sets3=[[passStats(E,1),nameOf(d,1)],[passStats(E,2),nameOf(d,2)],[st,"Les deux"]];
    const heat=(num,den)=>{ if(!den) return '<td class="hm">–</td>'; const v=num/den; return '<td class="hm" style="background:color-mix(in srgb,var(--q-m) '+Math.round(8+v*42)+'%,var(--panel))">'+Math.round(v*100)+' %</td>'; };
    o+='<h3 style="margin-top:6px">Efficacité par position</h3><div class="tscroll"><table class="st eff"><thead><tr class="grp"><th></th>'+sets3.map(([,l])=>'<th colspan="3" class="sep">'+esc(l)+'</th>').join("")+'</tr>'+
      '<tr><th>Position</th>'+sets3.map(()=>'<th class="sep">Passes</th><th>% marq.</th><th>% eff.</th>').join("")+'</tr></thead><tbody>'+
      POS.map(p=>'<tr><td>'+p.lab+' · '+p.sub+'</td>'+sets3.map(([x])=>{ const b=x.byPos[p.id]; return '<td class="sep">'+b.n+(x.total?' <span class="sub">('+pct(b.n,x.total)+')</span>':'')+'</td>'+heat(b.M,b.n)+heat(b.M+b.A,b.n); }).join("")+'</tr>').join("")+
      '</tbody><tfoot><tr><td>Total</td>'+sets3.map(([x])=>'<td class="sep">'+x.total+'</td>'+heat(x.M,x.total)+heat(x.M+x.A,x.total)).join("")+'</tr></tfoot></table></div>'+
      '<p class="sub" style="margin:0">Entre parenthèses : part des passes du passeur envoyées à cette position. Plus la case est verte, plus le % est élevé.</p></section>';
    o+='<div class="two even"><section class="card"><h3>Hors système</h3><div class="statrow">'+kv("Réussies",h.R,pct(h.R,h.n))+kv("Manquées",h.X,pct(h.X,h.n))+'</div></section>'+
      '<section class="card"><h3>Réception adverse</h3><div class="statrow">'+RN.map(n=>kv("Note "+n,pct(r.c[n],r.n),r.c[n]+" sur "+r.n)).join("")+kv("2 et plus",pct(r.plus,r.n),r.plus+" sur "+r.n)+'</div></section></div>';
    $("sd-body").innerHTML=o;
  }
  $("stats").onclick=()=>{ sView=d.view; renderStats(); try{ $("sdlg").showModal(); }catch(e){ $("sdlg").setAttribute("open",""); } };
  $("sd-close").onclick=()=>$("sdlg").close();

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
    const txt=e.k==="p"?"Passe "+POSLAB[e.pos]+" "+QLAB[e.q]+" ("+nameOf(d,e.w)+")":e.k==="h"?"Hors système "+(e.r==="R"?"réussie":"manquée"):"Réception adverse "+e.n;
    d.events.splice(idx,1); changed(); render(); U.toast("Annulé : "+txt);
  };
  $("correct").onclick=()=>{ correct=!correct; $("correct").setAttribute("aria-pressed",String(correct)); document.body.classList.toggle("correct",correct); U.toast(correct?"Mode correction : chaque touche retire 1":"Saisie normale"); };
  $("pdf").onclick=()=>ctx.exportPDF();
  render();
}

/* ---------- Rapport PDF : page 1 = match complet, puis une page identique par set ---------- */
function pdfFor(d, team, layout){
  const R=window.VSReport(), {doc,M,CW,C,mix,P}=R;
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
  function body(E, scopeLabel){
    const st=passStats(E,"both"), h=hsStats(E), r=recStats(E);
    R.tiles([["Passes en système",st.total,"Manquées : "+st.X],["Marquées",P(st.M,st.total),st.M+" sur "+st.total],["Efficacité",P(st.M+st.A,st.total),"marquées + attaquables"],
      ["Hors système",P(h.R,h.n),h.R+" réussies sur "+h.n],["Réc. adverse 2+",P(r.plus,r.n),r.n+" réceptions"]]);
    R.title("Passeur en système · "+scopeLabel);
    R.table([{h:"Passeur",w:2.2},{h:"Passes",w:1},{h:"Marquée",w:1,color:C.M},{h:"Attaquable",w:1.15,color:C.A},{h:"Jouable",w:1,color:C.J},{h:"Manquée",w:1,color:C.X},{h:"% marquée",w:1.1},{h:"% efficace",w:1.1}],
      [1,2,"both"].map(w=>{ const s=passStats(E,w); return [w==="both"?"Total":name(w),s.total,s.M,s.A,s.J,s.X,P(s.M,s.total),P(s.M+s.A,s.total)]; }),{boldLast:true});
    R.title("Répartition et efficacité par position","Intensité = part des passes · P = position du passeur");
    const cw=(CW-2*40)/3, cy0=R.y+14;
    court(M,cy0,cw,passStats(E,1),name(1)); court(M+cw+40,cy0,cw,passStats(E,2),name(2)); court(M+2*(cw+40),cy0,cw,st,"Les deux passeurs");
    R.y=cy0+cw*300/320+14;
    const g3=[[passStats(E,1),name(1)],[passStats(E,2),name(2)],[st,"Les deux"]];
    const cols=[{h:"Position",w:2.1}];
    g3.forEach(([,l])=>{ const g=l.slice(0,16); cols.push({h:"Passes",w:1.05,group:g},{h:"% marq.",w:1.1,group:g,color:C.M},{h:"% eff.",w:1.05,group:g,color:C.accent}); });
    const rows=POS.map(p=>{ const r=[p.lab+" · "+p.sub]; g3.forEach(([x])=>{ const b=x.byPos[p.id]; r.push(b.n,P(b.M,b.n),P(b.M+b.A,b.n)); }); return r; });
    const tr=["Total"]; g3.forEach(([x])=>tr.push(x.total,P(x.M,x.total),P(x.M+x.A,x.total))); rows.push(tr);
    R.table(cols,rows,{boldLast:true,rh:14.5,fs:8.5,hfs:6.8});
    R.title("Hors système et réception adverse");
    const bw=(CW-12)/2;
    R.statBox(M,R.y,bw,"Hors système",P(h.R,h.n),"de réussite",[["Réussies : "+h.R,C.M],["Manquées : "+h.X,C.X]]);
    R.distBox(M+bw+12,R.y,bw,"Réception adverse",P(r.plus,r.n),"de 2 et plus · "+r.n+" réc.",RN.map(n=>({lab:"Note "+n,count:r.c[n],pct:P(r.c[n],r.n),color:n===0?C.M:n===2?C.J:C.X})));
    R.y+=86;
  }
  return layout(R, body, name);
}
function pdf(sheet, team){
  const d=sheet.data;
  return pdfFor(d, team, (R, body, name)=>{
    const sets=played(d);
    const opp=(d.opp?"contre "+d.opp:"Adversaire non précisé")+"  ·  "+(d.date||"");
    R.header("STATS PASSEURS", opp, team+" · sets joués : "+sets.length, "Passeurs : "+name(1)+" et "+name(2));
    body(filt(d,"all"),"match complet");
    sets.forEach(s=>{ R.newPage(); R.subHeader("SET "+s, opp, team); body(filt(d,s),"set "+s); });
    return R.finish("Stats passeurs · "+team+(d.opp?" · contre "+d.opp:"")+" · "+(d.date||""));
  });
}

/* ---------- Rapport récapitulatif de plusieurs matchs ---------- */
// Les passeurs sont regroupés par nom ; s'il y a plus de deux noms différents, par position (passeur 1 / passeur 2).
function recap(sheets, team, title){
  sheets=[...sheets].sort((a,b)=>(a.data.date||"").localeCompare(b.data.date||""));
  const norm=x=>(x||"").trim().toLowerCase();
  const names=[];
  sheets.forEach(sh=>[1,2].forEach(w=>{ const n=(w===1?sh.data.n1:sh.data.n2)||""; if(n.trim() && !names.some(x=>norm(x)===norm(n))) names.push(n.trim()); }));
  const byName=names.length>0 && names.length<=2;
  const slotOf=(sh,w)=>{ if(!byName) return w; const n=norm(w===1?sh.data.n1:sh.data.n2); const i=names.findIndex(x=>norm(x)===n); return i>=0?i+1:w; };
  const v={ n1:byName?(names[0]||""):(sheets[0]&&sheets[0].data.n1)||"", n2:byName?(names[1]||""):(sheets[0]&&sheets[0].data.n2)||"", events:[] };
  const perMatch=sheets.map((sh,mi)=>{ const ev=sh.data.events.map(e=>e.k==="p"?Object.assign({},e,{w:slotOf(sh,e.w),m:mi}):Object.assign({},e,{m:mi})); v.events.push(...ev); return {sh,ev}; });
  const dates=sheets.map(x=>x.data.date).filter(Boolean).sort();
  const period=dates.length?(dates[0]===dates[dates.length-1]?dates[0]:dates[0]+" au "+dates[dates.length-1]):"";
  return pdfFor(v, team, (R, body, name)=>{
    const {doc,M,CW,C,P}=R;
    R.header("RÉCAPITULATIF PASSEURS", (title||"Plusieurs matchs")+(period?"  ·  "+period:""), team+" · "+sheets.length+" match"+(sheets.length>1?"s":""), "Passeurs : "+name(1)+" et "+name(2));
    body(v.events,"tous les matchs");
    R.newPage(); R.subHeader("PAR MATCH", (title||"")+(period?"  ·  "+period:""), team);
    R.title("Résultats de chaque match","Passes en système · hors système et réception adverse : toute l’équipe");
    const rows=[];
    perMatch.forEach(({sh,ev})=>{
      const lab=((sh.data.date||"").slice(5).replace("-","/")+" "+(sh.data.opp||"Adversaire ?")).slice(0,30);
      const h=hsStats(ev), r=recStats(ev);
      [1,2].forEach((w,i)=>{ const p=passStats(ev,w); if(!p.total && i>0) return;
        rows.push([i===0?lab:"", name(w), p.total, P(p.M,p.total), P(p.M+p.A,p.total), i===0?P(h.R,h.n):"", i===0?P(r.plus,r.n):""]); });
    });
    const all=passStats(v.events,"both"), ha=hsStats(v.events), ra=recStats(v.events);
    rows.push(["Tous les matchs","Les deux",all.total,P(all.M,all.total),P(all.M+all.A,all.total),P(ha.R,ha.n),P(ra.plus,ra.n)]);
    R.table([{h:"Match",w:3},{h:"Passeur",w:1.8},{h:"Passes",w:1},{h:"% marquée",w:1.2,color:C.M},{h:"% efficace",w:1.2,color:C.accent},{h:"Hors syst. %",w:1.3},{h:"Réc. adv. 2+",w:1.3}],rows,{boldLast:true,rh:17,fs:9});
    if(!byName && names.length>2){ R.font("normal",8.5,C.muted); doc.text("Plus de deux noms de passeurs : les passeurs sont regroupés par position sur la feuille (passeur 1 / passeur 2).",M,R.y+4); }
    return R.finish("Récapitulatif passeurs · "+team+(title?" · "+title:""));
  });
}


window.PasseursSheet = { blank, mount, summary, pdf, recap };
})();
