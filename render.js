import { CLAY, GLAZES, NL, LEVERS, PRESETS } from './glazes-data.js';
import { hd, circularSpan, cardTemperature, cardDepth, harmonyScore, scoreAesthetic, scoreGlaze, pairingScore, buildGlazeAffinity, SCORE_PRESETS, DEFAULT_SCORE_WEIGHTS } from './scoring.js';
import { state } from './state.js';
import { saveAll, exportSession } from './persistence.js';

// Constants for SVG
const TH = 78;
const TG = 1;
let NT = 4;
const SVG_W = 100;

const SCORE_HI = 70;
const SCORE_MID = 45;

let lastRenderedKeys = [];
let lastSavedKeys = [];

// ── COLOR MATH ────────────────────────────────────────────────────────────────
export function hexRGB(h){return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)};}

export function applyGlaze(g,ck){
  const clay=hexRGB(CLAY[ck]);let{r,g:gr,b}=hexRGB(g.hex);
  const isMatte=['matte','textured','crawl-dot','crawl-leather','crawl-crackle'].includes(g.fin);
  if(isMatte){r=Math.min(255,Math.round(r*.86+24));gr=Math.min(255,Math.round(gr*.86+24));b=Math.min(255,Math.round(b*.86+24));}
  else{r=Math.min(255,Math.round(r*.94+8));gr=Math.min(255,Math.round(gr*.94+8));b=Math.min(255,Math.round(b*.94+8));}
  const tr=g.trans||0;
  if(tr>0){r=Math.round(r*(1-tr)+clay.r*tr);gr=Math.round(gr*(1-tr)+clay.g*tr);b=Math.round(b*(1-tr)+clay.b*tr);}
  if(ck==='red'){const ri=0.10+tr*0.22;r=Math.round(r+(clay.r-r)*ri);gr=Math.round(gr+(clay.g-gr)*ri);b=Math.round(b+(clay.b-b)*ri);}
  return{r,gr,b};
}

export function lerp(a,b,t){t=Math.max(0,Math.min(1,t));return{r:a.r+(b.r-a.r)*t,gr:a.gr+(b.gr-a.gr)*t,b:a.b+(b.b-a.b)*t};}

export function sampleAt(t,glazes,ck){
  ck=ck||clayKey;
  if(!glazes||!glazes.length){const c=hexRGB(CLAY[ck]);return{r:c.r,gr:c.g,b:c.b};}
  if(glazes.length===1)return applyGlaze(glazes[0],ck);
  const s=Math.max(0,Math.min(1,t))*(glazes.length-1),i=Math.min(Math.floor(s),glazes.length-2);
  return lerp(applyGlaze(glazes[i],ck),applyGlaze(glazes[i+1],ck),s-i);
}

export function toHex(r,g,b){return'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}

export function glazeCSS(glazes,ck){
  ck=ck||clayKey;if(!glazes||!glazes.length)return CLAY[ck];
  const stops=Array.from({length:9},(_,i)=>{const t=i/8,c=sampleAt(t,glazes,ck);return`rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)}) ${Math.round(t*100)}%`;});
  return`linear-gradient(to right,${stops.join(',')})`;
}

// ── SVG ───────────────────────────────────────────────────────────────────────
export function uid6(){return Math.random().toString(36).slice(2,8);}

export function gradStops(glazes,ck,tf,tb,H){
  return Array.from({length:41},(_,i)=>{const lt=i/40,gt=tf+lt*(tb-tf),c=sampleAt(gt,glazes,ck);return`<stop offset="${(lt*100).toFixed(1)}%" stop-color="rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)})"/>`;}).join('');
}

export function crackPat(id,ck){const cc=ck==='red'?'rgba(80,35,15,0.22)':'rgba(120,112,102,0.20)';let p='';for(let i=0;i<9;i++){const x0=(Math.random()*8).toFixed(1),y0=(Math.random()*8).toFixed(1),x1=(+x0+Math.random()*5-2.5).toFixed(1),y1=(+y0+Math.random()*5-2.5).toFixed(1),mx=((+x0+ +x1)/2+(Math.random()-.5)).toFixed(1),my=((+y0+ +y1)/2+(Math.random()-.5)).toFixed(1);p+=`<path d="M${x0},${y0}Q${mx},${my}${x1},${y1}" stroke="${cc}" stroke-width="${(0.25+Math.random()*.25).toFixed(2)}" fill="none"/>`;}return`<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">${p}</pattern>`;}

export function dotPat(id,bh,ck){const c=CLAY[ck];return`<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${bh}"/><circle cx="2.5" cy="2.5" r="1.3" fill="${c}" opacity="0.62"/><circle cx="7.5" cy="6" r="1.0" fill="${c}" opacity="0.52"/><circle cx="4" cy="8.5" r="0.8" fill="${c}" opacity="0.48"/><circle cx="8.5" cy="1.5" r="0.7" fill="${c}" opacity="0.42"/></pattern>`;}

export function leatherPat(id,bh){const l='#1e1e1e';return`<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="${bh}"/><path d="M0,4Q3.5,2 7,5Q10.5,8 14,4" stroke="${l}" stroke-width="0.65" fill="none" opacity="0.60"/><path d="M0,10Q3,8 6.5,11Q10,14 14,10" stroke="${l}" stroke-width="0.55" fill="none" opacity="0.50"/><path d="M4,0Q3,4 4,7Q5,11 3,14" stroke="${l}" stroke-width="0.5" fill="none" opacity="0.45"/><path d="M10,0Q9,5 11,8Q12,12 10,14" stroke="${l}" stroke-width="0.5" fill="none" opacity="0.40"/></pattern>`;}

export function grogPat(id,bh){return`<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${bh}"/><circle cx="1.5" cy="1.5" r="0.55" fill="rgba(0,0,0,0.09)"/><circle cx="4.5" cy="3" r="0.45" fill="rgba(0,0,0,0.07)"/><circle cx="2.5" cy="5" r="0.50" fill="rgba(0,0,0,0.08)"/><circle cx="5.5" cy="5.5" r="0.35" fill="rgba(255,255,255,0.11)"/></pattern>`;}

export function tileInner(glazes,ck,tf,tb,H,W){
  const id=uid6(),gid='g'+id,clayHex=CLAY[ck];
  const midT=(tf+tb)/2,midS=Math.max(0,Math.min(1,midT))*(glazes.length-1),midI=Math.min(Math.floor(midS),glazes.length-1);
  const dg=glazes[midI],midC=sampleAt(midT,glazes,ck),midHex=toHex(midC.r,midC.gr,midC.b);
  let defs=`<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">${gradStops(glazes,ck,tf,tb,H)}</linearGradient>`;
  let body=`<rect width="${W}" height="${H}" fill="url(#${gid})"/>`,overlay='';
  if(dg){const pid='p'+id;
    if(dg.fin==='crawl-dot'){defs+=dotPat(pid,midHex,ck);body=`<rect width="${W}" height="${H}" fill="url(#${pid})"/>`;}
    else if(dg.fin==='crawl-leather'){defs+=leatherPat(pid,midHex);body=`<rect width="${W}" height="${H}" fill="url(#${pid})"/>`;}
    else if(dg.fin==='crawl-crackle'){defs+=crackPat(pid,ck);overlay=`<rect width="${W}" height="${H}" fill="url(#${pid})"/>`;}
    else if(dg.fin==='textured'){defs+=grogPat(pid,midHex);overlay=`<rect width="${W}" height="${H}" fill="url(#${pid})" opacity="0.80"/>`;}
  }
  let dots='';
  if(glazes.some(g=>g.special==='gold-flake')){
    const gi=glazes.findIndex(g=>g.special==='gold-flake'),gc=['#C8900A','#B87C08','#D4A010','#A86C06'];
    for(let i=0;i<55;i++){const dy=Math.random()*H,gt=tf+(dy/H)*(tb-tf),pr=Math.max(0,1-Math.abs(gt-gi/Math.max(glazes.length-1,1))*2.5);if(pr>.05&&Math.random()<pr*.4){const op=(0.35+Math.random()*.5).toFixed(2),col=gc[Math.floor(Math.random()*gc.length)],x=(Math.random()*W).toFixed(1),y=dy.toFixed(1);if(Math.random()>.45){const r=(0.18+Math.random()*.52).toFixed(1);dots+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" opacity="${op}"/>`;}else{const rx=(0.2+Math.random()*.55).toFixed(1),ry=(0.08+Math.random()*.25).toFixed(1),rot=(Math.random()*180).toFixed(0);dots+=`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${col}" opacity="${op}" transform="rotate(${rot},${x},${y})"/>`;}}}
  }
  return`<defs>${defs}</defs><rect width="${W}" height="${H}" fill="${clayHex}"/>${body}${overlay}${dots}`;
}

// Total stack height is pinned to the classic 4-tile size regardless of NT,
// so raising the tile-division count subdivides the same card height into
// thinner bands instead of making cards grow taller.
function _stackTotalHeight(tH){return 4*tH+3*TG;}

export function tileSVG(ti,glazes,ck,tH){
  tH=tH||TH;ck=ck||clayKey;
  const TOTAL=_stackTotalHeight(tH);
  const effH=(TOTAL-(NT-1)*TG)/NT;
  const top=ti*(effH+TG),bot=top+effH,tf=top/TOTAL,tb=bot/TOTAL,W=SVG_W,H=effH;
  return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="display:block;width:100%;border-radius:3px;" aria-hidden="true">${tileInner(glazes,ck,tf,tb,H,W)}</svg>`;
}

export function pairTileSVG(glazes,ck,h){
  ck=ck||clayKey;h=h||72;const W=SVG_W;
  return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" style="display:block;width:100%;border-radius:4px;" aria-hidden="true">${tileInner(glazes,ck,0,1,h,W)}</svg>`;
}

export function swatchSVG(g,ck,h){
  h=h||46;const W=100,id=uid6(),clayHex=CLAY[ck],c=applyGlaze(g,ck),col=`rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)})`,mh=toHex(c.r,c.gr,c.b);
  let defs='',body=`<rect width="${W}" height="${h}" fill="${col}"/>`,overlay='';const pid='p'+id;
  if(g.fin==='crawl-dot'){defs=dotPat(pid,mh,ck);body=`<rect width="${W}" height="${h}" fill="url(#${pid})"/>`;}
  else if(g.fin==='crawl-leather'){defs=leatherPat(pid,mh);body=`<rect width="${W}" height="${h}" fill="url(#${pid})"/>`;}
  else if(g.fin==='crawl-crackle'){defs=crackPat(pid,ck);overlay=`<rect width="${W}" height="${h}" fill="url(#${pid})"/>`;}
  else if(g.fin==='textured'){defs=grogPat(pid,mh);overlay=`<rect width="${W}" height="${h}" fill="url(#${pid})" opacity="0.80"/>`;}
  let gd='';if(g.special==='gold-flake'){const gc=['#C8900A','#B87C08','#D4A010'];for(let i=0;i<22;i++){const op=(0.35+Math.random()*.5).toFixed(2),r=(0.18+Math.random()*.48).toFixed(1);gd+=`<circle cx="${(Math.random()*W).toFixed(1)}" cy="${(Math.random()*h).toFixed(1)}" r="${r}" fill="${gc[i%3]}" opacity="${op}"/>`;}}
  return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" style="display:block;width:100%;" aria-hidden="true"><defs>${defs}</defs><rect width="${W}" height="${h}" fill="${clayHex}"/>${body}${overlay}${gd}</svg>`;
}

function _galleryEqualStops(glazes,ck){
  const n=glazes.length;
  return glazes.map((g,i)=>{
    const c=applyGlaze(g,ck);
    const pct=n>1?(i/(n-1))*100:50;
    return`rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)}) ${pct.toFixed(1)}%`;
  }).join(',');
}

export function galleryGradientCSS(glazes,ck,mode){
  ck=ck||clayKey;
  if(!glazes||!glazes.length)return CLAY[ck];
  if(mode==='radial')return`radial-gradient(circle,${_galleryEqualStops(glazes,ck)})`;
  if(mode==='conic'){
    const stops=glazes.map((g,i)=>{const c=applyGlaze(g,ck);const n=glazes.length;const pct=n>1?(i/(n))*100:0;return`rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)}) ${pct.toFixed(1)}%`;});
    const first=glazes[0],fc=applyGlaze(first,ck);
    stops.push(`rgb(${Math.round(fc.r)},${Math.round(fc.gr)},${Math.round(fc.b)}) 100%`);
    return`conic-gradient(from 0deg,${stops.join(',')})`;
  }
  // Vertical, matching the top-to-bottom stacking of the tile view (glazeCSS runs left-to-right).
  const stops=Array.from({length:9},(_,i)=>{const t=i/8,c=sampleAt(t,glazes,ck);return`rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)}) ${Math.round(t*100)}%`;});
  return`linear-gradient(to bottom,${stops.join(',')})`;
}

export function buildStack(glazes,ck,tH){
  tH=tH||TH;
  if(galleryViewMode&&galleryViewMode!=='tiles'){
    const wrap=document.createElement('div');wrap.className='tile-col tile-gradient';
    wrap.style.height=_stackTotalHeight(tH)+'px';
    wrap.style.background=galleryGradientCSS(glazes,ck||clayKey,galleryViewMode);
    if(galleryViewMode==='conic'){
      const ap=document.createElement('div');ap.className='conic-aperture';
      ap.style.background=CLAY[ck||clayKey];
      wrap.appendChild(ap);
    }
    return wrap;
  }
  const col=document.createElement('div');col.className='tile-col';
  for(let ti=0;ti<NT;ti++){const w=document.createElement('div');w.className='tile-wrap';w.innerHTML=tileSVG(ti,glazes,ck||clayKey,tH);col.appendChild(w);}
  return col;
}

export function refreshStack(col,glazes,ck,tH){
  tH=tH||TH;
  if(col.classList.contains('tile-gradient')){
    col.style.background=galleryGradientCSS(glazes,ck||clayKey,galleryViewMode);
    let ap=col.querySelector('.conic-aperture');
    if(galleryViewMode==='conic'){
      if(!ap){ap=document.createElement('div');ap.className='conic-aperture';col.appendChild(ap);}
      ap.style.background=CLAY[ck||clayKey];
    } else if(ap){ ap.remove(); }
    return;
  }
  col.querySelectorAll('.tile-wrap').forEach((w,ti)=>{w.innerHTML=tileSVG(ti,glazes,ck||clayKey,tH);});
}

export function setGalleryViewMode(mode){
  galleryViewMode=mode;
  document.querySelectorAll('.gv-btn').forEach(b=>b.classList.toggle('on',b.dataset.mode===mode));
  // Tile divisions only apply to tiles mode; hide the control otherwise
  const tdToggle=document.getElementById('tileDivisionToggle');
  const tdLabel=tdToggle&&tdToggle.previousElementSibling;
  if(tdToggle){tdToggle.style.display=mode==='tiles'?'':'none';}
  if(tdLabel&&tdLabel.classList.contains('plabel')){tdLabel.style.display=mode==='tiles'?'':'none';}
  lastRenderedKeys=[];lastSavedKeys=[];
  if(currentTab==='explore'){renderGallery();}
  renderSidebar();
}

export function setTileDivisions(n){
  NT=n;
  document.querySelectorAll('.td-btn').forEach(b=>b.classList.toggle('on',parseInt(b.dataset.n,10)===n));
  lastRenderedKeys=[];lastSavedKeys=[];
  if(currentTab==='explore'){renderGallery();}
}

// ── LEVER UI ──────────────────────────────────────────────────────────────────
export function buildLeversUI(){
  const list=document.getElementById('leversList');if(!list)return;list.innerHTML='';
  LEVERS.forEach(lev=>{
    const val=levers[lev.key],pct=val;
    const div=document.createElement('div');div.className='lever';
    const poles=document.createElement('div');poles.className='lever-poles';
    const lP=document.createElement('span');lP.className='lever-pole'+(pct<40?' active':'');lP.textContent=lev.leftLabel;
    const rP=document.createElement('span');rP.className='lever-pole'+(pct>60?' active':'');rP.textContent=lev.rightLabel;
    poles.appendChild(lP);poles.appendChild(rP);
    const track=document.createElement('div');track.className='lever-track';
    const tvis=document.createElement('div');tvis.className='lever-track-vis';
    tvis.style.background=`linear-gradient(to right,${lev.leftColor}55,${lev.rightColor}55)`;
    const thumb=document.createElement('div');thumb.className='lever-thumb';thumb.style.left=pct+'%';
    const inp=document.createElement('input');inp.type='range';inp.min=0;inp.max=100;inp.value=val;
    inp.addEventListener('input',()=>{
      const v=parseInt(inp.value);levers[lev.key]=v;thumb.style.left=v+'%';
      lP.className='lever-pole'+(v<40?' active':'');rP.className='lever-pole'+(v>60?' active':'');
      checkPresetMatch();updatePresetName();
      if(activeContext!=='global'){const proj=projects.find(p=>p.id===activeContext);if(proj)proj.leverState={...levers};}
      if(currentTab==='explore'){palettes=genBatch();renderGallery();}
    });
    track.appendChild(tvis);track.appendChild(thumb);track.appendChild(inp);
    div.appendChild(poles);div.appendChild(track);list.appendChild(div);
  });
}

export function applyPreset(name){
  activePreset=name;levers={...PRESETS[name]};
  document.querySelectorAll('.achip').forEach(b=>b.classList.remove('on'));
  const el=document.querySelector(`.achip[data-preset="${name}"]`);if(el)el.classList.add('on');
  buildLeversUI();updatePresetName();
  if(currentTab==='explore'){palettes=genBatch();renderGallery();}
}

export function resetLevers(){
  activePreset=null;levers={temp:50,depth:50,char:50};
  document.querySelectorAll('.achip').forEach(b=>b.classList.remove('on'));
  buildLeversUI();updatePresetName();
  if(currentTab==='explore'){palettes=genBatch();renderGallery();}
}

export function checkPresetMatch(){
  const matched=Object.entries(PRESETS).find(([,pv])=>Object.keys(pv).every(k=>pv[k]===levers[k]));
  activePreset=matched?matched[0]:null;
  document.querySelectorAll('.achip').forEach(b=>b.classList.remove('on'));
  if(activePreset){const el=document.querySelector(`.achip[data-preset="${activePreset}"]`);if(el)el.classList.add('on');}
}

export function updatePresetName(){
  const el=document.getElementById('presetName');if(!el)return;
  if(activePreset){el.textContent=activePreset.charAt(0).toUpperCase()+activePreset.slice(1);return;}
  const t=levers.temp,d=levers.depth,c=levers.char;
  if(Math.abs(t-50)<10&&Math.abs(d-50)<10&&Math.abs(c-50)<10){el.textContent='Balanced';return;}
  const parts=[];
  if(t<35)parts.push('Warm');else if(t>65)parts.push('Cool');
  if(d<35)parts.push('Light');else if(d>65)parts.push('Dark');
  if(c<35)parts.push('Quiet');else if(c>65)parts.push('Saturated');
  el.textContent=parts.length?parts.join(' + '):'Custom';
}

export function shuffle(){
  if('vibrate' in navigator) navigator.vibrate(25);
  const gal=document.getElementById('gallery');
  if(gal){
    gal.style.transition='opacity .1s';
    gal.style.opacity='0';
    setTimeout(()=>{
      palettes=genBatch();renderGallery();
      gal.style.transition='opacity .15s';
      gal.style.opacity='1';
    },100);
  } else {
    palettes=genBatch();renderGallery();
  }
}

// ── GENERATION ────────────────────────────────────────────────────────────────
const plain=GLAZES.filter(g=>!['crawl-dot','crawl-leather','crawl-crackle','textured'].includes(g.fin));

export function getPool(){
  if(activeContext==='global')return plain;
  const proj=projects.find(p=>p.id===activeContext);if(!proj)return plain;
  const names=new Set();
  likedMeta.filter(m=>m.projectId===activeContext).forEach(m=>(m.names||[]).forEach(n=>names.add(n)));
  if(names.size<3)return plain;
  const filtered=plain.filter(g=>names.has(g.name));
  return filtered.length>=3?filtered:plain;
}

export function toggleScoreSort(){
  sortByScore=!sortByScore;
  const btn=document.getElementById('scoreSortBtn');
  if(btn)btn.className='btn xs'+(sortByScore?' filter-on':'');
  renderGallery();
}

export function weightedPick(pool,scores,n){
  const out=[],used=new Set();let att=0;
  while(out.length<n&&att<400){att++;const tot=scores.reduce((a,b)=>a+b,0);let r=Math.random()*tot;for(let i=0;i<pool.length;i++){r-=scores[i];if(r<=0&&!used.has(i)){used.add(i);out.push(pool[i]);break;}}}
  while(out.length<n){const i=Math.floor(Math.random()*pool.length);if(!used.has(i)){used.add(i);out.push(pool[i]);}}
  return out;
}

// ── GLAZE AFFINITY ────────────────────────────────────────────────────────────
// Per-project multiplier map derived from that project's ranked pinned palettes,
// nudging generation toward glazes that appear in higher-ranked palettes.
export function getGlazeAffinity(name){
  if(activeContext==='global')return 1;
  const proj=projects.find(p=>p.id===activeContext);
  return (proj?.glazeAffinity?.[name])||1;
}

export function recomputeGlazeAffinity(){
  if(activeContext==='global')return;
  const proj=projects.find(p=>p.id===activeContext);if(!proj)return;
  const projRanked=rankSorted.filter(m=>m.projectId===activeContext);
  proj.glazeAffinity=buildGlazeAffinity(projRanked);
  saveAll();
}

export function generateBandingPalette(lv){
  const pool=getPool(),scores=pool.map(g=>scoreGlaze(g,lv)*getGlazeAffinity(g.name));
  const nBase=Math.random()<0.3?3:2;
  const base=weightedPick(pool,scores,nBase);
  if(base.length<2)return base;
  const len=nBase+(Math.random()<0.5?1:2);
  const result=[];
  for(let i=0;i<len;i++)result.push(base[i%nBase]);
  return result;
}

export function generatePalette(lv){
  const pool=getPool(),scores=pool.map(g=>scoreGlaze(g,lv)*getGlazeAffinity(g.name)),n=Math.min(3+Math.floor(Math.random()*2),pool.length);
  let picked=weightedPick(pool,scores,n);
  if(lv.depth>70){const dark=pool.filter(g=>g.lum<.22);if(!picked.some(g=>g.lum<.22)&&dark.length)picked[picked.length-1]=dark[Math.floor(Math.random()*dark.length)];}
  if(lv.depth<30){const light=pool.filter(g=>g.lum>.65);if(!picked.some(g=>g.lum>.65)&&light.length)picked[0]=light[Math.floor(Math.random()*light.length)];}
  return picked.sort((a,b)=>b.lum-a.lum);
}

export function mkid(){return Math.random().toString(36).slice(2);}

export function withKey(p){return{...p,key:p.glazes.map(g=>g.name).join('|')};}

export function bumpVersion(label){const m=label.match(/^(.*?)\s+v(\d+)$/);return m?m[1]+' v'+(parseInt(m[2])+1):label+' v2';}

export function genBatch(){
  const uk=new Set(),out=[];let a=0;
  while(out.length<20&&a<500){
    a++;
    const glazes=Math.random()<0.25?generateBandingPalette(levers):generatePalette(levers);
    if(glazes.length<2)continue;
    const key=glazes.map(g=>g.name).join('|');
    if(!uk.has(key)){uk.add(key);const tag=activePreset?activePreset.charAt(0).toUpperCase()+activePreset.slice(1):'Mood';out.push(withKey({id:mkid(),label:labelStore[key]||tag,feeling:'',tag,glazes}));}
  }
  return out;
}

export function doRiff(src){
  const pool=getPool();
  const uk=new Set(),out=[];let a=0;
  while(out.length<20&&a<300){a++;const gl=[...src.glazes];const ops=[()=>{gl[Math.floor(Math.random()*gl.length)]=pool[Math.floor(Math.random()*pool.length)];},()=>{if(gl.length<6)gl.splice(Math.floor(Math.random()*(gl.length+1)),0,pool[Math.floor(Math.random()*pool.length)]);},()=>{if(gl.length>3)gl.splice(Math.floor(Math.random()*gl.length),1);},()=>{if(gl.length>1){const i=Math.floor(Math.random()*(gl.length-1));[gl[i],gl[i+1]]=[gl[i+1],gl[i]];}}];for(let m=0;m<1+Math.floor(Math.random()*2);m++)ops[Math.floor(Math.random()*ops.length)]();const glazes=[...gl].sort((a,b)=>b.lum-a.lum);const key=glazes.map(g=>g.name).join('|');if(!uk.has(key)){uk.add(key);out.push(withKey({id:mkid(),label:bumpVersion(src.label),feeling:'',tag:src.tag,glazes}));}}
  return out;
}

// ── CLAY ──────────────────────────────────────────────────────────────────────
export function setClay(k){
  clayKey=k;
  document.getElementById('clay_white').className='clay-btn'+(k==='white'?' on':'');
  document.getElementById('clay_red').className='clay-btn red'+(k==='red'?' on':'');
  document.querySelectorAll('.tile-col').forEach(col=>{
    const card=col.closest('[data-pid]');if(!card)return;
    const pid=card.dataset.pid,p=palettes.find(x=>x.id===pid);
    const isCompact=card.classList.contains('compact');
    if(p&&p.glazes)refreshStack(col,p.glazes,k,isCompact?44:TH);
  });
  renderSidebar();
  renderLeftPanelPairings();
}

// ── TABS ──────────────────────────────────────────────────────────────────────
export function setTab(tab){
  currentTab=tab;
  const staticTabs=['explore','analytics'];
  staticTabs.forEach(t=>{
    const b=document.getElementById('tab_'+t),v=document.getElementById('view_'+t);
    if(b)b.className='ttab'+(t===tab?' on':'');
    if(v)v.style.display=t===tab?'':'none';
  });
  document.querySelectorAll('.ttab[data-proj-id]').forEach(b=>b.classList.remove('on'));
  if(tab==='explore'){activeContext='global';updateProjectBanner();renderSavedSection();renderSidebar();}
  if(tab==='analytics')renderAnalyticsView();
}

// ── PROJECT CONTEXT ───────────────────────────────────────────────────────────
export function activeScoreWeights(){
  if(activeContext==='global')return DEFAULT_SCORE_WEIGHTS;
  const proj=projects.find(p=>p.id===activeContext);
  return SCORE_PRESETS[proj?.scorePreset]?.weights || DEFAULT_SCORE_WEIGHTS;
}

export function switchContext(ctx){
  activeContext=ctx;
  let leversChanged=false;
  if(ctx!=='global'){
    const proj=projects.find(p=>p.id===ctx);
    if(proj&&proj.leverState){
      const prev=JSON.stringify(levers);
      levers={...proj.leverState};
      leversChanged=JSON.stringify(levers)!==prev;
      buildLeversUI();updatePresetName();
    }
  }
  updateProjectBanner();
  renderSidebar();
  renderTopbarTabs();
  renderLeftPanelPairings();
  renderScoreWeighting();
  if(currentTab==='explore'){if(leversChanged)palettes=genBatch();renderGallery();renderSavedSection();}
}

export function updateProjectBanner(){
  const ctx=document.getElementById('discoverContext');
  if(ctx){const proj=projects.find(p=>p.id===activeContext);ctx.textContent=proj?`in ${proj.name}`:'';  }
  const banner=document.getElementById('projectBanner');
  if(banner){
    if(activeContext==='global'){banner.classList.remove('visible');}
    else{
      const proj=projects.find(p=>p.id===activeContext);
      if(proj){
        banner.classList.add('visible');
        document.getElementById('bannerName').textContent=proj.name;
        const count=likedMeta.filter(m=>m.projectId===activeContext).length;
        document.getElementById('bannerInfo').textContent=`${count} palette${count!==1?'s':''}`;
      }else{banner.classList.remove('visible');}
    }
  }
  const nameEl=document.getElementById('mcbProjectName');
  const countEl=document.getElementById('mcbCount');
  if(!nameEl)return;
  if(activeContext==='global'){
    nameEl.textContent='All Projects';
    nameEl.className='mcb-project mcb-project-global';
    if(countEl)countEl.style.display='none';
  }else{
    const proj=projects.find(p=>p.id===activeContext);
    if(proj){
      nameEl.textContent=proj.name;
      nameEl.className='mcb-project';
      if(countEl){const count=likedMeta.filter(m=>m.projectId===activeContext).length;countEl.textContent=`${count}`;countEl.style.display='';}
    }
  }
}

export function updateProjectPicker(){
  const picker=document.getElementById('projectPicker');if(!picker)return;
  picker.innerHTML='<option value="global">All Exploration</option>';
  projects.forEach(p=>{const opt=document.createElement('option');opt.value=p.id;opt.textContent=p.name;picker.appendChild(opt);});
  picker.value=activeContext;
}

// ── PROJECT MANAGEMENT ────────────────────────────────────────────────────────
export function createNewProject(){
  const newId=mkid();
  const proj={id:newId,name:'New Board',leverState:{...levers},scorePreset:'Balanced'};
  projects.push(proj);
  _stampProjectOrder();
  saveAll();
  renderTopbarTabs();
  switchToProjectTab(newId);
  showToast('Board created — click its tab above to rename it, then save palettes to it.');
}

export function deleteProject(id){
  if('vibrate' in navigator) navigator.vibrate([30,0,30]);
  const proj=projects.find(p=>p.id===id);
  const affectedMeta=likedMeta.filter(m=>m.projectId===id).map(m=>({...m}));
  likedMeta.forEach(m=>{if(m.projectId===id)delete m.projectId;});
  projects=projects.filter(p=>p.id!==id);
  if(activeContext===id)switchContext('global');
  saveAll();renderSidebar();renderTopbarTabs();renderLeftPanelPairings();
  showToast(`"${proj?proj.name:'Board'}" deleted.`,()=>{
    if(proj)projects.push(proj);
    affectedMeta.forEach(restored=>{const m=likedMeta.find(x=>x.key===restored.key);if(m)m.projectId=restored.projectId;});
    saveAll();renderSidebar();renderTopbarTabs();renderLeftPanelPairings();
  });
}

export function showProjMenu(projId,anchor){
  if(_projMenuOpen){_projMenuOpen.remove();_projMenuOpen=null;return;}
  const proj=projects.find(p=>p.id===projId);if(!proj)return;
  const popup=document.createElement('div');popup.className='proj-menu-popup';_projMenuOpen=popup;
  const renameItem=document.createElement('button');renameItem.className='proj-menu-item';renameItem.textContent='Rename board';
  renameItem.addEventListener('click',()=>{
    popup.remove();_projMenuOpen=null;
    promptSheet('Rename board:',proj.name,'Rename',val=>{proj.name=val;saveAll();renderSidebar();renderTopbarTabs();});
  });
  const deleteItem=document.createElement('button');deleteItem.className='proj-menu-item danger';deleteItem.textContent='Delete board…';
  deleteItem.addEventListener('click',()=>{
    popup.remove();_projMenuOpen=null;
    confirmSheet(`Delete "${proj.name}"? Saved palettes will be moved back to All.`,'Delete board',()=>deleteProject(projId));
  });
  popup.appendChild(renameItem);popup.appendChild(deleteItem);
  const r=anchor.getBoundingClientRect();
  popup.style.top=(r.bottom+4)+'px';popup.style.left=r.left+'px';
  document.body.appendChild(popup);
  const close=e=>{if(!popup.contains(e.target)){popup.remove();_projMenuOpen=null;document.removeEventListener('mousedown',close);}};
  setTimeout(()=>document.addEventListener('mousedown',close),0);
}

export function makeProjTab(label, isActive, colorNames, onActivate, onDelete, projId){
  const tab=document.createElement('div');
  tab.className='proj-tab'+(isActive?' active':'');
  tab.dataset.projId=projId||'global';

  const strip=document.createElement('div');strip.className='proj-tab-strip';
  if(!projId){
    const icon=document.createElement('div');icon.className='proj-tab-all-icon';strip.appendChild(icon);
  } else {
    colorNames.forEach(n=>{
      const g=GLAZES.find(x=>x.name===n);
      if(g){const c=applyGlaze(g,clayKey);const d=document.createElement('div');d.className='proj-color-dot';d.style.background=`rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)})`;strip.appendChild(d);}
    });
  }

  const lbl=document.createElement('span');lbl.className='proj-tab-label';lbl.textContent=label;lbl.title='Double-click to rename';
  if(projId){
    lbl.addEventListener('dblclick',e=>{
      e.stopPropagation();
      const inp=document.createElement('input');inp.type='text';inp.value=lbl.textContent;
      inp.className='proj-tab-input';
      lbl.replaceWith(inp);inp.focus();inp.select();
      let committed=false;
      const commit=()=>{
        if(committed)return;committed=true;
        const proj=projects.find(p=>p.id===projId);
        if(proj){proj.name=inp.value.trim()||proj.name;saveAll();}
        renderSidebar();
      };
      inp.addEventListener('blur',commit);
      inp.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();inp.blur();}if(ev.key==='Escape'){committed=true;renderSidebar();}});
      inp.addEventListener('click',ev=>ev.stopPropagation());
    });
  }

  const cnt=document.createElement('span');cnt.className='proj-tab-count';cnt.textContent=label==='All Palettes'?(likedMeta.filter(m=>!m.projectId).length||''):(likedMeta.filter(m=>m.projectId===projId).length||'');

  tab.appendChild(strip);tab.appendChild(lbl);tab.appendChild(cnt);

  if(projId){
    const menu=document.createElement('button');menu.className='sb-proj-menu-btn';menu.textContent='⋯';menu.title='Board options';
    menu.addEventListener('click',e=>{e.stopPropagation();showProjMenu(projId,menu);});
    tab.appendChild(menu);
  }

  tab.addEventListener('click',()=>{onActivate();});

  if(projId){
    tab.addEventListener('dragover',e=>{e.preventDefault();tab.classList.add('drag-over');});
    tab.addEventListener('dragleave',()=>tab.classList.remove('drag-over'));
    tab.addEventListener('drop',e=>{
      e.preventDefault();tab.classList.remove('drag-over');
      const key=e.dataTransfer.getData('text/plain');
      if(!key)return;
      const meta=likedMeta.find(m=>m.key===key);
      if(meta){const prev=meta.projectId;meta.projectId=projId;saveAll();renderSidebar();showToast(`Moved to "${projects.find(p=>p.id===projId)?.name||'board'}"`,()=>{const m2=likedMeta.find(x=>x.key===key);if(m2){if(prev)m2.projectId=prev;else delete m2.projectId;saveAll();renderSidebar();}});}
    });
  } else {
    tab.addEventListener('dragover',e=>{e.preventDefault();tab.classList.add('drag-over');});
    tab.addEventListener('dragleave',()=>tab.classList.remove('drag-over'));
    tab.addEventListener('drop',e=>{
      e.preventDefault();tab.classList.remove('drag-over');
      const key=e.dataTransfer.getData('text/plain');
      const meta=likedMeta.find(m=>m.key===key);
      if(meta&&meta.projectId){const prev=meta.projectId;delete meta.projectId;saveAll();renderSidebar();showToast('Removed from board',()=>{const m2=likedMeta.find(x=>x.key===key);if(m2)m2.projectId=prev;saveAll();renderSidebar();});}
    });
  }

  return tab;
}

export function renderBoardSwitcher(){
  const el=document.getElementById('sheetBoardSwitcher');if(!el)return;
  el.innerHTML='';
  const allBtn=document.createElement('button');
  allBtn.className='sbs-pill'+(activeContext==='global'?' on':'');
  allBtn.textContent='All Palettes';
  allBtn.addEventListener('click',()=>switchToProjectTab('global'));
  el.appendChild(allBtn);
  projects.forEach(proj=>{
    const btn=document.createElement('button');
    btn.className='sbs-pill'+(activeContext===proj.id?' on':'');
    btn.textContent=proj.name;
    btn.addEventListener('click',()=>switchToProjectTab(proj.id));
    el.appendChild(btn);
  });
}

// IndexedDB's `projects` object store returns getAll() results in key order,
// not custom order, so drag-reordering needs an explicit stamp to survive reload.
function _stampProjectOrder(){ projects.forEach((p,i)=>{p.order=i;}); }

// ── MOBILE PROJECTS SCREEN (full-screen list, replaces the Boards half-sheet) ──
export function openProjectsView(){
  const view=document.getElementById('projectsView');if(!view)return;
  renderProjectsView();
  view.style.display='flex';
  document.body.style.overflow='hidden';
  requestAnimationFrame(()=>view.classList.add('open'));
}

export function closeProjectsView(){
  const view=document.getElementById('projectsView');if(!view)return;
  view.classList.remove('open');
  setTimeout(()=>{view.style.display='none';},180);
  document.body.style.overflow='';
}

export function renderProjectsView(){
  const list=document.getElementById('pvList');if(!list)return;
  list.innerHTML='';

  const allRow=document.createElement('div');
  allRow.className='pv-row pv-row-all'+(activeContext==='global'?' active':'');
  allRow.innerHTML=`<div class="pv-strip"><div class="proj-tab-all-icon"></div></div><span class="pv-name">All Palettes</span><span class="pv-count">${likedMeta.filter(m=>!m.projectId).length||''}</span>`;
  allRow.addEventListener('click',()=>{switchToProjectTab('global');closeProjectsView();});
  list.appendChild(allRow);

  projects.forEach(proj=>{
    const row=document.createElement('div');
    row.className='pv-row'+(activeContext===proj.id?' active':'');
    row.dataset.projId=proj.id;

    const strip=document.createElement('div');strip.className='pv-strip';
    const meta=likedMeta.filter(m=>m.projectId===proj.id);
    const names=[...new Set(meta.flatMap(m=>m.names||[]))].slice(0,4);
    names.forEach(n=>{
      const g=GLAZES.find(x=>x.name===n);
      if(g){const c=applyGlaze(g,clayKey);const d=document.createElement('div');d.className='proj-color-dot';d.style.background=`rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)})`;strip.appendChild(d);}
    });
    row.appendChild(strip);

    const name=document.createElement('span');name.className='pv-name';name.textContent=proj.name;
    row.appendChild(name);

    const count=document.createElement('span');count.className='pv-count';count.textContent=meta.length||'';
    row.appendChild(count);

    const menu=document.createElement('button');menu.className='pv-menu-btn';menu.textContent='⋯';menu.title='Board options';
    menu.addEventListener('click',e=>{e.stopPropagation();showProjMenu(proj.id,menu);});
    row.appendChild(menu);

    const handle=document.createElement('div');handle.className='pv-handle';handle.textContent='⠿';
    row.appendChild(handle);

    row.addEventListener('click',e=>{
      if(e.target.closest('.pv-menu-btn,.pv-handle'))return;
      switchToProjectTab(proj.id);closeProjectsView();
    });

    _wirePvRowDrag(handle,row,list);
    list.appendChild(row);
  });
}

function _wirePvRowDrag(handle,row,list){
  let startY=0,dragging=false;
  const onStart=e=>{
    startY=e.touches[0].clientY;dragging=true;
    row.classList.add('pv-dragging');
  };
  const onMove=e=>{
    if(!dragging)return;
    const y=e.touches[0].clientY;
    const rows=[...list.querySelectorAll('.pv-row:not(.pv-row-all)')];
    const target=rows.find(r=>{
      if(r===row)return false;
      const rect=r.getBoundingClientRect();
      return y>=rect.top&&y<=rect.bottom;
    });
    if(target){
      const rect=target.getBoundingClientRect();
      if(y<rect.top+rect.height/2)list.insertBefore(row,target);
      else list.insertBefore(row,target.nextSibling);
    }
    startY=y;
  };
  const onEnd=()=>{
    if(!dragging)return;
    dragging=false;
    row.classList.remove('pv-dragging');
    const orderedIds=[...list.querySelectorAll('.pv-row:not(.pv-row-all)')].map(r=>r.dataset.projId);
    projects=orderedIds.map(id=>projects.find(p=>p.id===id)).filter(Boolean);
    _stampProjectOrder();
    saveAll();renderTopbarTabs();
  };
  handle.addEventListener('touchstart',onStart,{passive:true});
  handle.addEventListener('touchmove',onMove,{passive:true});
  handle.addEventListener('touchend',onEnd,{passive:true});
}

export function renderSidebar(){
  if(typeof _activeSheet!=='undefined' && _activeSheet && _activeSheet.id==='sheetBoards') closeSheet();
  const scroll=document.getElementById('sbScroll');if(!scroll)return;
  scroll.innerHTML='';

  const titleEl=document.querySelector('.sb-header-title');
  if(titleEl){
    const proj=projects.find(p=>p.id===activeContext);
    titleEl.textContent=proj?proj.name:'All Palettes';
  }

  const contextMeta=activeContext==='global'
    ?likedMeta.filter(m=>!m.projectId)
    :likedMeta.filter(m=>m.projectId===activeContext);

  if(contextMeta.length){
    const ctxLbl=document.createElement('div');ctxLbl.className='sb-context-label';
    ctxLbl.textContent=activeContext==='global'?'Pinned':`Saved`;
    scroll.appendChild(ctxLbl);
    const grid=document.createElement('div');grid.className='lchip-grid';
    contextMeta.forEach(m=>grid.appendChild(buildSidebarChip(m,activeContext!=='global')));
    scroll.appendChild(grid);
  } else {
    const em=document.createElement('div');em.className='empty-sb';
    em.innerHTML=activeContext==='global'
      ?'Pin any palette from Explore<br>to save it here.'
      :'No palettes yet — pin one<br>or use <strong>Save to board</strong><br>on any palette card.';
    scroll.appendChild(em);
  }
}

export function buildSidebarChip(m,inProject){
  const glazes=(m.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
  const label=labelStore[m.key]||m.label;
  const chip=document.createElement('div');chip.className='lchip';chip.tabIndex=0;chip.dataset.key=m.key;
  chip.title=`${label}\n${(m.names||[]).join(', ')}`;
  chip.draggable=true;
  chip.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',m.key);chip.classList.add('dragging');});
  chip.addEventListener('dragend',()=>chip.classList.remove('dragging'));
  const strip=document.createElement('div');strip.className='lchip-strip';strip.style.background=galleryGradientCSS(glazes,clayKey,galleryViewMode);chip.appendChild(strip);
  if(galleryViewMode==='conic'){
    const ap=document.createElement('div');ap.className='lchip-aperture';ap.style.background=CLAY[clayKey];strip.appendChild(ap);
  }
  const rm=document.createElement('button');rm.className='lchip-rm';rm.textContent='×';rm.title='Remove from pinned';
  rm.addEventListener('click',e=>{
    e.stopPropagation();
    const snapshot={...m};
    likedKeys.delete(m.key);likedMeta=likedMeta.filter(x=>x.key!==m.key);
    saveAll();renderSidebar();updateCount();
    showToast('Palette removed',()=>{
      likedKeys.add(snapshot.key);
      if(!likedMeta.find(x=>x.key===snapshot.key))likedMeta.push(snapshot);
      saveAll();renderSidebar();updateCount();
    });
  });
  chip.appendChild(rm);
  const loadIt=()=>{ if(typeof openPaletteDetail==='function') openPaletteDetail(m.key); };
  chip.addEventListener('click',loadIt);chip.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();loadIt();}});
  return chip;
}

// ── CARD BUILDER ──────────────────────────────────────────────────────────────
export function buildCardTile(p, clayKey, tileH) {
  return buildStack(p.glazes, clayKey, tileH);
}

export function buildDragHandlers(card, p) {
  const handle=document.createElement('div');handle.className='card-drag-handle';handle.title='Drag to move to another board';
  for(let i=0;i<3;i++){const s=document.createElement('span');handle.appendChild(s);}
  handle.addEventListener('mousedown',e=>{card.draggable=true;});
  handle.addEventListener('mouseup',()=>{card.draggable=false;});
  card.addEventListener('dragstart',e=>{
    if(!card.draggable)return;
    e.dataTransfer.setData('text/plain',p.key);e.dataTransfer.effectAllowed='move';
    card.classList.add('dragging');
  });
  card.addEventListener('dragend',()=>{card.draggable=false;card.classList.remove('dragging');});
  return handle;
}

export function buildGlazeChips(p, stack, card) {
  const chipsWrap=document.createElement('div');chipsWrap.className='glaze-chips';
  let dragSrcIdx=null;
  const rebuildChips=(animate)=>{
    const prevRects=animate?new Map(Array.from(chipsWrap.children).map(c=>[c.dataset.name,c.getBoundingClientRect()])):null;
    chipsWrap.innerHTML='';
    p.glazes.forEach((g,idx)=>{
      const chip=document.createElement('div');chip.className='glaze-chip';chip.draggable=true;chip.dataset.idx=idx;chip.dataset.name=g.name;
      const c=applyGlaze(g,clayKey);
      const sw=document.createElement('div');sw.className='glaze-chip-swatch';sw.style.background=`rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)})`;
      const nm=document.createElement('span');nm.className='glaze-chip-name';nm.textContent=g.name;
      const rm=document.createElement('button');rm.className='glaze-chip-rm';rm.textContent='×';rm.title='Remove glaze';
      rm.addEventListener('click',e=>{e.stopPropagation();if(p.glazes.length<=2)return;p.glazes.splice(idx,1);p.key=p.glazes.map(g=>g.name).join('|');card.dataset.key=p.key;refreshStack(stack,p.glazes,clayKey,TH);rebuildChips(true);});
      chip.appendChild(sw);chip.appendChild(nm);chip.appendChild(rm);
      chip.addEventListener('dragstart',e=>{dragSrcIdx=idx;e.dataTransfer.effectAllowed='move';chip.style.opacity='.4';});
      chip.addEventListener('dragend',()=>{chip.style.opacity='';chipsWrap.querySelectorAll('.glaze-chip').forEach(c=>c.classList.remove('drag-over-chip'));});
      chip.addEventListener('dragover',e=>{e.preventDefault();chip.classList.add('drag-over-chip');});
      chip.addEventListener('dragleave',()=>chip.classList.remove('drag-over-chip'));
      chip.addEventListener('drop',e=>{
        e.preventDefault();chip.classList.remove('drag-over-chip');
        if(dragSrcIdx===null||dragSrcIdx===idx)return;
        const moved=p.glazes.splice(dragSrcIdx,1)[0];p.glazes.splice(idx,0,moved);
        p.key=p.glazes.map(g=>g.name).join('|');card.dataset.key=p.key;
        refreshStack(stack,p.glazes,clayKey,TH);rebuildChips(true);
        const meta=likedMeta.find(m=>m.key===p.key);if(meta){meta.names=p.glazes.map(g=>g.name);saveAll();}
      });
      chipsWrap.appendChild(chip);
    });
    if(prevRects){
      Array.from(chipsWrap.children).forEach(c=>{
        const prev=prevRects.get(c.dataset.name);if(!prev)return;
        const next=c.getBoundingClientRect();
        const dy=prev.top-next.top;
        if(!dy)return;
        c.style.transform=`translateY(${dy}px)`;
        c.classList.add('flip-dragging');
        requestAnimationFrame(()=>{
          c.classList.remove('flip-dragging');c.classList.add('flip-move');
          c.style.transform='';
          c.addEventListener('transitionend',()=>c.classList.remove('flip-move'),{once:true});
        });
      });
    }
  };
  rebuildChips(false);
  return chipsWrap;
}

export function buildPinButton(p, isLiked, card, compact) {
  const pinBtn=document.createElement('button');
  if(compact&&isLiked){
    pinBtn.className='btn remove-subtle';pinBtn.textContent='Remove';
  } else {
    pinBtn.className='btn'+(isLiked?' pin-on':'');pinBtn.textContent=isLiked?'Pinned':'Pin';
  }
  pinBtn.addEventListener('click',()=>togglePin(p,pinBtn,card,compact));
  return pinBtn;
}

export function buildBoardDropdown(p, pinBtn, card, compact) {
  const wrap=document.createElement('div');wrap.className='board-dropdown';
  const btn=document.createElement('button');btn.className='board-dropdown-btn';
  const strip=document.createElement('div');strip.className='bd-strip';
  const btnLabel=document.createElement('span');btnLabel.textContent='Save...';
  const caret=document.createElement('span');caret.textContent='▾';caret.style.marginLeft='auto';
  btn.appendChild(strip);btn.appendChild(btnLabel);btn.appendChild(caret);
  const saveToBoard=(projId)=>{
    if('vibrate' in navigator) navigator.vibrate(15);
    if(!likedKeys.has(p.key)){
      likedKeys.add(p.key);
      if(!likedMeta.find(m=>m.key===p.key))
        likedMeta.push({key:p.key,label:labelStore[p.key]||p.label,feeling:'',tag:p.tag,names:p.glazes.map(g=>g.name),hexes:p.glazes.map(g=>g.hex),projectId:projId});
      else likedMeta.find(m=>m.key===p.key).projectId=projId;
      pinBtn.className='btn pin-on';pinBtn.textContent='Pinned';
      if(!compact)card.className='card liked';
    } else {
      const meta=likedMeta.find(m=>m.key===p.key);if(meta)meta.projectId=projId;
    }
    saveAll();renderSidebar();renderTopbarTabs();updateCount();
    const pName=projects.find(x=>x.id===projId)?.name||'board';
    const projGlazes=likedMeta.filter(x=>x.projectId===projId).flatMap(x=>(x.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean));
    if(projGlazes.length)strip.style.background=glazeCSS(projGlazes.slice(0,4),clayKey);
    btnLabel.textContent=`✓ ${pName}`;
    showToast(`Saved to "${pName}"`);
  };
  let _dropOpen=null;
  btn.addEventListener('click',e=>{
    e.stopPropagation();
    if(_dropOpen){_dropOpen.remove();_dropOpen=null;return;}
    const panel=document.createElement('div');panel.className='board-dropdown-panel';_dropOpen=panel;
    projects.forEach(proj=>{
      const inP=likedMeta.find(x=>x.key===p.key&&x.projectId===proj.id);
      const projGlazes=likedMeta.filter(x=>x.projectId===proj.id).flatMap(x=>(x.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean));
      const item=document.createElement('button');item.className='board-dropdown-item';
      const itemStrip=document.createElement('div');itemStrip.className='bd-item-strip';
      if(projGlazes.length)itemStrip.style.background=glazeCSS(projGlazes.slice(0,4),clayKey);
      const itemName=document.createElement('span');itemName.className='bd-item-name';itemName.textContent=proj.name;
      const count=document.createElement('span');count.className='bd-item-count';count.textContent=likedMeta.filter(x=>x.projectId===proj.id).length+' palettes';
      if(inP){const ck=document.createElement('span');ck.className='bd-item-check';ck.textContent='✓';item.appendChild(itemStrip);item.appendChild(itemName);item.appendChild(count);item.appendChild(ck);}
      else{item.appendChild(itemStrip);item.appendChild(itemName);item.appendChild(count);}
      item.addEventListener('click',e=>{e.stopPropagation();panel.remove();_dropOpen=null;saveToBoard(proj.id);});
      panel.appendChild(item);
    });
    const r=btn.getBoundingClientRect();
    panel.style.top=(r.bottom+3)+'px';panel.style.left=r.left+'px';panel.style.width=r.width+'px';
    document.body.appendChild(panel);
    const close=e=>{if(!panel.contains(e.target)){panel.remove();_dropOpen=null;document.removeEventListener('mousedown',close);}};
    setTimeout(()=>document.addEventListener('mousedown',close),0);
  });
  wrap.appendChild(btn);
  return wrap;
}

export function buildCard(p,isLiked,compact){
  const tileH=compact?44:TH;
  const card=document.createElement('article');
  card.className='card'+(isLiked&&!compact?' liked':'')+(compact?' compact':'');
  card.dataset.pid=p.id;card.dataset.key=p.key||'';
  card.addEventListener('click',e=>{
    if(e.shiftKey&&p.key){e.preventDefault();toggleCardSelect(p.key,card);return;}
    if(e.target.closest('button,a,input,[contenteditable]'))return;
    // Once multi-select is active, plain taps keep adding to the selection
    // instead of opening the editor — no need to hold every subsequent card.
    if(p.key&&typeof selectedKeys!=='undefined'&&selectedKeys.size){toggleCardSelect(p.key,card);return;}
    _focusedCardKey=p.key;if(typeof openPaletteDetail==='function')openPaletteDetail(p.key,p);
  });
  card.addEventListener('contextmenu', e => { if(!compact) openCtxMenu(e, p); });

  if (!compact) {
    const check = document.createElement('div');
    check.className = 'card-check';
    check.textContent = '✓';
    card.appendChild(check);

    let _lpTimer = null, _swipeStartX = 0, _swipeStartY = 0;
    card.addEventListener('touchstart', e => {
      _swipeStartX = e.touches[0].clientX;
      _swipeStartY = e.touches[0].clientY;
      _lpTimer = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(30);
        toggleCardSelect(p.key, card);
      }, 500);
    }, {passive: true});
    card.addEventListener('touchend', e => {
      clearTimeout(_lpTimer);
      const dx = e.changedTouches[0].clientX - _swipeStartX;
      const dy = Math.abs(e.changedTouches[0].clientY - _swipeStartY);
      if (Math.abs(dx) < 60 || dy > 40) return;
      if (dx > 0) {
        if (!likedKeys.has(p.key)) {
          likedKeys.add(p.key);
          if (!likedMeta.find(m => m.key === p.key))
            likedMeta.push({key:p.key, label:p.label, feeling:'', tag:p.tag, names:p.glazes.map(g=>g.name), hexes:p.glazes.map(g=>g.hex)});
          saveAll(); renderSidebar(); renderTopbarTabs(); updateCount();
          card.style.transition = 'background .2s';
          card.style.background = 'color-mix(in srgb, var(--acc) 12%, var(--surf))';
          setTimeout(() => { card.style.background = ''; card.style.transition = ''; }, 500);
          showToast('Saved!');
        }
      } else {
        if(typeof selectedKeys!=='undefined') { selectedKeys.delete(p.key); updateMultiBar?.(); }
        palettes = palettes.filter(x => x.key !== p.key);
        card.style.transition = 'opacity .15s, transform .15s';
        card.style.opacity = '0';
        card.style.transform = 'translateX(-30px)';
        setTimeout(() => renderGallery(), 160);
      }
    }, {passive: true});
    card.addEventListener('touchmove', () => clearTimeout(_lpTimer), {passive: true});
  }

  const stack=buildCardTile(p, clayKey, tileH);card.appendChild(stack);
  if(compact){
    card.appendChild(buildDragHandlers(card, p));
  }
  if(!compact){
    const sc=scoreAesthetic(p.glazes,activeScoreWeights());
    const peekScore = document.createElement('div');
    peekScore.className = 'card-score-peek';
    peekScore.textContent = '★ ' + sc;
    card.appendChild(peekScore);
    card.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('glaze')){e.preventDefault();card.classList.add('drag-over-glaze');}});
    card.addEventListener('dragleave',()=>card.classList.remove('drag-over-glaze'));
    card.addEventListener('drop',e=>{
      const glazeName=e.dataTransfer.getData('glaze');if(!glazeName)return;
      e.preventDefault();card.classList.remove('drag-over-glaze');
      const g=GLAZES.find(x=>x.name===glazeName);
      if(g&&!p.glazes.find(x=>x.name===glazeName)){
        p.glazes.push(g);p.glazes.sort((a,b)=>b.lum-a.lum);
        p.key=p.glazes.map(g=>g.name).join('|');card.dataset.key=p.key;
        refreshStack(stack,p.glazes,clayKey,TH);
        showToast(`Added ${glazeName}`);
      }
    });
  }
  return card;
}

export function renderGallery(){
  const gal=document.getElementById('gallery');if(!gal)return;
  const w=activeScoreWeights();
  const toRender=sortByScore?[...palettes].sort((a,b)=>scoreAesthetic(b.glazes,w)-scoreAesthetic(a.glazes,w)):palettes;
  const currentKeys = toRender.map(p => p.key);
  const keysMatch = currentKeys.length === lastRenderedKeys.length && currentKeys.every((k, i) => k === lastRenderedKeys[i]);

  if (keysMatch) {
    toRender.forEach(p => {
      const card = gal.querySelector(`[data-key="${p.key}"]`);
      if (card) {
        const stack = card.querySelector('.tile-col');
        if (stack) {
          const isCompact = card.classList.contains('compact');
          refreshStack(stack, p.glazes, clayKey, isCompact ? 44 : TH);
        }
        const sc = scoreAesthetic(p.glazes, w);
        const badge = card.querySelector('.score-badge');
        if (badge) {
          badge.className = 'score-badge' + (sc >= SCORE_HI ? ' score-hi' : sc >= SCORE_MID ? ' score-mid' : ' score-lo');
          badge.textContent = '★ ' + sc;
        }
        const peek = card.querySelector('.card-score-peek');
        if (peek) {
          peek.textContent = '★ ' + sc;
        }
      }
    });
  } else {
    gal.innerHTML='';
    toRender.forEach((p,idx)=>{
      const card=buildCard(p,likedKeys.has(p.key),false);
      card.classList.add('tile-in');card.style.animationDelay=Math.min(idx*18,360)+'ms';
      gal.appendChild(card);
    });
    lastRenderedKeys = currentKeys;
  }
  renderSavedSection();
}

// ── MULTI-SELECT ───────────────────────────────────────────────────────────────
export function toggleCardSelect(key,card){
  if(selectedKeys.has(key)){selectedKeys.delete(key);card.classList.remove('card-selected');}
  else{selectedKeys.add(key);card.classList.add('card-selected');}
  updateMultiBar();
}

function _resolvePaletteByKey(key){
  const inPalettes=palettes.find(p=>p.key===key);
  if(inPalettes)return inPalettes;
  const m=likedMeta.find(x=>x.key===key);
  if(m){
    const glazes=(m.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
    return{key,label:m.label,tag:m.tag||'Mood',glazes};
  }
  return null;
}

function _ensurePinned(key,projId){
  const meta=likedMeta.find(m=>m.key===key);
  if(meta){if(projId)meta.projectId=projId;likedKeys.add(key);return;}
  const p=_resolvePaletteByKey(key);
  if(!p||!p.glazes.length)return;
  likedKeys.add(key);
  likedMeta.push({key,label:p.label,feeling:'',tag:p.tag,names:p.glazes.map(g=>g.name),hexes:p.glazes.map(g=>g.hex),projectId:projId});
}

export function updateMultiBar(){
  if(_multiBar)_multiBar.remove();_multiBar=null;
  const fab=document.getElementById('mobileShuffleFab');
  if(fab)fab.style.visibility=selectedKeys.size?'hidden':'';
  if(!selectedKeys.size)return;
  const bar=document.createElement('div');bar.className='multi-action-bar';_multiBar=bar;
  bar.innerHTML=`<span>${selectedKeys.size} selected</span>`;
  const pinAllBtn=document.createElement('button');pinAllBtn.textContent='Pin all';
  pinAllBtn.addEventListener('click',()=>{
    const n=selectedKeys.size;
    selectedKeys.forEach(key=>_ensurePinned(key,activeContext!=='global'?activeContext:undefined));
    saveAll();renderSidebar();updateCount();renderTopbarTabs();renderGallery();
    showToast(`Pinned ${n} palette${n===1?'':'s'}`);
    clearMultiSelect();
  });
  bar.appendChild(pinAllBtn);
  const riffBtn=document.createElement('button');riffBtn.textContent='Riff together';
  riffBtn.addEventListener('click',()=>{
    const srcs=[...selectedKeys].map(_resolvePaletteByKey).filter(s=>s&&s.glazes.length);
    if(!srcs.length)return;
    const glazeMap=new Map();
    srcs.forEach(s=>s.glazes.forEach(g=>glazeMap.set(g.name,g)));
    const combined={label:'Combined riff',tag:'Mood',glazes:[...glazeMap.values()]};
    palettes=doRiff(combined);
    if(currentTab!=='explore')setTab('explore');
    renderGallery();
    document.getElementById('discoverHead')?.scrollIntoView({behavior:'smooth'});
    clearMultiSelect();
  });
  bar.appendChild(riffBtn);
  if(selectedKeys.size>=2){
    const composeBtn=document.createElement('button');composeBtn.textContent='Compose columns';
    composeBtn.addEventListener('click',()=>{
      const srcs=[...selectedKeys].map(_resolvePaletteByKey).filter(s=>s&&s.glazes.length);
      openCompositionModal(srcs);
      clearMultiSelect();
    });
    bar.appendChild(composeBtn);
  }
  projects.forEach(proj=>{
    const b=document.createElement('button');b.textContent=`→ ${proj.name}`;
    b.addEventListener('click',()=>{
      const n=selectedKeys.size;
      selectedKeys.forEach(key=>_ensurePinned(key,proj.id));
      saveAll();renderSidebar();updateCount();renderTopbarTabs();
      showToast(`${n} palettes → "${proj.name}"`);
      clearMultiSelect();
    });
    bar.appendChild(b);
  });
  const clr=document.createElement('button');clr.textContent='✕ Clear';clr.addEventListener('click',clearMultiSelect);
  bar.appendChild(clr);
  document.body.appendChild(bar);
}

export function clearMultiSelect(){
  selectedKeys.clear();
  document.querySelectorAll('.card-selected').forEach(c=>c.classList.remove('card-selected'));
  if(_multiBar){_multiBar.remove();_multiBar=null;}
  const fab=document.getElementById('mobileShuffleFab');
  if(fab)fab.style.visibility='';
}

export function renderSavedSection(){
  const section=document.getElementById('savedSection');
  const sg=document.getElementById('savedGallery');
  const lbl=document.getElementById('savedSectionLabel');
  const cnt=document.getElementById('savedSectionCount');
  if(!section||!sg)return;
  const filtered=activeContext==='global'
    ?likedMeta
    :likedMeta.filter(m=>m.projectId===activeContext);
  if(!filtered.length){section.style.display='none';renderProjectAnalyticsBand();updateJumpNav(0);return;}
  section.style.display='';
  const proj=projects.find(p=>p.id===activeContext);
  
  const isMobile = window.innerWidth <= 700;
  if (isMobile) {
    if(lbl) lbl.textContent = 'PINNED';
    if(cnt) cnt.textContent = ` · ${filtered.length}`;
  } else {
    if(lbl) lbl.textContent = proj ? `${proj.name} — Saved` : 'All Saved';
    if(cnt) cnt.textContent = `(${filtered.length})`;
  }
  updateJumpNav(filtered.length);
  renderProjectAnalyticsBand();
  const w=activeScoreWeights();
  const toShow=sortByScore
    ?[...filtered].sort((a,b)=>{
        const ga=(a.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
        const gb=(b.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
        return scoreAesthetic(gb,w)-scoreAesthetic(ga,w);
      })
    :filtered;

  const currentKeys = toShow.map(m => m.key);
  const keysMatch = currentKeys.length === lastSavedKeys.length && currentKeys.every((k, i) => k === lastSavedKeys[i]);

  if (keysMatch) {
    toShow.forEach(m => {
      const card = sg.querySelector(`[data-key="${m.key}"]`);
      if (card) {
        const stack = card.querySelector('.tile-col');
        const glazes = (m.names || []).map(n => GLAZES.find(g => g.name === n)).filter(Boolean);
        if (stack && glazes.length) {
          const isCompact = card.classList.contains('compact');
          refreshStack(stack, glazes, clayKey, isCompact ? 44 : TH);
        }
        const sc = glazes.length ? scoreAesthetic(glazes, w) : 0;
        const badge = card.querySelector('.score-badge');
        if (badge && glazes.length) {
          badge.className = 'score-badge' + (sc >= SCORE_HI ? ' score-hi' : sc >= SCORE_MID ? ' score-mid' : ' score-lo');
          badge.textContent = '★ ' + sc;
        }
        const peek = card.querySelector('.card-score-peek');
        if (peek && glazes.length) {
          peek.textContent = '★ ' + sc;
        }
      }
    });
  } else {
    sg.innerHTML='';
    toShow.forEach(m=>{
      const glazes=(m.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
      if(!glazes.length)return;
      const p=withKey({id:mkid(),label:labelStore[m.key]||m.label,feeling:'',tag:m.tag||'Pinned',glazes});
      sg.appendChild(buildCard(p,true,false));
    });
    lastSavedKeys = currentKeys;
  }
}

// ── PROJECT ANALYTICS BAND ────────────────────────────────────────────────────
export function renderProjectAnalyticsBand(){
  const band=document.getElementById('projectAnalyticsBand');if(!band)return;
  if(activeContext==='global'){band.style.display='none';return;}
  const meta=likedMeta.filter(m=>m.projectId===activeContext);
  if(!meta.length){band.style.display='none';return;}
  band.style.display='';band.innerHTML='';
  const div=document.createElement('div');div.className='proj-analytics-band';
  const row=document.createElement('div');row.className='proj-analytics-row';
  const gc={};meta.forEach(m=>(m.names||[]).forEach(n=>{gc[n]=(gc[n]||0)+1;}));
  const topGlazes=Object.entries(gc).sort((a,b)=>b[1]-a[1]).slice(0,6);
  topGlazes.forEach(([name])=>{
    const g=GLAZES.find(x=>x.name===name);if(!g)return;
    const c=applyGlaze(g,clayKey);
    const sw=document.createElement('div');sw.className='proj-analytics-swatch';
    sw.style.background=`rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)})`;
    sw.title=name;row.appendChild(sw);
  });
  let warm=0,cool=0;
  meta.forEach(m=>{const cg=(m.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(g=>g&&g.sat>.18);if(cg.length){const avg=cg.reduce((s,g)=>s+g.hue,0)/cg.length;if(avg<70||avg>250)warm++;else cool++;}});
  const tempStat=document.createElement('div');tempStat.className='proj-analytics-stat';
  const dominant=warm>=cool?`<strong style="color:var(--warm)">${warm} warm</strong>`:`<strong style="color:var(--cool)">${cool} cool</strong>`;
  tempStat.innerHTML=`${meta.length} palettes · ${dominant}`;
  row.appendChild(tempStat);
  div.appendChild(row);band.appendChild(div);
}

// ── IMAGE COLOR EXTRACTION ────────────────────────────────────────────────────
export function nearestGlaze(r,g,b){
  let best=null,bestD=Infinity;
  GLAZES.forEach(gl=>{const c=applyGlaze(gl,clayKey);const d=(c.r-r)**2+(c.gr-g)**2+(c.b-b)**2;if(d<bestD){bestD=d;best=gl;}});
  return best;
}

export function extractImagePalette(file){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=80;
      const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,80,80);
      URL.revokeObjectURL(img.src);
      const data=ctx.getImageData(0,0,80,80).data;
      const buckets={};
      for(let i=0;i<data.length;i+=4){
        if(data[i+3]<128)continue;
        const r=Math.round(data[i]/24)*24,g=Math.round(data[i+1]/24)*24,b=Math.round(data[i+2]/24)*24;
        const key=`${r},${g},${b}`;buckets[key]=(buckets[key]||0)+1;
      }
      const sorted=Object.entries(buckets).sort((a,b)=>b[1]-a[1]);
      const glazes=[];const seen=new Set();
      for(const[key]of sorted){
        if(glazes.length>=4)break;
        const[r,g,b]=key.split(',').map(Number);
        const gl=nearestGlaze(r,g,b);
        if(gl&&!seen.has(gl.name)){seen.add(gl.name);glazes.push(gl);}
      }
      resolve(glazes.sort((a,b)=>b.lum-a.lum));
    };
    img.onerror=()=>resolve([]);
    img.src=URL.createObjectURL(file);
  });
}

export function updateJumpNav(savedCount){
  const js=document.getElementById('jumpSaved');
  const jd=document.getElementById('jumpDiscover');
  if(js){js.textContent=`↑ Saved (${savedCount})`;js.style.display=savedCount?'':'none';}
  if(jd){jd.classList.toggle('active',!savedCount);}
}

// Shared by desktop drag-drop and the mobile photo picker. Returns true on success.
async function _extractAndInsertPalette(file){
  const glazes=await extractImagePalette(file);
  if(!glazes.length){showToast('Could not extract colors from image');return false;}
  const label=file.name.replace(/\.[^.]+$/,'');
  const p=withKey({id:mkid(),label,feeling:'',tag:'From Image',glazes});
  palettes=[p,...palettes.slice(0,19)];
  if(currentTab!=='explore')setTab('explore');
  renderGallery();
  document.getElementById('discoverHead')?.scrollIntoView({behavior:'smooth'});
  showToast(`Palette from "${label}" — ${glazes.map(g=>g.name).join(', ')}`);
  return true;
}

export function wireImageDrop(){
  const zone=document.getElementById('sectionJumpDrop');
  const view=document.getElementById('view_explore');
  if(!zone||!view)return;
  const onOver=e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();zone.classList.add('drag-active');}};
  const onLeave=()=>zone.classList.remove('drag-active');
  const onDrop=async e=>{
    const file=[...e.dataTransfer.files].find(f=>f.type.startsWith('image/'));
    if(!file)return;
    e.preventDefault();zone.classList.remove('drag-active');
    zone.textContent='Extracting…';
    await _extractAndInsertPalette(file);
    zone.innerHTML='<span>🖼 Drop image</span>';
  };
  view.addEventListener('dragover',onOver);
  view.addEventListener('dragleave',onLeave);
  view.addEventListener('drop',onDrop);
}

// Mobile has no drag-and-drop, so the Controls sheet exposes a native photo
// picker (tap → file input → camera roll) that feeds the same extractor.
export function wireMobileImagePicker(){
  const btn=document.getElementById('sheetPhotoBtn');
  const input=document.getElementById('mobileImageInput');
  if(!btn||!input)return;
  btn.addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    const file=input.files[0];
    input.value='';
    if(!file)return;
    const prevText=btn.textContent;
    btn.textContent='Extracting…';btn.disabled=true;
    await _extractAndInsertPalette(file);
    btn.textContent=prevText;btn.disabled=false;
    closeSheet();
  });
}

// ── GLAZE TILES ───────────────────────────────────────────────────────────────
export function finBadge(fin){const map={shiny:'shiny',matte:'matte',transparent:'clear','crawl-dot':'crawl','crawl-leather':'crawl','crawl-crackle':'crawl',textured:'textured'};const lbl={shiny:'Shiny',matte:'Matte',transparent:'Clear','crawl-dot':'Crawl','crawl-leather':'Crawl','crawl-crackle':'Crackle',textured:'Textured'};return{cls:map[fin]||'matte',label:lbl[fin]||'Matte'};}

export function finFilterMatch(g){if(glazeFilter==='all')return true;if(glazeFilter==='shiny')return g.fin==='shiny'||g.fin==='transparent';if(glazeFilter==='matte')return g.fin==='matte';if(glazeFilter==='textured')return['crawl-dot','crawl-leather','crawl-crackle','textured'].includes(g.fin);if(glazeFilter==='clear')return g.fin==='transparent'||g.fin==='crawl-crackle';return true;}

export function setGlazeFilter(f){glazeFilter=f;document.querySelectorAll('#glazeFilterRow .btn').forEach(b=>{b.className='btn'+(b.dataset.filter===f?' filter-on':'');});renderGlazeTiles();}

export function clearGlazeSelection(){selectedGlaze=null;document.querySelectorAll('.glaze-card').forEach(c=>c.classList.remove('selected'));document.getElementById('glazeActionBar').classList.remove('visible');}

export function isColorGlaze(g){return g.sat>.18&&!['crawl-dot','crawl-leather','crawl-crackle','textured','transparent'].includes(g.fin);}

export function renderGlazeTiles(){
  const content=document.getElementById('glazeContent');if(!content)return;content.innerHTML='';
  const bar=document.getElementById('glazeActionBar');
  if(selectedGlaze){if(bar)bar.classList.add('visible');const lbl=document.getElementById('glazeActionLabel');if(lbl)lbl.innerHTML=`Selected: <strong>${selectedGlaze.name}</strong>`;}else{if(bar)bar.classList.remove('visible');}
  const colors=GLAZES.filter(g=>isColorGlaze(g)&&finFilterMatch(g));
  const neutrals=GLAZES.filter(g=>!isColorGlaze(g)&&finFilterMatch(g));
  const renderSection=(label,list)=>{
    if(!list.length)return;
    const head=document.createElement('div');head.className='glaze-section-head';head.textContent=label;content.appendChild(head);
    const grid=document.createElement('div');grid.className='glaze-grid';
    list.forEach((g,idx)=>{
      const card=document.createElement('div');card.className='glaze-card'+(selectedGlaze===g?' selected':'');
      const sw=document.createElement('div');sw.className='glaze-swatches';
      ['white','red'].forEach(ck=>{const w=document.createElement('div');w.innerHTML=swatchSVG(g,ck,44);sw.appendChild(w);});
      card.appendChild(sw);
      const info=document.createElement('div');info.className='glaze-info';
      const nm=document.createElement('div');nm.className='glaze-name';nm.textContent=g.name;info.appendChild(nm);
      const cr=document.createElement('div');cr.className='glaze-clay-row';['White','Red'].forEach(l=>{const s=document.createElement('span');s.className='glaze-clay-lbl';s.textContent=l;cr.appendChild(s);});info.appendChild(cr);
      const{cls,label:bl}=finBadge(g.fin);const badge=document.createElement('span');badge.className=`finish-badge ${cls}`;badge.textContent=bl;info.appendChild(badge);
      card.appendChild(info);
      card.addEventListener('click',()=>{const was=(selectedGlaze===g);selectedGlaze=was?null:g;document.querySelectorAll('.glaze-card').forEach(c=>c.classList.remove('selected'));if(!was){card.classList.add('selected');if(bar)bar.classList.add('visible');const lbl=document.getElementById('glazeActionLabel');if(lbl)lbl.innerHTML=`Selected: <strong>${g.name}</strong>`;}else{if(bar)bar.classList.remove('visible');}});
      card.classList.add('tile-in');card.style.animationDelay=(idx*14)+'ms';
      grid.appendChild(card);
    });
    content.appendChild(grid);
  };
  renderSection('Colors',colors);renderSection('Neutrals & Specials',neutrals);
}

// ── PAIRINGS ──────────────────────────────────────────────────────────────────
export function renderPairingsTab(){renderAnchorGrid();if(anchorGlaze)renderPairingResults();else{const pc=document.getElementById('pairingsContent');if(pc)pc.innerHTML='<div style="padding:12px 14px;font-size:12px;color:var(--ink3);">Select a glaze above to see all combinations.</div>';}}

export function renderAnchorGrid(){
  const grid=document.getElementById('anchorGrid');if(!grid)return;grid.innerHTML='';
  GLAZES.forEach(g=>{
    const chip=document.createElement('div');chip.className='anchor-chip'+(anchorGlaze===g?' on':'');
    const c=applyGlaze(g,clayKey);const dot=document.createElement('div');dot.className='anchor-dot';dot.style.background=`rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)})`;dot.style.border='1px solid rgba(0,0,0,.12)';
    const nm=document.createElement('span');nm.textContent=g.name;chip.appendChild(dot);chip.appendChild(nm);
    chip.addEventListener('click',()=>{anchorGlaze=(anchorGlaze===g)?null:g;renderAnchorGrid();renderPairingResults();});
    grid.appendChild(chip);
  });
}

export function renderPairingResults(){
  const content=document.getElementById('pairingsContent');if(!content)return;content.innerHTML='';
  if(!anchorGlaze){content.innerHTML='<div style="padding:12px 14px;font-size:12px;color:var(--ink3);">Select a glaze above to see all combinations.</div>';return;}
  const others=GLAZES.filter(g=>g.name!==anchorGlaze.name);
  const scored=others.map(g=>({g,score:pairingScore(anchorGlaze,g)})).sort((a,b)=>b.score-a.score);
  const renderPairSection=(label,list)=>{
    if(!list.length)return;
    const head=document.createElement('div');head.className='pairings-section-head';head.textContent=label;content.appendChild(head);
    const grid=document.createElement('div');grid.className='pairings-grid';
    list.forEach(({g})=>{
      const glazes=[anchorGlaze,g].sort((a,b)=>b.lum-a.lum);
      const card=document.createElement('div');card.className='pair-card';
      const tw=document.createElement('div');tw.className='pair-tile-wrap';tw.innerHTML=pairTileSVG(glazes,clayKey,68);card.appendChild(tw);
      const footer=document.createElement('div');footer.className='pair-footer';
      const gn=document.createElement('div');gn.className='pair-glaze-names';gn.textContent=anchorGlaze.name+' + '+g.name;footer.appendChild(gn);
      const btns=document.createElement('div');btns.className='pair-btns';
      const eb=document.createElement('button');eb.className='btn';eb.textContent='Explore';
      eb.addEventListener('click',()=>{const p=withKey({id:mkid(),label:anchorGlaze.name+' + '+g.name,feeling:'',tag:'Pairing',glazes});palettes=[p,...palettes.slice(0,19)];setTab('explore');renderGallery();window.scrollTo({top:0,behavior:'smooth'});});
      const pb=document.createElement('button');pb.className='btn';pb.textContent='Pin';
      pb.addEventListener('click',()=>{
        const p=withKey({id:mkid(),label:anchorGlaze.name+' + '+g.name,feeling:'',tag:'Pairing',glazes});
        if(!likedMeta.find(m=>m.key===p.key)){
          likedKeys.add(p.key);
          likedMeta.push({key:p.key,label:p.label,feeling:'',tag:'Pairing',names:glazes.map(g=>g.name),hexes:glazes.map(g=>g.hex),projectId:activeContext!=='global'?activeContext:undefined});
          saveAll();renderSidebar();updateCount();showToast('Pinned');pb.textContent='Pinned';pb.className='btn pin-on';
        }
      });
      btns.appendChild(eb);btns.appendChild(pb);footer.appendChild(btns);card.appendChild(footer);grid.appendChild(card);
    });
    content.appendChild(grid);
  };
  renderPairSection('Works well with '+anchorGlaze.name,scored.slice(0,9));
  renderPairSection('All other combinations',scored.slice(9));
}

// ── LEFT PANEL PAIRINGS ───────────────────────────────────────────────────────
export function renderLeftPanelPairings(){
  const section=document.getElementById('sbPairsSection');if(!section)return;
  section.innerHTML='';

  const head=document.createElement('div');head.className='sb-pairs-head';head.textContent='Pairings';section.appendChild(head);

  const sel=document.createElement('select');sel.className='sb-pair-anchor';
  const defOpt=document.createElement('option');defOpt.value='';defOpt.textContent='Choose anchor glaze...';sel.appendChild(defOpt);
  GLAZES.forEach(g=>{const opt=document.createElement('option');opt.value=g.name;opt.textContent=g.name;if(leftAnchorGlaze&&leftAnchorGlaze.name===g.name)opt.selected=true;sel.appendChild(opt);});
  sel.addEventListener('change',()=>{
    leftAnchorGlaze=GLAZES.find(g=>g.name===sel.value)||null;
    renderLeftPanelPairings();
  });
  section.appendChild(sel);

  if(!leftAnchorGlaze){
    const em=document.createElement('div');em.className='sb-pairs-empty';em.textContent='Pick a glaze to see combinations.';section.appendChild(em);
    return;
  }

  const others=GLAZES.filter(g=>g!==leftAnchorGlaze);
  const scored=others.map(g=>({g,score:pairingScore(leftAnchorGlaze,g)})).sort((a,b)=>b.score-a.score).slice(0,8);

  scored.forEach(({g})=>{
    const glazes=[leftAnchorGlaze,g].sort((a,b)=>b.lum-a.lum);
    const key=glazes.map(x=>x.name).join('|');
    const isPinned=likedKeys.has(key);

    const row=document.createElement('div');row.className='sb-pair-row';row.style.cursor='pointer';row.title='Click to explore this pairing';
    row.addEventListener('click',()=>{
      const p=withKey({id:mkid(),label:leftAnchorGlaze.name+' + '+g.name,feeling:'',tag:'Pairing',glazes});
      palettes=[p,...palettes.slice(0,19)];
      if(currentTab!=='explore')setTab('explore');renderGallery();window.scrollTo({top:0,behavior:'smooth'});
    });

    const strip=document.createElement('div');strip.className='sb-pair-strip';
    strip.style.background=glazeCSS(glazes,clayKey);row.appendChild(strip);

    const nm=document.createElement('div');nm.className='sb-pair-names';nm.textContent=leftAnchorGlaze.name+' + '+g.name;nm.title=leftAnchorGlaze.name+' + '+g.name;row.appendChild(nm);

    const useBtn=document.createElement('button');useBtn.className='sb-pair-use';useBtn.textContent='→';useBtn.title='Explore this pairing';
    useBtn.addEventListener('click',e=>{e.stopPropagation();row.click();});
    row.appendChild(useBtn);

    const pinBtn=document.createElement('button');pinBtn.className='sb-pair-pin'+(isPinned?' pinned':'');pinBtn.textContent=isPinned?'♥':'♡';pinBtn.title=isPinned?'Pinned':'Pin this pairing';
    pinBtn.addEventListener('click',e=>{
      e.stopPropagation();
      if(!likedKeys.has(key)){
        likedKeys.add(key);
        if(!likedMeta.find(m=>m.key===key))
          likedMeta.push({key,label:leftAnchorGlaze.name+' + '+g.name,feeling:'',tag:'Pairing',names:glazes.map(x=>x.name),hexes:glazes.map(x=>x.hex),projectId:activeContext!=='global'?activeContext:undefined});
        saveAll();renderSidebar();updateCount();showToast('Pinned');
      }
      renderLeftPanelPairings();
    });
    row.appendChild(pinBtn);

    section.appendChild(row);
  });
}

// ── SCORE WEIGHTING (right panel) ─────────────────────────────────────────────
export function renderScoreWeighting(){
  const sel=document.getElementById('scoreWeightSelect');if(!sel)return;
  const hint=document.getElementById('scoreWeightHint');
  const proj=activeContext!=='global'?projects.find(p=>p.id===activeContext):null;
  sel.innerHTML='';
  Object.keys(SCORE_PRESETS).forEach(key=>{
    const opt=document.createElement('option');opt.value=key;opt.textContent=SCORE_PRESETS[key].label;
    sel.appendChild(opt);
  });
  const activeKey=proj?(proj.scorePreset||'Balanced'):'Balanced';
  sel.value=activeKey;
  sel.disabled=!proj;
  const updateHint=key=>{
    if(!hint)return;
    hint.textContent=proj?SCORE_PRESETS[key]?.desc||'':`Open a board to set its score weighting.`;
  };
  updateHint(activeKey);
  sel.onchange=()=>{
    if(!proj)return;
    proj.scorePreset=sel.value;saveAll();
    updateHint(sel.value);
    if(!sortByScore){sortByScore=true;const btn=document.getElementById('scoreSortBtn');if(btn)btn.className='btn xs filter-on';}
    if(currentTab==='explore')renderGallery();
  };
}

// ── PIN TOGGLE ────────────────────────────────────────────────────────────────
// Pure state mutation shared by every pin surface (gallery card, detail view, …).
// Callers own their own DOM updates + undo toast wiring.
export function togglePinState(p){
  if(likedKeys.has(p.key)){
    const snapData=likedMeta.find(m=>m.key===p.key)?{...likedMeta.find(m=>m.key===p.key)}:null;
    likedKeys.delete(p.key);likedMeta=likedMeta.filter(m=>m.key!==p.key);
    saveAll();
    return {pinned:false,snapData};
  }else{
    likedKeys.add(p.key);
    if(!likedMeta.find(m=>m.key===p.key)){
      const pid=activeContext!=='global'?activeContext:undefined;
      likedMeta.push({key:p.key,label:labelStore[p.key]||p.label,feeling:'',tag:p.tag,names:p.glazes.map(g=>g.name),hexes:p.glazes.map(g=>g.hex),projectId:pid});
    }
    saveAll();
    return {pinned:true};
  }
}

export function togglePin(p,btn,card,compact){
  if('vibrate' in navigator) navigator.vibrate(15);
  const {pinned,snapData}=togglePinState(p);
  if(!pinned){
    btn.className='btn';btn.textContent='Pin';if(!compact)card.className='card';
    renderSidebar();updateCount();
    showToast('Unpinned',()=>{
      likedKeys.add(p.key);
      if(!likedMeta.find(m=>m.key===p.key)&&snapData)likedMeta.push(snapData);
      saveAll();renderSidebar();updateCount();
      if(compact){btn.className='btn remove-subtle';btn.textContent='Remove';}else{btn.className='btn pin-on';btn.textContent='Pinned';card.className='card liked';}
    });
  }else{
    btn.className='btn pin-on';btn.textContent='Pinned';if(!compact)card.className='card liked';
    renderSidebar();updateCount();
    showToast('Pinned');
  }
}

export function updateCount(){renderSavedSection();}

// ── TOAST ─────────────────────────────────────────────────────────────────────
export function showPaletteModal(m){
  const glazes=(m.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
  const backdrop=document.createElement('div');backdrop.className='palette-modal-backdrop';
  const modal=document.createElement('div');modal.className='palette-modal';
  const sw=document.createElement('div');sw.className='palette-modal-swatch';
  if(glazes.length)sw.style.background=glazeCSS(glazes,clayKey);
  const body=document.createElement('div');body.className='palette-modal-body';
  const nm=document.createElement('div');nm.className='palette-modal-name';nm.textContent=labelStore[m.key]||m.label;
  const gn=document.createElement('div');gn.className='palette-modal-glazes';gn.textContent=(m.names||[]).join(' · ');
  const projNames=projects.filter(p=>m.projectId===p.id).map(p=>p.name);
  const projEl=document.createElement('div');projEl.className='palette-modal-projects';
  if(projNames.length){projEl.textContent='In board: ';const strong=document.createElement('strong');strong.textContent=projNames.join(', ');projEl.appendChild(strong);}else{projEl.textContent='Not in any board';}
  const closeBtn=document.createElement('button');closeBtn.className='palette-modal-close';closeBtn.textContent='Close';
  closeBtn.addEventListener('click',()=>backdrop.remove());
  body.appendChild(nm);body.appendChild(gn);body.appendChild(projEl);
  modal.appendChild(sw);modal.appendChild(body);modal.appendChild(closeBtn);
  backdrop.appendChild(modal);
  backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.remove();});
  document.body.appendChild(backdrop);
}

export function showToast(msg,undoFn){
  const t=document.getElementById('toast');if(!t)return;
  t.innerHTML='';
  const txt=document.createElement('span');txt.textContent=msg;t.appendChild(txt);
  if(undoFn){
    const ub=document.createElement('button');ub.className='toast-undo';ub.textContent='Undo';
    ub.addEventListener('click',()=>{undoFn();t.classList.remove('show');clearTimeout(_toastTimer);});
    t.appendChild(ub);
  }
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>t.classList.remove('show'),3200);
}

// ── TOPBAR PROJECT TABS ───────────────────────────────────────────────────────
export function renderTopbarTabs(){
  const nav=document.getElementById('topbarTabs');if(!nav)return;
  nav.querySelectorAll('.ttab[data-proj-id]').forEach(el=>el.remove());
  const exploreTab=document.getElementById('tab_explore');
  if(exploreTab)exploreTab.classList.toggle('on',activeContext==='global');
  projects.forEach(proj=>{
    const btn=document.createElement('button');
    btn.className='ttab'+(activeContext===proj.id?' on':'');
    btn.dataset.projId=proj.id;
    btn.draggable=true;
    btn.textContent=proj.name;
    btn.title='Double-click to rename · Drag to reorder';
    btn.addEventListener('click',()=>switchToProjectTab(proj.id));
    btn.addEventListener('contextmenu',e=>{e.preventDefault();showProjMenu(proj.id,btn);});
    let _lpt=null;
    btn.addEventListener('touchstart',e=>{_lpt=setTimeout(()=>{e.preventDefault();showProjMenu(proj.id,btn);},600);},{passive:false});
    btn.addEventListener('touchend',()=>clearTimeout(_lpt));
    btn.addEventListener('touchmove',()=>clearTimeout(_lpt));
    btn.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain','proj-reorder:'+proj.id);e.dataTransfer.effectAllowed='move';});
    btn.addEventListener('dragover',e=>{e.preventDefault();btn.classList.add('drag-over');});
    btn.addEventListener('dragleave',()=>btn.classList.remove('drag-over'));
    btn.addEventListener('drop',e=>{
      e.preventDefault();btn.classList.remove('drag-over');
      const data=e.dataTransfer.getData('text/plain');
      if(!data||!data.startsWith('proj-reorder:'))return;
      const srcId=data.slice('proj-reorder:'.length);
      if(srcId===proj.id)return;
      const srcIdx=projects.findIndex(p=>p.id===srcId),dstIdx=projects.findIndex(p=>p.id===proj.id);
      if(srcIdx===-1||dstIdx===-1)return;
      const [moved]=projects.splice(srcIdx,1);
      projects.splice(projects.indexOf(proj),0,moved);
      _stampProjectOrder();
      saveAll();renderTopbarTabs();renderSidebar();
    });
    btn.addEventListener('dblclick',e=>{
      e.stopPropagation();
      const inp=document.createElement('input');inp.type='text';inp.value=btn.textContent;
      inp.className='topbar-tab-input';
      btn.replaceWith(inp);inp.focus();inp.select();
      let committed=false;
      const commit=()=>{
        if(committed)return;committed=true;
        const newName=inp.value.trim();
        if(newName){proj.name=newName;saveAll();renderTopbarTabs();renderSidebar();}
        else{renderTopbarTabs();}
      };
      inp.addEventListener('blur',commit);
      inp.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();inp.blur();}if(ev.key==='Escape'){committed=true;renderTopbarTabs();}});
    });
    nav.insertBefore(btn,exploreTab.nextSibling);
  });
  updateProjectPicker();
}

export function switchToProjectTab(projId){
  if(currentTab!=='explore')setTab('explore');
  switchContext(projId);
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
export function renderAnalyticsView(){
  const view=document.getElementById('view_analytics');if(!view)return;
  view.innerHTML='';
  if(!likedMeta.length){
    view.innerHTML='<div class="analytics-empty"><strong>Nothing to analyze yet</strong>Pin some palettes from Explore to see insights about your taste.</div>';
    return;
  }
  const glazeCount={},pairCount={};
  let warmCount=0,coolCount=0,darkCount=0,lightCount=0,satCount=0,quietCount=0;
  likedMeta.forEach(m=>{
    const names=m.names||[];
    names.forEach(n=>{glazeCount[n]=(glazeCount[n]||0)+1;});
    for(let i=0;i<names.length;i++){for(let j=i+1;j<names.length;j++){const pair=[names[i],names[j]].sort().join(' + ');pairCount[pair]=(pairCount[pair]||0)+1;}}
    const colorGlazes=names.map(n=>GLAZES.find(g=>g.name===n)).filter(g=>g&&g.sat>.18);
    if(colorGlazes.length){const avg=colorGlazes.reduce((s,g)=>s+g.hue,0)/colorGlazes.length;if(avg<70||avg>250)warmCount++;else coolCount++;}
    const allG=names.map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
    if(allG.length){
      const avgLum=allG.reduce((s,g)=>s+g.lum,0)/allG.length;
      if(avgLum>.55)lightCount++;else darkCount++;
      const avgSat=allG.reduce((s,g)=>s+g.sat,0)/allG.length;
      if(avgSat>.35)satCount++;else quietCount++;
    }
  });
  const grid=document.createElement('div');grid.className='analytics-grid';

  const topGlazes=Object.entries(glazeCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxG=topGlazes[0]?.[1]||1;
  const glazeCard=document.createElement('div');glazeCard.className='analytics-card';
  glazeCard.innerHTML='<div class="analytics-card-title">Most Used Glazes</div>';
  topGlazes.forEach(([name,count])=>{
    const g=GLAZES.find(x=>x.name===name);
    const c=g?applyGlaze(g,clayKey):null;
    const col=c?`rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)})`:'#888';
    const row=document.createElement('div');row.className='analytics-bar-row';
    row.innerHTML=`<div class="analytics-bar-label">${name}</div><div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${(count/maxG*100).toFixed(0)}%;background:${col}"></div></div><div class="analytics-bar-count">${count}</div>`;
    glazeCard.appendChild(row);
  });
  grid.appendChild(glazeCard);

  const topPairs=Object.entries(pairCount).filter(([,c])=>c>1).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const pairCard=document.createElement('div');pairCard.className='analytics-card';
  pairCard.innerHTML='<div class="analytics-card-title">Common Pairings</div>';
  if(!topPairs.length){const noPairs=document.createElement('div');noPairs.className='analytics-empty-msg';noPairs.textContent='No repeated pairings yet.';pairCard.appendChild(noPairs);}
  topPairs.forEach(([pair,count])=>{
    const[a,b]=pair.split(' + ');
    const ga=GLAZES.find(g=>g.name===a),gb=GLAZES.find(g=>g.name===b);
    const glazes=[ga,gb].filter(Boolean).sort((x,y)=>y.lum-x.lum);
    const row=document.createElement('div');row.className='analytics-swatch-row';
    const sw=document.createElement('div');sw.className='analytics-swatch';
    if(glazes.length)sw.style.background=glazeCSS(glazes,clayKey);
    const lbl=document.createElement('div');lbl.className='analytics-pair-label';lbl.textContent=pair;
    const cnt=document.createElement('div');cnt.className='analytics-pair-count';cnt.textContent=count+'×';
    const riffBtn=document.createElement('button');riffBtn.className='btn sm';riffBtn.textContent='Explore';riffBtn.title='Explore this pairing';
    riffBtn.addEventListener('click',()=>{
      if(glazes.length){
        const p=withKey({id:mkid(),label:pair,feeling:'',tag:'Pairing',glazes});
        palettes=[p,...palettes.slice(0,19)];setTab('explore');renderGallery();window.scrollTo({top:0,behavior:'smooth'});
      }
    });
    row.appendChild(sw);row.appendChild(lbl);row.appendChild(cnt);row.appendChild(riffBtn);pairCard.appendChild(row);
  });
  grid.appendChild(pairCard);

  const tempCard=document.createElement('div');tempCard.className='analytics-card';
  tempCard.innerHTML=`<div class="analytics-card-title">Temperature</div><div class="analytics-mood-grid"><div class="analytics-mood-cell"><div class="analytics-mood-count" style="color:var(--warm)">${warmCount}</div><div class="analytics-mood-label">Warm</div></div><div class="analytics-mood-cell"><div class="analytics-mood-count" style="color:var(--cool)">${coolCount}</div><div class="analytics-mood-label">Cool</div></div></div><div class="analytics-mood-bar" style="margin-top:10px;"><div class="analytics-mood-bar-warm analytics-mood-bar-fill" style="flex:${warmCount};"></div><div class="analytics-mood-bar-cool analytics-mood-bar-fill" style="flex:${coolCount};"></div></div>`;
  const bar=tempCard.querySelector('.analytics-mood-bar');
  if(bar){bar.style.cssText='margin-top:10px;height:10px;border-radius:5px;overflow:hidden;display:flex;';}
  grid.appendChild(tempCard);

  const valueCard=document.createElement('div');valueCard.className='analytics-card';
  valueCard.innerHTML=`<div class="analytics-card-title">Luminosity</div><div class="analytics-mood-grid"><div class="analytics-mood-cell"><div class="analytics-mood-count" style="color:var(--tone-dark)">${darkCount}</div><div class="analytics-mood-label">Dark</div></div><div class="analytics-mood-cell"><div class="analytics-mood-count" style="color:var(--tone-light)">${lightCount}</div><div class="analytics-mood-label">Light</div></div></div>`;
  const lbar=document.createElement('div');lbar.style.cssText='margin-top:10px;height:10px;border-radius:5px;overflow:hidden;display:flex;';
  const dk=document.createElement('div');dk.style.cssText=`flex:${darkCount};background:var(--tone-dark);`;
  const lt=document.createElement('div');lt.style.cssText=`flex:${lightCount};background:var(--tone-light);`;
  lbar.appendChild(dk);lbar.appendChild(lt);valueCard.appendChild(lbar);
  grid.appendChild(valueCard);

  view.appendChild(grid);

  const rankSection=document.createElement('div');rankSection.className='analytics-rank-section';
  const rankHead=document.createElement('div');rankHead.className='analytics-rank-head';rankHead.textContent='Palette Ranking';
  rankSection.appendChild(rankHead);
  const rankContainer=document.createElement('div');rankContainer.className='rank-container';rankContainer.id='analyticsRankContainer';
  rankSection.appendChild(rankContainer);
  view.appendChild(rankSection);
  renderRankInContainer(rankContainer);
}

export function renderRankInContainer(container){
  container.innerHTML='';
  if(!likedMeta.length){container.innerHTML='<div style="font-size:12px;color:var(--ink3);padding:8px 14px;">Pin some palettes to start ranking.</div>';return;}
  if(rankMode==='idle'){
    const modeBtns=document.createElement('div');modeBtns.className='rate-rank-mode-btns';
    const fullBtn=document.createElement('button');fullBtn.className='rate-rank-mode-btn';
    fullBtn.innerHTML=`<span class="mode-label">Full Rank</span><span class="mode-desc">A vs B comparisons<br>~${Math.ceil(likedMeta.length*Math.log2(likedMeta.length+1))} steps · most accurate</span>`;
    fullBtn.addEventListener('click',()=>startRank(container));
    const rateBtn=document.createElement('button');rateBtn.className='rate-rank-mode-btn';
    rateBtn.innerHTML=`<span class="mode-label">Quick Rate ★</span><span class="mode-desc">Star each palette once<br>${likedMeta.length} steps · fast</span>`;
    rateBtn.addEventListener('click',()=>startQuickRate(container));
    modeBtns.appendChild(fullBtn);modeBtns.appendChild(rateBtn);
    container.appendChild(modeBtns);return;
  }
  if(rankMode==='rating'){
    renderQuickRate(container);return;
  }
  if(rankMode==='active'&&rankCurrentItem){
    const prog=document.createElement('div');prog.style.cssText='font-size:10px;color:var(--ink3);margin-bottom:10px;';
    prog.textContent=`Comparison ${Math.min(rankDoneComparisons+1,rankTotalComparisons)} of ~${rankTotalComparisons}`;
    container.appendChild(prog);
    const mid=Math.floor((rankLow+rankHigh)/2);
    const pair=document.createElement('div');pair.className='rank-pair';
    const optA=buildRankCard(rankCurrentItem,'A');optA.addEventListener('click',()=>{rankChoose('current');renderRankInContainer(container);});
    const optB=buildRankCard(rankSorted[mid],'B');optB.addEventListener('click',()=>{rankChoose('existing');renderRankInContainer(container);});
    pair.appendChild(optA);pair.appendChild(optB);
    container.appendChild(pair);
    const hint=document.createElement('div');hint.className='rank-kb-hint';hint.textContent='A / B keys · Space to skip';
    container.appendChild(hint);
    const skip=document.createElement('button');skip.className='rank-skip';skip.textContent='Skip (tie)';
    skip.addEventListener('click',()=>{rankSkip();renderRankInContainer(container);});
    container.appendChild(skip);return;
  }
  if(rankMode==='done'){
    const results=document.createElement('div');results.className='rank-results';
    const medals=['🥇','🥈','🥉'];
    rankSorted.forEach((m,i)=>{
      const glazes=(m.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
      const row=document.createElement('div');row.className='rank-result-row';row.style.cursor='pointer';row.title='Click to view palette';
      row.addEventListener('click',()=>showPaletteModal(m));
      const num=document.createElement('div');num.className='rank-result-num';num.textContent=medals[i]||`${i+1}`;
      const strip=document.createElement('div');strip.className='rank-result-strip';
      if(glazes.length)strip.style.background=glazeCSS(glazes,clayKey);
      const info=document.createElement('div');info.className='rank-result-info';
      const nm=document.createElement('div');nm.className='rank-result-name';nm.textContent=labelStore[m.key]||m.label;
      const gn=document.createElement('div');gn.className='rank-result-glazes';gn.textContent=(m.names||[]).join(' · ');
      info.appendChild(nm);info.appendChild(gn);
      const expBtn=document.createElement('div');expBtn.style.cssText='font-size:11px;color:var(--ink3);flex-shrink:0;padding:2px 4px;';expBtn.textContent='↗';
      row.appendChild(num);row.appendChild(strip);row.appendChild(info);row.appendChild(expBtn);results.appendChild(row);
    });
    container.appendChild(results);
    const restart=document.createElement('button');restart.className='btn';restart.textContent='Rank Again';restart.style.marginTop='10px';
    restart.addEventListener('click',()=>{rankMode='idle';rateQueue=[];rateScores={};renderRankInContainer(container);});
    container.appendChild(restart);
  }
}

// ── RANK / COMPARE ────────────────────────────────────────────────────────────
export function startQuickRate(container){
  rateQueue=[...likedMeta];rateScores={};rankMode='rating';renderRankInContainer(container);
}

export function renderQuickRate(container){
  container.innerHTML='';
  if(!rateQueue.length){
    rankSorted=[...likedMeta].sort((a,b)=>(rateScores[b.key]||0)-(rateScores[a.key]||0));
    rankMode='done';recomputeGlazeAffinity();saveAll();renderRankInContainer(container);return;
  }
  const m=rateQueue[0];
  const glazes=(m.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
  const prog=document.createElement('div');prog.style.cssText='font-size:10px;color:var(--ink3);margin-bottom:8px;';
  prog.textContent=`Rating ${likedMeta.length-rateQueue.length+1} of ${likedMeta.length}`;
  const card=document.createElement('div');card.className='rate-card';
  const sw=document.createElement('div');sw.className='rate-card-swatch';
  if(glazes.length)sw.style.background=glazeCSS(glazes,clayKey);
  const body=document.createElement('div');body.className='rate-card-body';
  const nm=document.createElement('div');nm.className='rate-card-name';nm.textContent=labelStore[m.key]||m.label;
  const stars=document.createElement('div');stars.className='rate-stars';
  for(let s=1;s<=5;s++){
    const star=document.createElement('span');star.className='rate-star';star.textContent='★';star.dataset.val=s;
    star.addEventListener('click',()=>{
      rateScores[m.key]=s;rateQueue.shift();
      renderQuickRate(container);
    });
    stars.appendChild(star);
  }
  body.appendChild(nm);body.appendChild(stars);
  card.appendChild(sw);card.appendChild(body);
  container.appendChild(prog);container.appendChild(card);
  const skip=document.createElement('button');skip.className='rank-skip';skip.textContent='Skip';
  skip.addEventListener('click',()=>{rateScores[m.key]=0;rateQueue.shift();renderQuickRate(container);});
  container.appendChild(skip);
}

export function startRank(container){
  const items=[...likedMeta];
  if(items.length<2){showToast('Pin at least 2 palettes to start ranking.');return;}
  for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}
  rankSorted=[items[0]];
  rankQueue=items.slice(1);
  rankCurrentItem=rankQueue.shift();
  rankLow=0;rankHigh=rankSorted.length-1;
  let est=0;for(let k=1;k<items.length;k++)est+=Math.ceil(Math.log2(k+1));
  rankTotalComparisons=Math.max(est,1);
  rankDoneComparisons=0;
  rankMode='active';
  if(container)renderRankInContainer(container);
}

export function rankChoose(which){
  const mid=Math.floor((rankLow+rankHigh)/2);
  if(which==='current')rankHigh=mid-1;
  else rankLow=mid+1;
  rankDoneComparisons++;
  if(rankLow>rankHigh){
    rankSorted.splice(rankLow,0,rankCurrentItem);
    if(rankQueue.length>0){rankCurrentItem=rankQueue.shift();rankLow=0;rankHigh=rankSorted.length-1;}
    else{rankMode='done';recomputeGlazeAffinity();saveAll();}
  }
}

export function rankSkip(){
  const mid=Math.floor((rankLow+rankHigh)/2);
  rankSorted.splice(mid+1,0,rankCurrentItem);
  rankDoneComparisons++;
  if(rankQueue.length>0){rankCurrentItem=rankQueue.shift();rankLow=0;rankHigh=rankSorted.length-1;}
  else{rankMode='done';recomputeGlazeAffinity();saveAll();}
}

export function buildRankCard(m,label){
  const glazes=(m.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
  const opt=document.createElement('div');opt.className='rank-option';
  const lbl=document.createElement('div');lbl.className='rank-option-label';lbl.textContent=label;
  const tileDiv=document.createElement('div');tileDiv.className='rank-option-tile';
  if(glazes.length)tileDiv.innerHTML=pairTileSVG(glazes,clayKey,90);
  const nm=document.createElement('div');nm.className='rank-option-name';nm.textContent=labelStore[m.key]||m.label;
  const gn=document.createElement('div');gn.className='rank-option-glazes';gn.textContent=(m.names||[]).join(' · ');
  opt.appendChild(lbl);opt.appendChild(tileDiv);opt.appendChild(nm);opt.appendChild(gn);
  return opt;
}

// ── VESSEL PREVIEW ────────────────────────────────────────────────────────────
export function openVesselModal(glazes,ck,label){
  const n=glazes.length;
  _vs={shape:'cylinder',direction:'top',stops:n>1?glazes.map((_,i)=>i/(n-1)):[0.5],glazes,ck:ck||clayKey};
  const ov=document.getElementById('vesselModal');if(!ov)return;
  ov.innerHTML='';
  _buildVesselModal(ov,glazes,ck||clayKey,label);
  ov.classList.add('open');
  ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('open');},{once:true});
}

export function _buildVesselModal(ov,glazes,ck,label){
  const modal=document.createElement('div');modal.className='vm-modal';
  const hdr=document.createElement('div');hdr.className='vm-header';
  const ttl=document.createElement('div');ttl.className='vm-title';ttl.textContent=label||'Vessel Preview';
  const xBtn=document.createElement('button');xBtn.className='vm-close';xBtn.textContent='×';xBtn.setAttribute('aria-label','Close');
  xBtn.onclick=()=>ov.classList.remove('open');
  hdr.append(ttl,xBtn);modal.appendChild(hdr);
  const body=document.createElement('div');body.className='vm-body';
  const lft=document.createElement('div');lft.className='vm-left';
  const lftLbl=document.createElement('div');lftLbl.className='vm-panel-label';lftLbl.textContent='Flat tile';
  const sw=document.createElement('div');sw.className='vm-stack-wrap';sw.appendChild(buildStack(glazes,ck,80));
  lft.append(lftLbl,sw);body.appendChild(lft);
  const rgt=document.createElement('div');rgt.className='vm-right';
  const rgtLbl=document.createElement('div');rgtLbl.className='vm-panel-label';rgtLbl.textContent='On vessel';
  rgt.appendChild(rgtLbl);
  const segRow=(items,getVal,setVal,cvs)=>{
    const row=document.createElement('div');row.className='vm-ctrl-row';
    items.forEach(({id,lbl})=>{
      const b=document.createElement('button');b.className='vm-seg-btn'+(id===getVal()?' on':'');b.textContent=lbl;
      b.onclick=()=>{setVal(id);row.querySelectorAll('.vm-seg-btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');_vesselDraw(cvs);};
      row.appendChild(b);
    });
    return row;
  };
  const dpr=window.devicePixelRatio||1,CW=300,CH=336;
  const cvs=document.createElement('canvas');cvs.className='vm-canvas';
  cvs.width=CW*dpr;cvs.height=CH*dpr;cvs.style.width=CW+'px';cvs.style.height=CH+'px';
  rgt.appendChild(segRow(
    [{id:'cylinder',lbl:'Jar'},{id:'squat',lbl:'Squat Jar'},{id:'bowl',lbl:'Bowl'},{id:'plate',lbl:'Plate'}],
    ()=>_vs.shape,v=>_vs.shape=v,cvs
  ));
  rgt.appendChild(segRow(
    [{id:'top',lbl:'↓ Top'},{id:'bottom',lbl:'↑ Bottom'},{id:'horizontal',lbl:'→ Side'}],
    ()=>_vs.direction,v=>_vs.direction=v,cvs
  ));
  rgt.appendChild(segRow(
    [{id:'white',lbl:'White clay'},{id:'red',lbl:'Red clay'}],
    ()=>_vs.ck,v=>_vs.ck=v,cvs
  ));
  rgt.appendChild(cvs);
  if(glazes.length>1){
    const sl=document.createElement('div');sl.className='vm-stop-label';sl.textContent='Gradient stops — drag to adjust';
    rgt.append(sl,_buildStopEditor(glazes,cvs));
  }else{
    const note=document.createElement('div');note.style.cssText='font-size:11px;color:var(--ink3);';
    note.textContent='Single glaze — solid color on vessel.';
    rgt.appendChild(note);
  }
  const expBtn=document.createElement('button');expBtn.className='btn vm-export-btn';expBtn.textContent='Save PNG';
  expBtn.onclick=()=>{
    const a=document.createElement('a');
    a.download=glazes.map(g=>g.name.replace(/\s+/g,'-')).join('_').slice(0,36)+`-${_vs.shape}.png`;
    a.href=cvs.toDataURL('image/png');a.click();
  };
  rgt.appendChild(expBtn);
  body.appendChild(rgt);
  modal.appendChild(body);
  ov.appendChild(modal);
  requestAnimationFrame(()=>_vesselDraw(cvs));
}

export function _buildStopEditor(glazes,cvs){
  const wrap=document.createElement('div');wrap.className='vm-stop-editor';
  const track=document.createElement('div');track.className='vm-stop-track';
  const syncBg=()=>{
    const pts=_vs.stops.map((t,i)=>{const c=applyGlaze(glazes[i],_vs.ck);return`rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)}) ${(t*100).toFixed(1)}%`;});
    track.style.background=`linear-gradient(to right,${pts.join(',')})`;
  };
  glazes.forEach((g,i)=>{
    const h=document.createElement('div');h.className='vm-stop-handle';
    const c=applyGlaze(g,_vs.ck);h.style.background=`rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)})`;
    h.style.left=(_vs.stops[i]*100)+'%';h.title=g.name;
    const move=ex=>{
      const r=track.getBoundingClientRect();
      _vs.stops[i]=Math.max(0,Math.min(1,(ex-r.left)/r.width));
      h.style.left=(_vs.stops[i]*100)+'%';syncBg();_vesselDraw(cvs);
    };
    h.addEventListener('mousedown',e=>{
      e.preventDefault();
      const mv=e2=>move(e2.clientX);
      const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
      document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
    });
    h.addEventListener('touchstart',e=>{
      e.preventDefault();
      const mv=e2=>{e2.preventDefault();move(e2.touches[0].clientX);};
      const up=()=>{h.removeEventListener('touchmove',mv);h.removeEventListener('touchend',up);};
      h.addEventListener('touchmove',mv,{passive:false});h.addEventListener('touchend',up);
    },{passive:false});
    track.appendChild(h);
  });
  syncBg();wrap.appendChild(track);return wrap;
}

export function _vsample(t){
  const{glazes,stops,ck}=_vs;
  if(!glazes.length)return{r:200,gr:200,b:200};
  if(glazes.length===1)return applyGlaze(glazes[0],ck);
  t=Math.max(0,Math.min(1,t));
  const n=stops.length;let i=0;
  while(i<n-2&&stops[i+1]<=t)i++;
  if(i>=n-1)return applyGlaze(glazes[n-1],ck);
  const t0=stops[i],t1=stops[i+1],s=t1>t0?(t-t0)/(t1-t0):0;
  const c0=applyGlaze(glazes[i],ck),c1=applyGlaze(glazes[i+1],ck);
  return{r:c0.r+(c1.r-c0.r)*s,gr:c0.gr+(c1.gr-c0.gr)*s,b:c0.b+(c1.b-c0.b)*s};
}

export function _vfill(g,N,inv){
  for(let i=0;i<=N;i++){let t=i/N;if(inv)t=1-t;const c=_vsample(t);g.addColorStop(i/N,`rgb(${Math.round(c.r)},${Math.round(c.gr)},${Math.round(c.b)})`);}
}

export function _vesselDraw(cvs){
  const dpr=window.devicePixelRatio||1,W=cvs.width/dpr,H=cvs.height/dpr;
  const ctx=cvs.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#f5f3f0';ctx.fillRect(0,0,W,H);
  if(!_vs.glazes||!_vs.glazes.length)return;
  if(_vs.shape==='bowl')_vBowl(ctx,W,H);
  else if(_vs.shape==='plate')_vPlate(ctx,W,H);
  else _vCylinder(ctx,W,H);
}

export function _vCylinder(ctx,W,H){
  const{shape,direction:dir,ck}=_vs;
  const clay=CLAY[ck];
  const pT=38,pB=28,vesH=H-pT-pB,cx=W/2,eH=9,N=28;
  const squat=shape==='squat';
  const pr=yn=>squat?(0.29+0.13*Math.sin(Math.PI*yn))*W:0.31*W;
  const topR=pr(0),botR=pr(1),maxR=squat?pr(0.5):topR;
  const PTS=28;
  const sil=()=>{
    ctx.beginPath();
    ctx.moveTo(cx-topR,pT);
    if(squat){
      for(let i=1;i<=PTS;i++){const yn=i/PTS;ctx.lineTo(cx-pr(yn),pT+yn*vesH);}
    }else{
      ctx.lineTo(cx-botR,pT+vesH);
    }
    ctx.ellipse(cx,pT+vesH,botR,eH,0,Math.PI,0,true);
    if(squat){
      for(let i=PTS-1;i>=0;i--){const yn=i/PTS;ctx.lineTo(cx+pr(yn),pT+yn*vesH);}
    }else{
      ctx.lineTo(cx+topR,pT);
    }
    ctx.ellipse(cx,pT,topR,eH,0,0,Math.PI,true);
    ctx.closePath();
  };
  ctx.save();sil();ctx.fillStyle=clay;ctx.fill();ctx.clip();
  let grd;
  if(dir==='horizontal'){grd=ctx.createLinearGradient(cx-maxR,0,cx+maxR,0);_vfill(grd,N,false);}
  else{grd=ctx.createLinearGradient(0,pT,0,pT+vesH);_vfill(grd,N,dir==='bottom');}
  ctx.fillStyle=grd;sil();ctx.fill();
  const sl=ctx.createLinearGradient(cx-maxR,0,cx-maxR*0.32,0);
  sl.addColorStop(0,'rgba(0,0,0,0.50)');sl.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=sl;sil();ctx.fill();
  const sr=ctx.createLinearGradient(cx+maxR*0.32,0,cx+maxR,0);
  sr.addColorStop(0,'rgba(0,0,0,0)');sr.addColorStop(1,'rgba(0,0,0,0.50)');
  ctx.fillStyle=sr;sil();ctx.fill();
  const hlx=cx-maxR*0.14,hly=pT+vesH*0.15;
  const hl=ctx.createRadialGradient(hlx,hly,0,hlx,hly,maxR*0.74);
  hl.addColorStop(0,'rgba(255,255,255,0.34)');hl.addColorStop(0.42,'rgba(255,255,255,0.06)');hl.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=hl;sil();ctx.fill();
  ctx.restore();
  ctx.save();sil();ctx.strokeStyle='rgba(0,0,0,0.13)';ctx.lineWidth=1;ctx.stroke();
  ctx.beginPath();ctx.ellipse(cx,pT,topR,eH,0,0,Math.PI*2);
  const rg=ctx.createLinearGradient(0,pT-eH,0,pT+eH);
  rg.addColorStop(0,clay+'ee');rg.addColorStop(1,clay+'77');
  ctx.fillStyle=rg;ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.18)';ctx.lineWidth=0.8;ctx.stroke();
  ctx.restore();
}

export function _vBowl(ctx,W,H){
  const{direction:dir,ck}=_vs;
  const clay=CLAY[ck],cx=W/2,cy=H/2,rx=W*0.42,ry=H*0.40,maxR=Math.max(rx,ry),N=28;
  ctx.save();
  ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fillStyle=clay;ctx.fill();ctx.clip();
  let grd;
  if(dir==='horizontal'){
    grd=ctx.createLinearGradient(cx-rx,cy,cx+rx,cy);_vfill(grd,N,false);
  }else{
    grd=ctx.createRadialGradient(cx,cy,0,cx,cy,maxR);_vfill(grd,N,dir==='bottom');
  }
  ctx.fillStyle=grd;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();
  const rs=ctx.createRadialGradient(cx,cy,maxR*0.74,cx,cy,maxR);
  rs.addColorStop(0,'rgba(0,0,0,0)');rs.addColorStop(1,'rgba(0,0,0,0.22)');
  ctx.fillStyle=rs;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();
  const hl=ctx.createRadialGradient(cx-rx*0.14,cy-ry*0.14,0,cx,cy,Math.min(rx,ry)*0.52);
  hl.addColorStop(0,'rgba(255,255,255,0.24)');hl.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=hl;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
  ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=1.5;ctx.stroke();
}

export function _vPlate(ctx,W,H){
  const{direction:dir,ck}=_vs;
  const clay=CLAY[ck],cx=W/2,cy=H/2,rx=W*0.44,ry=H*0.33,maxR=Math.max(rx,ry),N=28;
  ctx.save();
  ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fillStyle=clay;ctx.fill();ctx.clip();
  let grd;
  if(dir==='horizontal'){
    grd=ctx.createLinearGradient(cx-rx,cy,cx+rx,cy);_vfill(grd,N,false);
  }else{
    grd=ctx.createRadialGradient(cx,cy,0,cx,cy,maxR);_vfill(grd,N,dir==='bottom');
  }
  ctx.fillStyle=grd;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();
  const ws=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.min(rx,ry)*0.28);
  ws.addColorStop(0,'rgba(0,0,0,0.12)');ws.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=ws;ctx.beginPath();ctx.ellipse(cx,cy,rx*0.28,ry*0.28,0,0,Math.PI*2);ctx.fill();
  const rs=ctx.createRadialGradient(cx,cy,maxR*0.77,cx,cy,maxR);
  rs.addColorStop(0,'rgba(0,0,0,0)');rs.addColorStop(1,'rgba(0,0,0,0.19)');
  ctx.fillStyle=rs;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
  ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.strokeStyle='rgba(0,0,0,0.12)';ctx.lineWidth=1.5;ctx.stroke();
}

// ── COMPOSITION CANVAS (copy/paste-to-pair + multi-select "Compose columns") ──
// Composition state tracks palette objects in fixed, pre-allocated slots (not
// just keys — matches how _resolvePaletteByKey/likedMeta already carry full
// palette data) so both the right-click copy/paste flow and the multi-select
// "Compose columns" entry point can share one modal instance.
const COMP_COUNTS = [4, 8, 12, 16]; // mirrors the gallery's tile-division config (4/8/12/16)

let _copiedPaletteKey = null;
let _copiedPaletteObj = null;
export let compositionOpen = false;
let _compCount = COMP_COUNTS[0];
let _compSlots = new Array(_compCount).fill(null);
let _compColWidths = [];

export function copyPaletteForComposition(p) {
  document.querySelectorAll('.comp-copy-badge').forEach(b => b.remove());
  _copiedPaletteKey = p.key;
  _copiedPaletteObj = p;
  const card = document.querySelector(`.card[data-key="${p.key}"]`);
  if (card) {
    const badge = document.createElement('span');
    badge.className = 'comp-copy-badge';
    badge.textContent = 'Copied';
    card.appendChild(badge);
  }
  showToast('Copied — right-click another palette and choose "Paste as pair here".');
}

export function pasteAsPairComposition(p) {
  if (!_copiedPaletteObj || _copiedPaletteKey === p.key) return;
  document.querySelectorAll('.comp-copy-badge').forEach(b => b.remove());
  const first = _copiedPaletteObj;
  _copiedPaletteKey = null; _copiedPaletteObj = null;
  openCompositionModal([first, p]);
}

// Seeds the pre-allocated slots from an array of full palette objects (used by
// both "Paste as pair here" and the multi-select "Compose columns" button).
export function openCompositionModal(paletteObjs) {
  const srcs = (paletteObjs || []).filter(p => p && p.glazes && p.glazes.length);
  if (!srcs.length) return;
  _compCount = COMP_COUNTS.find(n => n >= srcs.length) || COMP_COUNTS[COMP_COUNTS.length - 1];
  _compSlots = new Array(_compCount).fill(null);
  srcs.slice(0, _compCount).forEach((p, i) => { _compSlots[i] = p; });
  _compColWidths = [];
  compositionOpen = true;
  _renderCompositionModal();
}

export function addToComposition(p) {
  if (!compositionOpen) return;
  if (_compSlots.some(s => s && s.key === p.key)) { showToast('Already in this composition'); return; }
  const idx = _compSlots.findIndex(s => !s);
  if (idx === -1) { showToast('Composition is full'); return; }
  _compSlots[idx] = p;
  _renderCompositionModal();
}

export function clearComposition() {
  _compSlots = new Array(_compCount).fill(null);
  _compColWidths = [];
  if (compositionOpen) _renderCompositionModal();
}

export function closeCompositionModal() {
  compositionOpen = false;
  document.getElementById('compositionModal')?.classList.remove('open');
}

function _setCompCount(n) {
  const willDrop = _compSlots.slice(n).filter(Boolean).length;
  const apply = () => {
    const kept = _compSlots.slice(0, n);
    while (kept.length < n) kept.push(null);
    _compSlots = kept;
    _compCount = n;
    _compColWidths = [];
    _renderCompositionModal();
  };
  if (willDrop) confirmSheet(`Reducing to ${n} columns will remove ${willDrop} filled palette${willDrop === 1 ? '' : 's'} from the composition.`, 'Reduce columns', apply);
  else apply();
}

function _startDividerDrag(e, i) {
  e.preventDefault();
  const cols = document.querySelectorAll('#compositionModal .comp-col');
  const colA = cols[i], colB = cols[i + 1];
  if (!colA || !colB) return;
  const startX = e.clientX;
  const rectA = colA.getBoundingClientRect(), rectB = colB.getBoundingClientRect();
  const totalPx = rectA.width + rectB.width;
  const startA = _compColWidths[i], startB = _compColWidths[i + 1];
  const totalPct = startA + startB;
  const onMove = ev => {
    const dxPct = ((ev.clientX - startX) / totalPx) * totalPct;
    const a = Math.max(8, Math.min(totalPct - 8, startA + dxPct));
    const b = totalPct - a;
    _compColWidths[i] = a; _compColWidths[i + 1] = b;
    colA.style.flex = `${a} ${a} 0`;
    colB.style.flex = `${b} ${b} 0`;
  };
  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function _renderCompositionModal() {
  const overlay = document.getElementById('compositionModal');
  if (!overlay) return;
  overlay.classList.add('open');
  overlay.innerHTML = '';

  if (_compColWidths.length !== _compCount) _compColWidths = new Array(_compCount).fill(100 / _compCount);

  const modal = document.createElement('div'); modal.className = 'comp-modal';

  const header = document.createElement('div'); header.className = 'comp-header';
  const title = document.createElement('div'); title.className = 'comp-title';
  title.textContent = `Composition (${_compSlots.filter(Boolean).length}/${_compCount})`;
  const countRow = document.createElement('div'); countRow.className = 'comp-col-count';
  COMP_COUNTS.forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'comp-count-btn' + (n === _compCount ? ' on' : '');
    btn.textContent = String(n);
    btn.addEventListener('click', () => _setCompCount(n));
    countRow.appendChild(btn);
  });
  const closeBtn = document.createElement('button'); closeBtn.className = 'comp-close'; closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeCompositionModal);
  header.appendChild(title); header.appendChild(countRow); header.appendChild(closeBtn);

  const body = document.createElement('div'); body.className = 'comp-body';
  const columns = document.createElement('div'); columns.className = 'comp-columns';

  _compSlots.forEach((p, i) => {
    const col = document.createElement('div');
    col.className = 'comp-col' + (p ? '' : ' comp-col-empty');
    col.style.flex = `${_compColWidths[i]} ${_compColWidths[i]} 0`;
    if (p) {
      col.appendChild(buildStack(p.glazes, clayKey, TH));
      const label = document.createElement('div'); label.className = 'comp-col-label';
      label.textContent = labelStore[p.key] || p.label;
      col.appendChild(label);
    } else {
      const ph = document.createElement('div'); ph.className = 'comp-col-empty-label';
      ph.textContent = 'Right-click a palette → Add to composition';
      col.appendChild(ph);
    }
    columns.appendChild(col);
    if (i < _compSlots.length - 1) {
      const divider = document.createElement('div'); divider.className = 'comp-divider';
      divider.addEventListener('pointerdown', ev => _startDividerDrag(ev, i));
      columns.appendChild(divider);
    }
  });

  body.appendChild(columns);

  const footer = document.createElement('div'); footer.className = 'comp-footer';
  const clearBtn = document.createElement('button'); clearBtn.className = 'btn danger'; clearBtn.textContent = 'Clear composition';
  clearBtn.addEventListener('click', () => {
    if (_compSlots.some(Boolean)) confirmSheet('Remove all palettes from this composition?', 'Clear composition', clearComposition);
  });
  const saveBtn = document.createElement('button'); saveBtn.className = 'btn primary'; saveBtn.textContent = 'Save as board';
  saveBtn.addEventListener('click', saveCompositionAsBoard);
  footer.appendChild(clearBtn); footer.appendChild(saveBtn);

  modal.appendChild(header); modal.appendChild(body); modal.appendChild(footer);
  overlay.appendChild(modal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeCompositionModal(); }, { once: true });
}

// Reuses the exact board-creation path from createNewProject/buildBoardDropdown
// (projects.push + likedKeys/likedMeta + saveAll) rather than a new persistence layer.
export function saveCompositionAsBoard() {
  const filled = _compSlots.filter(Boolean);
  if (!filled.length) { showToast('Composition is empty'); return; }
  promptSheet('Name this board:', 'Composition', 'Save as board', name => {
    const newId = mkid();
    const proj = { id: newId, name, leverState: { ...levers }, scorePreset: 'Balanced' };
    projects.push(proj);
    filled.forEach(p => {
      likedKeys.add(p.key);
      let meta = likedMeta.find(m => m.key === p.key);
      if (!meta) {
        meta = { key: p.key, label: labelStore[p.key] || p.label, feeling: '', tag: p.tag, names: p.glazes.map(g => g.name), hexes: p.glazes.map(g => g.hex), projectId: newId };
        likedMeta.push(meta);
      } else {
        meta.projectId = newId;
      }
    });
    saveAll(); renderSidebar(); renderTopbarTabs(); updateCount();
    showToast(`Saved as board "${name}"`);
    closeCompositionModal();
  });
}

// ── SECTION OBSERVER ──────────────────────────────────────────────────────────
export function initSectionObserver(){
  const mainEl=document.getElementById('mainContent');
  if(!mainEl||!('IntersectionObserver' in window))return;
  const saved=document.getElementById('savedSection');
  const disc=document.getElementById('discoverHead');
  if(!saved||!disc)return;
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      const id=entry.target.id;
      if(id==='savedSection'){
        const js = document.getElementById('jumpSaved');
        if (js) js.classList.toggle('active', entry.isIntersecting);
      }else if(id==='discoverHead'){
        const jd = document.getElementById('jumpDiscover');
        if (jd) jd.classList.toggle('active', entry.isIntersecting);
      }
    });
  },{root:mainEl,threshold:0.1});
  obs.observe(saved);obs.observe(disc);
}

export function initHorizontalSwipe(){
  const mainEl=document.getElementById('mainContent');
  if(!mainEl)return;
  let sx=0,sy=0;
  mainEl.addEventListener('touchstart',e=>{
    sx=e.touches[0].clientX;sy=e.touches[0].clientY;
  },{passive:true});
  mainEl.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-sx;
    const dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)<40||Math.abs(dx)<Math.abs(dy)*1.2)return; // too short or too vertical
    if(dx<0){
      // swipe left → Discover
      document.getElementById('discoverHead')?.scrollIntoView({behavior:'smooth'});
    }else{
      // swipe right → Saved
      document.getElementById('savedSection')?.scrollIntoView({behavior:'smooth'});
    }
  },{passive:true});
}

// ── KEYBOARD NAVIGATION & SHEETS ──────────────────────────────────────────────
export function moveFocusToCard(dir) {
  const cards = [...document.querySelectorAll('#gallery .card')];
  if (!cards.length) return;
  const idx = _focusedCardKey
    ? cards.findIndex(c => c.dataset.key === _focusedCardKey)
    : -1;
  const next = Math.max(0, Math.min(cards.length - 1, idx + dir));
  const nextCard = cards[next];
  if (!nextCard) return;
  _focusedCardKey = nextCard.dataset.key;
  cards.forEach(c => c.classList.remove('card-kb-focus'));
  nextCard.classList.add('card-kb-focus');
  nextCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function openShortcutOverlay(){
  document.getElementById('shortcutOverlay')?.classList.add('open');
}

export function closeShortcutOverlay(){
  document.getElementById('shortcutOverlay')?.classList.remove('open');
}

export function openSheet(name) {
  closeSheet();
  clearMultiSelect?.();
  const backdrop = document.getElementById('sheetBackdrop');
  const sheet = document.getElementById('sheet' + name.charAt(0).toUpperCase() + name.slice(1));
  if (!sheet) return;
  _activeSheet = sheet;

  if (name === 'controls') {
    const body = document.getElementById('sheetControlsBody');
    const sidebar = document.getElementById('rightSidebar');
    if (body && sidebar) {
      while (sidebar.firstChild) body.appendChild(sidebar.firstChild);
      sheet._contentSource = sidebar;
      sheet._contentBody = body;
    }
    setControlsSection('clay');
  }
  if (name === 'boards') {
    renderBoardSwitcher();
    const body = document.getElementById('sheetBoardsBody');
    const sbScroll = document.getElementById('sbScroll');
    if (body && sbScroll) {
      while (sbScroll.firstChild) body.appendChild(sbScroll.firstChild);
      sheet._contentSource = sbScroll;
      sheet._contentBody = body;
    }
  }

  backdrop?.classList.add('open');
  sheet.classList.add('open');

  let startY = 0, lastY = 0, lastT = 0, dragging = false;

  const onTouchStart = e => {
    // Only start drag from handle area or within top 60px of sheet
    const touch = e.touches[0];
    const rect = sheet.getBoundingClientRect();
    if (touch.clientY - rect.top > 60) return;
    startY = lastY = touch.clientY;
    lastT = Date.now();
    dragging = true;
    sheet.style.transition = 'none';
  };

  const onTouchMove = e => {
    if (!dragging) return;
    const touch = e.touches[0];
    const dy = touch.clientY - startY;
    if (dy > 0) {
      sheet.style.transform = `translateY(${dy}px)`;
      if (backdrop) backdrop.style.opacity = Math.max(0, 1 - dy / 300);
    }
    lastY = touch.clientY;
    lastT = Date.now();
  };

  const onTouchEnd = e => {
    if (!dragging) return;
    dragging = false;
    const dy = lastY - startY;
    const dt = Date.now() - lastT;
    const velocity = dt > 0 ? dy / dt : 0; // px/ms
    sheet.style.transition = '';
    if (backdrop) backdrop.style.opacity = '';
    if (dy > 120 || velocity > 0.4) {
      closeSheet();
    } else {
      sheet.style.transform = '';
    }
  };

  sheet.addEventListener('touchstart', onTouchStart, {passive:true});
  sheet.addEventListener('touchmove', onTouchMove, {passive:true});
  sheet.addEventListener('touchend', onTouchEnd, {passive:true});
  sheet._onTouchStart = onTouchStart;
  sheet._onTouchMove = onTouchMove;
  sheet._onTouchEnd = onTouchEnd;
}

export function closeSheet() {
  if (_activeSheet) {
    if (_activeSheet._contentSource && _activeSheet._contentBody) {
      const body = _activeSheet._contentBody;
      const source = _activeSheet._contentSource;
      while (body.firstChild) source.appendChild(body.firstChild);
      _activeSheet._contentSource = null;
      _activeSheet._contentBody = null;
    }
    if (_activeSheet._onTouchStart) _activeSheet.removeEventListener('touchstart', _activeSheet._onTouchStart);
    if (_activeSheet._onTouchMove) _activeSheet.removeEventListener('touchmove', _activeSheet._onTouchMove);
    if (_activeSheet._onTouchEnd) _activeSheet.removeEventListener('touchend', _activeSheet._onTouchEnd);
    _activeSheet.style.transform = '';
    _activeSheet.style.transition = '';
    _activeSheet.classList.remove('open');
    _activeSheet = null;
  }
  document.getElementById('sheetBackdrop')?.classList.remove('open');
}

// Mobile Controls sheet shows one section at a time (CapCut-style header nav)
// so the gallery stays visible behind it instead of a single tall scrolling list.
export function setControlsSection(sec){
  const sheet=document.getElementById('sheetControls');if(!sheet)return;
  sheet.querySelectorAll('[data-sec]').forEach(el=>el.classList.toggle('active-sec',el.dataset.sec===sec));
  sheet.querySelectorAll('.cs-tab').forEach(b=>b.classList.toggle('on',b.dataset.sec===sec));
}

// ── DIALOG SHEETS (replace native confirm/prompt on mobile) ──────────────────

function _dialogSheet(html, onMount) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop open';
  backdrop.style.zIndex = '310';
  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet open dialog-sheet';
  sheet.style.cssText = window.innerWidth > 700
    ? 'top:50%;left:50%;bottom:auto;right:auto;transform:translate(-50%,-50%);width:380px;max-width:90vw;max-height:none;border-radius:var(--r);z-index:320;'
    : 'top:auto;max-height:50vh;z-index:320;';
  sheet.innerHTML = `<div class="sheet-handle"></div>${html}`;
  const dismiss = () => { backdrop.remove(); sheet.remove(); };
  backdrop.addEventListener('click', dismiss);
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  onMount(sheet, dismiss);
}

export function confirmSheet(message, title, onConfirm) {
  _dialogSheet(
    `<div class="sheet-header"><span class="sheet-title">${title||'Confirm'}</span></div>
     <div style="padding:0 16px 12px;color:var(--ink2);font-size:14px;">${message}</div>
     <div style="display:flex;gap:8px;padding:0 16px 32px;">
       <button class="ds-btn ds-cancel" style="flex:1;">Cancel</button>
       <button class="ds-btn ds-confirm danger" style="flex:1;">Delete</button>
     </div>`,
    (sheet, dismiss) => {
      sheet.querySelector('.ds-cancel').addEventListener('click', dismiss);
      sheet.querySelector('.ds-confirm').addEventListener('click', () => { dismiss(); onConfirm(); });
    }
  );
}

export function promptSheet(message, defaultVal, title, onSave) {
  _dialogSheet(
    `<div class="sheet-header"><span class="sheet-title">${title||'Rename'}</span></div>
     <div style="padding:0 16px 12px;">
       <input class="ds-input" value="${(defaultVal||'').replace(/"/g,'&quot;')}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r);font-size:15px;font-family:var(--font);background:var(--surf);color:var(--ink);">
     </div>
     <div style="display:flex;gap:8px;padding:0 16px 32px;">
       <button class="ds-btn ds-cancel" style="flex:1;">Cancel</button>
       <button class="ds-btn ds-save" style="flex:1;">Save</button>
     </div>`,
    (sheet, dismiss) => {
      const input = sheet.querySelector('.ds-input');
      input.focus(); input.select();
      sheet.querySelector('.ds-cancel').addEventListener('click', dismiss);
      sheet.querySelector('.ds-save').addEventListener('click', () => {
        const val = input.value.trim();
        if (val) { dismiss(); onSave(val); }
      });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') sheet.querySelector('.ds-save').click(); });
    }
  );
}

// ── CONTEXT MENU ─────────────────────────────────────────────────────────────
export function closeCtxMenu() {
  if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; }
  document.querySelectorAll('.ctx-submenu').forEach(s => s.remove());
}

export function openCtxMenu(e, p) {
  e.preventDefault();
  closeCtxMenu();

  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  _ctxMenu = menu;

  const addItem = (label, action, isDanger) => {
    const item = document.createElement('div');
    item.className = 'ctx-item' + (isDanger ? ' danger' : '');
    item.textContent = label;
    item.addEventListener('click', () => { closeCtxMenu(); action(); });
    menu.appendChild(item);
    return item;
  };

  const addDivider = () => {
    const d = document.createElement('div');
    d.className = 'ctx-divider';
    menu.appendChild(d);
  };

  if (projects.length) {
    const saveItem = document.createElement('div');
    saveItem.className = 'ctx-item';
    saveItem.textContent = 'Save to board ▶';
    saveItem.addEventListener('mouseenter', () => {
      document.querySelectorAll('.ctx-submenu').forEach(s => s.remove());
      const sub = document.createElement('div');
      sub.className = 'ctx-submenu';
      projects.forEach(proj => {
        const pi = document.createElement('div');
        pi.className = 'ctx-item';
        pi.textContent = proj.name;
        pi.addEventListener('click', () => {
          closeCtxMenu();
          if (!likedKeys.has(p.key)) {
            likedKeys.add(p.key);
            if (!likedMeta.find(m => m.key === p.key))
              likedMeta.push({ key: p.key, label: p.label, feeling: '', tag: p.tag, names: p.glazes.map(g => g.name), hexes: p.glazes.map(g => g.hex), projectId: proj.id });
            else likedMeta.find(m => m.key === p.key).projectId = proj.id;
          } else {
            const meta = likedMeta.find(m => m.key === p.key);
            if (meta) meta.projectId = proj.id;
          }
          saveAll(); renderSidebar(); renderTopbarTabs(); updateCount();
          showToast(`Saved to "${proj.name}"`);
        });
        sub.appendChild(pi);
      });
      const r = saveItem.getBoundingClientRect();
      sub.style.top = r.top + 'px';
      sub.style.left = (r.right + 2) + 'px';
      document.body.appendChild(sub);
      requestAnimationFrame(() => {
        if (sub.getBoundingClientRect().right > window.innerWidth - 8) {
          sub.style.left = (r.left - sub.offsetWidth - 2) + 'px';
        }
      });
    });
    menu.appendChild(saveItem);
    addDivider();
  }

  addItem('Riff on this', () => {
    palettes = doRiff(p);
    if (currentTab !== 'explore') setTab('explore');
    renderGallery();
    document.getElementById('discoverHead')?.scrollIntoView({ behavior: 'smooth' });
  });

  addItem('Copy glaze names', () => {
    const text = p.glazes.map(g => g.name).join(', ');
    navigator.clipboard?.writeText(text).then(() => showToast('Copied!')).catch(() => showToast('Copy failed'));
  });

  addDivider();

  addItem('Copy palette', () => copyPaletteForComposition(p));

  const pasteItem = addItem('Paste as pair here', () => pasteAsPairComposition(p));
  if (!_copiedPaletteKey || _copiedPaletteKey === p.key) pasteItem.classList.add('disabled');

  const addToCompItem = addItem('Add to composition', () => addToComposition(p));
  if (!compositionOpen || _compSlots.some(s => s && s.key === p.key) || !_compSlots.some(s => !s))
    addToCompItem.classList.add('disabled');

  const clearCompItem = addItem('Clear composition', () => {
    if (_compSlots.some(Boolean)) confirmSheet('Remove all palettes from this composition?', 'Clear composition', clearComposition);
  }, true);
  if (!_compSlots.some(Boolean)) clearCompItem.classList.add('disabled');

  addDivider();

  addItem('Remove from discover', () => {
    palettes = palettes.filter(x => x.key !== p.key);
    renderGallery();
  }, false);

  document.body.appendChild(menu);
  let x = e.clientX, y = e.clientY;
  requestAnimationFrame(() => {
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    if (x + mw > window.innerWidth - 8) x = window.innerWidth - mw - 8;
    if (y + mh > window.innerHeight - 8) y = window.innerHeight - mh - 8;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  });
}
