/* Outils communs pour les rapports PDF (jsPDF, format lettre). */
(function(){
"use strict";
const C = { ink:[20,26,38], muted:[91,101,120], line:[217,222,232], soft:[243,245,249], accent:[29,79,168], hi:[242,194,48], white:[255,255,255],
  M:[15,122,74], A:[63,154,44], J:[182,122,0], X:[194,54,47] };
const mix = (c,a) => c.map(v => Math.round(255-(255-v)*a));

function Report(opts){
  const { jsPDF } = window.jspdf;
  opts = opts || {};
  const doc = new jsPDF({ unit:"pt", format:"letter", orientation: opts.landscape ? "landscape" : "portrait" });
  const W=opts.landscape?792:612, H=opts.landscape?612:792, M=opts.landscape?32:40, CW=W-2*M;
  const r = { doc, W, H, M, CW, C, mix, y:M };
  r.font = (st,sz,col) => { doc.setFont("helvetica",st); doc.setFontSize(sz); doc.setTextColor(...(col||C.ink)); };
  r.fill = c => doc.setFillColor(...c);
  r.draw = c => doc.setDrawColor(...c);
  r.P = (a,b) => b ? Math.round(100*a/b)+" %" : "–";
  r.ensure = h => { if(r.y+h > H-46){ doc.addPage(); r.y=M; } };

  r.newPage = () => { doc.addPage(); r.y=M; };
  // Bandeau plus petit pour les pages de set
  r.subHeader = (title, line1, right1) => {
    r.fill(C.accent); doc.rect(0,0,W,52,"F");
    r.fill(C.hi); doc.rect(0,52,W,3,"F");
    r.font("bold",18,C.white); doc.text(title,M,33); const tw=doc.getTextWidth(title);
    r.font("normal",10,C.white); doc.text(line1,M+tw+14,33);
    if(right1) doc.text(right1,W-M,33,{align:"right"});
    r.y = 72;
  };
  r.header = (title, line1, right1, right2) => {
    r.fill(C.accent); doc.rect(0,0,W,84,"F");
    r.fill(C.hi); doc.rect(0,84,W,4,"F");
    r.font("bold",22,C.white); doc.text(title,M,40);
    r.font("normal",12,C.white); doc.text(line1,M,62);
    r.font("normal",10,C.white);
    if(right1) doc.text(right1,W-M,40,{align:"right"});
    if(right2) doc.text(right2,W-M,58,{align:"right"});
    r.y = 110;
  };
  r.title = (t, sub, next) => {
    r.ensure(34+(next||0));
    r.font("bold",13,C.ink); doc.text(t.toUpperCase(),M,r.y+12);
    if(sub){ r.font("normal",9,C.muted); doc.text(sub,M+CW,r.y+12,{align:"right"}); }
    r.draw(C.accent); doc.setLineWidth(1.5); doc.line(M,r.y+18,M+CW,r.y+18); r.y+=28;
  };
  r.tiles = list => {
    const n=list.length, tw=(CW-(n-1)*8)/n;
    r.ensure(60);
    list.forEach((t,i)=>{ const x=M+i*(tw+8);
      r.draw(C.line); doc.setLineWidth(.8); doc.roundedRect(x,r.y,tw,52,5,5,"S");
      r.font("bold",7,C.muted); doc.text(t[0].toUpperCase(),x+8,r.y+14);
      r.font("bold",18,C.ink); doc.text(String(t[1]),x+8,r.y+36);
      r.font("normal",7.5,C.muted); doc.text(String(t[2]||""),x+8,r.y+48); });
    r.y += 64;
  };
  // cols: [{h, w, color, group}] ; rows: arrays ; opt: {boldLast, rh, fs, x, w}
  r.table = (cols, rows, opt) => {
    opt = opt || {};
    const x=opt.x ?? M, w=opt.w ?? CW, rh=opt.rh||19, fs=opt.fs||9.5;
    const total=cols.reduce((s,c)=>s+c.w,0), k=w/total;
    const groups = cols.some(c=>c.group);
    r.ensure(rh*(rows.length+1+(groups?1:0))+4);
    let cx;
    if(groups){
      cx=x; let i=0;
      while(i<cols.length){
        let j=i, gw=0; while(j<cols.length && cols[j].group===cols[i].group){ gw+=cols[j].w*k; j++; }
        if(cols[i].group){ r.font("bold",8.5,C.ink); doc.text(cols[i].group.toUpperCase(), cx+gw/2, r.y+11, {align:"center"});
          r.draw(C.accent); doc.setLineWidth(1); doc.line(cx+4,r.y+15,cx+gw-4,r.y+15); }
        cx+=gw; i=j;
      }
      r.y+=18;
    }
    r.fill(C.soft); doc.rect(x,r.y,w,rh,"F");
    cx=x;
    cols.forEach((c,i)=>{ const cw=c.w*k; r.font("bold",opt.hfs||7.5,c.color||C.muted);
      doc.text(String(c.h).toUpperCase(), i===0?cx+6:cx+cw/2, r.y+rh/2+3, {align:i===0?"left":"center"}); cx+=cw; });
    r.y+=rh;
    rows.forEach((row,ri)=>{
      const last=opt.boldLast && ri===rows.length-1;
      if(last){ r.draw(C.ink); doc.setLineWidth(.8); doc.line(x,r.y,x+w,r.y); }
      else if(ri>0){ r.draw(C.line); doc.setLineWidth(.5); doc.line(x,r.y,x+w,r.y); }
      cx=x;
      row.forEach((v,i)=>{ const cw=cols[i].w*k; r.font(last||i===0?"bold":"normal",fs,C.ink);
        doc.text(String(v), i===0?cx+6:cx+cw/2, r.y+rh/2+3.5, {align:i===0?"left":"center"}); cx+=cw; });
      r.y+=rh;
    });
    r.y+=8;
  };
  // Boîte de distribution 0-1-2-3 (réception)
  r.recBox = (x, y0, w, label, rs, colors) => {
    r.fill(C.soft); doc.roundedRect(x,y0,w,76,6,6,"F");
    r.font("bold",9,C.muted); doc.text(label.toUpperCase(),x+12,y0+18);
    r.font("bold",22,C.ink); doc.text(rs.avg==null?"–":rs.avg.toFixed(2),x+12,y0+46);
    r.font("normal",9,C.muted); doc.text("moyenne sur 3 · "+rs.n+" réc.",x+12,y0+60);
    const gx=x+w-12-4*30;
    [0,1,2,3].forEach(n=>{ const cx=gx+n*30;
      r.fill(mix(colors[n],.18)); doc.roundedRect(cx,y0+26,26,36,4,4,"F");
      r.font("bold",8,colors[n]); doc.text(String(n),cx+13,y0+37,{align:"center"});
      r.font("bold",13,C.ink); doc.text(String(rs.c[n]),cx+13,y0+55,{align:"center"}); });
  };
  r.distBox = (x, y0, w, label, big, small, items, h) => {
    h = h || 76;
    r.fill(C.soft); doc.roundedRect(x,y0,w,h,6,6,"F");
    r.font("bold",9,C.muted); doc.text(label.toUpperCase(),x+12,y0+18);
    r.font("bold",22,C.ink); doc.text(String(big),x+12,y0+46);
    r.font("normal",9,C.muted); doc.text(small,x+12,y0+60);
    const cw=38, gx=x+w-12-items.length*(cw+4)+4;
    items.forEach((it,n)=>{ const cx=gx+n*(cw+4);
      r.fill(mix(it.color,.16)); doc.roundedRect(cx,y0+10,cw,h-20,4,4,"F");
      r.font("bold",8,it.color); doc.text(String(it.lab),cx+cw/2,y0+22,{align:"center"});
      r.font("bold",13,C.ink); doc.text(String(it.count),cx+cw/2,y0+40,{align:"center"});
      r.font("normal",8,C.muted); doc.text(String(it.pct),cx+cw/2,y0+53,{align:"center"}); });
  };
  r.statBox = (x, y0, w, label, big, small, lines) => {
    r.fill(C.soft); doc.roundedRect(x,y0,w,76,6,6,"F");
    r.font("bold",9,C.muted); doc.text(label.toUpperCase(),x+12,y0+18);
    r.font("bold",22,C.ink); doc.text(String(big),x+12,y0+46);
    r.font("normal",9,C.muted); doc.text(small,x+12,y0+60);
    (lines||[]).forEach((l,i)=>{ r.font("bold",10.5,l[1]||C.ink); doc.text(l[0],x+w-12,y0+30+i*15,{align:"right"}); });
  };
  r.finish = footer => {
    const n=doc.getNumberOfPages();
    for(let i=1;i<=n;i++){ doc.setPage(i); r.font("normal",8,C.muted); doc.text(footer,M,H-24); doc.text("Page "+i+" / "+n,W-M,H-24,{align:"right"}); }
    return doc.output("blob");
  };
  return r;
}
window.VSReport = Report;
})();
