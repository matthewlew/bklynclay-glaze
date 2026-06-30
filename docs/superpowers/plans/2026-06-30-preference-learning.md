# Phase 2: Preference Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pairwise palette comparison UI, logistic-regression weight fitting from user feedback, and personalized score display to BklynClay Glaze Studio.

**Architecture:** All logic lives in the single `index.html` file. Feature data (`featureVector`) is extracted from `scoreAesthetic`'s internal calculations, then used in vanilla-JS gradient descent to produce `learnedWeights` stored in `localStorage`. A modal overlay handles comparisons; `scoreAesthetic` is patched to check for learned weights at call time.

**Tech Stack:** Vanilla JS, CSS custom properties, `localStorage` (key `bklyn_v6`), no build step.

---

## File Map

| File | Change |
|------|--------|
| `index.html` (CSS section ~line 1–640) | Add styles for comparison modal, calibrate button, personalized badge |
| `index.html` (JS ~line 850–920) | Extract `featureVector()`, patch `scoreAesthetic()` to use learned weights |
| `index.html` (JS new section after line 920) | Add `openCalibrate()`, `renderComparePair()`, `recordPair()`, `fitWeights()`, `spearmanRho()` |
| `index.html` (JS ~line 1270–1280) | Update score badge tooltip to say "Personalized score" when learned weights exist |
| `index.html` (JS ~line 1770–1780) | Patch `saveAll()` / load to persist `pairs` and `learnedWeights` |
| `index.html` (HTML ~discover header section) | Add "Calibrate" button near `#scoreSortBtn` |

---

## Task 1: Extract `featureVector()` from `scoreAesthetic()`

**Files:**
- Modify: `index.html` around line 882–919

Currently `scoreAesthetic` computes f1–f7 inline and returns a single score. We need those raw feature values accessible for logistic regression. Extract them into a shared helper.

- [ ] **Step 1: Add `featureVector(glazes)` function immediately before `scoreAesthetic` (~line 882)**

Insert after the `harmonyScore` function closing brace (around line 881), before line 882:

```javascript
// Returns raw [f1,f2,f3,f4,f5,f6,f7] feature values (0-1 each) for a palette.
function featureVector(glazes){
  if(!glazes||glazes.length<2)return [0,0,0,0,0,0,0];
  const n=glazes.length;
  const lums=glazes.map(g=>g.lum);
  const sats=glazes.map(g=>g.sat);
  const uniqueGlazes=glazes.filter((g,i)=>glazes.findIndex(x=>x.name===g.name)===i);
  const isBanding=uniqueGlazes.length<n;
  const satMean=sats.reduce((a,b)=>a+b,0)/n;
  const satSig=Math.sqrt(sats.map(s=>(s-satMean)**2).reduce((a,b)=>a+b,0)/n);
  const f1=Math.min(1,satSig/0.22);
  const lumR=Math.max(...lums)-Math.min(...lums);
  const f2base=lumR<0.15?lumR/0.15*0.4:lumR>0.85?Math.max(0.7,1-(lumR-0.85)/0.15):0.4+Math.min(0.6,(lumR-0.15)/0.55);
  const f2=isBanding?Math.max(f2base,0.55):f2base;
  const lumMean=lums.reduce((a,b)=>a+b,0)/n;
  const f3=Math.max(0,1-Math.abs(lumMean-0.47)*(isBanding?1.5:3.0));
  const f4pool=uniqueGlazes.length>=2?uniqueGlazes:glazes;
  let minDist=Infinity;
  for(let i=0;i<f4pool.length;i++)for(let j=i+1;j<f4pool.length;j++){
    const d=hd(f4pool[i].hue,f4pool[j].hue)/180*0.35+Math.abs(f4pool[i].lum-f4pool[j].lum)*0.45+Math.abs(f4pool[i].sat-f4pool[j].sat)*0.20;
    if(d<minDist)minDist=d;
  }
  const f4=minDist>=0.10?1.0:Math.pow(minDist/0.10,2);
  const f5=harmonyScore(glazes.map(g=>g.hue));
  const finTypes=new Set(glazes.map(g=>g.fin==='transparent'?'clear':g.fin.startsWith('crawl')?'texture':g.fin));
  const f6=finTypes.size>=2?1:0.5;
  const achromaticCount=glazes.filter(g=>g.sat<0.10).length;
  const f7=achromaticCount<=1?1.0:Math.max(0.3,1-(achromaticCount-1)*0.35);
  return [f1,f2,f3,f4,f5,f6,f7];
}
```

- [ ] **Step 2: Rewrite `scoreAesthetic` to use `featureVector` + learned weights**

Replace the existing `scoreAesthetic` function body (lines 882–919) with:

```javascript
function scoreAesthetic(glazes){
  if(!glazes||glazes.length<2)return 0;
  const fv=featureVector(glazes);
  const [f1,f2,f3,f4,f5,f6,f7]=fv;
  const w=learnedWeights||[0.18,0.15,0.17,0.25,0.07,0.05,0.13];
  return Math.round((f1*w[0]+f2*w[1]+f3*w[2]+f4*w[3]+f5*w[4]+f6*w[5]+f7*w[6])*100);
}
```

Note: `learnedWeights` is a module-level variable (null initially) declared in Task 2.

- [ ] **Step 3: Open the file in the browser (`open index.html`) and verify the ★ badges still show numbers on palette cards — no change in behavior yet.**

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "refactor: extract featureVector() helper, scoreAesthetic reads learnedWeights"
```

---

## Task 2: localStorage persistence for `pairs` and `learnedWeights`

**Files:**
- Modify: `index.html` around line 640–650 (global vars) and line 1770–1815 (saveAll/load)

- [ ] **Step 1: Declare module-level vars near other globals (~line 644)**

Find `let likedMeta    = [];` and add immediately after:

```javascript
let compPairs      = [];   // [{a, b, winner, ts}]
let learnedWeights = null; // [w1..w7] or null
```

- [ ] **Step 2: Update `saveAll()` to persist the new fields**

Find this line in `saveAll` (~line 1772):
```javascript
  try{localStorage.setItem('bklyn_v6',JSON.stringify({keys:[...likedKeys],meta:likedMeta,projects,labels:labelStore,rankState}));}catch(e){}
```

Replace with:
```javascript
  try{localStorage.setItem('bklyn_v6',JSON.stringify({keys:[...likedKeys],meta:likedMeta,projects,labels:labelStore,rankState,pairs:compPairs,learnedWeights}));}catch(e){}
```

- [ ] **Step 3: Update the load block to restore `pairs` and `learnedWeights`**

Find the load block (~line 1777):
```javascript
  try{const r=localStorage.getItem('bklyn_v6');if(r){const d=JSON.parse(r);likedKeys=new Set(d.keys||[]);likedMeta=d.meta||[];projects=d.projects||[];labelStore=d.labels||{};
```

After the line that restores `labelStore` (and before the `rankState` block), add:
```javascript
    compPairs=d.pairs||[];
    learnedWeights=d.learnedWeights||null;
```

Also find the export/import block (~line 1790–1813) that has a second JSON.stringify with the same fields and apply the same additions there.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: persist compPairs and learnedWeights in bklyn_v6 localStorage"
```

---

## Task 3: Calibrate button in the Discover header

**Files:**
- Modify: `index.html` HTML section — the discover header containing `#scoreSortBtn`

- [ ] **Step 1: Find `#scoreSortBtn` in the HTML (search for `id="scoreSortBtn"`)**

The button is inside a `discoverHead` div. Add a "Calibrate" button right after it:

```html
<button class="btn xs" id="calibrateBtn" onclick="openCalibrate()" title="Run pairwise comparisons to personalize scores">Calibrate</button>
```

- [ ] **Step 2: Add CSS for the comparison modal (in the `<style>` block, after existing modal styles)**

Search for existing `.modal` styles or add near the end of the `<style>` block (before `</style>`):

```css
/* ── COMPARISON MODAL ─────────────────────────────── */
#compareOverlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:900;display:flex;align-items:center;justify-content:center;padding:16px;}
.compare-box{background:var(--bg);border-radius:12px;padding:24px;width:min(720px,96vw);box-shadow:0 8px 40px rgba(0,0,0,.35);}
.compare-header{font-size:13px;font-weight:700;text-align:center;color:var(--ink2);margin-bottom:18px;}
.compare-progress{font-size:11px;color:var(--ink3);text-align:center;margin-top:-10px;margin-bottom:16px;}
.compare-pair{display:flex;gap:16px;justify-content:center;}
.compare-card{flex:1;max-width:280px;cursor:pointer;border:2px solid transparent;border-radius:10px;overflow:hidden;transition:border-color .15s,transform .1s;}
.compare-card:hover{border-color:var(--accent);transform:translateY(-2px);}
.compare-card .compare-swatch{height:120px;border-radius:8px 8px 0 0;}
.compare-card .compare-label{padding:10px 12px;font-size:12px;font-weight:600;color:var(--ink1);background:var(--bg2);border-radius:0 0 8px 8px;}
.compare-card .compare-glazes{font-size:10px;color:var(--ink3);padding:0 12px 8px;background:var(--bg2);}
.compare-skip{display:block;margin:14px auto 0;font-size:11px;color:var(--ink3);background:none;border:none;cursor:pointer;text-decoration:underline;}
.compare-done-msg{text-align:center;padding:24px 0;}
.compare-done-msg h3{font-size:16px;margin-bottom:8px;}
.compare-done-msg p{font-size:12px;color:var(--ink2);margin-bottom:16px;}
.calibrate-badge{font-size:9px;background:var(--accent);color:#fff;border-radius:4px;padding:1px 4px;margin-left:4px;vertical-align:middle;}
```

- [ ] **Step 3: Update the `#calibrateBtn` to show a badge when learned weights exist — add a helper called after load**

In `saveAll()` or immediately after the load block, call an update function. Add at the end of the load block (~line 1780):

```javascript
updateCalibrateBtn();
```

And define the function near the other UI helpers:

```javascript
function updateCalibrateBtn(){
  const btn=document.getElementById('calibrateBtn');if(!btn)return;
  const existing=btn.querySelector('.calibrate-badge');
  if(learnedWeights){
    if(!existing){const b=document.createElement('span');b.className='calibrate-badge';b.textContent='✓';btn.appendChild(b);}
  } else {
    if(existing)existing.remove();
  }
}
```

- [ ] **Step 4: Reload the browser and verify the "Calibrate" button appears in the Discover header. Clicking it should not crash (function not defined yet is OK — we add it in Task 4).**

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add Calibrate button and comparison modal CSS"
```

---

## Task 4: Comparison modal — `openCalibrate()` and `renderComparePair()`

**Files:**
- Modify: `index.html` — add JS functions and modal HTML

- [ ] **Step 1: Add the modal HTML to `<body>` (right before the closing `</body>` tag)**

```html
<div id="compareOverlay" style="display:none" role="dialog" aria-modal="true" aria-label="Palette preference comparison">
  <div class="compare-box" id="compareBox"></div>
</div>
```

- [ ] **Step 2: Add `openCalibrate()` function in JS (add after the `updateCalibrateBtn` function from Task 3)**

```javascript
function openCalibrate(){
  const candidates=likedMeta.filter(m=>(m.names||[]).length>=2);
  if(candidates.length<2){showToast('Pin at least 2 palettes to calibrate.');return;}
  document.getElementById('compareOverlay').style.display='flex';
  renderComparePair(candidates);
}

function closeCalibrate(){
  document.getElementById('compareOverlay').style.display='none';
}
```

- [ ] **Step 3: Add `renderComparePair(candidates)` function**

This renders one comparison round. It picks two candidates with similar `scoreAesthetic` (within ~10 pts) from those not yet well-compared, falling back to random if no close pair exists.

```javascript
function renderComparePair(candidates){
  const box=document.getElementById('compareBox');
  const total=Math.min(30,candidates.length*(candidates.length-1)/2);
  const done=compPairs.length;

  if(done>=25){
    // Enough data — fit and show result
    fitWeights();
    const rho=spearmanRho();
    box.innerHTML=`<div class="compare-done-msg">
      <h3>Calibration complete</h3>
      <p>Based on ${done} comparisons.<br>Rank agreement (ρ): <strong>${rho.toFixed(2)}</strong>${rho>=0.65?' 🎉':''}</p>
      <button class="btn" onclick="closeCalibrate();renderGallery();">Apply personalized scores</button>
      <button class="btn" style="margin-left:8px" onclick="resetLearnedWeights()">Reset to default</button>
    </div>`;
    updateCalibrateBtn();
    return;
  }

  // Pick pair: prefer similar scores, avoid already-compared pairs
  const alreadyPaired=new Set(compPairs.map(p=>p.a+'|'+p.b).concat(compPairs.map(p=>p.b+'|'+p.a)));
  const scored=candidates.map(m=>{
    const glazes=(m.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
    return{m,score:scoreAesthetic(glazes),glazes};
  }).filter(x=>x.glazes.length>=2);
  scored.sort((a,b)=>a.score-b.score);

  let pA=null,pB=null;
  // Find closest-score pair not already compared
  outer: for(let i=0;i<scored.length-1;i++){
    for(let j=i+1;j<scored.length;j++){
      const key=scored[i].m.key+'|'+scored[j].m.key;
      if(!alreadyPaired.has(key)){pA=scored[i];pB=scored[j];break outer;}
    }
  }
  if(!pA){showToast('All pairs compared!');fitWeights();closeCalibrate();renderGallery();return;}

  const makeCard=(side)=>{
    const glazes=side.glazes;
    const swatch=document.createElement('div');swatch.className='compare-swatch';swatch.style.background=glazeCSS(glazes);
    const label=document.createElement('div');label.className='compare-label';
    label.textContent=labelStore[side.m.key]||side.m.label||'Palette';
    const glazeNames=document.createElement('div');glazeNames.className='compare-glazes';
    glazeNames.textContent=(side.m.names||[]).join(' · ');
    const card=document.createElement('div');card.className='compare-card';
    card.appendChild(swatch);card.appendChild(label);card.appendChild(glazeNames);
    return card;
  };

  box.innerHTML='';
  const header=document.createElement('div');header.className='compare-header';
  header.textContent='Which palette do you prefer for your pottery?';
  const progress=document.createElement('div');progress.className='compare-progress';
  progress.textContent=`Comparison ${done+1} of ~${Math.min(30,total)} · ${done>=25?'Ready to fit!':''}`;

  const pair=document.createElement('div');pair.className='compare-pair';
  const cardA=makeCard(pA);const cardB=makeCard(pB);

  cardA.addEventListener('click',()=>recordPair(pA.m.key,pB.m.key,'a',candidates));
  cardB.addEventListener('click',()=>recordPair(pA.m.key,pB.m.key,'b',candidates));

  pair.appendChild(cardA);pair.appendChild(cardB);

  const skip=document.createElement('button');skip.className='compare-skip';
  skip.textContent='Skip this pair';
  skip.addEventListener('click',()=>{
    // Mark as "seen" without recording preference by pushing a skip marker
    compPairs.push({a:pA.m.key,b:pB.m.key,winner:'skip',ts:Date.now()});
    saveAll();renderComparePair(candidates);
  });

  box.appendChild(header);box.appendChild(progress);box.appendChild(pair);box.appendChild(skip);
}
```

- [ ] **Step 4: Add `recordPair()` function**

```javascript
function recordPair(keyA,keyB,winner,candidates){
  compPairs.push({a:keyA,b:keyB,winner,ts:Date.now()});
  saveAll();
  renderComparePair(candidates);
}
```

- [ ] **Step 5: Wire overlay click-outside-to-close**

Add in the JS init area (near where other overlay/modal dismiss logic lives):

```javascript
document.getElementById('compareOverlay').addEventListener('click',e=>{
  if(e.target.id==='compareOverlay')closeCalibrate();
});
```

- [ ] **Step 6: Open browser, click "Calibrate". Verify the modal shows two palette cards side by side. Clicking one should log the pair and immediately show the next pair. Skipping should work. After ~25 choices the "done" screen should appear.**

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: pairwise comparison modal with pair selection and recording"
```

---

## Task 5: Weight fitting — `fitWeights()` and `spearmanRho()`

**Files:**
- Modify: `index.html` — add JS functions after `recordPair`

- [ ] **Step 1: Add `fitWeights()` using logistic regression on feature differences**

Logistic regression: for each won pair `(a beats b)`, the feature difference `d = fv(a) - fv(b)` should have `w · d > 0`. We minimize binary cross-entropy with gradient descent.

```javascript
function fitWeights(){
  // Collect non-skip pairs
  const pairs=compPairs.filter(p=>p.winner!=='skip');
  if(pairs.length<5){showToast('Need at least 5 comparisons to fit weights.');return;}

  // Build training data: X[i] = fvA - fvB, y[i] = 1 if a won, 0 if b won
  const X=[],y=[];
  for(const pair of pairs){
    const mA=likedMeta.find(m=>m.key===pair.a);
    const mB=likedMeta.find(m=>m.key===pair.b);
    if(!mA||!mB)continue;
    const glazesA=(mA.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
    const glazesB=(mB.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
    if(glazesA.length<2||glazesB.length<2)continue;
    const fvA=featureVector(glazesA);
    const fvB=featureVector(glazesB);
    const diff=fvA.map((v,i)=>v-fvB[i]);
    X.push(diff);
    y.push(pair.winner==='a'?1:0);
  }
  if(X.length<5){showToast('Not enough valid pairs after filtering.');return;}

  // Initialize weights (uniform), add bias term
  const D=7;
  let w=new Array(D).fill(1/D);

  const sigmoid=z=>1/(1+Math.exp(-z));
  const lr=0.05;
  const epochs=200;

  for(let e=0;e<epochs;e++){
    const grad=new Array(D).fill(0);
    for(let i=0;i<X.length;i++){
      const z=X[i].reduce((s,v,j)=>s+v*w[j],0);
      const pred=sigmoid(z);
      const err=pred-y[i]; // d(CE)/dz = pred - label
      for(let j=0;j<D;j++)grad[j]+=err*X[i][j];
    }
    for(let j=0;j<D;j++)w[j]-=lr*grad[j]/X.length;
  }

  // Normalize so weights sum to 1 and are all positive (shift + renorm)
  const minW=Math.min(...w);
  if(minW<0)w=w.map(v=>v-minW+0.02);
  const sumW=w.reduce((a,b)=>a+b,0);
  w=w.map(v=>v/sumW);

  learnedWeights=w;
  saveAll();
  console.log('Learned weights:',w.map((v,i)=>`f${i+1}:${v.toFixed(3)}`).join(' '));
}
```

- [ ] **Step 2: Add `spearmanRho()` function to measure rank correlation against user's ranked list**

```javascript
function spearmanRho(){
  if(!learnedWeights)return 0;
  // Get ranked palettes from rankSorted (user's ground truth)
  if(!rankSorted||rankSorted.length<4)return 0;
  const ranked=rankSorted.filter(m=>{
    const glazes=(m.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
    return glazes.length>=2;
  });
  if(ranked.length<4)return 0;
  const n=ranked.length;
  // User rank: position in rankSorted (0=best)
  // Learned score: scoreAesthetic with learnedWeights already set
  const scores=ranked.map(m=>{
    const glazes=(m.names||[]).map(n=>GLAZES.find(g=>g.name===n)).filter(Boolean);
    return scoreAesthetic(glazes);
  });
  // Spearman: rank correlation between [0,1,...,n-1] and rankOf(scores)
  const scoreRanks=scores.map((_,i)=>i).sort((a,b)=>scores[b]-scores[a]);
  // scoreRanks[i] = index in 'ranked' that has the i-th highest score
  // We want: for each palette in ranked, its user rank vs its score rank
  const userRank=ranked.map((_,i)=>i);
  const scoreRankOf=new Array(n);
  scoreRanks.forEach((idx,rank)=>{scoreRankOf[idx]=rank;});
  let d2=0;
  for(let i=0;i<n;i++)d2+=(userRank[i]-scoreRankOf[i])**2;
  return 1-(6*d2)/(n*(n*n-1));
}
```

- [ ] **Step 3: Add `resetLearnedWeights()` function**

```javascript
function resetLearnedWeights(){
  learnedWeights=null;
  saveAll();
  updateCalibrateBtn();
  renderGallery();
  closeCalibrate();
  showToast('Scores reset to default weights.');
}
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: fitWeights() logistic regression and spearmanRho() validation"
```

---

## Task 6: Personalized score badge tooltip

**Files:**
- Modify: `index.html` around line 1278 (the badge tooltip in `buildCard`)

- [ ] **Step 1: Update the badge `title` attribute in `buildCard` to reflect personalization**

Find this line (~line 1278):
```javascript
    badge.title='Aesthetic score: contrast, harmony, distinctness, material variety';
```

Replace with:
```javascript
    badge.title=learnedWeights?'Personalized score (calibrated to your preferences)':'Aesthetic score: contrast, harmony, distinctness, material variety';
```

- [ ] **Step 2: Verify in browser — hover the ★ badge. Before calibration it says "Aesthetic score…". After calibrating and applying weights, reload and hover — it should say "Personalized score…".**

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: personalized score badge tooltip when learnedWeights active"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task covering it |
|------------------|-----------------|
| Pairwise comparison UI (modal, two swatches side by side) | Task 4 |
| Store pairs in `bklyn_v6.pairs` | Task 2 + Task 4 `recordPair` |
| Only compare saved palettes (`likedMeta`) | Task 4 `openCalibrate` filters `likedMeta` |
| Prioritize similar-score pairs | Task 4 `renderComparePair` sorts by score, walks closest |
| ~30 comparisons target | Task 4 threshold at 25, goal stated as up to 30 |
| Bradley-Terry / logistic regression on feature diffs | Task 5 `fitWeights` |
| Store `learnedWeights` in localStorage | Task 2 + Task 5 |
| `scoreAesthetic` uses learned weights when present | Task 1 |
| "Personalized score" tooltip when weights fitted | Task 6 |
| "Calibrate" button in Discover header | Task 3 |
| Spearman ρ display after calibration | Task 5 `spearmanRho` + Task 4 done screen |
| Skip pairs option | Task 4 skip button |
| Reset to defaults | Task 5 `resetLearnedWeights` |

**Placeholder scan:** No TBD, TODO, or "implement later" found. All steps include code.

**Type consistency:**
- `featureVector(glazes)` defined in Task 1, called in Task 5 `fitWeights` — ✓ same signature
- `learnedWeights` declared in Task 2, read in Task 1 `scoreAesthetic`, written in Task 5 `fitWeights` — ✓ consistent
- `compPairs` declared in Task 2, pushed in Task 4 `recordPair`, read in Task 5 `fitWeights` — ✓ consistent
- `rankSorted` referenced in Task 5 `spearmanRho` — this is an existing global set by the Phase 1 rank mode, confirmed at line 1778
- `glazeCSS(glazes)` called in Task 4 `makeCard` — existing helper, confirmed used at line 1204 ✓
- `updateCalibrateBtn()` defined in Task 3, called in Task 2 load block and Task 5 — ✓ consistent
