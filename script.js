/* ===== shared part (3D viewer, storage, colors, chat helpers) ===== */
/* =====================================================================
   FORM/MORE shared module. Loaded by the shop (index.html) and the admin
   (admin.html) so both draw the same shirt, 3D view, colors and statuses.
   ===================================================================== */
const $=s=>document.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const uid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money=n=>'₱'+Math.round(n).toLocaleString('en-US');
const hm=t=>new Date(t).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'});
const mfmt=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const manila=i=>mfmt.format(new Date(i));
const PF={tier:'high',mode:'auto',bypass:false,n:0,sum:0};   // performance tier (the shop runs a device test and updates this)
function perfFrame(){}                                          // the shop replaces this with a slowdown watchdog
function toast(t){const e=document.createElement('div');e.className='toast';e.textContent=t;document.body.append(e);setTimeout(()=>e.remove(),2400)}

/* ---- 3D model settings ---- */
const MODEL_CFG={
  url:'assets/shirt.glb',
  map:[0,0.97,145,145],                     // front/back decal mapping: [center x, shoulder-top y, px per unit across, px per unit down]
  sleeve:[0.796,0.225,0.042,0.17,0.22,-0.975,0.058] // sleeve print: [center |x|, center y, center z (sleeve at +x), print size, axis x, axis y, center z (sleeve at -x)].
                                            // The print size fits the outer face of the sleeve so the whole design shows. Tune if you swap the model.
};

/* ---- statuses: red = needs the team now, orange = in progress, green = agreed and paid, done = delivered ---- */
const ST={
  'Brief Submitted':{g:'red'},'Artwork Check':{g:'red'},'Revision':{g:'red'},'Negotiation':{g:'red'},
  'Designing':{g:'orange'},'For Design Approval':{g:'orange'},'Approved':{g:'orange'},'Self-design':{g:'orange'},'For Payment':{g:'orange'},
  'Paid':{g:'green'},'In Production':{g:'green'},'Shipped':{g:'green'},
  'Delivered':{g:'done'},'Cancelled':{g:'grey'},'Draft':{g:'grey'}
};
const STATUS_LIST=['Brief Submitted','Artwork Check','Revision','Negotiation','Designing','For Design Approval','Approved','Self-design','For Payment','Paid','In Production','Shipped','Delivered','Cancelled'];
const stGroup=s=>(ST[s]||{g:'grey'}).g;

/* ---- color catalog: everything is listed, and the admin switches colors on or off ---- */
const COLORS=[
  ['Black','#1b1b22',1],['White','#f4f4f8',1],['Charcoal','#3a3a3f'],['Heather Grey','#a7a7a8'],['Light Grey','#d4d4d2'],['Silver','#c4c6c9'],
  ['Cream','#efe9dc'],['Ivory','#f7f1e1'],['Sand','#cdb8a0'],['Beige','#d9c7a8'],['Tan','#b08d66'],['Camel','#a9743f'],
  ['Brown','#5a3a28'],['Chocolate','#3e2a21'],['Rust','#a24a26'],['Terracotta','#c26a4a'],['Orange','#e8772e'],['Mustard','#d8a31e'],
  ['Yellow','#f2d230'],['Lemon','#f5e664'],['Olive','#5b6340'],['Army Green','#4b5a3a'],['Sage','#9aa98a'],['Mint','#b9dcc6'],
  ['Forest','#234a3a'],['Emerald','#1e7a55'],['Teal','#1f6f73'],['Turquoise','#2fb3b0'],['Sky Blue','#9bb8d3'],['Baby Blue','#bcd7ee'],
  ['Royal Blue','#2a4fb5'],['Navy','#1f2a44'],['Midnight','#141a2e'],['Denim','#3d5a80'],['Lavender','#b7a6d9'],['Lilac','#c9b6e4'],
  ['Purple','#5b3a8c'],['Plum','#5a2a4a'],['Burgundy','#6e1f2f'],['Maroon','#5b1a22'],['Red','#c0272d'],['Crimson','#9d1d2a'],
  ['Coral','#ee7066'],['Salmon','#f1998a'],['Pink','#f2a6bf'],['Hot Pink','#e0457b'],['Blush','#f0cfc9'],['Peach','#f6c3a0']
];
function colorStore(){let c={avail:{},custom:[]};try{c=Object.assign(c,JSON.parse(localStorage.sh_colors||'{}'))}catch(e){}return c}
function colorSave(c){try{localStorage.sh_colors=JSON.stringify(c)}catch(e){}}
function colorList(){const st=colorStore();return COLORS.map(([n,h,core])=>({n,h,core:!!core,ok:st.avail[n]!==false})).concat((st.custom||[]).map(c=>({n:c.n,h:c.h,core:false,ok:st.avail[c.n]!==false,custom:true})))}

/* ---- orders and chats live in one place so the shop and the admin always agree ---- */
const allOrders=()=>{try{return JSON.parse(localStorage.sh_orders||'[]')}catch(e){return[]}};
const saveOrders=o=>{try{localStorage.sh_orders=JSON.stringify(o);return true}catch(e){toast('Storage is full (demo)');return false}};
function chatsAll(){
  let a={};try{a=JSON.parse(localStorage.sh_chats||'{}')}catch(e){}
  for(const k in a){
    if(Array.isArray(a[k]))a[k]={name:k,msgs:a[k],ar:0,ur:0};            // older format
    a[k].msgs=(a[k].msgs||[]).map(m=>({...m,rx:(m.rx||[]).map(r=>typeof r==='string'?{e:r,by:'me'}:r)}));
  }
  return a;
}
const chatsSave=a=>{try{localStorage.sh_chats=JSON.stringify(a)}catch(e){}};

/* ---- original artwork vault (IndexedDB) so the team can download the full-quality files ---- */
const IDB={
  db:null,
  open(){return this.db||(this.db=new Promise((res,rej)=>{const r=indexedDB.open('formmore',1);r.onupgradeneeded=()=>r.result.createObjectStore('art');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))},
  async put(k,v){try{const d=await this.open();return await new Promise(r=>{const t=d.transaction('art','readwrite');t.objectStore('art').put(v,k);t.oncomplete=()=>r(true);t.onerror=()=>r(false)})}catch(e){return false}},
  async get(k){try{const d=await this.open();return await new Promise(r=>{const q=d.transaction('art').objectStore('art').get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>r(null)})}catch(e){return null}}
};
async function vaultSave(d){   // call before thumbnails replace the sources
  for(const s of Object.keys(d.art))for(let i=0;i<d.art[s].length;i++){
    const it=d.art[s][i];if(it.key)continue;
    try{const b=await(await fetch(it.src)).blob();it.key=`${d.id}|${s}|${i}`;it.type=b.type;await IDB.put(it.key,b)}catch(e){}
  }
}
async function artBlob(it){if(it.key){const b=await IDB.get(it.key);if(b)return b}try{return await(await fetch(it.src)).blob()}catch(e){return null}}

/* ---- zip (no library) and downloads ---- */
const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=u=>{let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRCT[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0};
function makeZip(files){
  const enc=new TextEncoder(),parts=[],cd=[];let off=0;
  for(const f of files){
    const nm=enc.encode(f.name),crc=crc32(f.data),sz=f.data.length,lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(12,0x21,true);lh.setUint32(14,crc,true);lh.setUint32(18,sz,true);lh.setUint32(22,sz,true);lh.setUint16(26,nm.length,true);
    parts.push(lh.buffer,nm,f.data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(14,0x21,true);ch.setUint32(16,crc,true);ch.setUint32(20,sz,true);ch.setUint32(24,sz,true);ch.setUint16(28,nm.length,true);ch.setUint32(42,off,true);
    cd.push(ch.buffer,nm);off+=30+nm.length+sz;
  }
  const cdSize=cd.reduce((s,b)=>s+(b.byteLength!=null?b.byteLength:b.length),0),end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,cdSize,true);end.setUint32(16,off,true);
  return new Blob([...parts,...cd,end.buffer],{type:'application/zip'});
}
function dl(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}
const blobU8=async b=>new Uint8Array(await b.arrayBuffer());
const extOf=b=>/png/.test(b?.type||'')?'png':/jpe?g/.test(b?.type||'')?'jpg':/webp/.test(b?.type||'')?'webp':/svg/.test(b?.type||'')?'svg':'png';

/* ---- icons ---- */
const IC={
  edit:'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',help:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  upload:'M12 5v14M5 12h14',sliders:'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  undo:'M1 4v6h6M3.5 15a9 9 0 1 0 2.1-9.4L1 10',redo:'M23 4v6h-6M20.5 15a9 9 0 1 1-2.1-9.4L23 10',
  trash:'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  x:'M18 6L6 18M6 6l12 12',send:'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',chat:'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z',
  reply:'M9 14L4 9l5-5M20 20v-7a4 4 0 0 0-4-4H4',up:'M12 19V5M5 12l7-7 7 7',down:'M12 5v14M19 12l-7 7-7-7',left:'M19 12H5M12 19l-7-7 7-7',right:'M5 12h14M12 5l7 7-7 7',
  move:'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',max:'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
  pinch:'M8 8l-5-5M3 8V3h5M16 16l5 5M21 16v5h-5M8 16l-5 5M3 16v5h5M16 8l5-5M21 8V3h-5',rot:'M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16',
  mouse:'M12 2a6 6 0 0 0-6 6v8a6 6 0 0 0 12 0V8a6 6 0 0 0-6-6zM12 6v4',key:'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  download:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',grid:'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  image:'M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  check:'M20 6L9 17l-5-5',copy:'M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',smile:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  box:'M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.3 7L12 12l8.7-5M12 22V12',
  list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',users:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  ruler:'M3.5 16.5L16.5 3.5l4 4-13 13zM7.5 12.5l2 2M10.5 9.5l1.5 1.5M13.5 6.5l2 2',palette:'M12 22a10 10 0 1 1 10-10c0 3-2 4-4 4h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22zM7.5 11h.01M10.5 7h.01M15.5 8h.01',search:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  eye:'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',layers:'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'
};
const ic=n=>`<svg viewBox="0 0 24 24"><path d="${IC[n]}"/></svg>`;
function icons(root=document){$$('[data-ic]',root).forEach(e=>{if(!e.firstChild)e.innerHTML=ic(e.dataset.ic)})}

/* ---- products, prints, prices ---- */
const SIZES=['S','M','L','XL','2XL'],HEX={Black:'#1b1b22',White:'#f4f4f8'};
const LAY={ // [id,label,class(S small/L large),print area x,y,w,h on the 300x330 shirt]
  F:[['lc','Left chest','S',[168,84,30,30]],['rc','Right chest','S',[102,84,30,30]],['cc','Center chest','L',[104,86,92,84]],['ff','Full front','L',[88,78,124,164]],['of','Oversize front','L',[76,70,148,206]]],
  B:[['bn','Back neck','S',[130,42,40,26]],['ub','Upper back','L',[92,58,116,72]],['fb','Full back','L',[88,72,124,164]]]};
const sides=(o=O)=>o.pos==='both'?['F','B']:[o.pos==='front'?'F':'B'];
const SL={sl:['Left sleeve',268,100,58],sr:['Right sleeve',32,100,-58]};
/* ---- prices: one place. The team edits them in the admin Pricing page; the server keeps the master copy. ---- */
const PRICE_DEF={base:399,large:69,small:49,ship:150,free:1500};   // shirt with one print, extra large print, extra small print or sleeve, shipping, free shipping above
function PR(){let p={};try{p=JSON.parse(localStorage.sh_price||'{}')}catch(e){}const o={...PRICE_DEF};for(const k in PRICE_DEF)if(isFinite(+p[k])&&p[k]!==''&&p[k]!==null)o[k]=+p[k];return o}
const shipFee=(t,Pv)=>{const P=Pv?{...PRICE_DEF,...Pv}:PR();return !t||t>P.free?0:P.ship};
function price(o=O,Pv){   // Pv: prices locked into the order when the team set it to For Payment
  const p=[];sides(o).forEach(s=>{if(o.custom)p.push('L');else if(o.lay[s])p.push(LAY[s].find(l=>l[0]===o.lay[s])[2])});
  o.sl.forEach(()=>p.push('T'));
  const P=Pv?{...PRICE_DEF,...Pv}:PR(),per=P.base+p.slice(1).reduce((a,c)=>a+(c==='L'?P.large:P.small),0),qty=Object.values(o.sizes).reduce((a,b)=>a+b,0);
  return{per,qty,total:per*qty};
}
const ZSLV=[105,112,90,90];
const zone=(d,s)=>{if(s==='SL'||s==='SR')return ZSLV;const o=d.O,id=o.custom?(s==='F'?'ff':'fb'):o.lay[s];return(LAY[s].find(l=>l[0]===id)||LAY[s][3]||LAY[s][2])[3]};
const ipu=s=>(s==='SL'||s==='SR')?3.5/90:12/124;               // inches per stage unit (sleeve area about 3.5 in, torso about 12 in across 124 units)
const stepsOf=d=>sides(d.O).concat(d.O.sl.map(k=>k==='sl'?'SL':'SR'));
const LBL={F:'Front',B:'Back',SL:'Left sleeve',SR:'Right sleeve'};
const arr=(d,s)=>(d.art&&d.art[s])||(d.art?(d.art[s]=[]):[]);
const hasArt=d=>Object.values(d.art||{}).some(a=>a.length);
const colorOf=d=>d.O.color==='Other'?(d.O.other||'Custom color'):d.O.color;
const specOf=d=>`${colorOf(d)} · ${Object.entries(d.O.sizes).filter(x=>x[1]).map(x=>x[0]+'×'+x[1]).join(', ')}`;
const placeOf=o=>sides(o).map(s=>o.custom?'Custom':LAY[s].find(l=>l[0]===o.lay[s])[1]).concat(o.sl.map(k=>SL[k][0])).join(', ');
const dpiOf=(it,s)=>Math.round(it.nw/(it.w*300*ipu(s)));

/* ---- plain 3D vector shirt: smooth silhouette, soft light and shade, simple collar ---- */
const GRADS=`<linearGradient id="shd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>
<linearGradient id="shs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".26"/><stop offset=".2" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".26"/></linearGradient>
<linearGradient id="shv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>
<radialGradient id="shr" cx=".5" cy=".38" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
function shirtInner(d){
  const P='M108 26Q150 '+d+' 192 26C206 31 226 39 240 47C262 63 282 96 294 122L256 150L238 134C234 190 240 255 238 308Q150 324 62 308C60 255 66 190 62 134L44 150L6 122C18 96 38 63 60 47C74 39 94 31 108 26Z';
  const f='fill="none" stroke-linecap="round"',C='M108 26Q150 8 192 26Q150 '+d+' 108 26Z';
  return `<path d="${P}" fill="var(--sh,#fff)"/>
  <path d="${P}" fill="url(#shv)"/><path d="${P}" fill="url(#shd)"/><path d="${P}" fill="url(#shs)"/><path d="${P}" fill="url(#shr)"/>
  <path d="${C}" fill="var(--sh,#fff)"/><path d="${C}" fill="#000" fill-opacity=".28"/>
  <path d="M108 26Q150 ${d} 192 26" ${f} stroke="#fff" stroke-opacity=".16" stroke-width="8"/>
  <path d="M110 29Q150 ${d-7} 190 29" ${f} stroke="#000" stroke-opacity=".1" stroke-width="1.2"/>
  <path d="${P}" fill="none" stroke="rgba(20,20,40,.28)" stroke-width="1.3" stroke-linejoin="round"/>`;
}
function sleeveInner(mir){
  const P='M44 96Q150 34 256 96L236 262Q150 282 64 262Z';
  return `<g ${mir?'transform="translate(300 0) scale(-1 1)"':''}><path d="${P}" fill="var(--sh,#fff)"/><path d="${P}" fill="url(#shv)"/><path d="${P}" fill="url(#shd)"/><path d="${P}" fill="url(#shs)"/>
  <path d="M64 246Q150 266 236 246" fill="none" stroke="#000" stroke-opacity=".1" stroke-width="1.2"/><path d="${P}" fill="none" stroke="rgba(20,20,40,.28)" stroke-width="1.3" stroke-linejoin="round"/></g>`;
}
const symbol=(id,inner)=>`<symbol id="${id}" viewBox="0 0 300 330">${inner}</symbol>`;
function installSprite(){const g=$('#syms');if(g)g.innerHTML='<defs>'+GRADS+'</defs>'+symbol('sF',shirtInner(82))+symbol('sB',shirtInner(40))+symbol('sSL',sleeveInner(false))+symbol('sSR',sleeveInner(true))}
const setShirt=c=>document.documentElement.style.setProperty('--sh',c);

/* ---- a mockup stage: shirt, print zone, designs. Options: {edit, zone, grid, center, measure} ---- */
const itPos=it=>`left:${it.x*100}%;top:${it.y*100}%;width:${it.w*100}%;transform:translate(-50%,-50%) rotate(${it.r}deg)`;
const PV=new Map();   // editor previews: original src -> smaller blob url
const itemHTML=(it,i,on)=>`<div class="it ${on?'act':''}" data-i="${i}" data-x="${it.x}" data-y="${it.y}" data-w="${it.w}" style="${itPos(it)}"><img src="${(v=>typeof v==='string'?v:it.src)(PV.get(it.src))}" draggable="false" alt="" decoding="async"></div>`;
function stageHTML(d,s,o){
  if(o===true)o={edit:true};o=o||{};
  const z=zone(d,s),k=ipu(s);
  let h=`<svg viewBox="0 0 300 330"><use href="#s${s}"/></svg>`;
  if(o.edit||o.zone)h+=`<i class="pz ${o.grid?'grid':''} ${o.center===false?'nc':''}" style="left:${z[0]/3}%;top:${z[1]/3.3}%;width:${z[2]/3}%;height:${z[3]/3.3}%;--gx:${5/z[2]*100}%;--gy:${5/z[3]*100}%"></i>`;
  if(o.edit)h+='<i class="gd" id="gx"></i><i class="gd" id="gy"></i>';
  h+=arr(d,s).map((it,i)=>itemHTML(it,i,false)).join('');
  if(o.measure){
    h+=`<b class="ms" style="left:${(z[0]+z[2]/2)/3}%;top:${z[1]/3.3}%">${(z[2]*k).toFixed(1)} × ${(z[3]*k).toFixed(1)} in</b>`;
    arr(d,s).forEach(it=>{const w=it.w*300*k,hh=w*(it.ar||1);h+=`<b class="ms it2" style="left:${it.x*100}%;top:${(it.y*330+it.w*150*(it.ar||1))/3.3}%">${w.toFixed(1)} × ${hh.toFixed(1)} in · ${dpiOf(it,s)} DPI</b>`});
  }
  return h;
}

/* ---- exports: print-ready layer (300 DPI, transparent) and a mockup picture ---- */
async function bmpOf(b){try{return await createImageBitmap(b)}catch(e){const u=URL.createObjectURL(b),im=new Image();await new Promise((r,j)=>{im.onload=r;im.onerror=j;im.src=u});setTimeout(()=>URL.revokeObjectURL(u),4000);return im}}
async function composePrint(d,s,dpi=300){
  const z=zone(d,s),W=Math.round(z[2]*ipu(s)*dpi),H=Math.round(z[3]*ipu(s)*dpi),c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  for(const it of arr(d,s)){
    const b=await artBlob(it);if(!b)continue;const bm=await bmpOf(b);
    const w=it.w*300/z[2]*W,h=w*bm.height/bm.width,cx=(it.x*300-z[0])/z[2]*W,cy=(it.y*330-z[1])/z[3]*H;
    x.save();x.translate(cx,cy);x.rotate(it.r*Math.PI/180);x.drawImage(bm,-w/2,-h/2,w,h);x.restore();
  }
  return new Promise(r=>c.toBlob(r,'image/png'));
}
async function mockupPNG(d,s,px=1800){
  const hex=d.O.hex||'#fff',inner=((s==='SL'||s==='SR')?sleeveInner(s==='SR'):shirtInner(s==='B'?40:82)).split('var(--sh,#fff)').join(hex);
  let imgs='';
  for(const it of arr(d,s)){
    const b=await artBlob(it);if(!b)continue;const uri=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)}),bm=await bmpOf(b),w=it.w*300,h=w*bm.height/bm.width;
    imgs+=`<image href="${uri}" x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" transform="translate(${it.x*300} ${it.y*330}) rotate(${it.r})"/>`;
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 330" width="${px}" height="${Math.round(px*1.1)}"><defs>${GRADS}</defs><rect width="300" height="330" fill="#f6f6f4"/>${inner}${imgs}</svg>`;
  const im=new Image();await new Promise(r=>{im.onload=r;im.onerror=r;im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)});
  const c=document.createElement('canvas');c.width=px;c.height=Math.round(px*1.1);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  return new Promise(r=>c.toBlob(r,'image/png'));
}

/* ================= server connection (shared by the shop and the admin) =================
   Everything here stays OFF until config.js sets  window.FM = {api:'https://your-server'}.
   With no server the site keeps working on this device only (demo mode), exactly as before. */
const NET={
  get base(){return String((window.FM&&window.FM.api)||'').replace(/\/$/,'')},
  get on(){return !!this.base},
  tok:'',cfg:null,
  async j(path,body,opt={}){
    const h={};if(this.tok)h.Authorization='Bearer '+this.tok;
    const init={method:opt.method||(body===undefined?'GET':'POST'),headers:h};
    if(body instanceof FormData)init.body=body;
    else if(body!==undefined){h['Content-Type']='application/json';init.body=JSON.stringify(body)}
    let r;try{r=await fetch(this.base+path,init)}catch(e){throw Object.assign(new Error('Cannot reach the server. Check your connection and try again.'),{net:true})}
    const d=await r.json().catch(()=>({}));
    if(!r.ok){let m=d.detail;if(Array.isArray(m))m='Please check what you entered.';throw Object.assign(new Error(m||'Something went wrong. Please try again.'),{status:r.status})}
    return d;
  },
  async config(){if(this.cfg||!this.on)return this.cfg;try{this.cfg=await this.j('/config')}catch(e){this.cfg=null}return this.cfg},
  async blob(path){const r=await fetch(this.base+'/art/file?path='+encodeURIComponent(path),{headers:{Authorization:'Bearer '+this.tok}});if(!r.ok)throw new Error('file');return r.blob()}
};

/* one place to hear about writes to the shared "database" keys (works for every call site) */
const STORE_HOOKS={};let STORE_QUIET=false;
(()=>{const orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){orig.call(this,k,v);if(this===localStorage&&!STORE_QUIET&&STORE_HOOKS[k])try{STORE_HOOKS[k]()}catch(e){}}})();
function quietSet(k,v){STORE_QUIET=true;try{localStorage.setItem(k,v)}finally{STORE_QUIET=false}}
function soon(fn,ms=700){let t=0;return()=>{clearTimeout(t);t=setTimeout(fn,ms)}}

/* originals of artwork: this browser's vault first, then the server (for the admin on another computer) */
const _artBlobLocal=artBlob;
artBlob=async function(it){
  if(it.key){const b=await IDB.get(it.key);if(b)return b}
  if(it.path&&NET.on&&NET.tok){try{return await NET.blob(it.path)}catch(e){}}
  return _artBlobLocal(it);
};

/* ===== animated wordmark =====
   Built letter by letter from the logo symbol on the page, so every header logo moves like the intro:
   the slash cuts in first, then the letters rise out of a blur, from the middle outward.
   Plays when a page opens; tap the logo to play it again. */
function logoHTML(id){
  const sym=document.getElementById(id);if(!sym)return'';
  const vb=sym.getAttribute('viewBox').trim().split(/\s+/).map(Number),W=vb[2],H=vb[3];
  const gl=[...sym.children].filter(n=>n.tagName.toLowerCase()==='svg').map(g=>({x:+g.getAttribute('x'),y:+g.getAttribute('y'),w:+g.getAttribute('width'),h:+g.getAttribute('height'),vb:g.getAttribute('viewBox'),inner:g.innerHTML}));
  if(!gl.length)return'';
  let si=gl.findIndex(g=>g.h>=H-.5);if(si<0)si=gl.length>>1;
  const sc=gl[si].x+gl[si].w/2,f=n=>n.toFixed(3);
  return gl.map((g,i)=>`<svg class="g${i===si?' s':''}" style="left:${f(g.x/W*100)}%;top:${f(g.y/H*100)}%;width:${f(g.w/W*100)}%;height:${f(g.h/H*100)}%;--dx:${(((sc-(g.x+g.w/2))/g.w)*16).toFixed(2)};--d:${(Math.abs(i-si)*.075).toFixed(3)}s" viewBox="${g.vb}" aria-hidden="true">${g.inner}</svg>`).join('');
}
function fillLogos(root=document){
  root.querySelectorAll('.hlogo:not([data-ok])').forEach(e=>{const s=e.dataset.logo||'lg-full',v=document.getElementById(s);if(!v)return;e.innerHTML=logoHTML(s);e.style.aspectRatio=v.getAttribute('viewBox').trim().split(/\s+/).slice(2).join('/');e.dataset.ok='1';e.classList.add('play')});
}
function replayLogo(e){if(!e)return;e.classList.remove('play');void e.offsetWidth;e.classList.add('play')}
document.addEventListener('click',e=>{const l=e.target.closest('.hlogo');if(l)replayLogo(l)});
fillLogos();

/* ===== chat attachments (shop and admin) =====
   Pictures get a small preview inside the message; the full file stays in this browser (and on the server when connected). */
const CHX={max:10*1024*1024,ext:/\.(png|jpe?g|webp|gif|pdf|svg|ai|eps|psd|zip|txt|docx?|tiff?|heic)$/i,
  accept:'image/*,.pdf,.svg,.ai,.eps,.psd,.zip,.txt,.doc,.docx,.tif,.tiff,.heic'};
const fsize=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
function chThumb(file){
  return new Promise(res=>{
    if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))return res(null);
    const u=URL.createObjectURL(file),im=new Image();
    im.onload=()=>{const k=Math.min(1,480/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));
      const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);
      res({thumb:c.toDataURL('image/jpeg',.82),w:im.width,h:im.height})};
    im.onerror=()=>{URL.revokeObjectURL(u);res(null)};im.src=u;
  });
}
/* check and store the picked files; returns [{att, blob}] and a list of problems */
async function chPrep(files){
  const ok=[],bad=[];
  for(const f of [...files].slice(0,6)){
    if(!CHX.ext.test(f.name||'')&&!/^image\//.test(f.type)){bad.push(`${f.name}: this type of file cannot be sent.`);continue}
    if(f.size>CHX.max){bad.push(`${f.name}: larger than 10 MB.`);continue}
    const id=uid()+uid(),k='chat|'+id,th=await chThumb(f);
    await IDB.put(k,f);
    ok.push({att:{id,k,n:f.name||'file',t:f.type||'',s:f.size,...(th||{})},blob:f});
  }
  return{ok,bad};
}
async function chUpload(list,mid,email){       // server copy; the message waits for it so both sides can open the file
  if(!(NET.on&&NET.tok))return;
  for(const x of list){
    const f=new FormData();f.append('mid',mid+'-'+x.att.id);f.append('file',new File([x.blob],x.att.n,{type:x.att.t||'application/octet-stream'}));
    if(email)f.append('email',email);
    x.att.path=(await NET.j(email?'/admin/chat/file':'/me/chat/file',f)).path;
  }
}
function attHTML(m){
  const a=m.att||[];if(!a.length)return'';
  const pics=a.filter(x=>x.thumb),files=a.filter(x=>!x.thumb);
  return `<div class="catt">${pics.length?`<div class="cpics n${Math.min(pics.length,3)}">${pics.map(x=>`<button class="cpic" data-att="${esc(m.id)}|${esc(x.id)}" aria-label="Open ${esc(x.n)}"><img src="${x.thumb}" alt="${esc(x.n)}" loading="lazy"></button>`).join('')}</div>`:''}${files.map(x=>`<button class="cfile" data-att="${esc(m.id)}|${esc(x.id)}" aria-label="Download ${esc(x.n)}"><span class="cfi" aria-hidden="true">${esc((x.n.split('.').pop()||'file').slice(0,4).toUpperCase())}</span><span class="grow"><b>${esc(x.n)}</b><small>${fsize(x.s||0)}</small></span><span class="cfd" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg></span></button>`).join('')}</div>`;
}
async function attBlob(x){
  if(x.k){const b=await IDB.get(x.k);if(b)return b}
  if(x.path&&NET.on&&NET.tok){try{return await NET.blob(x.path)}catch(e){}}
  return null;
}
async function attOpen(x){
  const b=await attBlob(x);
  if(!b){if(x.thumb)return lbxShow(x.thumb,x.n,null);toast('This file is not available on this device.');return}
  const u=URL.createObjectURL(b);
  if(/^image\/(png|jpeg|webp|gif)$/.test(b.type||x.t))return lbxShow(u,x.n,b);
  const a=document.createElement('a');a.href=u;a.download=x.n;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},1500);
}
function lbxShow(src,name,blob){
  let L=document.getElementById('lbx');
  if(!L){document.body.insertAdjacentHTML('beforeend','<div class="lbx" id="lbx" role="dialog" aria-modal="true" aria-label="Picture"><img alt=""><div class="lbxb"><span class="lbxn"></span><a class="lbxd" download>Download</a><button class="lbxx" aria-label="Close">Close</button></div></div>');L=document.getElementById('lbx');
    L.addEventListener('click',e=>{if(e.target===L||e.target.closest('.lbxx'))lbxClose()});addEventListener('keydown',e=>{if(e.key==='Escape'&&L.classList.contains('on')){e.stopPropagation();lbxClose()}},true)}
  L.querySelector('img').src=src;L.querySelector('img').alt=name;L.querySelector('.lbxn').textContent=name;
  const d=L.querySelector('.lbxd');d.hidden=!blob;if(blob){d.href=src;d.download=name}
  L.classList.add('on');
}
function lbxClose(){const L=document.getElementById('lbx');if(!L)return;L.classList.remove('on');const s=L.querySelector('img').src;if(s.startsWith('blob:'))setTimeout(()=>URL.revokeObjectURL(s),400)}
async function attForget(m){for(const x of m.att||[])if(x.k)try{const d=await IDB.open();d.transaction('art','readwrite').objectStore('art').delete(x.k)}catch(e){}}
const delTxt=(m,viewer,name)=>m.from===viewer?'You deleted a message':`${name} deleted a message`;

/* ===== size chart (shop and admin) =====
   The team types the measurements in the admin panel (Size chart). Shirts are measured laid flat. */
const SZ_SIZES=['S','M','L','XL','2XL'];
const SZ_COLS=[['a','A','Chest width','Across the chest, armpit to armpit, with the shirt laid flat.'],
  ['b','B','Body length','From the highest point of the shoulder straight down to the hem.'],
  ['c','C','Sleeve length','From the shoulder seam to the end of the sleeve.']];
function szClean(d){
  d=d&&typeof d==='object'?d:{};const out={unit:d.unit==='cm'?'cm':'in',rows:{},note:String(d.note||'').replace(/\s+/g,' ').trim().slice(0,300)};
  SZ_SIZES.forEach(s=>{const r=(d.rows&&d.rows[s])||{};out.rows[s]={};
    SZ_COLS.forEach(([k])=>{const v=r[k],n=parseFloat(v);out.rows[s][k]=(v===''||v==null||!isFinite(n)||n<=0||n>=300)?'':Math.round(n*10)/10})});
  return out;
}
function szStore(){try{return szClean(JSON.parse(localStorage.getItem('sh_size')||'null'))}catch(e){return szClean(null)}}
const szHas=d=>SZ_SIZES.some(s=>SZ_COLS.some(([k])=>d.rows[s][k]!==''));
const SZ_TEE='M108 26Q150 82 192 26C206 31 226 39 240 47C262 63 282 96 294 122L256 150L238 134C234 190 240 255 238 308Q150 324 62 308C60 255 66 190 62 134L44 150L6 122C18 96 38 63 60 47C74 39 94 31 108 26Z';
function szHTML(d){
  d=szClean(d);const u=d.unit,alt=u==='in'?'cm':'in',conv=v=>u==='in'?Math.round(v*2.54):Math.round(v/2.54*10)/10;
  const cell=v=>v===''?'<td class="sz0">—</td>':`<td><b>${v}</b><small>${conv(v)} ${alt}</small></td>`;
  const arrow=(x1,y1,x2,y2)=>{const a=Math.atan2(y2-y1,x2-x1),h=(x,y,s)=>`M${(x+Math.cos(a+s*2.6)*9).toFixed(1)} ${(y+Math.sin(a+s*2.6)*9).toFixed(1)}L${x} ${y}L${(x+Math.cos(a-s*2.6)*9).toFixed(1)} ${(y+Math.sin(a-s*2.6)*9).toFixed(1)}`;
    return `<path d="M${x1} ${y1}L${x2} ${y2}"/><path d="${h(x2,y2,1)}"/><path d="${h(x1,y1,-1)}"/>`};
  return `<div class="szc-w"><svg class="szd" viewBox="-12 -6 326 336" role="img" aria-label="Where each measurement is taken"><path class="szs" d="${SZ_TEE}"/><path class="szs" d="M108 26Q150 82 192 26"/>
    <g class="sza">${arrow(66,156,234,156)}${arrow(122,32,122,310)}${arrow(248,40,305,118)}</g>
    <g class="szl"><text x="178" y="146">A</text><text x="130" y="236">B</text><text x="286" y="68">C</text></g></svg>
  <div class="szt-w"><table class="szt"><thead><tr><th scope="col">Size</th>${SZ_COLS.map(([,L,n])=>`<th scope="col"><i>${L}</i>${n}</th>`).join('')}</tr></thead>
  <tbody>${SZ_SIZES.map(s=>`<tr><th scope="row">${s}</th>${SZ_COLS.map(([k])=>cell(d.rows[s][k])).join('')}</tr>`).join('')}</tbody></table>
  <p class="szu">Measured flat, in ${u==='in'?'inches':'centimetres'}${szHas(d)?` (${alt==='cm'?'centimetres':'inches'} below)`:''}.</p></div></div>
  <ul class="szh">${SZ_COLS.map(([,L,n,h])=>`<li><i>${L}</i><span><b>${n}.</b> ${h}</span></li>`).join('')}</ul>
  ${d.note?`<p class="szno">${String(d.note).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</p>`:''}
  ${szHas(d)?'':'<p class="szno">Measurements are being added. Ask us in the chat for exact sizes.</p>'}`;
}

/* ================= 3D VIEWER (raw WebGL, no library) ================= */
let G3=null,MODEL;
const sst=(a,b,x)=>{x=Math.min(1,Math.max(0,(x-a)/(b-a)));return x*x*(3-2*x)};
function grid(NR,NU,fn,ref,kind){
  const P=[],I=[];
  for(let j=0;j<=NR;j++)for(let u=0;u<NU;u++)P.push(fn(j,u));
  for(let j=0;j<NR;j++)for(let u=0;u<NU;u++){const a=j*NU+u,b=j*NU+(u+1)%NU,c=(j+1)*NU+u,d=(j+1)*NU+(u+1)%NU;I.push(a,c,b,b,c,d)}
  const n=P.map(()=>[0,0,0]);
  for(let i=0;i<I.length;i+=3){
    const t=[I[i],I[i+1],I[i+2]],A=P[t[0]],B=P[t[1]],C=P[t[2]],u=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],v=[C[0]-A[0],C[1]-A[1],C[2]-A[2]];
    const f=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];t.forEach(q=>{n[q][0]+=f[0];n[q][1]+=f[1];n[q][2]+=f[2]});
  }
  let s=0;P.forEach((p,i)=>{const r=ref(p,i);s+=n[i][0]*r[0]+n[i][1]*r[1]+n[i][2]*r[2]});
  const g=s<0?-1:1;
  return{v:P.map((p,i)=>{const m=Math.hypot(n[i][0],n[i][1],n[i][2])||1;return[p[0],p[1],p[2],g*n[i][0]/m,g*n[i][1]/m,g*n[i][2]/m,kind(Math.floor(i/NU))]}),i:I};
}
function shirtMesh(){
  const NU=56,NV=44,TAU=Math.PI*2;
  const torso=grid(NV+2,NU,(j,u)=>{
    const y0=j<=NV?-1+1.9*j/NV:.9+.018*(j-NV),ys=Math.min(y0,.9),s=sst(.58,.9,ys),q=u/NU*TAU;
    const a=(.70+.10*sst(-1,.2,ys))*(1-s)+.37*s,b=(.30+.07*sst(-1,.2,ys))*(1-s)+.31*s;
    return[a*Math.sin(q),y0-.16*Math.pow(Math.max(0,Math.cos(q)),2)*sst(.6,.9,ys),b*Math.cos(q)];
  },p=>[p[0],0,p[2]],r=>r>=NV+1?1:0);
  const sl=sg=>{const th=.58,D=[sg*Math.cos(th),-Math.sin(th),0],n2=[D[1],-D[0],0],P0=[sg*.68,.44,0],L=.76,NR=14,NS=32;
    const ax=j=>[P0[0]+D[0]*L*j/NR,P0[1]+D[1]*L*j/NR,0];
    return grid(NR,NS,(j,u)=>{const q=u/NS*TAU,r=.225-.05*j/NR,c=ax(j);return[c[0]+r*Math.sin(q)*n2[0],c[1]+r*Math.sin(q)*n2[1],r*Math.cos(q)]},
      (p,i)=>{const c=ax(Math.floor(i/NS));return[p[0]-c[0],p[1]-c[1],p[2]]},()=>2)};
  const parts=[torso,sl(1),sl(-1)],V=[],I=[];
  parts.forEach(m=>{const o=V.length/7;m.v.forEach(x=>V.push(...x));m.i.forEach(i=>I.push(i+o))});
  return{v:new Float32Array(V),i:new Uint16Array(I)};
}
const mm=(a,b)=>{const o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o};
const rX=a=>{const c=Math.cos(a),s=Math.sin(a);return[1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]};
const rY=a=>{const c=Math.cos(a),s=Math.sin(a);return[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]};
const tr=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];

/* =============== 3D PREVIEW (raw WebGL, no library, loaded only when asked) =============== */
const VS='attribute vec3 aP;attribute vec3 aN;attribute float aK;uniform mat4 uP,uMV;uniform mat3 uNM;varying vec3 vP,vN,vM,vNM;varying float vK;void main(){vM=aP;vNM=aN;vN=uNM*aN;vec4 m=uMV*vec4(aP,1.);vP=m.xyz;vK=aK;gl_Position=uP*m;}';
const FS=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vP,vN,vM,vNM;varying float vK;uniform vec3 uC,uOv;uniform sampler2D uF,uB,uL,uR;uniform vec4 uA,uS,uZF,uZB;uniform vec3 uSa;
float lines(vec2 p,vec2 sz){
  float l=0.;
  if(uOv.x>.5)l=max(l,1.-smoothstep(0.,1.1,min(min(p.x,sz.x-p.x),min(p.y,sz.y-p.y))));
  if(uOv.y>.5){vec2 g=abs(fract(p/5.+.5)-.5)*5.;l=max(l,.55*(1.-smoothstep(0.,.45,min(g.x,g.y))));}
  if(uOv.z>.5){vec2 c=abs(p-sz*.5);l=max(l,.8*(1.-smoothstep(0.,.55,min(c.x,c.y))));}
  return l;
}
void main(){
  vec3 n=normalize(vN);vec3 v=normalize(-vP);float f=dot(n,v);bool inside=f<0.;if(inside)n=-n;
  vec3 L=normalize(vec3(-.45,.65,.6));float d=max(dot(n,L),0.);
  if(vK>2.5){float sp=pow(max(dot(reflect(-L,n),v),0.),28.)*.35;gl_FragColor=vec4(vec3(.17,.17,.2)*(.55+.45*d)+sp+vec3(.04)*pow(1.-abs(f),2.),1.);return;}
  vec3 base=uC*((vK>.5&&vK<1.5)?.9:1.);float a=0.;vec3 dc=vec3(0.);float ov=0.;
  if(!inside&&vK<.5){
    bool fr=vNM.z>0.;float sx=fr?150.+(vM.x-uA.x)*uA.z:150.-(vM.x-uA.x)*uA.z;float sy=38.-(vM.y-uA.y)*uA.w;vec2 uv=vec2(sx/300.,sy/330.);
    float w=smoothstep(.1,.45,abs(vNM.z));
    if(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.){vec4 t=fr?texture2D(uF,uv):texture2D(uB,uv);a=t.a*w;dc=t.rgb*w;}
    vec4 z=fr?uZF:uZB;
    if(z.z>0.&&abs(vNM.z)>.3){vec2 p=vec2(sx-z.x,sy-z.y);if(p.x>-1.&&p.y>-1.&&p.x<z.z+1.&&p.y<z.w+1.)ov=lines(p,z.zw)*smoothstep(.3,.55,abs(vNM.z));}
    if(uS.w>0.&&abs(vM.x)>.64&&vM.y>-.15&&vM.y<.8){
      float sg=vM.x>0.?1.:-1.;float sw=smoothstep(.02,.12,vNM.x*sg);
      if(sw>0.){
        float al=(abs(vM.x)-uS.x)*uSa.x+(vM.y-uS.y)*uSa.y;
        float cz=sg>0.?uS.z:uSa.z;float su=(sg>0.?-(vM.z-cz):(vM.z-cz))/uS.w+.5,sv=al/uS.w+.5;
        if(su>0.&&su<1.&&sv>0.&&sv<1.){
          vec2 tuv=vec2((105.+su*90.)/300.,(112.+sv*90.)/330.);vec4 t=sg>0.?texture2D(uL,tuv):texture2D(uR,tuv);
          a=max(a,t.a*sw);dc=mix(dc,t.rgb*sw,step(.001,t.a*sw));
        }
        if(su>-.02&&su<1.02&&sv>-.02&&sv<1.02&&(uOv.x+uOv.y+uOv.z)>0.)ov=max(ov,lines(vec2(su,sv)*90.,vec2(90.))*smoothstep(.3,.5,vNM.x*sg));
      }
    }
  }
  vec3 col=(base*(1.-a)+dc)*(.5+.5*d)+vec3(.05)*d+pow(1.-abs(f),3.)*.1;
  if(inside)col*=.55;
  float lum=dot(col,vec3(.3,.6,.1));col=mix(col,lum>.5?vec3(0.):vec3(1.),ov*.9);
  gl_FragColor=vec4(col,1.);}`;

/* GLB loader: plain .glb only. Biggest part = shirt, everything else = hanger. */
async function loadModel(){
  for(const u of [MODEL_CFG.url,'shirt.glb','assets/shirt.glb']){try{const r=await fetch(u);if(r.ok)return parseGLB(await r.arrayBuffer())}catch(e){}}
  return null;
}
async function ensureModel(){if(MODEL===undefined){MODEL=await loadModel();if(!MODEL)toast('Shirt model not found. Showing a basic 3D shape.')}}
function parseGLB(buf){
  const dv=new DataView(buf);if(dv.getUint32(0,true)!==0x46546C67)throw 0;
  const jl=dv.getUint32(12,true),J=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,20,jl))),bo=20+jl+8;
  if(J.extensionsRequired&&J.extensionsRequired.length)throw 0; // Draco/meshopt compressed files are not supported
  const rd=ai=>{const a=J.accessors[ai],bv=J.bufferViews[a.bufferView],nc={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],ct=a.componentType,cs=ct===5126||ct===5125?4:2,st=bv.byteStride||nc*cs,o=bo+(bv.byteOffset||0)+(a.byteOffset||0),out=new Float32Array(a.count*nc);
    for(let i=0;i<a.count;i++)for(let c=0;c<nc;c++){const p=o+i*st+c*cs;out[i*nc+c]=ct===5126?dv.getFloat32(p,true):ct===5125?dv.getUint32(p,true):dv.getUint16(p,true)}return out};
  const trs=n=>{const t=n.translation||[0,0,0],[x,y,z,w]=n.rotation||[0,0,0,1],s=n.scale||[1,1,1];
    return[(1-2*(y*y+z*z))*s[0],2*(x*y+z*w)*s[0],2*(x*z-y*w)*s[0],0,2*(x*y-z*w)*s[1],(1-2*(x*x+z*z))*s[1],2*(y*z+x*w)*s[1],0,2*(x*z+y*w)*s[2],2*(y*z-x*w)*s[2],(1-2*(x*x+y*y))*s[2],0,t[0],t[1],t[2],1]};
  const parts=[],walk=(i,pm)=>{const n=J.nodes[i],m=mm(pm,n.matrix?n.matrix:trs(n));if(n.mesh!=null)J.meshes[n.mesh].primitives.forEach(p=>parts.push({p,m}));(n.children||[]).forEach(c=>walk(c,m))};
  J.scenes[J.scene||0].nodes.forEach(i=>walk(i,tr(0,0,0)));
  const all=[];
  parts.forEach(({p,m})=>{
    if((p.mode??4)!==4||p.attributes.NORMAL==null)return;
    const P=rd(p.attributes.POSITION),N=rd(p.attributes.NORMAL),I=rd(p.indices),n=P.length/3,v=new Float32Array(n*7),lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
    for(let i=0;i<n;i++){const x=P[i*3],y=P[i*3+1],z=P[i*3+2],nx=N[i*3],ny=N[i*3+1],nz=N[i*3+2];
      const w=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]],q=[m[0]*nx+m[4]*ny+m[8]*nz,m[1]*nx+m[5]*ny+m[9]*nz,m[2]*nx+m[6]*ny+m[10]*nz],l=Math.hypot(q[0],q[1],q[2])||1;
      v.set([w[0],w[1],w[2],q[0]/l,q[1]/l,q[2]/l,0],i*7);for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],w[k]);hi[k]=Math.max(hi[k],w[k])}}
    all.push({vol:(hi[0]-lo[0])*(hi[1]-lo[1])*(hi[2]-lo[2]),v,I,n,lo,hi});
  });
  if(!all.length)throw 0;
  all.sort((a,b)=>b.vol-a.vol);const best=all[0];
  if(all.reduce((s,x)=>s+x.n,0)>65535)throw 0;
  const k=2/(best.hi[1]-best.lo[1]),c=[0,1,2].map(a=>(best.lo[a]+best.hi[a])/2);
  const V=[],Ix=[];let off=0;
  all.forEach((x,ix)=>{for(let i=0;i<x.n;i++){for(let a=0;a<3;a++)x.v[i*7+a]=(x.v[i*7+a]-c[a])*k;x.v[i*7+6]=ix===0?0:3}  // center on the shirt, 2 units tall. kind 3 = hanger
    V.push(...x.v);x.I.forEach(j=>Ix.push(j+off));off+=x.n;if(ix===0)best.ns=Ix.length});
  return{v:new Float32Array(V),i:Uint16Array.from(Ix),ns:best.ns};
}

function init3(){
  const c=document.createElement('canvas');c.className='gl3';
  const gl=c.getContext('webgl',{antialias:PF.tier!=='low',alpha:true,premultipliedAlpha:true,powerPreference:'low-power'});
  if(!gl)return null;
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o},pr=gl.createProgram();
  gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return null;
  gl.useProgram(pr);
  const m=MODEL||shirtMesh(),vb=gl.createBuffer(),ib=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,m.v,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.i,gl.STATIC_DRAW);
  [['aP',3,0],['aN',3,12],['aK',1,24]].forEach(([n,s,o])=>{const l=gl.getAttribLocation(pr,n);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,s,gl.FLOAT,false,28,o)});
  const tex=u=>{const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+u);gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
    [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]].forEach(([p,v])=>gl.texParameteri(gl.TEXTURE_2D,p,v));return t};
  const g={c,gl,pr,n:m.i.length,ns:m.ns||m.i.length,hasH:!!(m.ns&&m.ns<m.i.length),hanger:false,full:false,map:MODEL?MODEL_CFG.map:[0,.9,110,142.6],tF:tex(0),tB:tex(1),tL:tex(2),tR:tex(3),ov:[0,0,0],zf:[0,0,0,0],zb:[0,0,0,0],col:[.1,.1,.13],yaw:0,pitch:.1,dist:4.2,q:0,tok:0,last:0,u:n=>gl.getUniformLocation(pr,n)};
  g.d0=()=>g.hanger&&g.hasH?4.6:3.7;g.dist=g.d0();
  gl.uniform1i(g.u('uF'),0);gl.uniform1i(g.u('uB'),1);gl.uniform1i(g.u('uL'),2);gl.uniform1i(g.u('uR'),3);gl.enable(gl.DEPTH_TEST);
  bind3(c,g);
  c.addEventListener('webglcontextlost',e=>{e.preventDefault();if(!G3||G3.c!==c)return;G3=null;toast('3D stopped. Showing 2D.');if(window.onGLLost)window.onGLLost()});
  return g;
}
function bind3(c,g){   // one finger turns the shirt, two fingers zoom, wheel zooms in full screen
  const P=new Map();let d0=0,z0=1;
  c.onpointerdown=e=>{try{c.setPointerCapture(e.pointerId)}catch(_){};P.set(e.pointerId,[e.clientX,e.clientY]);if(P.size===2){const[a,b]=[...P.values()];d0=Math.hypot(a[0]-b[0],a[1]-b[1])||1;z0=g.dist}};
  c.onpointermove=e=>{
    const o=P.get(e.pointerId);if(!o)return;P.set(e.pointerId,[e.clientX,e.clientY]);
    if(P.size===1){g.yaw+=(e.clientX-o[0])*.012;g.pitch=clamp(g.pitch+(e.clientY-o[1])*.006,g.full?-1.5:-.35,g.full?1.5:.5)}
    else if(P.size===2){const[a,b]=[...P.values()];g.dist=clamp(z0*d0/(Math.hypot(a[0]-b[0],a[1]-b[1])||1),2.4,8)}
    req3();
  };
  c.onpointerup=c.onpointercancel=e=>{P.delete(e.pointerId)};
  c.addEventListener('wheel',e=>{if(!g.full)return;e.preventDefault();g.dist=clamp(g.dist*Math.exp(e.deltaY*.001),2.4,8);req3()},{passive:false});
}
function sizeC(){
  const g=G3;if(!g||!g.c.parentNode)return;const r=g.c.parentNode.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,PF.tier==='high'?2:1.5);
  g.c.width=Math.max(2,Math.round(r.width*dpr));g.c.height=Math.max(2,Math.round(r.height*dpr));req3();
}
addEventListener('resize',()=>{if(G3)sizeC()});
function draw3(t){
  if(!G3)return;const g=G3,gl=g.gl,f=1/Math.tan(.31);g.q=0;
  if(g.last&&t-g.last<200)perfFrame(t-g.last);g.last=t;
  gl.viewport(0,0,g.c.width,g.c.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const a=g.c.width/g.c.height,P=[f/a,0,0,0,0,f,0,0,0,0,-1.0101,-1,0,0,-.20101,0],H=g.hanger&&g.hasH;
  const MV=mm(tr(0,0,-g.dist),mm(rX(g.pitch),mm(rY(g.yaw),tr(0,H?-.14:.05,0))));
  gl.uniformMatrix4fv(g.u('uP'),false,P);gl.uniformMatrix4fv(g.u('uMV'),false,MV);
  gl.uniformMatrix3fv(g.u('uNM'),false,[MV[0],MV[1],MV[2],MV[4],MV[5],MV[6],MV[8],MV[9],MV[10]]);
  gl.uniform3fv(g.u('uC'),g.col);gl.uniform4fv(g.u('uA'),g.map);const SLV=MODEL_CFG.sleeve;gl.uniform4fv(g.u('uS'),MODEL&&!g.nosl?[SLV[0],SLV[1],SLV[2],SLV[3]]:[0,0,0,0]);gl.uniform3fv(g.u('uSa'),[SLV[4],SLV[5],SLV[6]??SLV[2]]);gl.uniform3fv(g.u('uOv'),g.ov);gl.uniform4fv(g.u('uZF'),g.zf);gl.uniform4fv(g.u('uZB'),g.zb);
  gl.drawElements(gl.TRIANGLES,H?g.n:g.ns,gl.UNSIGNED_SHORT,0);
}
const req3=()=>{if(G3&&!G3.q){G3.q=1;requestAnimationFrame(draw3)}};
const IMGC=new Map(),getImg=src=>{if(!IMGC.has(src))IMGC.set(src,new Promise(r=>{const im=new Image();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=src}));return IMGC.get(src)};
async function decal(d,s){
  const W=600,H=660,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  for(const it of arr(d,s)){const im=await getImg(it.src);if(!im)continue;const w=it.w*W,h=w*im.height/im.width;x.save();x.translate(it.x*W,it.y*H);x.rotate(it.r*Math.PI/180);x.drawImage(im,-w/2,-h/2,w,h);x.restore()}
  return c;
}
async function set3(d){
  const g=G3;if(!g)return;const k=++g.tok,h=d.O.hex.replace('#','');g.col=[0,2,4].map(i=>parseInt(h.substr(i,2),16)/255);const sd=sides(d.O);g.zf=sd.includes('F')?zone(d,'F'):[0,0,0,0];g.zb=sd.includes('B')?zone(d,'B'):[0,0,0,0];req3();
  const [f,b,l,r]=await Promise.all([decal(d,'F'),decal(d,'B'),decal(d,'SL'),decal(d,'SR')]);if(G3!==g||g.tok!==k)return;
  const gl=g.gl;gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  [[0,g.tF,f],[1,g.tB,b],[2,g.tL,l],[3,g.tR,r]].forEach(([u,t,cv])=>{gl.activeTexture(gl.TEXTURE0+u);gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cv)});
  req3();
}
function free3(){if(G3){G3.gl.getExtension('WEBGL_lose_context')?.loseContext();G3.c.remove();G3=null}closeFS(true)}


/* full screen viewer */
function openFS(){if(!G3)return;G3.full=true;G3.home=G3.c.parentNode;$('#fsC').append(G3.c);$('#fs').classList.add('on');$('#fsH').hidden=!G3.hasH;sizeC()}
function closeFS(quiet){
  $('#fs').classList.remove('on');if(!G3||!G3.full)return;G3.full=false;G3.pitch=clamp(G3.pitch,-.35,.5);
  if(!quiet){(G3.home&&G3.home.isConnected?G3.home:$('#v3'))?.append(G3.c);requestAnimationFrame(sizeC)}
}
$('#fsX')&&($('#fsX').onclick=()=>closeFS());
if($('#fsH'))$('#fsH').onclick=()=>{if(G3){G3.hanger=!G3.hanger;G3.dist=G3.d0();req3()}};
if($('#fsR'))$('#fsR').onclick=()=>{if(G3){G3.yaw=0;G3.pitch=.1;G3.dist=G3.d0();req3()}};
addEventListener('keydown',e=>{if(e.key==='Escape')closeFS()});


/* high-resolution picture of the current 3D view */
function snap3(w=2400){return new Promise(res=>{if(!G3)return res(null);const c=G3.c,ow=c.width,oh=c.height;c.width=w;c.height=Math.round(w*oh/ow);draw3(performance.now());c.toBlob(b=>{c.width=ow;c.height=oh;req3();res(b)},'image/png')})}
installSprite();


/* ===== shop ===== */
/* =====================================================================
   SITE CONFIG: put your image/video paths and texts here. Leave '' to keep
   the placeholder. As soon as a file loads, its placeholder box and border
   disappear completely. Example: logo:'assets/logo.png'
   ===================================================================== */
const SITE={
  images:{            // every slot has a ready file name. Put your picture in an "images" folder next to index.html with that exact name, or change the name here.
    logo:'images/logo.png',                 // landing page logo (transparent PNG works best)
    authBg:'images/auth-bg.png',            // soft background for sign up / log in screens
    tapIcon:'images/tap-icon.png',          // "tap right side" hint icon on the first intro slide
    alcGeneric:'images/alchemy-generic.png',// Prompt Alchemy: the generic image
    alcPrompt:'images/alchemy-prompt.png',  // Prompt Alchemy: the image made with Prompt Alchemy
    bentoDesign:'images/tile-design.png',   // dashboard tile "Start with a design"
    bentoIdea:'images/tile-idea.png',       // dashboard tile "Just an idea"
    sizeChart:'images/size-chart.png',      // size chart popup
    auhsy:'images/auhsy.png',               // Auhsy AI image on the "And finally" page
    questionBox:'images/question-box.png',  // image box on the questionnaire pages
    layouts:{lc:'images/layout-left-chest.png',rc:'images/layout-right-chest.png',cc:'images/layout-center-chest.png',ff:'images/layout-full-front.png',of:'images/layout-oversize-front.png',bn:'images/layout-back-neck.png',ub:'images/layout-upper-back.png',fb:'images/layout-full-back.png',sl:'images/layout-sleeve-left.png',sr:'images/layout-sleeve-right.png'},
    styles:{Minimalist:'images/style-minimalist.png',Typographic:'images/style-typographic.png',Editorial:'images/style-editorial.png',Y2K:'images/style-y2k.png',Maximalist:'images/style-maximalist.png',Streetwear:'images/style-streetwear.png','Retro / Vintage':'images/style-retro-vintage.png',Illustrated:'images/style-illustrated.png','Type your own':'images/style-type-your-own.png'}
  },
  videos:{            // background videos. One file for upright screens (phones, tablets) and one for wide screens (laptops, desktops, tilted devices)
    portrait:'videos/intro-portrait.mp4',      // landing page, portrait
    landscape:'videos/intro-landscape.mp4',    // landing page, landscape
    stories:{portrait:'videos/story-portrait.mp4',landscape:'videos/story-landscape.mp4'}  // backgrounds behind the intro stories
  },
  how:[ // "Curious how it works?" cards on the intro: a title and one or two lines each. Add or remove cards freely.
    {title:'Pick your shirt',text:'Choose the color, the sizes and where the print goes: chest, front, back or sleeves.'},
    {title:'Add your design or your idea',text:'Upload your artwork and place it on a live shirt, or tell Auhsy your idea and our designers make it for you.'},
    {title:'Approve, pay, we print',text:'Nothing is printed until you approve it. Printing takes 3 to 5 days, then shipping takes 2 to 5 days.'}
  ],
  text:{
    alcGeneric:'cool tiger shirt design, cartoon style, orange and teal',   // Prompt Alchemy: the plain prompt (left panel)
    alcPrompt:[                                // Prompt Alchemy: the crafted prompt (right panel). Each part gets its own color, in this order
      {title:'Subject',text:'One tiger head mid-roar in three-quarter view: ears pinned back, whiskers flared, eyes narrowed and locked on the viewer.'},
      {title:'Line',text:'Hand-inked bold black outlines, thick on the silhouette and fine inside, every stroke ending in a tapered brush point.'},
      {title:'Color',text:'Burnt orange #E8772E fur, black stripes that follow the form, teal #28D0D0 halftone shadows, deep teal #0C7C7C for the deepest depth, white fangs and eye glints.'},
      {title:'Composition',text:'Centered chest print, the head filling the middle of the frame, a few short ink strokes bursting from the roar, clean space all around.'},
      {title:'Output',text:'Flat 2D vector, crisp edges, print-ready at 300 DPI, square canvas, off-white background, one single design, no T-shirt mockup, streetwear mood.'}
    ],
    questionBox:''    // helper text under the questionnaire image box
  },
  chat:{welcome:'Hi! How can we help with your design?',auto:'Thanks for reaching out! A teammate will reply here soon.'}
};
const LOADED=new Set();
function applyImg(el,src){
  if(!src)return;
  const on=()=>{el.style.setProperty('--img',`url("${src}")`);el.classList.add('has-img')};
  if(LOADED.has(src))return on();
  const im=new Image();im.onload=()=>{LOADED.add(src);on()};im.src=src; // a missing file keeps the placeholder
}
function applyAssets(root=document){
  root.querySelectorAll('[data-img]').forEach(el=>applyImg(el,el.dataset.img.split('.').reduce((o,k)=>o?.[k],SITE)));
}
/* ---- global state (declared first so every part can use it) ---- */
let M3=false,M3E=false,ORD=[],CUR=-1,SIDE='F',SEL=-1,U=[],Rd=[],HB='',QI=0,LANG='en',DSEL=-1,REV=0,RV='F',CV='F',O={},NEWTAB=-1;

/* ---- greetings: 14 for each part of the day (Manila time). {n} becomes ", Name" ---- */
const GREET={
  morning:['Morning tea{n}? Let\'s steep a fresh design.','Rise and print{n}.','Fresh morning{n}. Fresh tee idea?','Coffee first, then colors{n}.','Good morning{n}. Your blank tee is waiting.','A new day, a new drop{n}.','Morning{n}. What are we wearing next?','Early bird gets the best print{n}.','Sunrise sketches{n}? Let\'s go.','Kape muna{n}, then design tayo.','Start the day with something wearable{n}.','Morning inspiration{n}? Let\'s turn it into a tee.','Let\'s ink the morning{n}.','Good morning{n}. Ready to make something iconic?'],
  afternoon:['Afternoon{n}. Time for a creative break.','Merienda and mockups{n}?','Lunch break design{n}? Let\'s make it count.','Halfway through the day{n}. One tee to go.','Good afternoon{n}. Let\'s print your idea.','Afternoon spark{n}. What\'s the vibe today?','Sun\'s high, ideas higher{n}.','Quick afternoon drop{n}?','Still plenty of time to design{n}.','Let\'s make your afternoon wearable{n}.','Mid-day mood board{n}? Let\'s go.','Iced coffee and ink{n}?','Good afternoon{n}. Your design deserves a shirt.','Pick a color, pick a story{n}.'],
  evening:['Good evening{n}. Let\'s design something cozy.','Night owl{n}? Perfect time to sketch.','Golden hour, golden idea{n}.','Evening{n}. Wind down with a design.','Dinner\'s cooking{n}, so is your design.','Let\'s end the day with a fresh tee{n}.','Late-night inspo{n}? We\'re here for it.','Good evening{n}. Ready to print your idea?','Moonlight mockups{n}?','After-hours creativity{n}. Let\'s go.','Sleep on it{n}? Or design it now.','Evening ritual{n}: one tee, one idea.','Quiet night, loud design{n}.','Good evening{n}. Let\'s make tomorrow\'s outfit.']
};
const mHour=()=>+new Intl.DateTimeFormat('en-US',{hour:'numeric',hourCycle:'h23',timeZone:'Asia/Manila'}).format(new Date());
const dayPart=()=>{const h=mHour();return h>=5&&h<12?'morning':h<18&&h>=12?'afternoon':'evening'};
function greetText(name){
  const p=dayPart(),k='sh_g_'+p;let i=sessionStorage.getItem(k);
  if(i==null){i=Math.floor(Math.random()*GREET[p].length);sessionStorage.setItem(k,i)}   // one variation per visit
  return GREET[p][+i].replace('{n}',name?', '+name:'');
}

/* ---- performance: auto test + tiers (high / mid / low) + watchdog ---- */
PF.tier='mid';function applyTier(t){PF.tier=t;document.documentElement.dataset.tier=t;if(typeof setVid==='function')setVid();perfUI()}
function perfSave(tier){try{localStorage.sh_perf=JSON.stringify({tier,mode:PF.mode,ts:Date.now()})}catch(e){}}
function perfUI(){
  $$('#pf button').forEach(b=>b.classList.toggle('on',b.dataset.m===PF.mode));
  const n=$('#pfNote');if(n)n.textContent=PF.mode==='auto'?`Auto: this device was tested as ${PF.tier==='high'?'full':PF.tier==='mid'?'balanced':'lite'}.`:PF.mode==='high'?'Full effects are on. The 2D design view always stays light for smooth dragging.':'Lite mode is on for the smoothest speed.';
}
function perfInit(){
  let s=null;try{s=JSON.parse(localStorage.sh_perf||'null')}catch(e){}
  PF.mode=s?.mode||'auto';
  const weak=(navigator.hardwareConcurrency||8)<=2||(navigator.deviceMemory||8)<=1||navigator.connection?.saveData||matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(PF.mode==='high')applyTier('high');
  else if(PF.mode==='low')applyTier('low');
  else if(s?.tier&&Date.now()-s.ts<21*864e5)applyTier(s.tier);
  else{applyTier(weak?'low':'mid');setTimeout(perfRun,800)}   // provisional tier until the quick test finishes
}
function perfRun(){
  const box=document.createElement('div');
  box.style.cssText='position:fixed;right:0;bottom:0;width:200px;height:200px;opacity:.04;pointer-events:none;z-index:-1';
  box.innerHTML=Array.from({length:6},(_,i)=>`<i style="position:absolute;left:${i*24}px;top:${i*18}px;width:90px;height:90px;border-radius:24px;background:#0b0b0b"></i>`).join('');
  document.body.append(box);
  const A=[],Bq=[];let ph=1,t0=0,last=0,f=0;
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:99;
  const tick=t=>{
    if(!t0){t0=last=t}
    const dt=t-last;last=t;if(f++>3)(ph===1?A:Bq).push(dt);
    [...box.children].forEach((e,i)=>{if(e.tagName==='I')e.style.transform=`translate(${Math.sin(t/300+i)*40}px,${Math.cos(t/260+i)*30}px) rotate(${t/20+i*30}deg)`});
    if(ph===1&&t-t0>650){ph=2;t0=t;f=0;box.insertAdjacentHTML('beforeend','<b style="position:absolute;inset:0;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)"></b><b style="position:absolute;inset:20px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)"></b>')}
    if(ph===2&&t-t0>750){
      box.remove();const a1=avg(A),a2=avg(Bq);
      const tier=a1<=19&&a2<=21?'high':a1<=25?'mid':'low';
      if(PF.mode==='auto'){applyTier(tier);perfSave(tier)}
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function perfFrame(dt){   // watchdog: called while dragging or orbiting. Steps the tier down if the device really struggles.
  if(PF.mode!=='auto'||PF.bypass||PF.tier==='low'||dt>250)return;
  PF.n++;PF.sum+=dt;
  if(PF.n>=50){const a=PF.sum/PF.n;PF.n=0;PF.sum=0;if(a>42){const t=PF.tier==='high'?'mid':'low';applyTier(t);perfSave(t);toast('Switched to a lighter mode for smoother speed')}}
}
$('#pf')?.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;PF.mode=b.dataset.m;
  if(PF.mode==='auto'){applyTier('mid');perfSave('mid');setTimeout(perfRun,300)}else{applyTier(PF.mode);perfSave(PF.mode)}
});

/* ---- background videos: a portrait file and a landscape file, swapped by screen orientation ---- */
function bgVideo(els,cfg,active,ph){
  const land=matchMedia('(orientation:landscape)').matches,want=land?'landscape':'portrait',other=land?'portrait':'landscape';
  const E={portrait:els[0],landscape:els[1]},off=PF.tier==='low'||navigator.connection?.saveData||!active,src=cfg[want]||cfg[other];
  Object.entries(E).forEach(([k,v])=>{if(k!==want||off||!src){v.pause();v.hidden=true}});
  if(ph)ph.textContent=cfg[want]||cfg[other]||`{${want} video here}`;
  if(off||!src){if(ph)ph.hidden=false;return}
  const v=E[want],good=()=>{v.dataset.ok='1';v.hidden=false;if(ph)ph.hidden=true;v.play().catch(()=>{})};
  if(v.dataset.src!==src){v.dataset.src=src;v.dataset.ok='0';v.src=src;v.load()}
  v.onloadeddata=good;
  v.onerror=()=>{const alt=cfg[other];if(alt&&v.dataset.src!==alt){v.dataset.src=alt;v.src=alt;v.load()}else{v.hidden=true;if(ph)ph.hidden=false}};   // missing file: try the other orientation's file, then the placeholder
  if(v.dataset.ok==='1'&&v.readyState>=2)good();else if(ph)ph.hidden=false;
}
function setVid(){
  bgVideo([$('#vP'),$('#vL')],SITE.videos,S.scr==='land',$('#vph'));
  bgVideo([$('#iP'),$('#iL')],SITE.videos.stories||{},S.scr==='intro',null);
}
matchMedia('(orientation:landscape)').addEventListener?.('change',()=>setVid());
['pointerdown','keydown','touchstart'].forEach(ev=>addEventListener(ev,()=>{$$('video.vid').forEach(v=>{if(!v.hidden&&v.paused)v.play().catch(()=>{})})},{passive:true}));   // browsers that block autoplay start the video on the first tap or key

/* ---- textareas grow line by line (no resize handle, no scrollbar) ---- */
function grow(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight+2,el.dataset.max?+el.dataset.max:220)+'px'}
document.addEventListener('input',e=>{if(e.target.tagName==='TEXTAREA')grow(e.target)});
const growAll=root=>$$('textarea',root||document).forEach(grow);

/* ---- tiny confirm dialog ---- */
function ask(title,text,yes,label='Yes'){
  $('#askT').textContent=title;$('#askP').textContent=text;$('#askY').textContent=label;
  $('#ask').classList.add('on');
  $('#askY').onclick=()=>{$('#ask').classList.remove('on');yes()};
  $('#askN').onclick=()=>$('#ask').classList.remove('on');
}

/* ---- API: DEMO STUB. Replace each method with fetch('/api/...') to app.py later.
   Demo only: real PIN checks, lockout and email codes MUST run server-side. ---- */
const API={
  async sendCode(email){return true},
  async verifyCode(code){return code==='123456'},            // demo code
  accounts(){return JSON.parse(localStorage.sh_acc||'[]')},
  async savePin(a){const l=this.accounts().filter(x=>x.email!==a.email);l.push(a);localStorage.sh_acc=JSON.stringify(l)},
  async checkPin(a,pin){return a.pin===pin},
  nameKey:n=>String(n||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim(),
  async nameTaken(n,ownEmail){const k=this.nameKey(n);return this.accounts().some(a=>this.nameKey(a.name)===k&&a.email!==ownEmail)}   // the server must enforce this too (unique index)
};

const S={scr:'land',mode:'signup',email:'',name:'',first:'',ps:'c',acc:null,h:[],tries:0,lock:0,full:false,max:0};

/* ---- routing ---- */
function go(id,push=true){
  if(id!=='rev'&&M3){M3=false;free3()}
  if(id!=='edit'){if(M3E){M3E=false;free3();showStage()}if(ADJ.on)adjOpen(false)}
  $$('.scr').forEach(e=>e.classList.remove('on'));$('#s-'+id).classList.add('on');S.scr=id;
  document.querySelector('meta[name=theme-color]').content=(id==='land'||id==='intro')?'#000000':(document.documentElement.dataset.theme==='dark'?'#0e0f10':'#f6f6f4');
  if(push)S.h.push(id);
  $('#uit')&&$('#uit').classList.toggle('onDark',id==='land'||id==='intro');
  luxScr(id);fabShow();setVid();
  if(matchMedia('(hover:hover)').matches)setTimeout(()=>{const el=$('#s-'+id+' input:not([hidden]):not([type=file])');if(el&&$('#s-'+id).classList.contains('on'))el.focus({preventScroll:true})},80);
  closeFS(true);
}
function back(){S.h.pop();go(S.h[S.h.length-1]||'land',false)}
function shake(el){el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake')}

/* ---- PIN keypad ---- */
function keypad(pad,dots,cb){
  let v='';
  dots.innerHTML='<i></i><i></i><i></i><i></i>';
  pad.innerHTML=[1,2,3,4,5,6,7,8,9,'',0,'X'].map(k=>k===''?'<span></span>':`<button data-k="${k}" class="${k==='X'?'x':''}" aria-label="${k==='X'?'Erase':k}">${k}</button>`).join('');
  const draw=()=>[...dots.children].forEach((d,i)=>d.classList.toggle('f',i<v.length));
  const press=k=>{
    k=String(k);if(k==='X')v=v.slice(0,-1);else if(/^\d$/.test(k)&&v.length<4)v+=k;else return;
    draw();if(v.length===4)setTimeout(()=>{const x=v;v='';draw();cb(x)},160);
  };
  pad.onclick=e=>{const k=e.target.closest('button')?.dataset.k;if(k!==undefined)press(k)};
  return{clear(){v='';draw()},press};
}

/* ---- sign up / forgot ---- */
function start(mode){
  S.mode=mode;$('#emailT').textContent=mode==='forgot'?'Reset your PIN':'Create your account';
  $('#email').value='';$('#emailE').textContent='';go('email');
}
$('#emailB').onclick=async()=>{
  const e=$('#email').value.trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(e)){$('#emailE').textContent='Enter a valid email address.';return}
  S.email=e;$('#emailB').disabled=true;try{await API.sendCode(e)}catch(err){$('#emailB').disabled=false;$('#emailE').textContent=err.message||'Could not send the code. Try again.';shake($('#email'));return}$('#emailB').disabled=false;
  $('#codeSub').textContent=`We sent a code to ${e}. (Demo code: 123456)`;
  $('#code').value='';$('#codeE').textContent='';go('code');
};
$('#code').oninput=e=>e.target.value=e.target.value.replace(/\D/g,'');
$('#codeB').onclick=async()=>{
  if(!await API.verifyCode($('#code').value,S.email)){$('#codeE').textContent=S.codeErr||"That code doesn't match. Check your email and try again.";S.codeErr='';shake($('#code'));return}
  S.mode==='forgot'?askPin('c'):go('name');
};
$('#nameB').onclick=async()=>{
  const n=$('#name').value.trim();
  if(n.length<2){$('#nameE').textContent='Enter your name.';return}
  if(await API.nameTaken(n,S.email)){$('#nameE').textContent='That name is already taken. Please enter a different one.';shake($('#name'));$('#name').focus();return}
  $('#nameE').textContent='';S.name=n;askPin('c');
};
$('#name').addEventListener('input',()=>{$('#nameE').textContent=''});
function askPin(step){
  S.ps=step;
  $('#pinT').textContent=step==='c'?'Create your PIN':'Confirm your PIN';
  $('#pinS').textContent=step==='c'?"4 digits. You'll use it every time you log in.":'Enter the same PIN again.';
  $('#pinE').textContent='';pin.clear();
  if(!$('#s-pin').classList.contains('on'))go('pin');
}
const pin=keypad($('#pinPad'),$('#pinDots'),async v=>{
  if(S.ps==='c'){S.first=v;askPin('v');return}
  if(v!==S.first){askPin('c');$('#pinE').textContent="PINs didn't match. Start again.";shake($('#pinDots'));return}
  const old=API.accounts().find(a=>a.email===S.email);
  const name=S.mode==='forgot'?(old?.name||S.email.split('@')[0]):S.name;
  let sv;try{sv=await API.savePin({name,email:S.email,pin:v})}catch(err){
    if(/name is already taken/i.test(err.message)){go('name');$('#nameE').textContent=err.message;return}
    askPin('c');$('#pinE').textContent=err.message||'Something went wrong. Try again.';return}
  S.acc={name:(sv&&sv.name)||name,email:S.email};
  if(S.mode==='forgot'){S.h=[];toast('PIN updated. Log in with your new PIN.');showLogin()}
  else{$('#pName').value=name;$('#profile').classList.add('on')}
});

/* ---- optional profile popup ---- */
$('#addr').innerHTML=['House / Block & Lot no.','Building, unit or floor (optional)','Street','Barangay','City','Province','Region','ZIP code'].map((p,i)=>`<input class="in" placeholder="${p}" data-a="${p}" style="${i<3?'grid-column:1/-1':''}">`).join('');
const askLeave=()=>$('#confirm').classList.add('on');
$('#pClose').onclick=askLeave;$('#pSkip').onclick=askLeave;
$('#cStay').onclick=()=>$('#confirm').classList.remove('on');
function closeProfile(){
  $('#profile').classList.remove('on');$('#confirm').classList.remove('on');
  if(S.edit){S.edit=false;dash()}else intro();
}
$('#cLeave').onclick=closeProfile;
$('#pSave').onclick=async()=>{
  const n=$('#pName').value.trim();
  if(n&&S.acc&&await API.nameTaken(n,S.acc.email)){toast('That name is already taken. Please use a different one.');shake($('#pName'));return}
  localStorage.sh_prof=JSON.stringify({full:n,phone:$('#pPhone').value,addr:$$('[data-a]').map(i=>i.value)}); // demo only
  if(n&&S.acc){S.acc.name=n;API.savePin({...API.accounts().find(a=>a.email===S.acc.email),name:n})}
  toast('Details saved');closeProfile();
};

/* ---- log in ---- */
const mask=e=>e.replace(/^(.).*(@.*)$/,'$1***$2');
function showLogin(){
  S.acc=null;$('#loginPin').hidden=true;$('#lErr').textContent='';
  const l=API.accounts();
  $('#tiles').innerHTML=l.length?l.map((a,i)=>`<button class="tile" data-i="${i}"><b>${a.name}</b><small>${mask(a.email)}</small></button>`).join('')
    :'<div class="card sub">No account on this device yet. Sign up, or tap Forgot PIN to add one.</div>';
  go('login');
}
$('#tiles').onclick=e=>{
  const t=e.target.closest('.tile');if(!t)return;
  $$('.tile').forEach(x=>x.classList.remove('sel'));t.classList.add('sel');
  S.acc=API.accounts()[t.dataset.i];S.tries=0;
  $('#loginWho').textContent=`Hi ${S.acc.name}, enter your PIN`;$('#lErr').textContent='';
  $('#loginPin').hidden=false;
};
const lpad=keypad($('#lPad'),$('#lDots'),async v=>{
  if(Date.now()<S.lock){$('#lErr').textContent=`Too many tries. Try again in ${Math.ceil((S.lock-Date.now())/60000)} min.`;return}
  if(await API.checkPin(S.acc,v)){S.tries=0;dash();return}
  S.tries++;shake($('#lDots'));
  if(NET.on&&S.lerr){$('#lErr').textContent=S.lerr;S.tries=0;return}   // the server counts tries and locks the account
  if(S.tries>=5){S.lock=Date.now()+15*60000;S.tries=0;$('#lErr').textContent='Locked for 15 minutes. Use Forgot PIN to reset now.'}
  else $('#lErr').textContent=`Wrong PIN. ${5-S.tries} tries left.`;
});
$('#forgot').onclick=()=>start('forgot');

/* ---- intro stories ---- */
function type(el,t,ms,d=0){
  el.textContent='';el.classList.add('caret');const w=t.split(' ');let i=0;
  setTimeout(function n(){if(i<w.length){el.textContent+=(i?' ':'')+w[i++];setTimeout(n,ms)}else el.classList.remove('caret')},d);
}
function intro(){
  go('intro');S.full=false;S.max=0;
  $('#sl1').classList.add('on');$('#sl2').classList.remove('on');$('#tap').hidden=false;$('#dim').hidden=true;$('#dim p').innerHTML=matchMedia('(hover:hover)').matches?'<b>Press Enter or click</b><br>to continue':'<b>Tap the right side</b><br>to continue';
  $('#b2').style.transform='scaleX(0)';
  const b=$('#b1');b.style.transition='none';b.style.transform='scaleX(0)';void b.offsetWidth;b.style.transition='transform 7s linear';b.style.transform='scaleX(1)';
  alcRun();
  setTimeout(()=>{if(!S.full&&$('#sl1').classList.contains('on')){S.full=true;$('#dim').hidden=false}},7000);
}
function nextSlide(){
  if(!S.full)return;
  $('#dim').hidden=true;$('#tap').hidden=true;
  $('#sl1').classList.remove('on');$('#sl2').classList.add('on');
  const c=$('#cards');
  c.innerHTML=SITE.how.map((x,i)=>`<div class="hc hct"><span class="hcn">${String(i+1).padStart(2,'0')}</span><span class="hcx"><b class="hcb">${esc(x.title||'')}</b><p>${esc(x.text||'')}</p></span></div>`).join('');
  c.scrollLeft=0;$('#sw span').textContent=matchMedia('(hover:hover)').matches?'Drag, or use the arrows':'Swipe left';$('#sw').hidden=false;$('#startB').hidden=true;
}
$('#tap').onclick=nextSlide;
$('#dim').onclick=e=>{const r=$('#app').getBoundingClientRect();if(matchMedia('(hover:hover)').matches||e.clientX>r.left+r.width/2)nextSlide()};
const N=()=>SITE.how.length,cs=$('#cards');
const cur=()=>{const m=cs.scrollLeft+cs.clientWidth/2;let b=0,d=1e9;[...cs.children].forEach((c,i)=>{const x=Math.abs(c.offsetLeft+c.offsetWidth/2-m);if(x<d){d=x;b=i}});return b};
const cardTo=i=>cs.children[Math.max(0,Math.min(cs.children.length-1,i))]?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
cs.onscroll=()=>{
  S.max=Math.max(S.max,cs.scrollLeft+cs.clientWidth>=cs.scrollWidth-6?N()-1:cur());
  $('#b2').style.transform=`scaleX(${S.max/Math.max(1,N()-1)})`;
  if(S.max>=N()-1){$('#startB').hidden=false;$('#sw').hidden=true}
};
/* desktop: mouse drag, arrow buttons, arrow keys */
let drag=null;
cs.onpointerdown=e=>{if(e.pointerType==='touch')return;drag={x:e.clientX,s:cs.scrollLeft};cs.classList.add('drag')};
addEventListener('pointermove',e=>{if(drag)cs.scrollLeft=drag.s-(e.clientX-drag.x)});
addEventListener('pointerup',()=>{if(!drag)return;drag=null;cs.classList.remove('drag');cardTo(cur())});
$('#cPrev').onclick=()=>cardTo(cur()-1);
$('#cNext').onclick=()=>cardTo(cur()+1);
addEventListener('keydown',e=>{
  if(!$('#s-intro').classList.contains('on')||!['ArrowRight','ArrowLeft'].includes(e.key))return;
  if($('#sl1').classList.contains('on')){if(e.key==='ArrowRight')nextSlide()}
  else cardTo(cur()+(e.key==='ArrowRight'?1:-1));
});
$('#startB').onclick=dash;


/* ---- wiring ---- */
$$('[data-go]').forEach(b=>b.onclick=()=>b.dataset.go==='signup'?start('signup'):showLogin());
$$('[data-back]').forEach(b=>b.onclick=back);


/* =============== SHIRT, DASHBOARD, CUSTOMIZE =============== */

const _SW=['#efe9dc','#cdb8a0','#5b6340','#1f2a44','#6e1f2f','#234a3a','#9bb8d3','#3a3a3f'];   // muted product colors for "Other color"
const STY=['Minimalist','Typographic','Editorial','Y2K','Maximalist','Streetwear','Retro / Vintage','Illustrated','Type your own'];
/* dashboard */
const AVSVG='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9.2" r="4.2" fill="#fff"/><path d="M3.2 24c0-5.4 3.9-8.8 8.8-8.8s8.8 3.4 8.8 8.8z" fill="#fff"/></svg>';
function dash(more=false){
  if(S.own!==S.acc?.email){ORD=[];S.own=S.acc?.email}
  pull();
  const nm=S.acc?.name||S.name||'';
  $('#greet').textContent=greetText(nm);
  $('#greetL').textContent={morning:'Good morning',afternoon:'Good afternoon',evening:'Good evening'}[dayPart()];
  $('#dname').textContent=nm;$('#av').innerHTML=AVSVG;
  const T=ORD.filter(d=>d.placed_at&&!d.gone),row=d=>`<button class="tk ${d.status==='For Design Approval'?'glow':''} ${d.status==='Delivered'?'done':''}" data-t="${d.id}"><b>${d.id}</b><span class="chip st-${stGroup(d.status)}">${d.status}</span></button>`;
  const on=T.filter(d=>d.status!=='Delivered').sort((a,b)=>(b.status==='For Design Approval')-(a.status==='For Design Approval')||b.placed_at.localeCompare(a.placed_at)),dn=T.filter(d=>d.status==='Delivered');
  $('#tix').innerHTML=(on.length?'<p class="note" style="margin-bottom:6px">Ongoing</p>'+on.map(row).join(''):'')+(dn.length?'<p class="note" style="margin:6px 0">Done</p>'+dn.map(row).join(''):'')||'<p class="sub">No designs yet. Start one above.</p>';
  $('#s-dash').classList.toggle('more',more===true);
  $('#ordSum').innerHTML=ORD.map((d,i)=>`<b>Design ${i+1}</b> · ${d.O.color==='Other'?'Custom color':d.O.color}, ${price(d.O).qty} pcs`).join('<br>')||'Nothing yet.';
  S.h=[];go('dash');
}
$('#tix').onclick=e=>{const t=e.target.closest('.tk');if(t)openTicket(t.dataset.t)};
$('#revB').onclick=()=>{REV=0;drawRev();go('rev')};
$('#logout').onclick=()=>{S.h=[];go('land')};
$('#editB').onclick=()=>{
  S.edit=true;const p=JSON.parse(localStorage.sh_prof||'{}');
  $('#pName').value=S.acc?.name||p.full||'';$('#pPhone').value=p.phone||'';
  $$('[data-a]').forEach((i,k)=>i.value=p.addr?.[k]||'');perfUI();$('#profile').classList.add('on');
};

/* start a flow */
$$('[data-flow]').forEach(b=>b.onclick=()=>{
  O={flow:b.dataset.flow,color:'Black',hex:HEX.Black,other:'',sizes:{S:0,M:0,L:0,XL:0,'2XL':0},pos:'front',lay:{F:'',B:''},sl:[],custom:false,customTxt:'',style:''};CV='F';
  CQ='';CALL=false;$('#cq').value='';$('#otherTxt').value='';drawCust();go('cust');
});

/* customize */
let CQ='',CALL=false;
function drawColors(){
  const q=CQ.trim().toLowerCase(),list=colorList(),core=list.filter(c=>c.core||c.n===O.color).concat(list.filter(c=>!c.core&&c.n!==O.color)).slice(0,14);
  const show=q?list.filter(c=>c.n.toLowerCase().includes(q)):(CALL?list:core);
  $('#swg').innerHTML=show.map(c=>`<button class="swc ${c.n===O.color?'on':''} ${c.ok?'':'na'}" data-cn="${esc(c.n)}" ${c.ok?'':'disabled'} aria-label="${esc(c.n)}${c.ok?'':' (unavailable)'}"><i style="background:${c.h}"></i><span>${esc(c.n)}${c.ok?'':' · unavailable'}</span></button>`).join('');
  $('#otherBox').hidden=!((q&&!show.length)||O.color==='Other');
  $('#cMore').hidden=!!q;$('#cMore').textContent=CALL?'Show fewer colors':'Show all colors';
  $('#cSel').textContent=O.color==='Other'?'Custom request':O.color;
  $('#cNote').textContent=q?`${show.length} match${show.length===1?'':'es'}`:'';
}
function drawCust(){
  setShirt(O.hex);
  $('#cuse').setAttribute('href','#s'+CV);
  $$('#cview button').forEach(b=>b.classList.toggle('on',b.dataset.cv===CV));
  $('#cview').hidden=O.pos!=='both';
  $$('.seg[data-k]').forEach(s=>$$('button',s).forEach(b=>b.classList.toggle('on',b.dataset.v===O[s.dataset.k])));
  drawColors();
  $('#sizes').innerHTML=SIZES.map(s=>`<div class="sz"><b>${s}</b><button data-s="${s}" data-d="1" aria-label="More ${s}">+</button><span>${O.sizes[s]}</span><button data-s="${s}" data-d="-1" aria-label="Less ${s}">−</button></div>`).join('');
}
$('#s-cust').onclick=e=>{
  const sb=e.target.closest('.seg button'),sc=e.target.closest('.swc'),sz=e.target.closest('.sz button'),cv=e.target.closest('#cview button');
  if(sb){const k=sb.parentNode.dataset.k;O[k]=sb.dataset.v;if(k==='pos'){O.lay={F:'',B:''};CV=O.pos==='back'?'B':'F'}}
  else if(sc){if(sc.disabled)return;const c=colorList().find(x=>x.n===sc.dataset.cn);if(!c||!c.ok)return toast('That color is not available right now.');O.color=c.n;O.hex=c.h;O.other='';$('#otherTxt').value=''}
  else if(e.target.id==='cMore')CALL=!CALL;
  else if(sz){const s=sz.dataset.s;O.sizes[s]=Math.max(0,O.sizes[s]+ +sz.dataset.d)}
  else if(cv)CV=cv.dataset.cv;
  else return;
  drawCust();
};
$('#cq').oninput=e=>{CQ=e.target.value;drawColors()};
$('#otherTxt').oninput=e=>{const t=e.target.value.trim();if(t){O.color='Other';O.hex='#cfcfda';O.other=t;setShirt(O.hex);drawColors()}else{O.other=''}};
addEventListener('storage',e=>{if(e.key==='sh_colors'&&S.scr==='cust')drawColors()});
$('#chartB').onclick=()=>$('#chart').classList.add('on');$('#chartX').onclick=()=>$('#chart').classList.remove('on');
$('#custB').onclick=()=>{
  O.other=$('#otherTxt').value.trim();
  if(!Object.values(O.sizes).some(n=>n>0))return toast('Add at least one shirt.');
  if(O.color==='Other'&&!O.other)return toast('Describe the color you want.');
  drawLay();go('lay');
};

/* layouts and price */
function drawLay(){
  $('#layList').innerHTML=O.custom?'':sides().map(s=>`<h3>${s==='F'?'Front':'Back'}</h3><div class="lg">${LAY[s].map(l=>`<button class="lc ${O.lay[s]===l[0]?'on':''}" data-s="${s}" data-id="${l[0]}"><svg viewBox="0 0 300 330"><use href="#s${s}"/><rect class="pa" x="${l[3][0]}" y="${l[3][1]}" width="${l[3][2]}" height="${l[3][3]}" rx="6"/></svg>${l[1]}</button>`).join('')}</div>`).join('');
  $('#slList').innerHTML=Object.entries(SL).map(([k,v])=>`<button class="lc ${O.sl.includes(k)?'on':''}" data-sl="${k}"><svg viewBox="0 0 300 330"><use href="#sF"/><rect class="pa" x="${v[1]-15}" y="${v[2]-13}" width="30" height="26" rx="6" transform="rotate(${v[3]} ${v[1]} ${v[2]})"/></svg>${v[0]}</button>`).join('');
  applyAssets($('#s-lay'));$('#custLay').textContent=O.custom?'Use standard layouts':'Custom layout';$('#custTxt').hidden=!O.custom;
  const p=price();$('#priceBar').innerHTML=`<b>${money(p.per)}</b> per shirt × ${p.qty} = <b>${money(p.total)}</b><p class="note">Shipping is added at checkout.</p>`;
}
$('#s-lay').onclick=e=>{
  const l=e.target.closest('[data-id]'),s=e.target.closest('[data-sl]');
  if(l)O.lay[l.dataset.s]=l.dataset.id;
  else if(s)O.sl=O.sl.includes(s.dataset.sl)?O.sl.filter(x=>x!==s.dataset.sl):[...O.sl,s.dataset.sl];
  else if(e.target.id==='custLay')O.custom=!O.custom;
  else return;
  drawLay();
};
$('#layB').onclick=()=>{
  O.customTxt=$('#custTxt').value;
  if(!O.custom&&sides().some(s=>!O.lay[s]))return toast('Pick a layout for each side.');
  O.flow==='idea'?go('sty'):finish();
};

/* graphic style (idea flow) */
$('#styList').innerHTML=STY.map(s=>`<button class="sty" data-st="${s}" data-img="images.styles.${s}">${s==='Type your own'?'+ ':''}${s}</button>`).join('');
$('#styList').onclick=e=>{
  const b=e.target.closest('.sty');if(!b)return;
  O.style=b.dataset.st;$$('.sty').forEach(x=>x.classList.toggle('on',x===b));$('#styTxt').hidden=O.style!=='Type your own';
};
$('#styB').onclick=()=>{
  if(O.style==='Type your own')O.style=$('#styTxt').value.trim();
  if(!O.style)return toast('Choose a style or type your own.');
  finish();
};


/* =============== ORDERS, TICKETS, NEW DESIGN =============== */
const D=()=>ORD[CUR];
const URG=['Brief Submitted','Revision','Negotiation','Artwork Check','Paid'];
function persist(){try{const em=S.acc?.email;localStorage.sh_orders=JSON.stringify(allOrders().filter(x=>x.email!==em).concat(ORD.filter(d=>d.placed_at).map(d=>({...d,email:em,name:S.acc.name}))))}catch(e){toast('Storage is full (demo)')}}
function setSt(d,st){const t=new Date().toISOString();d.status=st;if(!d.placed_at)d.placed_at=t;if(URG.includes(st))d.queued_at=t;(d.hist=d.hist||[]).push({t,s:st,by:'customer'});persist()}
function pull(){
  const em=S.acc?.email;if(!em)return;
  allOrders().filter(x=>x.email===em).forEach(s=>{const d=ORD.find(x=>x.id===s.id);d?['status','take','drops','queued_at','reason','msg','hist','note','inote','dkeys','paid_at','u','pay_ref'].forEach(k=>d[k]=s[k]):ORD.push(s)});
  const n=ORD.find(d=>d.status==='For Design Approval'&&d.drops&&d.seen!==d.take);
  if(n){n.seen=n.take;CUR=ORD.indexOf(n);$('#dropPop').classList.add('on');persist()}
}
addEventListener('storage',e=>{if(e.key==='sh_orders'&&$('#s-dash').classList.contains('on'))dash($('#s-dash').classList.contains('more'))});
const toThumb=src=>new Promise(r=>{if(src.startsWith('data:'))return r(src);const im=new Image();im.onload=()=>{const k=Math.min(1,900/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);try{r(c.toDataURL('image/webp',.85))}catch(x){r(src)}};im.onerror=()=>r(src);im.src=src});
async function bake(d){for(const s of Object.keys(d.art))for(const it of d.art[s])it.src=await toThumb(it.src)}

/* ticket page: 2D / 3D view of what we received, with the details on the right in partitions */
let TK={side:'F',zone:1,grid:0};
const YAW3={F:0,B:Math.PI,SL:-Math.PI/2,SR:Math.PI/2};
const STX={red:'Our team is looking at this right now.',orange:'In progress. We will tell you when it needs you.',green:'Agreed and paid. It is moving to production.',done:'Delivered. Thank you!',grey:'This request is closed.'};
function openTicket(id){
  const i=ORD.findIndex(d=>d.id===id);if(i<0)return;CUR=i;const d=D(),sd=stepsOf(d);
  TK={side:sd.find(k=>arr(d,k).length)||sd[0]||'F',zone:1,grid:0};M3=false;free3();drawTk();go('tk');
}
function apply3t(){
  const d=D();if(!G3)return;G3.nosl=!stepsOf(d).some(k=>k==='SL'||k==='SR');G3.ov=[TK.zone?1:0,TK.grid?1:0,0];G3.yaw=YAW3[TK.side]??0;G3.pitch=.08;set3(d);req3();
}
function drawTk(){
  const d=D(),p=price(d.O,d.P),sd=stepsOf(d),s=TK.side,ship=shipFee(p.total,d.P),g=stGroup(d.status),has=hasArt(d);setShirt(d.O.hex);
  const rows=[];sd.forEach(k=>arr(d,k).forEach((it,n)=>{const w=it.w*300*ipu(k),dp=it.nw?dpiOf(it,k):0;rows.push(`<tr><td><img class="thm" src="${it.src}" alt=""></td><td>${LBL[k]}${arr(d,k).length>1?' #'+(n+1):''}</td><td class="num">${w.toFixed(1)} × ${(w*(it.ar||1)).toFixed(1)} in</td><td>${dp?`<span class="dpi ${dp>=250?'ok':dp>=150?'mid':'lo'}">${dp>=250?'Great':dp>=150?'Good':'Low'} · ${dp} DPI</span>`:''}</td></tr>`)}));
  $('#tkBox').innerHTML=`<div class="tkv">
    <div class="row tkbar"><div class="seg" id="tkM"><button data-m="2" class="${M3?'':'on'}">2D</button><button data-m="3" class="${M3?'on':''}">3D</button></div><div class="seg grow" id="tkS">${sd.map(k=>`<button data-s="${k}" class="${k===s?'on':''}">${LBL[k]}</button>`).join('')}</div></div>
    <div class="tkst">${M3?'<div class="v3" id="tkV3"></div>':`<div class="stage">${stageHTML(d,s,{zone:TK.zone,grid:TK.grid})}</div>`}</div>
    <div class="row tkbar"><button class="tgq ${TK.zone?'on':''}" data-t="zone"><i></i>Print area</button><button class="tgq ${TK.grid?'on':''}" data-t="grid"><i></i>Grid</button><span class="grow"></span><button class="btn sec sm" id="tkFs" ${M3?'':'hidden'}>Full screen</button></div>
    ${has?'':`<p class="note" style="text-align:center">${d.status==='For Design Approval'?'Your designs are ready. Tap below to choose one.':'Your design will appear here once it is ready.'}</p>`}
  </div>
  <div class="tkd">
    <div class="card ptn"><h3>Status</h3><div class="row" style="gap:.6rem;flex-wrap:wrap"><span class="chip st-${g}">${esc(d.status)}</span></div><p class="note" style="margin-top:.5rem">${STX[g]||''}</p>${d.note?`<p class="tkn"><b>Message from the team</b><br>${esc(d.note)}</p>`:''}${d.status==='For Design Approval'?'<button class="btn" id="tkView" style="margin-top:.7rem">View your designs</button>':''}${d.status==='For Payment'?'<button class="btn" id="tkPay" style="margin-top:.7rem">Pay now · '+money(p.total+ship)+'</button>':''}</div>
    <div class="card ptn"><h3>Details</h3><dl class="kv2"><dt>Ticket</dt><dd>${esc(d.id)}</dd><dt>Placed</dt><dd>${manila(d.placed_at)} (Manila)</dd><dt>Color</dt><dd><i class="swd" style="background:${esc(d.O.hex)}"></i>${esc(colorOf(d))}</dd><dt>Sizes</dt><dd>${esc(Object.entries(d.O.sizes).filter(x=>x[1]).map(x=>x[0]+' × '+x[1]).join(', '))}</dd><dt>Placement</dt><dd>${esc(placeOf(d.O))}</dd><dt>Per shirt</dt><dd>${money(p.per)}</dd><dt>Shipping</dt><dd>${ship?money(ship):'Free'}</dd><dt>Total</dt><dd><b>${money(p.total+ship)}</b></dd></dl></div>
    ${rows.length?`<div class="card ptn"><h3>Your artwork</h3><table class="tbl2"><tbody>${rows.join('')}</tbody></table><p class="note">Quality is measured at the printed size. 300 DPI prints sharpest.</p></div>`:''}
    <div class="card ptn"><h3>Legend</h3>
      <div class="lgi"><span class="k z"></span><div><b>Print area</b><small>Where ink can go on the ${LBL[s].toLowerCase()}, about ${(zone(d,s)[2]*ipu(s)).toFixed(1)} × ${(zone(d,s)[3]*ipu(s)).toFixed(1)} in.</small></div></div>
      <div class="lgi"><span class="k g"></span><div><b>Grid</b><small>One square is about ${(5*ipu(s)).toFixed(2)} in.</small></div></div>
      <div class="lgi"><span class="k a"></span><div><b>Statuses</b><small><span class="dt r"></span>Needs us · <span class="dt o"></span>In progress · <span class="dt g"></span>Paid · <span class="dt d"></span>Delivered</small></div></div></div>
  </div>`;
  if(M3&&G3){$("#tkV3").append(G3.c);sizeC();apply3t()}
}
$('#tkBox').onclick=e=>{
  const t=e.target;if(t.id==='tkView')return openDrops(CUR);if(t.id==='tkPay')return openPay(CUR);
  const m=t.closest('#tkM button');if(m){if(m.dataset.m==='3'&&!M3)askW3('tk');else if(m.dataset.m==='2'&&M3){M3=false;free3();drawTk()}return}
  const sb=t.closest('#tkS button');if(sb){TK.side=sb.dataset.s;drawTk();return}
  const tg=t.closest('.tgq');if(tg){TK[tg.dataset.t]=TK[tg.dataset.t]?0:1;drawTk();return}
  if(t.id==='tkFs')openFS();
};

const tid=l=>{const d=String(10000+Math.random()*90000|0);return l+d+'-'+String(([...d].reduce((a,b)=>a+ +b,0)*37+l.charCodeAt(0))%1000).padStart(3,'0')}; // placeholder ID rule
function finish(){
  ORD.push({id:tid(O.flow==='idea'?'I':'D'),name:S.acc?.name,email:S.acc?.email,O:JSON.parse(JSON.stringify(O)),art:{F:[],B:[],SL:[],SR:[]},req:'',status:'Draft',take:0,ans:[],brief:'',inc:true});
  CUR=ORD.length-1;NEWTAB=CUR;localStorage.sh_draft=JSON.stringify(ORD.map(d=>({...d,art:0}))); // demo: later API.saveItem
  if(O.flow==='idea'){QI=0;go('rem')}else openEdit(CUR);
}

/* Auhsy AI questionnaire (suggestions are a demo stub: swap API.suggest for the AI call) */
const QS=[
['What do you want to see on your shirt?','Ano ang gusto mong makita sa shirt mo?',['A roaring tiger','Our team name in big letters','A sunset beach scene'],['Isang umaatungal na tigre','Pangalan ng grupo namin sa malalaking letra','Paglubog ng araw sa dagat']],
['What is it for?','Para saan ito?',['Group shirt','A gift','An event'],['Pang-grupo','Regalo','Para sa event']],
['Any exact words to include?','May eksaktong salita bang ilalagay?',['Our team name','A short quote','No text'],['Pangalan ng grupo','Maikling quote','Walang text']],
['Who will wear it?','Sino ang magsusuot?',['Teens','Adults','Everyone'],['Teens','Matatanda','Lahat']],
['What mood do you want?','Anong mood ang gusto mo?',['Bold and loud','Chill and soft','Funny'],['Matapang','Chill','Nakakatawa']],
['Colors to use or avoid?','Anong kulay ang gusto o iwasan?',['Bright colors','Earth tones','Avoid red'],['Matingkad','Earth tones','Iwasan ang pula']],
['Any references? (describe or paste a link)','May reference ba? (ilarawan o mag-paste ng link)',['Like a vintage poster','Similar to a logo I like','None'],['Parang vintage poster','Kahawig ng logo na gusto ko','Wala']],
['Is it based on an existing character, logo or brand?','Hango ba ito sa umiiral na karakter, logo o brand?',['No, it is original','Our own logo','Yes (I will describe)'],['Hindi, original','Sarili naming logo','Oo (ilalarawan ko)']],
['Anything it must not include?','May hindi dapat isama?',['No violence','No text','No people'],['Walang karahasan','Walang text','Walang tao']],
['Anything else we should know?','May iba pa bang dapat naming malaman?',['Rush if possible','Keep it simple','Nothing else'],['Pakibilisan kung puwede','Panatilihing simple','Wala na']]];
$('#remB').onclick=()=>{QI=0;drawQ();go('q')};
function drawQ(){
  const q=QS[QI],t=LANG==='tl';
  $$('#lang button').forEach(b=>b.classList.toggle('on',b.dataset.l===LANG));
  $('#qn').textContent=`${t?'Tanong':'Question'} ${QI+1}/${QS.length}`;$('#qt').textContent=q[t?1:0];
  $('#qa').value=D().ans[QI]||'';grow($('#qa'));$('#qTxt').textContent=SITE.text.questionBox||'{texts here}';$('#qsl').textContent=t?'Mga mungkahi ni Auhsy:':"Auhsy's suggestions:";
  $('#qs').innerHTML=q[t?3:2].map(s=>`<button class="chp">${s}</button>`).join('');aiSuggest(QI,t);
  $('#qB').textContent=QI===QS.length-1?(t?'Tapusin':'Finish'):(t?'Magpatuloy':'Continue');
}
$('#lang').onclick=e=>{const b=e.target.closest('button');if(b){D().ans[QI]=$('#qa').value;LANG=b.dataset.l;drawQ()}};
$('#qs').onclick=e=>{const b=e.target.closest('.chp');if(b){const a=$('#qa');a.value=a.value?a.value+', '+b.textContent:b.textContent}};
$('#qBack').onclick=()=>{D().ans[QI]=$('#qa').value;QI>0?(QI--,drawQ()):back()};
$('#qB').onclick=()=>{
  D().ans[QI]=$('#qa').value.trim();
  if(QI<QS.length-1){QI++;drawQ();return}
  const d=D(),a=QS.map((_,i)=>d.ans[i]||'-'),o=d.O;
  $('#briefT').value=`Ticket: ${d.id}\nShirt: ${o.color==='Other'?(o.other||o.hex):o.color}, ${Object.entries(o.sizes).filter(x=>x[1]).map(x=>x.join(' x ')).join(', ')}\nPlacement: ${sides(o).map(s=>o.custom?'Custom':LAY[s].find(l=>l[0]===o.lay[s])[1]).concat(o.sl.map(k=>SL[k][0])).join(', ')}\nStyle: ${o.style}\n\nConcept: ${a[0]}\nPurpose: ${a[1]} | Wearer: ${a[3]}\nText: ${a[2]}\nMood: ${a[4]} | Colors: ${a[5]}\nReferences: ${a[6]}\nExisting IP: ${a[7]}\nMust avoid: ${a[8]}\nNotes: ${a[9]}\n\nPROMPT: ${a[0]}, ${o.style} graphic style, ${a[4]} mood, colors: ${a[5]}, text: ${a[2]}, print-ready, clean edges, isolated on transparent background, high detail, 300 DPI. Avoid: ${a[8]}.`;
  go('brief');grow($('#briefT'));
};
$('#briefB').onclick=()=>{const d=D();d.brief=$('#briefT').value;setSt(d,'Brief Submitted');showWait('Brief sent!',`Ticket ${d.id}. Our team is designing. Your designs will be handed over within the day. We'll email you and send a notification when they are ready.`)};
function showWait(t,p){$('#waitT').textContent=t;$('#waitP').textContent=p;go('wait')}
$('#waitD').onclick=()=>dash();
$('#notifB').onclick=()=>Notify.enable();
$('#dropLater').onclick=()=>{$('#dropPop').classList.remove('on');dash()};
$('#dropView').onclick=()=>{$('#dropPop').classList.remove('on');openDrops(CUR)};

/* design drops */
const dropSVG=k=>{const bg=['#111111','#d9d9d6','#8a8a86','#f1f1ef'][k%4],fg=['#ffffff','#111111','#ffffff','#111111'][k%4];return 'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><circle cx="300" cy="300" r="${200+(k%3)*20}" fill="${bg}"/><path d="M120 420Q300 ${150+k*20} 480 420" stroke="${fg}" stroke-width="28" fill="none" stroke-linecap="round"/><text x="300" y="330" font-size="64" font-weight="800" text-anchor="middle" fill="${fg}" font-family="sans-serif">Design ${k+1}</text></svg>`)};
function openDrops(i){CUR=i;DSEL=-1;const d=D();
  $('#dnote').textContent=`Take ${d.take} of 3 · Ticket ${d.id}`;$('#rejTxt').value='';
  $('#dgrid').innerHTML=[0,1,2,3].map(k=>`<button class="dp" data-k="${k}"><img src="${d.drops?d.drops[k]:dropSVG(k+(d.take-1)*4)}" alt="Design ${k+1}" decoding="async"></button>`).join('');
  go('drops');
}
$('#dgrid').onclick=e=>{const b=e.target.closest('.dp');if(!b)return;DSEL=+b.dataset.k;$$('.dp').forEach(x=>x.classList.toggle('on',x===b))};
$('#chooseB').onclick=()=>{
  if(DSEL<0)return toast('Tap a design to choose it.');
  const d=D();setSt(d,'Approved');openEdit(CUR);addArt(d.drops?d.drops[DSEL]:dropSVG(DSEL+(d.take-1)*4));
};
$('#rejB').onclick=()=>{
  const d=D();d.reason=$('#rejTxt').value;setSt(d,d.take>=3?'Negotiation':'Revision');
  d.take>=3?go('fall'):showWait('Request sent',`Take ${d.take} was rejected. We'll hand over a new batch within the day and notify you. You can request up to 3 takes.`);
};
$('#diyB').onclick=()=>{setSt(D(),'Self-design');openEdit(CUR)};
$('#chatB').onclick=()=>{$('#chatT').hidden=false;$('#chatS').hidden=false};
$('#chatS').onclick=()=>{if(!$('#chatT').value.trim())return toast('Write a message first.');D().msg=$('#chatT').value;setSt(D(),'Negotiation');toast('Sent to our team');dash()}; // later: email to main address


/* =============== EDITOR =============== */
const A=()=>D()?arr(D(),SIDE):[],act=()=>A()[SEL];
let GRID=false,SNAP=true,FL=0;

/* history: one entry per finished gesture */
const snapH=()=>{HB=JSON.stringify(D().art)};
function commit(){const s=JSON.stringify(D().art);if(s!==HB){U.push(HB);if(U.length>60)U.shift();Rd=[];HB=s}dockState()}
function undo(){if(!U.length)return;Rd.push(HB);D().art=JSON.parse(U.pop());HB=JSON.stringify(D().art);SEL=Math.min(SEL,A().length-1);drawStage()}
function redo(){if(!Rd.length)return;U.push(HB);D().art=JSON.parse(Rd.pop());HB=JSON.stringify(D().art);SEL=Math.min(SEL,A().length-1);drawStage()}
$('#undoB').onclick=undo;$('#redoB').onclick=redo;
function delIt(){if(!act())return toast('Add a design first.');A().splice(SEL,1);SEL=A().length-1;commit();drawStage()}
$('#delB').onclick=delIt;
function dockState(){
  $('#undoB').disabled=!U.length;$('#redoB').disabled=!Rd.length;$('#delB').disabled=!act();
  $('#adjB').disabled=!act()&&!ADJ.on;$('#adjB').classList.toggle('on',ADJ.on);$('#v3B').classList.toggle('on',M3E);
}

/* open / draw */
function openEdit(i,step){
  const first=!$('#s-edit').classList.contains('on');
  CUR=i;const d=D();SIDE=step||stepsOf(d)[0];SEL=A().length-1;U=[];Rd=[];snapH();
  if(M3E){M3E=false;free3();showStage()}
  drawEdit();go('edit');if(first)maybeTut();
}
function drawEdit(){
  const d=D(),st=stepsOf(d),ix=st.indexOf(SIDE);setShirt(d.O.hex);
  $('#tabs').innerHTML=ORD.map((x,i)=>`<div class="tab ${i===CUR?'on':''} ${i===NEWTAB?'new':''}"><button class="tt" data-tab="${i}" aria-label="Open design ${i+1}">Design ${i+1}</button>${ORD.length>1?`<button class="tx" data-x="${i}" aria-label="Close design ${i+1}">×</button>`:''}</div>`).join('');
  NEWTAB=-1;
  $('#views').hidden=st.length<2;$('#views').innerHTML=st.map(s=>`<button data-st="${s}" class="${s===SIDE?'on':''}">${LBL[s]}</button>`).join('');
  $('#tid').textContent=d.id;$('#stepLbl').textContent=st.length>1?`${LBL[SIDE]} · ${ix+1}/${st.length}`:LBL[SIDE];
  $('#spec').textContent=specOf(d);$('#req').value=d.req||'';grow($('#req'));
  $('#editB2').textContent=ix<st.length-1?'Next: '+LBL[st[ix+1]]:'Review';
  drawStage();
}
function drawStage(){
  const d=D(),it=act();
  $('#stage').innerHTML=stageHTML(d,SIDE,{edit:true,grid:GRID});
  $('#dpi').textContent=dpiTxt(it);pvMake();
  $('#hud').textContent=M3E?'Turn the shirt by dragging. Use Adjust to position your design.':(A().length?(matchMedia('(hover:hover) and (pointer:fine)').matches?'Drag to move · scroll to resize · hold R and scroll to rotate':'Drag anywhere to move · pinch to resize'):'');
  dockState();if(ADJ.on)adjSync();if(M3E)live3();
}
const showStage=()=>{$('#stage').hidden=false;$('#v3e').hidden=true};
function flash(){const el=$(`#stage .it[data-i="${SEL}"]`);if(!el)return;el.classList.add('act');clearTimeout(FL);FL=setTimeout(()=>el.classList.remove('act'),900)}
function place(it){   // moves/resizes/rotates with the GPU only: left/top/width stay as drawn, a transform carries the difference
  const el=$(`#stage .it[data-i="${SEL}"]`);if(!el)return;
  const bw=+el.dataset.w;if(!bw){el.style.cssText=itPos(it);return}
  el.style.willChange='transform';   // a layer of its own only while it moves; settle() clears it
  el.style.transform=`translate(${(it.x-el.dataset.x)*stg.clientWidth}px,${(it.y-el.dataset.y)*stg.clientHeight}px) translate(-50%,-50%) rotate(${it.r}deg) scale(${it.w/bw})`;
}
function settle(){   // gesture finished: bake the transform into real left/top/width without rebuilding the stage
  const it=act(),el=it&&$(`#stage .it[data-i="${SEL}"]`);
  if(el){el.style.cssText=itPos(it);el.dataset.x=it.x;el.dataset.y=it.y;el.dataset.w=it.w}
  $('#dpi').textContent=dpiTxt(it);dockState();if(ADJ.on)adjSync();if(M3E)live3();
}
const dpiTxt=it=>it?(q=>q>=150?`Print quality looks good (about ${q} DPI).`:`Low resolution (about ${q} DPI). Use a larger file for sharper print.`)(Math.round(it.nw/(it.w*300*ipu(SIDE)))):(A().length?'':'Tap + to add your design.');
function pvMake(){   // big photos are shown as a 1024px preview while editing (the full file is kept for print)
  A().forEach(it=>{
    if(PV.has(it.src))return;PV.set(it.src,true);
    const im=new Image();im.onload=()=>{
      if(im.naturalWidth<=1100){PV.set(it.src,it.src);return}
      const c=document.createElement('canvas');c.width=1024;c.height=Math.round(im.naturalHeight*1024/im.naturalWidth);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      c.toBlob(b=>{if(!b){PV.set(it.src,it.src);return}const u=URL.createObjectURL(b);PV.set(it.src,u);
        $$('#stage .it').forEach(el=>{const a=A()[+el.dataset.i];if(a&&a.src===it.src)el.querySelector('img').src=u})},'image/webp',.92);
    };im.onerror=()=>PV.set(it.src,it.src);im.src=it.src;
  });
}
$('#tabs').onclick=e=>{
  const x=e.target.closest('[data-x]');if(x)return closeTab(+x.dataset.x);
  const t=e.target.closest('[data-tab]');if(t&&+t.dataset.tab!==CUR){D().req=$('#req').value;openEdit(+t.dataset.tab)}
};
function closeTab(i){
  const d=ORD[i];if(d.placed_at)return toast('A submitted design can not be closed.');
  ask('Close this design?',hasArt(d)?'Its artwork and settings will be removed.':'This design will be removed.',()=>{
    ORD.splice(i,1);if(!ORD.length){dash();return}
    if(CUR>i)CUR--;else if(CUR===i)CUR=Math.max(0,i-1);
    openEdit(CUR);
  },'Close design');
}
$('#views').onclick=e=>{const b=e.target.closest('[data-st]');if(!b)return;D().req=$('#req').value;SIDE=b.dataset.st;SEL=A().length-1;adjOpen(false);drawEdit();if(M3E&&G3){G3.yaw=YAW3[SIDE]??0;req3()}};
$('#req').addEventListener('input',e=>{D().req=e.target.value});

/* ---- gestures: drag anywhere to move, pinch to size, wheel to size, hold R + wheel to rotate ---- */
const stg=$('#stage'),PT=new Map();let GS=null,RK=false,rafG=0,WH=null;
function gBegin(){
  const it=act(),pts=[...PT.values()];
  GS={R:stg.getBoundingClientRect(),it:it?{...it}:null,p:pts.map(p=>({...p})),d:pts.length>1?Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y):0,moved:false,t:performance.now(),n:pts.length,last:0};
}
stg.addEventListener('pointerdown',e=>{
  if(M3E||(e.pointerType==='mouse'&&e.button>0))return;
  try{stg.setPointerCapture(e.pointerId)}catch(_){};PT.set(e.pointerId,{x:e.clientX,y:e.clientY});gBegin();
});
stg.addEventListener('pointermove',e=>{
  if(!PT.has(e.pointerId))return;PT.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(GS&&!rafG)rafG=requestAnimationFrame(gMove);
});
function gMove(t){
  rafG=0;const it=act();if(!GS||!GS.it||!it)return;
  if(GS.last)perfFrame(t-GS.last);GS.last=t;
  const pts=[...PT.values()];
  if(pts.length===1&&GS.n===1){
    const dx=pts[0].x-GS.p[0].x,dy=pts[0].y-GS.p[0].y;
    if(!GS.moved&&Math.hypot(dx,dy)<4)return;
    GS.moved=true;it.x=GS.it.x+dx/GS.R.width;it.y=GS.it.y+dy/GS.R.height;snapIt(it);
  }else if(pts.length>=2&&GS.n>=2){
    GS.moved=true;it.w=clamp(GS.it.w*Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)/(GS.d||1),.03,1.3);
  }
  place(it);
}
function gEnd(e){
  if(!PT.has(e.pointerId))return;PT.delete(e.pointerId);
  const quick=GS&&!GS.moved&&GS.n===1&&performance.now()-GS.t<400;
  if(quick&&!PT.size)tapSelect(e);
  if(PT.size){gBegin();return}
  if(GS){GS=null;showGuides(null,null);commit();settle()}
}
stg.addEventListener('pointerup',gEnd);stg.addEventListener('pointercancel',gEnd);
function tapSelect(e){
  const R=stg.getBoundingClientRect(),px=(e.clientX-R.left)/R.width*300,py=(e.clientY-R.top)/R.height*330,a=A();
  for(let i=a.length-1;i>=0;i--){
    const it=a[i],dx=px-it.x*300,dy=py-it.y*330,r=-it.r*Math.PI/180,rx=dx*Math.cos(r)-dy*Math.sin(r),ry=dx*Math.sin(r)+dy*Math.cos(r),hw=it.w*150,hh=hw*(it.ar||1);
    if(Math.abs(rx)<=hw&&Math.abs(ry)<=hh){if(i!==SEL){SEL=i;drawStage()}flash();return}
  }
}
let lastSnap='';
function snapIt(it){
  const z=zone(D(),SIDE),hw=it.w*150,hh=hw*(it.ar||1);let cx=it.x*300,cy=it.y*330,gx=null,gy=null;
  if(GRID){const g=5;cx=z[0]+Math.round((cx-z[0])/g)*g;cy=z[1]+Math.round((cy-z[1])/g)*g}
  else if(SNAP){
    const T=4,xs=[z[0]+z[2]/2,z[0]+hw,z[0]+z[2]-hw],ys=[z[1]+z[3]/2,z[1]+hh,z[1]+z[3]-hh];
    for(const v of xs)if(Math.abs(cx-v)<T){cx=v;gx=v;break}
    for(const v of ys)if(Math.abs(cy-v)<T){cy=v;gy=v;break}
  }
  it.x=cx/300;it.y=cy/330;showGuides(gx,gy);
  const k=gx+'|'+gy;if(k!==lastSnap&&(gx!=null||gy!=null))navigator.vibrate?.(5);lastSnap=k;
}
function showGuides(gx,gy){
  const x=$('#gx'),y=$('#gy');if(!x)return;
  x.classList.toggle('on',gx!=null);y.classList.toggle('on',gy!=null);
  if(gx!=null)x.style.left=gx/3+'%';if(gy!=null)y.style.top=gy/3.3+'%';
}
let WHr=0;
stg.addEventListener('wheel',e=>{
  if(M3E)return;const it=act();if(!it)return;e.preventDefault();
  const dy=e.deltaY*(e.deltaMode===1?33:e.deltaMode===2?400:1);
  if(!WH)WH={w:it.w,raf:0,t:0};clearTimeout(WH.t);
  if(RK){let r=(it.r+(dy>0?1:-1)*(e.shiftKey?1:5)+360)%360;if(SNAP){const n=Math.round(r/45)*45;if(Math.abs(r-n)<=2.5)r=n%360}it.r=r}
  else WH.w=clamp(WH.w*Math.exp(-dy*(e.ctrlKey?.01:.0016)),.03,1.3);   // target size; the frame loop eases toward it
  if(!WH.raf)WH.raf=requestAnimationFrame(wStep);
  WH.t=setTimeout(wEnd,300);
},{passive:false});
function wStep(){
  if(!WH)return;WH.raf=0;const it=act();if(!it)return;
  const d=WH.w-it.w;it.w=Math.abs(d)<.0003?WH.w:it.w+d*.3;place(it);
  if(it.w!==WH.w)WH.raf=requestAnimationFrame(wStep);
  else if(WH.end)wEnd();
}
function wEnd(){
  if(!WH)return;const it=act();
  if(it&&it.w!==WH.w){WH.end=1;if(!WH.raf)WH.raf=requestAnimationFrame(wStep);return}   // let the ease finish first
  cancelAnimationFrame(WH.raf);WH=null;commit();settle();
}
addEventListener('keydown',e=>{
  if(!$('#s-edit').classList.contains('on')||/INPUT|TEXTAREA/.test(document.activeElement?.tagName))return;
  if(e.key==='r'||e.key==='R')RK=true;
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();delIt()}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}
  if(e.key.startsWith('Arrow')&&act()){e.preventDefault();const s=e.shiftKey?5:1;nudge(e.key==='ArrowLeft'?-s:e.key==='ArrowRight'?s:0,e.key==='ArrowUp'?-s:e.key==='ArrowDown'?s:0);commit()}
});
addEventListener('keyup',e=>{if(e.key==='r'||e.key==='R')RK=false});
addEventListener('blur',()=>{RK=false});
addEventListener('resize',()=>{if($('#s-edit').classList.contains('on')&&!M3E)drawStage()});

/* ---- upload ---- */
$('#upB').onclick=()=>$('#upRem').classList.add('on');
$('#upGo').onclick=()=>{$('#upRem').classList.remove('on');$('#file').click()};
$('#file').onchange=e=>{const f=e.target.files[0];if(f)addArt(URL.createObjectURL(f));e.target.value=''};
function addArt(src){
  const im=new Image();im.onload=()=>{
    const d=D(),z=zone(d,SIDE),ar=im.height/im.width||1;
    arr(d,SIDE).push({src,nw:im.naturalWidth>300?im.naturalWidth:1800,ar,x:(z[0]+z[2]/2)/300,y:(z[1]+z[3]/2)/330,w:Math.min(z[2],z[3]/ar)*.9/300,r:0});
    SEL=A().length-1;commit();drawStage();flash();
  };im.src=src;
}

/* ---- adjust panel: Rotate wheel | Move & size ---- */
const ADJ={on:false,tab:'rot'};
$('#adjMov').hidden=false;$('#adjMov').style.display='none';
const DESK=matchMedia('(min-width:900px)');
function placeAdj(){   // PC: the panel is part of the right column, always open. Phone: floating panel at the bottom.
  const a=$('#adj');
  if(DESK.matches){$('#s-edit .ctl').prepend(a);a.classList.add('dk','on');ADJ.on=true}
  else{document.body.appendChild(a);a.classList.remove('dk','idle','pulse','on');ADJ.on=false}
  if($('#s-edit').classList.contains('on')&&typeof D==='function'&&ORD.length){dockState();if(ADJ.on)adjSync()}
}
DESK.addEventListener?.('change',placeAdj);
function nudgeAdv(){   // the customer tried to continue without a design: bring them back to the tools
  const msg='No design yet. Add your artwork with the upload button, then use the Advanced editing tools to place it exactly.';
  toast(DESK.matches?'Add a design first.':msg);
  const a=$('#adj'),n=$('#adjN');
  if(DESK.matches){n.textContent=msg;n.classList.add('show');a.classList.remove('pulse');void a.offsetWidth;a.classList.add('pulse');a.scrollIntoView({behavior:'smooth',block:'nearest'});setTimeout(()=>{a.classList.remove('pulse');n.classList.remove('show')},6000)}
  ['#upB','#adjB'].forEach(s=>{const b=$(s);b.classList.remove('hint');void b.offsetWidth;b.classList.add('hint');setTimeout(()=>b.classList.remove('hint'),5000)});
}
function adjOpen(on){if(DESK.matches)on=true;ADJ.on=on;$('#adj').classList.toggle('on',on);dockState();fabShow();if(on)adjSync()}
function adjTab(t){ADJ.tab=t;$$('#adjT button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));$('#adjRot').style.display=t==='rot'?'grid':'none';$('#adjMov').style.display=t==='mov'?'grid':'none'}
$('#adjB').onclick=()=>{if(!act())return nudgeAdv();adjOpen(!ADJ.on)};
$('#adjX').onclick=()=>adjOpen(false);
$('#adjT').onclick=e=>{const b=e.target.closest('button');if(b)adjTab(b.dataset.t)};
$('#dial').innerHTML=(()=>{let t='<circle cx="100" cy="100" r="92" fill="#f6f6f4" stroke="rgba(10,10,10,.12)"/>';
  for(let a=0;a<360;a+=15){const M=a%45===0,r1=M?76:83,q=a*Math.PI/180;t+=`<line x1="${100+r1*Math.sin(q)}" y1="${100-r1*Math.cos(q)}" x2="${100+92*Math.sin(q)}" y2="${100-92*Math.cos(q)}" stroke="${M?'#0b0b0b':'#b8b8b4'}" stroke-width="${M?2.2:1.2}"/>`}
  return t+'<text id="dTxt" x="100" y="105" text-anchor="middle" font-size="12" fill="#7a7a76">0°</text><g id="dG"><line x1="100" y1="100" x2="100" y2="38" stroke="#0b0b0b" stroke-width="2"/><circle cx="100" cy="30" r="11" fill="#0b0b0b" stroke="#fff" stroke-width="3"/></g>'})();
function adjSync(){
  const it=act();if(!it){if(DESK.matches){$('#adj').classList.add('idle');$('#adjN').textContent='Add your design with the upload button below the shirt. These tools unlock as soon as it is on the shirt.';return}adjOpen(false);return}
  $('#adj').classList.remove('idle');$('#adjN').textContent='';
  const a=Math.round(((it.r%360)+360)%360),z=zone(D(),SIDE);
  $('#dG').setAttribute('transform',`rotate(${a} 100 100)`);$('#dTxt').textContent=a+'°';
  $('#rotS').classList.toggle('on',SNAP);$('#snapB').classList.toggle('on',SNAP);$('#gridB').classList.toggle('on',GRID);
  const pct=Math.round(it.w*300/z[2]*100);$('#size').value=clamp(pct,8,130);$('#sizeV').textContent=pct+'%';
}
function rotSet(v){const it=act();if(!it)return;it.r=((v%360)+360)%360;place(it);if(it.r%45===0&&lastRot!==it.r)navigator.vibrate?.(8);lastRot=it.r;adjSync()}
let lastRot=-1,dragR=false;
const dial=$('#dial');
function dialAng(e){
  const r=dial.getBoundingClientRect();let a=(Math.atan2(e.clientX-(r.left+r.width/2),-(e.clientY-(r.top+r.height/2)))*180/Math.PI+360)%360;
  if(SNAP){const n=Math.round(a/45)*45;return Math.abs(a-n)<=4?n%360:Math.round(a)}   // magnet every 45 degrees
  return Math.round(a);                                                                // else 1 degree steps
}
dial.onpointerdown=e=>{dragR=true;try{dial.setPointerCapture(e.pointerId)}catch(_){};rotSet(dialAng(e));if(M3E)live3()};
dial.onpointermove=e=>{if(dragR){rotSet(dialAng(e));if(M3E)live3()}};
dial.onpointerup=dial.onpointercancel=()=>{if(dragR){dragR=false;commit()}};
dial.tabIndex=0;dial.setAttribute('role','slider');dial.setAttribute('aria-label','Rotation');
dial.addEventListener('keydown',e=>{const it=act();if(!it)return;const st=e.shiftKey?5:1;let h=true;
  if(e.key==='ArrowRight'||e.key==='ArrowUp')rotSet(it.r+st);else if(e.key==='ArrowLeft'||e.key==='ArrowDown')rotSet(it.r-st);else if(e.key==='Home')rotSet(0);else h=false;
  if(h){e.preventDefault();e.stopPropagation();commit()}});
let rt;
function hold(b,fn){b.onpointerdown=()=>{fn();rt=setTimeout(function k(){fn();rt=setTimeout(k,70)},380)};b.onpointerup=b.onpointerleave=b.onpointercancel=()=>{clearTimeout(rt);commit()}}
hold($('#rotM'),()=>{const it=act();if(it)rotSet(it.r-1)});hold($('#rotP'),()=>{const it=act();if(it)rotSet(it.r+1)});
$('#rotR').onclick=()=>{rotSet(0);commit()};
$('#rotS').onclick=$('#snapB').onclick=()=>{SNAP=!SNAP;adjSync()};
$('#gridB').onclick=()=>{GRID=!GRID;drawStage()};
function nudge(dx,dy){const it=act();if(!it)return;it.x+=dx/300;it.y+=dy/330;place(it);if(M3E)live3()}
[['nu',0,-1],['nd',0,1],['nl',-1,0],['nr',1,0]].forEach(([id,x,y])=>hold($('#'+id),()=>nudge(x,y)));
$('#nc').onclick=()=>{const it=act(),z=zone(D(),SIDE);if(!it)return;it.x=(z[0]+z[2]/2)/300;it.y=(z[1]+z[3]/2)/330;place(it);commit();if(M3E)live3()};
$('#fitB').onclick=()=>{const it=act(),z=zone(D(),SIDE);if(!it)return;it.w=Math.min(z[2],z[3]/(it.ar||1))*.96/300;place(it);commit();adjSync();if(M3E)live3()};
$('#size').oninput=e=>{const it=act(),z=zone(D(),SIDE);if(!it)return;it.w=e.target.value/100*z[2]/300;$('#sizeV').textContent=e.target.value+'%';place(it);if(M3E)live3()};
$('#size').onchange=()=>commit();

/* ---- next / more designs ---- */
$('#moreB').onclick=()=>{if(ORD.length>=5)return toast('You can add up to 5 designs.');D().req=$('#req').value;adjOpen(false);dash(true)};
$('#editB2').onclick=()=>{
  const d=D();d.req=$('#req').value;const st=stepsOf(d),ix=st.indexOf(SIDE);adjOpen(false);
  if(ix<st.length-1){SIDE=st[ix+1];SEL=A().length-1;drawEdit();return}
  if(!hasArt(d))return nudgeAdv();
  REV=ORD.filter(hasArt).indexOf(d);RV=st.find(s=>arr(d,s).length)||st[0];drawRev();go('rev');
};

/* ---- tutorial (first visit, then now and then, with a "don't show again" option) ---- */
const TUT={
  touch:[['move','Drag anywhere to move','Touch and drag on the shirt. Your design follows your finger.'],['pinch','Pinch to resize','Use two fingers to make your design bigger or smaller.'],['sliders','Adjust for precision','Tap Adjust to rotate with a wheel, nudge, use the grid and snapping.'],['trash','Fix mistakes fast','Undo, redo or delete from the toolbar under the shirt.']],
  pc:[['mouse','Click, hold and drag','Hold the mouse button on the shirt and drag to move your design.'],['mouse','Scroll to resize','Scroll up or down over the shirt to make your design bigger or smaller.'],['sliders','Advanced editing (teal panel)','The teal panel on the right rotates with a wheel, nudges, resizes, snaps and shows a grid, so you can place your design exactly.'],['rot','Hold R, then scroll','Press and hold the R key, then scroll to rotate quickly.'],['key','Shortcuts','Delete removes your design. Ctrl+Z undoes. Arrow keys nudge it.']]
};
let TS=0,TL=[];
function showTut(force){
  const pc=matchMedia('(hover:hover) and (pointer:fine)').matches;TL=pc?TUT.pc:TUT.touch;TS=0;
  const must=force===true&&!tutState().seen;$('#tut').dataset.must=must?'1':'0';$('#tutSkip').hidden=must;$$('.chk',$('#tut')).forEach(x=>x.hidden=must);drawTut();$('#tut').classList.add('on');
}
function drawTut(){
  const s=TL[TS];$('#tutI').innerHTML=ic(s[0]);$('#tutT').textContent=s[1];$('#tutP').textContent=s[2];
  $('#tutD').innerHTML=TL.map((_,i)=>`<i class="${i===TS?'on':''}"></i>`).join('');$('#tutNext').textContent=TS<TL.length-1?'Next':'Got it';
}
function closeTut(){
  const must=$('#tut').dataset.must==='1';
  if(must){if(TS<TL.length-1)return;const t=tutState();t.seen=true;localStorage.sh_tut=JSON.stringify(t);$('#tut').dataset.must='0';$('#tut').classList.remove('on');return}
  if($('#tutNever').checked){const t=tutState();t.off=true;localStorage.sh_tut=JSON.stringify(t)}$('#tut').classList.remove('on')
}
const tutState=()=>{try{return JSON.parse(localStorage.sh_tut||'{"n":0,"off":false}')}catch(e){return{n:0,off:false}}};
function maybeTut(){
  const t=tutState();t.n++;
  if(!t.seen){localStorage.sh_tut=JSON.stringify(t);setTimeout(()=>showTut(true),450);return}   // first time: required, must be read to the end
  localStorage.sh_tut=JSON.stringify(t);if(!t.off&&t.n%6===0)setTimeout(showTut,450);
}
$('#tutNext').onclick=()=>{TS<TL.length-1?(TS++,drawTut()):closeTut()};
$('#tutSkip').onclick=closeTut;
$('#helpB').onclick=()=>{$('#tutNever').checked=false;showTut()};

let LT=0;const live3=()=>{clearTimeout(LT);LT=setTimeout(()=>G3&&M3E&&set3(D()),70)};
window.onGLLost=()=>{M3=false;M3E=false;if($('#s-tk').classList.contains('on'))drawTk();else if($('#s-rev').classList.contains('on'))drawRev();else{showStage();drawStage()}};
/* warning, then 3D on (review or live editor) */
let W3C='rev';
function askW3(ctx){
  W3C=ctx;const low=PF.tier!=='high';
  $('#w3T').textContent=low?'This device may lag':'Heads up';
  $('#w3P').textContent=low?'We tested this device and 3D could be slow here. You can still turn it on, but the smoothness guard is paused while 3D is on.':'The 3D preview can slow down or heat up your phone, especially an older one. You can switch back to 2D any time.';
  $('#w3Go').textContent=low?'Enable anyway':'Show 3D';$('#w3').classList.add('on');
}
$('#w3Go').onclick=async()=>{
  $('#w3').classList.remove('on');if(PF.tier!=='high')PF.bypass=true;
  await ensureModel();free3();G3=init3();if(!G3){toast('3D is not supported on this device');return}
  if(W3C==='edit')enter3E();else if(W3C==='tk'){M3=true;G3.hanger=false;G3.dist=G3.d0();drawTk()}else{M3=true;G3.hanger=G3.hasH;G3.dist=G3.d0();drawRev()}
};
$('#w3No').onclick=()=>$('#w3').classList.remove('on');
$('#v3B').onclick=()=>M3E?leave3E():askW3('edit');
function enter3E(){
  M3E=true;adjOpen(false);$('#stage').hidden=true;$('#v3e').hidden=false;$('#v3e').append(G3.c);sizeC();
  G3.yaw=YAW3[SIDE]??0;set3(D());drawStage();
}
function leave3E(){M3E=false;free3();showStage();drawStage()}

/* =============== REVIEW =============== */
function drawRev0(){
  const R=ORD.filter(hasArt);
  if(!R.length){$('#revBox').innerHTML='<div class="card sub">No finished designs yet.</div>';return}
  REV=(REV+R.length)%R.length;const d=R[REV],p=price(d.O),st=stepsOf(d);setShirt(d.O.hex);
  if(!st.includes(RV))RV=st.find(s=>arr(d,s).length)||st[0];
  const sub=R.filter(x=>x.inc).reduce((a,x)=>a+price(x.O).total,0),ship=shipFee(sub);
  const ad=(JSON.parse(localStorage.sh_prof||'{}').addr||[]).filter(Boolean).join(', ');
  $('#revBox').innerHTML=`<div class="split"><div class="stg">
    <div class="seg" id="vm" style="width:170px"><button data-vm="2" class="${M3?'':'on'}">2D</button><button data-vm="3" class="${M3?'on':''}">3D</button></div>
    <div class="stw">${R.length>1?'<button class="icn nav l" data-rv="-1" aria-label="Previous design" data-ic="left"></button>':''}
      <div class="stage" ${M3?'hidden':''}>${stageHTML(d,RV,false)}</div><div class="v3" id="v3" ${M3?'':'hidden'}></div>
      ${M3?'<button class="icn fsb" id="fsB" aria-label="Full screen" data-ic="max"></button>':''}
      ${R.length>1?'<button class="icn nav r" data-rv="1" aria-label="Next design" data-ic="right"></button>':''}</div>
    <div class="pills">${st.map(s=>`<button data-rview="${s}" class="${s===RV?'on':''}">${LBL[s]}</button>`).join('')}</div>
    ${M3&&G3&&G3.hasH?`<label class="chk"><input type="checkbox" id="hgr" ${G3.hanger?'checked':''}> Show hanger</label>`:''}
    ${M3?'<p class="note">Drag to turn · open full screen to zoom and view from any angle</p>':''}
  </div><div class="ctl" style="display:grid;gap:12px">
    <label class="chk"><input type="checkbox" id="inc" ${d.inc?'checked':''}> Include ${d.id} in my order</label>
    <div class="card" style="line-height:1.8;font-size:13.5px">Color <b>${d.O.color==='Other'?(d.O.other||d.O.hex):d.O.color}</b><br>Sizes <b>${Object.entries(d.O.sizes).filter(x=>x[1]).map(x=>x[0]+' × '+x[1]).join(', ')}</b><br>Placement <b>${placeOf(d.O)}</b><br>Quantity <b>${p.qty}</b> · ${money(p.per)} each</div>
    <div class="card" style="line-height:1.9;font-size:13.5px">Subtotal <b style="float:right">${money(sub)}</b><br>Shipping <b style="float:right">${ship?money(ship):'Free'}</b><br><span style="font-size:17px">Total <b style="float:right">${money(sub+ship)}</b></span>${sub&&sub<=PR().free?`<p class="note" style="margin-top:6px">Add ${money(PR().free+1-sub)} more for free shipping.</p>`:''}</div>
    <p class="note">Deliver to: ${ad||'no address yet. Add one in your profile.'}</p>
    <button class="btn sec" id="addMore">Add another design</button>
    <button class="btn" id="payB">Submit order</button><p class="note">Our team checks your artwork first. You pay securely with PayMongo once it is approved.</p>
  </div></div>`;
  icons($('#revBox'));
}
function drawRev(){
  drawRev0();
  if(M3&&G3){const R=ORD.filter(hasArt);if(R[REV]){$('#v3').append(G3.c);sizeC();set3(R[REV])}}
}
$('#revBox').onclick=e=>{
  const vm=e.target.closest('[data-vm]'),rv=e.target.closest('[data-rview]'),r=e.target.closest('[data-rv]');
  if(vm){if(vm.dataset.vm==='3'&&!M3)askW3('rev');else if(vm.dataset.vm==='2'&&M3){M3=false;free3();drawRev()}return}
  if(rv){RV=rv.dataset.rview;if(M3&&G3){G3.yaw=RV==='B'?Math.PI:0;req3()}drawRev();return}
  if(e.target.closest('#fsB'))return openFS();
  if(e.target.id==='hgr'){if(G3){G3.hanger=e.target.checked;G3.dist=G3.d0();req3()}return}
  if(r){REV+=+r.dataset.rv;drawRev()}
  else if(e.target.id==='inc'){ORD.filter(hasArt)[REV].inc=e.target.checked;drawRev()}
  else if(e.target.id==='addMore'){if(ORD.length>=5)return toast('You can add up to 5 designs.');dash(true)}
  else if(e.target.id==='payB')submitOrder();
};
async function submitOrder(){
  const R=ORD.filter(d=>d.inc&&hasArt(d));
  if(!R.length)return toast('Include at least one design.');
  $('#payB').disabled=true;
  for(const d of R){await vaultSave(d);await uploadArt(d);await bake(d);setSt(d,'Artwork Check')}
  toast('Submitted. Our team will check your artwork.');dash();
}

/* =============== CHAT: floating button + live messaging =============== */
const FABS=['dash','cust','lay','sty','rem','q','brief','wait','drops','fall','edit','rev','tk','pay'];   // dashboard through checkout. Hidden on landing, login and the intro features.
const fab=$('#fab'),FB={x:0,y:0,vx:0,vy:0,raf:0,drag:null,tx:0,ty:0};
const REM=()=>parseFloat(getComputedStyle(document.documentElement).fontSize)/16;
const FSZ=()=>fab.offsetWidth||54,FM=()=>12*REM();
function fabShow(){fab.hidden=!FABS.includes(S.scr)||CH.open||(ADJ.on&&!$('#adj').classList.contains('dk'))}
const fabSet=()=>{fab.style.transform=`translate3d(${FB.x}px,${FB.y}px,0)`};
function fabInit(){FB.x=innerWidth-FSZ()-FM();FB.y=Math.round(innerHeight*.74);fabSet()}
fab.addEventListener('pointerdown',e=>{try{fab.setPointerCapture(e.pointerId)}catch(_){};cancelAnimationFrame(FB.raf);FB.vx=FB.vy=0;FB.drag={sx:e.clientX,sy:e.clientY,ox:FB.x,oy:FB.y,lx:e.clientX,ly:e.clientY,lt:performance.now(),moved:0}});
fab.addEventListener('pointermove',e=>{
  const d=FB.drag;if(!d)return;const now=performance.now(),dt=Math.max(1,now-d.lt);
  FB.vx=(e.clientX-d.lx)/dt*16*.6+FB.vx*.4;FB.vy=(e.clientY-d.ly)/dt*16*.6+FB.vy*.4;d.lx=e.clientX;d.ly=e.clientY;d.lt=now;
  d.moved=Math.max(d.moved,Math.hypot(e.clientX-d.sx,e.clientY-d.sy));FB.x=d.ox+e.clientX-d.sx;FB.y=d.oy+e.clientY-d.sy;fabSet();
});
const fabEnd=()=>{const d=FB.drag;FB.drag=null;if(!d)return;if(d.moved<6){chatOpen(true);return}fabFling()};
fab.addEventListener('pointerup',fabEnd);fab.addEventListener('pointercancel',fabEnd);
function fabFling(){
  const W=innerWidth,H=innerHeight,px=FB.x+FB.vx*10,py=FB.y+FB.vy*10,s=FSZ(),m=FM();
  FB.tx=px+s/2<W/2?m:W-s-m;FB.ty=clamp(py,m+8,H-s-m-8);
  const step=()=>{
    FB.vx=(FB.vx+(FB.tx-FB.x)*.14)*.78;FB.vy=(FB.vy+(FB.ty-FB.y)*.14)*.78;FB.x+=FB.vx;FB.y+=FB.vy;fabSet();
    if(Math.abs(FB.vx)+Math.abs(FB.vy)>.05||Math.abs(FB.tx-FB.x)>.4||Math.abs(FB.ty-FB.y)>.4)FB.raf=requestAnimationFrame(step);
    else{FB.x=FB.tx;FB.y=FB.ty;fabSet()}
  };
  FB.raf=requestAnimationFrame(step);
}
addEventListener('resize',()=>{FB.vx=FB.vy=0;const s=FSZ(),m=FM();FB.tx=FB.x+s/2<innerWidth/2?m:innerWidth-s-m;FB.ty=clamp(FB.y,m,innerHeight-s-m);FB.x=FB.tx;FB.y=FB.ty;fabSet()});

const CH={open:false,reply:null,t:0},EMO=['👍','❤️','😂','😮','😢','🙏','🔥','🎉','👏','😍','🤔','👀','✅','💯','😎','🥹'];
const ckey=()=>S.acc?.email||'guest';
function chatGet(){
  const all=chatsAll(),k=ckey();let c=all[k];
  if(!c){c=all[k]={name:S.acc?.name||'Guest',email:k,msgs:[{id:uid(),from:'team',text:SITE.chat.welcome,t:Date.now(),auto:1}],ar:0,ur:0};chatsSave(all)}
  else if(S.acc?.name&&c.name!==S.acc.name){c.name=S.acc.name;chatsSave(all)}
  return{all,c};
}
const chatPut=g=>{g.all[ckey()]=g.c;chatsSave(g.all)};
const unreadN=c=>c.msgs.filter(m=>m.from==='team'&&m.t>(c.ur||0)&&!m.auto).length;
function chatBadge(){const{c}=chatGet(),n=CH.open?0:unreadN(c),b=$('#fabB');b.hidden=!n;b.textContent=n>9?'9+':n}
function chatDraw(scroll=true){
  const{c}=chatGet();
  $('#msgs').innerHTML=c.msgs.map(m=>{
    const q=m.reply&&c.msgs.find(x=>x.id===m.reply),gr=[];(m.rx||[]).forEach(r=>{const g=gr.find(x=>x.e===r.e);g?g.n++:gr.push({e:r.e,n:1})});
    return`<div class="m ${m.from}" data-id="${m.id}"><i class="ric">${ic('reply')}</i>${q?`<div class="rep" data-to="${q.id}">${esc(q.text.slice(0,60))}</div>`:''}<div class="bub" tabindex="0">${esc(m.text)}</div>${gr.length?`<div class="rxs">${gr.map(g=>`<span data-e="${g.e}" tabindex="0" role="button" aria-label="Reactions ${g.e}">${g.e}${g.n>1?' '+g.n:''}</span>`).join('')}</div>`:''}<time>${hm(m.t)}${m.from==='me'&&(c.ar||0)>=m.t?' · Seen':''}</time></div>`;
  }).join('');
  if(scroll)$('#msgs').scrollTop=1e9;
}
function chatOpen(on){
  const ch=$('#chat');
  if(on){const left=FB.x+FSZ()/2<innerWidth/2;ch.style.transition='none';ch.classList.toggle('left',left);void ch.offsetWidth;ch.style.transition='';CH.t=Date.now()}   // opens on the side where the button is parked
  CH.open=on;ch.classList.toggle('on',on);$('#chatBg').classList.toggle('on',on);
  if(on){const g=chatGet();g.c.ur=Date.now();chatPut(g);chatDraw();CH.reply=null;$('#rbar').hidden=true;if(matchMedia('(hover:hover)').matches)setTimeout(()=>$('#cin').focus({preventScroll:true}),380)}
  else{rxClose();rxwClose()}
  chatBadge();fabShow();
}
$('#chatX').onclick=()=>chatOpen(false);
$('#chatBg').onclick=()=>{if(Date.now()-CH.t>600)chatOpen(false)};   // ignore the ghost click that follows the tap on the button
function chatSend(){
  const t=$('#cin').value.trim();if(!t)return;
  const g=chatGet(),m={id:uid(),from:'me',text:t,t:Date.now()};if(CH.reply)m.reply=CH.reply;
  g.c.msgs.push(m);chatPut(g);CH.reply=null;$('#rbar').hidden=true;$('#cin').value='';grow($('#cin'));chatDraw();
  if(!g.c.msgs.some(x=>x.autoR))setTimeout(()=>{const h=chatGet();h.c.msgs.push({id:uid(),from:'team',text:SITE.chat.auto,t:Date.now(),auto:1,autoR:1});h.c.ur=Date.now();chatPut(h);if(CH.open)chatDraw()},1000);
}
$('#csend').onclick=chatSend;
$('#cin').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&matchMedia('(hover:hover)').matches){e.preventDefault();chatSend()}});
function startReply(id){const{c}=chatGet(),m=c.msgs.find(x=>x.id===id);if(!m)return;CH.reply=id;$('#rbar').hidden=false;$('#rtxt').textContent='Replying: '+m.text.slice(0,70);$('#cin').focus()}
$('#rX').onclick=()=>{CH.reply=null;$('#rbar').hidden=true};
$('#msgs').addEventListener('click',e=>{
  const r=e.target.closest('.rep');
  if(r){const el=$(`.m[data-id="${r.dataset.to}"]`);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('hl');setTimeout(()=>el.classList.remove('hl'),1000)}return}
  const chip=e.target.closest('.rxs span');if(chip)showRxw(chip.closest('.m').dataset.id,chip);
});
function toggleRx(id,e,by='me'){const g=chatGet(),m=g.c.msgs.find(x=>x.id===id);if(!m)return;m.rx=m.rx||[];const i=m.rx.findIndex(r=>r.e===e&&r.by===by);i>=0?m.rx.splice(i,1):m.rx.push({e,by});chatPut(g);chatDraw(false)}
const rx=$('#rx'),rxw=$('#rxw');let RXM=null,SWG=null;
$('#rxs').innerHTML=EMO.map(e=>`<button data-e="${e}" aria-label="React ${e}">${e}</button>`).join('');
function placePop(el,b,h){const w=el.offsetWidth||240;el.style.left=clamp(b.left+b.width/2-w/2,10,innerWidth-w-10)+'px';const top=b.top-h;el.style.top=(top<10?b.bottom+8:top)+'px';el.style.transformOrigin=top<10?'top center':'bottom center'}
function showRx(m){
  rxwClose();RXM=m.dataset.id;const b=m.querySelector('.bub').getBoundingClientRect(),g=chatGet().c.msgs.find(x=>x.id===RXM)||{};
  $$('#rxs button').forEach(x=>x.classList.toggle('mine',(g.rx||[]).some(r=>r.by==='me'&&r.e===x.dataset.e)));
  placePop(rx,b,98);$('#rxs').scrollLeft=0;rx.classList.add('on');navigator.vibrate?.(12);
}
function rxClose(){rx.classList.remove('on');RXM=null}
function showRxw(id,chip){
  rxClose();RXM=id;const m=chatGet().c.msgs.find(x=>x.id===id);if(!m)return;
  const list=m.rx||[],first=chip.dataset.e;
  $('#rxl').innerHTML=[...list].sort((a,b)=>(b.e===first)-(a.e===first)).map(r=>r.by==='me'
    ?`<button data-e="${r.e}" data-by="me"><em>${r.e}</em><span>You</span><small>Tap to remove</small></button>`
    :`<div class="rxr"><em>${r.e}</em><span>Team</span></div>`).join('');
  placePop(rxw,chip.getBoundingClientRect(),Math.min(260,70+list.length*40));rxw.classList.add('on');
}
function rxwClose(){rxw.classList.remove('on')}
rxw.addEventListener('click',e=>{const b=e.target.closest('button[data-by="me"]');if(b){toggleRx(RXM,b.dataset.e);rxwClose();toast('Reaction removed')}});
rx.addEventListener('click',e=>{
  const b=e.target.closest('[data-e]'),g=chatGet(),m=g.c.msgs.find(x=>x.id===RXM);
  if(b&&m){toggleRx(m.id,b.dataset.e);rxClose()}
  else if(e.target.id==='rxReply'&&m){startReply(m.id);rxClose()}
  else if(e.target.id==='rxCopy'&&m){navigator.clipboard?.writeText(m.text);toast('Copied');rxClose()}
});
addEventListener('pointerdown',e=>{if(rx.classList.contains('on')&&!e.target.closest('#rx'))rxClose();if(rxw.classList.contains('on')&&!e.target.closest('#rxw')&&!e.target.closest('.rxs'))rxwClose()},true);
$('#msgs').addEventListener('pointerdown',e=>{
  const bub=e.target.closest('.bub');if(!bub)return;const m=bub.closest('.m');
  SWG={m,x:e.clientX,y:e.clientY,dx:0,sw:false,dir:m.classList.contains('me')?-1:1,lp:setTimeout(()=>{if(SWG){SWG.lp=0;SWG.sw=false;showRx(m)}},450)};
});
addEventListener('pointermove',e=>{
  if(!SWG)return;const dx=(e.clientX-SWG.x)*SWG.dir,dy=e.clientY-SWG.y;
  if(Math.hypot(e.clientX-SWG.x,dy)>8&&SWG.lp){clearTimeout(SWG.lp);SWG.lp=0}
  if(!SWG.sw&&dx>10&&dx>Math.abs(dy)*1.4)SWG.sw=true;
  if(SWG.sw){SWG.dx=clamp(dx,0,72);SWG.m.style.transition='none';SWG.m.style.transform=`translateX(${SWG.dx*SWG.dir}px)`;SWG.m.querySelector('.ric').style.opacity=SWG.dx/56}
});
const swEnd=()=>{
  if(!SWG)return;clearTimeout(SWG.lp);const{m,dx,sw}=SWG;SWG=null;
  if(sw){m.style.transition='';m.style.transform='';m.querySelector('.ric').style.opacity=0;if(dx>=56){navigator.vibrate?.(10);startReply(m.dataset.id)}}
};
addEventListener('pointerup',swEnd);addEventListener('pointercancel',swEnd);
addEventListener('storage',e=>{   // live: replies and reactions from the team arrive without a refresh
  if(e.key!=='sh_chats')return;
  const g=chatGet();
  if(CH.open){g.c.ur=Date.now();chatPut(g);chatDraw()}
  else{const n=unreadN(g.c);chatBadge();if(n&&FABS.includes(S.scr))toast('New message from the team')}
});

/* every primary button sweeps to lime for a split second before the next page opens */
addEventListener('click',e=>{
  const b=e.target.closest('.btn:not(.ghost)');
  if(!b||b.__ok||b.disabled||b.id==='upGo')return;       // the file picker must open inside the tap, so it skips the delay
  e.stopImmediatePropagation();e.preventDefault();b.classList.add('fill');
  setTimeout(()=>{b.__ok=1;b.click();b.__ok=0;setTimeout(()=>b.classList.remove('fill'),450)},130);
},true);

/* ===== keyboard: the whole shop works from a PC keyboard ===== */
const MODAL_CANCEL={profile:'#pClose',confirm:'#cStay',ask:'#askN',chart:'#chartX',dropPop:'#dropLater',w3:'#w3No',tut:'#tutSkip',upRem:null};
const modalOn=()=>$$('.modal.on').pop();
function focusIn(m){const el=m.querySelector('textarea,input:not([type=checkbox]):not([type=file])')||m.querySelector('.btn:not(.ghost):not(.sec)')||m.querySelector('button');if(el)el.focus({preventScroll:true})}
new MutationObserver(ms=>ms.forEach(r=>{const t=r.target;if(t.classList&&t.classList.contains('modal')&&t.classList.contains('on'))setTimeout(()=>focusIn(t),70)})).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
const NOENTER='#cq,#cin,#custTxt,#req,#briefT,#chatT,#rejTxt,#otherTxt,input[type=checkbox],input[type=range],input[type=file]';
addEventListener('keydown',e=>{
  const t=e.target,typing=/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)&&!/checkbox|range|file/.test(t.type||''),m=modalOn();
  if(e.key==='Escape'){
    if(m){const c=MODAL_CANCEL[m.id];e.preventDefault();c?$(c).click():m.classList.remove('on');return}
    if(typeof ADJ!=='undefined'&&ADJ.on&&!$('#adj').classList.contains('dk')){adjOpen(false);return}
    if($('#rxw').classList.contains('on')){rxwClose();return}
    if($('#rx').classList.contains('on')){rxClose();return}
    if($('#chat').classList.contains('on')){chatOpen(false);return}
    return;
  }
  const pinScr=S.scr==='pin'?pin:(S.scr==='login'&&!$('#loginPin').hidden?lpad:null);
  if(!typing&&!m&&!e.ctrlKey&&!e.metaKey){
    if(pinScr&&/^\d$/.test(e.key)){e.preventDefault();pinScr.press(e.key);return}
    if(pinScr&&e.key==='Backspace'){e.preventDefault();pinScr.press('X');return}
    if(S.scr==='login'&&$('#loginPin').hidden&&/^[1-9]$/.test(e.key)){const tl=$$('.tile')[+e.key-1];if(tl){e.preventDefault();tl.click();return}}
  }
  if(S.scr==='intro'&&!m&&(e.key==='Enter'||e.key===' ')){
    e.preventDefault();
    if($('#sl1').classList.contains('on'))nextSlide();else if(!$('#startB').hidden)dash();else cardTo(cur()+1);
    return;
  }
  if((e.key==='Enter'||e.key===' ')&&t.matches&&t.matches('[role=button]')){e.preventDefault();t.click();return}
  if(t.classList&&t.classList.contains('bub')){
    if(e.key==='Enter'||e.key===' '){e.preventDefault();showRx(t.closest('.m'));return}
    if(e.key==='r'||e.key==='R'){e.preventDefault();startReply(t.closest('.m').dataset.id);return}
  }
  if(e.key==='Enter'&&!e.isComposing&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey){
    if(t.matches&&t.matches('button,a,summary,[role=button]'))return;
    if(t.matches&&t.matches(NOENTER))return;
    if(t.tagName==='TEXTAREA'&&t.id!=='qa')return;
    const box=m||$('#s-'+S.scr);if(!box)return;
    const b=$$('.btn:not(.ghost):not(.sec)',box).find(x=>!x.hidden&&!x.disabled&&x.offsetParent);
    if(b){e.preventDefault();b.click()}
  }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'&&S.scr==='edit'&&!typing){e.preventDefault();redo()}
});

placeAdj();
/* ===== appearance (light / dark, text size) + footer + policies ===== */
const UI={
  load(){try{return JSON.parse(localStorage.sh_ui||'{}')}catch(e){return{}}},
  save(u){try{localStorage.sh_ui=JSON.stringify(u)}catch(e){}},
  theme(){const u=this.load();return u.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')},
  ts(){const u=this.load();return typeof u.ts==='number'?u.ts:1}
};
const TS_LEVELS=[{k:.94,n:'Small'},{k:1,n:'Default'},{k:1.1,n:'Large'},{k:1.2,n:'Extra large'}];
const I_SUN='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7"/></svg>';
const I_MOON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a8.4 8.4 0 1 0 10.8 10.8z"/></svg>';
const I_TS='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19L8.2 5.5 13.4 19M4.9 14.6h6.6"/><path d="M15.5 19l3-7.7 3 7.7M16.5 16.6h4"/></svg>';
function applyUI(){
  const th=UI.theme(),k=TS_LEVELS[UI.ts()]?.k||1;
  document.documentElement.dataset.theme=th;document.documentElement.style.setProperty('--ts',k);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content',th==='dark'?'#0e0f10':'#f6f6f4');
  const b=$('#thB');if(b){b.innerHTML=th==='dark'?I_SUN:I_MOON;const l=th==='dark'?'Switch to light mode':'Switch to dark mode';b.setAttribute('aria-label',l);b.title=l;b.setAttribute('aria-pressed',th==='dark')}
  $$('#tsPop button').forEach(x=>x.classList.toggle('on',+x.dataset.i===UI.ts()));
  $('#uit')&&$('#uit').classList.toggle('onDark',S.scr==='land'||S.scr==='intro');
}
document.body.insertAdjacentHTML('beforeend',`<div class="uit" id="uit"><button id="thB" class="uib"></button><button id="tsB" class="uib" aria-label="Text size" title="Text size" aria-haspopup="true" aria-expanded="false">${I_TS}</button>
<div id="tsPop" role="menu" aria-label="Text size"><b>Text size</b>${TS_LEVELS.map((l,i)=>`<button role="menuitemradio" data-i="${i}" style="font-size:${.8+i*.12}rem">${l.n}<span>Aa</span></button>`).join('')}</div></div>`);
$('#thB').onclick=()=>{const u=UI.load();u.theme=UI.theme()==='dark'?'light':'dark';UI.save(u);applyUI()};
$('#tsB').onclick=e=>{e.stopPropagation();const o=$('#tsPop').classList.toggle('on');$('#tsB').setAttribute('aria-expanded',o)};
$('#tsPop').onclick=e=>{const b=e.target.closest('button[data-i]');if(!b)return;const u=UI.load();u.ts=+b.dataset.i;UI.save(u);applyUI()};
addEventListener('pointerdown',e=>{if(!e.target.closest('#uit')){$('#tsPop').classList.remove('on');$('#tsB').setAttribute('aria-expanded',false)}});
matchMedia('(prefers-color-scheme:dark)').addEventListener?.('change',()=>{if(!UI.load().theme)applyUI()});
applyUI();

/* ---- business details used in every policy: edit once here ---- */
const BIZ={name:'{business name}',email:'{email}',phone:'{phone}',address:'{address}',updated:'October 2026'};
const POL={
about:{t:'About us',h:`
<p><b>${'{n}'}</b> makes custom-printed shirts, one order at a time. You send us your artwork, or just an idea, and our team turns it into a print-ready design you approve before anything is printed.</p>
<h3>How it works</h3>
<ol><li><b>Pick your shirt.</b> Choose the color, sizes and where your design goes: chest, front, back or sleeves.</li>
<li><b>Add your design or your idea.</b> Upload artwork and place it on a live mockup, or describe your idea and let our designers take it from there.</li>
<li><b>Approve the design.</b> Our designers hand over your designs within the day. You can request changes before approving.</li>
<li><b>We print and ship.</b> Printing takes 3 to 5 days, then shipping takes 2 to 5 days.</li></ol>
<h3>Why people use us</h3>
<p>A real preview before you pay, a human design team behind every order, and one place to chat with us about your shirt from start to finish.</p>`},
contact:{t:'Contact us',h:`
<p>Questions about an order, a design or a payment? Reach us any time. We usually reply within a few hours during working days.</p>
<ul><li><b>Chat:</b> use the chat button inside the app for the fastest reply.</li><li><b>Email:</b> {e}</li><li><b>Phone:</b> {p}</li><li><b>Address:</b> {a}</li></ul>
<p>Please include your ticket number (it looks like D12345-678) so we can find your order quickly.</p>`},
terms:{t:'Terms of service',h:`
<p><i>Last updated {u}.</i> By creating an account or placing an order with <b>{n}</b> you agree to these terms.</p>
<h3>1. Who can order</h3><p>You must be 18 or older, or have a parent or guardian place the order for you. Keep your PIN private. You are responsible for activity under your account. Accounts that are not used for 60 days are deleted (we email you a week before), and you can delete yours from your profile once nothing is in progress.</p>
<h3>2. Your artwork</h3><p>You confirm you own the artwork you upload or have permission to use it. We do not print designs that infringe someone else's rights, or that are hateful, unlawful or sexually explicit. We may decline or pause an order for these reasons and will tell you why.</p>
<h3>3. Our designs</h3><p>When you ask us to design for you, you may receive up to 3 takes of 4 designs each. Once you approve a design it is final and goes to print. Designs we create for your order are printed for you only, and we may show finished work as examples unless you ask us not to.</p>
<h3>4. Prices and payment</h3><p>Prices are shown in Philippine pesos before you pay. Payment is processed securely by PayMongo. An order is confirmed once payment succeeds.</p>
<h3>5. Production and delivery</h3><p>Design usually takes 1 day. Printing takes 3 to 5 days and shipping takes 2 to 5 days. These are estimates, not guarantees, and may be longer during busy periods, holidays or weather events.</p>
<h3>6. Color and print differences</h3><p>Screens differ, so printed colors can look slightly different from your mockup. Small shifts in placement or color are normal for printed garments.</p>
<h3>7. Returns</h3><p>See our Returns and refunds policy. Because every shirt is made to order, we do not accept returns for change of mind.</p>
<h3>8. AI suggestions</h3><p>Our assistant, Auhsy, helps you shape your idea. Its suggestions are only suggestions. Our design team reviews your request.</p>
<h3>9. Changes and contact</h3><p>We may update these terms and will post the new date here. Questions: {e}.</p>`},
privacy:{t:'Privacy policy',h:`
<p><i>Last updated {u}.</i> <b>{n}</b> respects your privacy and handles personal data under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules.</p>
<h3>What we collect</h3>
<ul><li><b>Account:</b> your name, email address and a PIN (stored in protected form, never in plain text).</li>
<li><b>Order:</b> shirt choices, uploaded artwork, requests, chat messages, and delivery details you choose to give (name, phone, address).</li>
<li><b>Payment:</b> handled by PayMongo. We do not store your full card number. We keep the payment reference and status.</li>
<li><b>Device:</b> a notification token if you allow notifications, and simple settings saved on your device such as theme and text size.</li></ul>
<h3>Why we use it</h3>
<ul><li>To create and secure your account, and send you a verification code.</li><li>To design, print, ship and support your order.</li><li>To tell you when your designs or order are ready.</li><li>To prevent fraud and keep the service safe.</li></ul>
<p>We use your data only for these purposes. We do not sell it.</p>
<h3>Who processes it for us</h3>
<ul><li><b>PayMongo</b> processes payments.</li><li><b>Supabase</b> stores our database and your files.</li><li><b>OneSignal</b> delivers push notifications.</li><li><b>DeepSeek</b> powers the Auhsy assistant. Messages you type to the assistant are sent to it. Do not put passwords, card numbers or other sensitive information in the assistant.</li><li>Email delivery for verification codes and updates.</li><li>Couriers receive your name, phone and address to deliver your order.</li></ul>
<p>These providers may process data on servers outside the Philippines. We require them to protect it.</p>
<h3>How long we keep it</h3><p>Your account, designs and messages stay while you use the service. If you do not sign in for 60 days, we delete your account together with your designs, files and messages; we email you a week before so you can keep it by signing in. You can also delete your account yourself from your profile at any time once none of your orders is in progress. Records of paid orders are kept without your name, email, phone or address for as long as tax and accounting rules require.</p>
<h3>Your rights</h3>
<p>You have the right to be informed, to access your data, to object, to correct it, to ask us to erase or block it, to data portability, to claim damages for misuse, and to file a complaint with the National Privacy Commission (privacy.gov.ph). To use any of these rights, email {e} with your account email.</p>
<h3>Security</h3><p>We use encrypted connections, restricted staff access and protected storage. No system is perfectly secure, so please keep your PIN private. If a breach affects you, we will notify you and the National Privacy Commission as the law requires.</p>
<h3>Contact</h3><p>Data protection contact: {n}, {e}, {p}.</p>`},
returns:{t:'Returns and refunds',h:`
<p><i>Last updated {u}.</i> Every shirt is printed to order, so we cannot resell it. That shapes this policy.</p>
<h3>No returns</h3><p>We do not accept returns or exchanges for change of mind, wrong size ordered, or color preference.</p>
<h3>If the mistake is ours, we reprint</h3><p>If your order arrives with a print defect, wrong print, wrong shirt color or size different from what you approved, or damage in transit, we will reprint and send it again at no cost to you.</p>
<h3>How to report a problem</h3>
<ol><li>Tell us within <b>3 days</b> of delivery through chat or at {e}.</li><li>Include your ticket number and clear photos of the shirt and the problem.</li><li>We review within 2 working days and tell you the result. If approved, the reprint goes into production right away.</li></ol>
<h3>What is not covered</h3><ul><li>Low quality, blurry or wrongly placed artwork that you approved.</li><li>Small color differences between screen and print.</li><li>Normal wear, washing against the care label, or changes you made yourself.</li></ul>
<h3>Cancellations</h3><p>You can cancel before your design is approved. After approval the order goes to print and cannot be cancelled. If we cannot deliver an order, we will refund it in full through the original payment method.</p>`},
shipping:{t:'Shipping and production',h:`
<p><i>Last updated {u}.</i></p>
<h3>Timeline</h3>
<ul><li><b>Design:</b> about 1 day after you send your request. Your designs are handed over within the day and we notify you by email and push notification.</li><li><b>Printing:</b> 3 to 5 days after you approve and payment is confirmed.</li><li><b>Shipping:</b> 2 to 5 days depending on your location.</li></ul>
<p>Start to finish, plan for about 6 to 11 days. Busy seasons and remote areas can take longer.</p>
<h3>Delivery details</h3><p>Make sure your name, phone number and address are correct. We are not responsible for delays caused by a wrong or incomplete address. If a courier cannot reach you, they may return the parcel and re-shipping costs may apply.</p>
<h3>Tracking</h3><p>When your order ships we will send you the courier and tracking number through chat and notification.</p>`},
payment:{t:'Payment policy',h:`
<p><i>Last updated {u}.</i></p>
<h3>How you pay</h3><p>You pay on the checkout page. Payments are processed by PayMongo using the methods shown at checkout. We never see or store your full card number.</p>
<h3>When you are charged</h3><p>You are charged when you place your order. Your order shows as paid as soon as PayMongo confirms the payment, and our team sees it right away.</p>
<h3>Failed or duplicate payments</h3><p>If a payment fails, you are not charged for the order. If you were charged twice by mistake, contact us with the reference and we will refund the duplicate.</p>
<h3>Refunds</h3><p>Refunds follow the Returns and refunds policy and go back to the original payment method. Banks and e-wallets can take several working days to show them.</p>
<h3>Receipts</h3><p>Ask us in chat or email {e} for a receipt for any paid order.</p>`}
};
const POL_ORDER=['about','contact','terms','privacy','returns','shipping','payment'];
const polHTML=k=>POL[k].h.replace(/\{n\}/g,BIZ.name).replace(/\{e\}/g,BIZ.email).replace(/\{p\}/g,BIZ.phone).replace(/\{a\}/g,BIZ.address).replace(/\{u\}/g,BIZ.updated);
document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="info" role="dialog" aria-modal="true" aria-labelledby="infoT"><div class="sheet infoS"><div class="row"><h1 class="grow" id="infoT" style="font-size:1.2rem"></h1><button class="icn" id="infoX" aria-label="Close" data-ic="x"></button></div><div class="infoN" id="infoN" role="tablist"></div><div class="infoB" id="infoB" tabindex="0"></div></div></div>`);
$('#infoX').innerHTML=ic('x');
function openInfo(k){
  $('#infoT').textContent=POL[k].t;$('#infoB').innerHTML=polHTML(k);$('#infoB').scrollTop=0;
  $('#infoN').innerHTML=POL_ORDER.map(x=>`<button role="tab" data-k="${x}" class="${x===k?'on':''}" aria-selected="${x===k}">${POL[x].t}</button>`).join('');
  $('#info').classList.add('on');
}
$('#infoN').onclick=e=>{const b=e.target.closest('[data-k]');if(b)openInfo(b.dataset.k)};
$('#infoX').onclick=()=>$('#info').classList.remove('on');
$('#info').addEventListener('pointerdown',e=>{if(e.target===$('#info'))$('#info').classList.remove('on')});
MODAL_CANCEL.info='#infoX';

const footHTML=()=>`<footer class="foot"><nav aria-label="About and policies"><button data-pol="about">About us</button><button data-pol="contact">Contact us</button><button data-pol="terms">Terms</button><button data-pol="privacy">Privacy</button><button data-pol="returns">Returns</button><button data-pol="shipping">Shipping</button><button data-pol="payment">Payment</button></nav><small>© ${new Date().getFullYear()} ${BIZ.name}. Made to order.</small></footer>`;
['#s-land','#s-dash'].forEach(s=>$(s)?.insertAdjacentHTML('beforeend',footHTML()));
document.addEventListener('click',e=>{const b=e.target.closest('[data-pol]');if(b){e.preventDefault();openInfo(b.dataset.pol)}});

/* ===== server connection: shop side. Inactive until config.js sets window.FM.api ===== */
const canon=o=>JSON.stringify(o,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((a,x)=>(a[x]=v[x],a),{}):v);
const hashO=o=>{const{u,...r}=o;return canon(r)};

/* ---- sign up, log in ---- */
Object.assign(API,{
  _demo:{sendCode:API.sendCode,verifyCode:API.verifyCode,nameTaken:API.nameTaken,savePin:API.savePin,checkPin:API.checkPin},
  async sendCode(email){if(!NET.on)return this._demo.sendCode.call(this,email);return NET.j('/auth/send-code',{email})},
  async verifyCode(code,email){
    if(!NET.on)return this._demo.verifyCode.call(this,code);
    try{const r=await NET.j('/auth/verify-code',{email,code:String(code).trim()});S.vt=r.ticket;return true}catch(e){S.codeErr=e.message;return false}
  },
  async nameTaken(n,own){
    if(!NET.on)return this._demo.nameTaken.call(this,n,own);
    try{return !(await NET.j('/auth/name-available?name='+encodeURIComponent(n)+'&email='+encodeURIComponent(own||''))).available}
    catch(e){return false}                       // if the server cannot be reached, register still enforces it
  },
  async savePin(a){
    if(!NET.on)return this._demo.savePin.call(this,a);
    const r=S.mode==='forgot'?await NET.j('/auth/reset-pin',{email:a.email,pin:a.pin,ticket:S.vt}):await NET.j('/auth/register',{email:a.email,name:a.name,pin:a.pin,ticket:S.vt});
    this._session(r);
    const l=this.accounts().filter(x=>x.email!==r.email);l.push({name:r.name,email:r.email});localStorage.sh_acc=JSON.stringify(l);   // this device remembers who you are, never the PIN
    return r;
  },
  _session(r){NET.tok=r.token;try{sessionStorage.sh_tok=r.token}catch(e){}Notify.login(r.ext)},
  async checkPin(a,pin){
    if(!NET.on)return this._demo.checkPin.call(this,a,pin);
    S.lerr='';
    try{const r=await NET.j('/auth/login',{email:a.email,pin});this._session(r);if(r.name)a.name=r.name;await Repl.tick(true);return true}
    catch(e){S.lerr=e.message;return false}
  }
});

/* ---- keep orders and chat in step with the server ---- */
const Repl={
  email:'',sent:{},cs:{},since:0,csince:0,busy:false,
  reset(){this.email=S.acc?.email||'';this.sent={};this.cs={};this.since=0;this.csince=0},
  async tick(first){
    if(!NET.on)return;
    if(!S.acc){if(NET.tok){NET.tok='';try{sessionStorage.removeItem('sh_tok')}catch(e){}Notify.logout()}return}
    if(!NET.tok)return;
    if(this.busy){if(first){await new Promise(r=>setTimeout(r,800))}return}
    if(this.email!==S.acc.email)this.reset();
    this.busy=true;
    try{await this.flush();await this.pullOrders();await this.chat()}
    catch(e){if(e.status===401){NET.tok='';toast('Please log in again.');showLogin()}}
    finally{this.busy=false}
  },
  async flush(){
    const mine=allOrders().filter(o=>o.email===S.acc.email&&this.sent[o.id]!==hashO(o));
    if(!mine.length)return;
    const r=await NET.j('/me/orders',{orders:mine});this.apply(r.orders);
  },
  async pullOrders(){
    const r=await NET.j('/me/orders?since='+this.since),all=allOrders(),take=[];
    for(const o of r.orders){this.since=Math.max(this.since,o.u||0);const loc=all.find(x=>x.id===o.id);if(!loc||this.sent[o.id]===hashO(loc))take.push(o)}
    if(take.length)this.apply(take);
  },
  apply(list){
    const all=allOrders();let ch=false;
    for(const o of list){this.since=Math.max(this.since,o.u||0);const i=all.findIndex(x=>x.id===o.id);if(i<0)all.push(o);else all[i]=o;this.sent[o.id]=hashO(o);ch=true}
    if(!ch)return;
    quietSet('sh_orders',JSON.stringify(all));
    pull();                                                          // merge into the open session (also shows the "designs are ready" popup)
    if($('#s-dash').classList.contains('on'))dash($('#s-dash').classList.contains('more'));
    else if($('#s-tk').classList.contains('on'))drawTk();
  },
  async chat(){
    const g=chatGet(),c=g.c,out=[];
    for(const m of c.msgs){if(m.auto)continue;if(m.from==='team'&&this.cs[m.id]===undefined)continue;if(this.cs[m.id]!==canon(m))out.push(m)}
    const body={};if(out.length)body.msgs=out;if((c.ur||0)>(this.ur||0))body.ur=c.ur;
    if(body.msgs||body.ur!==undefined){await NET.j('/me/chat',body);out.forEach(m=>this.cs[m.id]=canon(m));if(body.ur!==undefined)this.ur=body.ur}
    const r=await NET.j('/me/chat?since='+this.csince);let fresh=0;
    for(const s of r.msgs){this.csince=Math.max(this.csince,s.u||0);const{u,email,...m}=s,i=c.msgs.findIndex(x=>x.id===m.id);
      if(i<0){c.msgs.push(m);if(m.from==='team'&&!m.auto)fresh++}else if(this.cs[m.id]===undefined||this.cs[m.id]===canon(c.msgs[i]))c.msgs[i]=m;
      this.cs[m.id]=canon(m)}
    if(r.thread&&r.thread.ar)c.ar=Math.max(c.ar||0,r.thread.ar);
    if(!r.msgs.length)return;
    c.msgs.sort((a,b)=>a.t-b.t);
    if(CH.open)c.ur=Date.now();
    g.all[ckey()]=c;quietSet('sh_chats',JSON.stringify(g.all));
    chatBadge();if(CH.open)chatDraw();else if(fresh&&FABS.includes(S.scr))toast('New message from the team');
  },
  async colors(){
    if(!NET.on)return;
    try{const c=await NET.j('/colors');if(c&&(c.avail||c.custom)){quietSet('sh_colors',JSON.stringify(c));if($('#s-cust').classList.contains('on'))drawColors()}}catch(e){}
  }
};

/* the original artwork files go to private storage when the order is submitted */
async function uploadArt(d){
  if(!(NET.on&&NET.tok))return;
  for(const s of Object.keys(d.art))for(const it of d.art[s]){
    if(it.path||!it.key)continue;
    try{
      const b=await IDB.get(it.key);if(!b)continue;
      const f=new FormData();f.append('order_id',d.id);f.append('key',it.key);f.append('file',new File([b],'art',{type:b.type||'image/png'}));
      it.path=(await NET.j('/me/art',f)).path;
    }catch(e){}                                  // the preview still travels with the order; the team can ask for the file in chat
  }
}

/* ---- Auhsy AI suggestions (DeepSeek, kept inside the business rules on the server) ---- */
const AIC={};
async function aiSuggest(qi,tl){
  if(!(NET.on&&NET.tok&&NET.cfg&&NET.cfg.ai))return;
  const d=D(),o=d.O,lang=tl?'tl':'en',prev=(d.ans||[]).slice(0,qi),key=qi+'|'+lang+'|'+prev.join('¦');
  const show=a=>{if(QI!==qi||LANG!==lang)return;$('#qs').innerHTML=a.map(s=>`<button class="chp ai">${esc(s)}</button>`).join('')};
  if(AIC[key])return show(AIC[key]);
  try{
    const r=await NET.j('/ai/suggest',{question:QS[qi][tl?1:0],answers:prev,lang,style:o.style||'',shirt:{color:o.color==='Other'?(o.other||''):o.color,placement:placeOf(o)}});
    AIC[key]=r.suggestions;show(r.suggestions);
  }catch(e){}                                    // the built-in suggestions stay
}

/* ---- push notifications (OneSignal) ---- */
const Notify={
  ready:false,ext:'',loading:null,
  init(){
    if(this.loading||!NET.cfg||!NET.cfg.onesignal_app_id)return this.loading;
    this.loading=new Promise(res=>{
      window.OneSignalDeferred=window.OneSignalDeferred||[];
      window.OneSignalDeferred.push(async OS=>{try{await OS.init({appId:NET.cfg.onesignal_app_id,serviceWorkerPath:'OneSignalSDKWorker.js',allowLocalhostAsSecureOrigin:true,notifyButton:{enable:false}});this.OS=OS;this.ready=true;if(this.ext)await OS.login(this.ext)}catch(e){}res()});
      const s=document.createElement('script');s.src='https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';s.defer=true;document.head.appendChild(s);
    });
    return this.loading;
  },
  async login(ext){this.ext=ext;if(this.ready)try{await this.OS.login(ext)}catch(e){}},
  async logout(){this.ext='';if(this.ready)try{await this.OS.logout()}catch(e){}},
  async enable(){
    if(!NET.on||!(NET.cfg&&NET.cfg.onesignal_app_id)){toast('Notifications are not switched on yet. We will email you instead.');return}
    await this.init();if(!this.ready){toast('Could not start notifications on this browser.');return}
    try{await this.OS.Notifications.requestPermission();toast(this.OS.Notifications.permission?'Notifications are on.':'Notifications are blocked. You can allow them in your browser settings.')}catch(e){toast('Could not turn on notifications.')}
  }
};

/* ---- checkout: card payment right on this page (PayMongo) ---- */
const PAY={d:null,method:'card',busy:false,poll:0,intent:null};
const luhn=n=>{let s=0,t=false;for(let i=n.length-1;i>=0;i--){let x=+n[i];if(t){x*=2;if(x>9)x-=9}s+=x;t=!t}return s%10===0};
const payAmt=d=>{const p=price(d.O,d.P),ship=shipFee(p.total,d.P);return{...p,ship,pay:p.total+ship}};
function openPay(i){CUR=i;PAY.d=D();PAY.method='card';PAY.busy=false;drawPay();go('pay')}
function drawPay(){
  const d=PAY.d,p=payAmt(d),prof=JSON.parse(localStorage.sh_prof||'{}'),ad=(prof.addr||[]).filter(Boolean).join(', ');
  const live=NET.on&&NET.cfg&&NET.cfg.payments;
  $('#payL').innerHTML=`<div class="card ptn"><h3>Order ${esc(d.id)}</h3><dl class="kv2"><dt>Color</dt><dd>${esc(colorOf(d))}</dd><dt>Sizes</dt><dd>${esc(Object.entries(d.O.sizes).filter(x=>x[1]).map(x=>x[0]+' × '+x[1]).join(', '))}</dd><dt>Placement</dt><dd>${esc(placeOf(d.O))}</dd></dl></div>
  <div class="card ptn" style="line-height:1.9">${money(p.per)} × ${p.qty} shirts<b style="float:right">${money(p.total)}</b><br>Shipping<b style="float:right">${p.ship?money(p.ship):'Free'}</b><br><span style="font-size:1.15rem">Total<b style="float:right">${money(p.pay)}</b></span></div>
  <p class="note">Deliver to: ${esc(ad||'no address yet. Add one in your profile.')}</p>`;
  if(d.status==='Paid'||d.paid_at){$('#payR').innerHTML=paidHTML(d);return}
  $('#payR').innerHTML=`<div class="card ptn payF">
    <h3>Pay securely</h3>
    ${live?'':'<p class="note demoN">Demo mode: no money is taken. Connect the server to charge real payments.</p>'}
    <div class="seg" id="payM"><button data-m="card" class="${PAY.method==='card'?'on':''}">Card</button><button data-m="gcash" class="${PAY.method==='gcash'?'on':''}">GCash</button><button data-m="paymaya" class="${PAY.method==='paymaya'?'on':''}">Maya</button></div>
    <div id="payCard" ${PAY.method==='card'?'':'hidden'}>
      <label class="fl">Name on card<input class="in" id="pcName" autocomplete="cc-name" value="${esc(S.acc?.name||'')}"></label>
      <label class="fl">Card number<input class="in" id="pcNum" inputmode="numeric" autocomplete="cc-number" placeholder="1234 5678 9012 3456" maxlength="23"></label>
      <div class="row2c"><label class="fl">Expiry<input class="in" id="pcExp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM / YY" maxlength="7"></label><label class="fl">CVC<input class="in" id="pcCvc" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4"></label></div>
    </div>
    <div id="payWal" ${PAY.method==='card'?'hidden':''}><label class="fl">Mobile number<input class="in" id="pwPhone" inputmode="tel" autocomplete="tel" value="${esc(prof.phone||'')}" placeholder="09XX XXX XXXX"></label><p class="note">You will be sent to ${PAY.method==='gcash'?'GCash':'Maya'} to approve the payment, then brought right back here. Wallets must open their own page; only cards can stay on this page.</p></div>
    <p class="err" id="payE" role="alert"></p>
    <button class="btn" id="payGo">Pay ${money(p.pay)}</button>
    <p class="note">${live?'Payments are processed by PayMongo. Your card goes straight to PayMongo and is never stored by us.':'This is a preview of the checkout.'}</p>
  </div>`;
}
const paidHTML=d=>`<div class="card ptn payOk"><div class="okc">${ic('check')}</div><h2>Payment received</h2><p class="note">Ticket ${esc(d.id)} is paid. Our team has been told and your shirt goes into printing next. We will notify you at each step.</p><button class="btn" id="payDone">Back to dashboard</button></div>`;
$('#s-pay').addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='pcNum'){const v=t.value.replace(/\D/g,'').slice(0,19);t.value=v.replace(/(.{4})/g,'$1 ').trim()}
  if(t.id==='pcExp'){let v=t.value.replace(/\D/g,'').slice(0,4);if(v.length>=3)v=v.slice(0,2)+' / '+v.slice(2);t.value=v}
  if(t.id==='pcCvc')t.value=t.value.replace(/\D/g,'').slice(0,4);
  const er=$('#payE');if(er)er.textContent='';
});
$('#s-pay').addEventListener('click',e=>{
  const m=e.target.closest('#payM button');if(m&&!PAY.busy){PAY.method=m.dataset.m;drawPay();return}
  if(e.target.id==='payGo')payGo();
  if(e.target.id==='payDone')dash();
});
$('#s-pay').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('#s-pay input')){e.preventDefault();payGo()}});
const payErr=t=>{const el=$('#payE');if(el){el.textContent=t;shake($('#payGo'))}PAY.busy=false;const b=$('#payGo');if(b){b.disabled=false}};
async function pmCall(path,key,body){
  const r=await fetch('https://api.paymongo.com/v1'+path,{method:'POST',headers:{Authorization:'Basic '+btoa(key+':'),'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error((j.errors&&j.errors[0]&&j.errors[0].detail)||'The payment was not accepted.');
  return j.data;
}
async function payGo(){
  if(PAY.busy)return;const d=PAY.d,p=payAmt(d);
  if(!NET.on||!(NET.cfg&&NET.cfg.payments)){   // demo: nothing is charged
    PAY.busy=true;$('#payGo').disabled=true;
    setTimeout(()=>{d.status='Paid';d.paid_at=new Date().toISOString();(d.hist=d.hist||[]).push({t:d.paid_at,s:'Paid',by:'customer',n:'demo'});persist();$('#payR').innerHTML=paidHTML(d);PAY.busy=false},700);return;
  }
  let card=null;
  if(PAY.method==='card'){
    const num=$('#pcNum').value.replace(/\s/g,''),ex=$('#pcExp').value.replace(/\D/g,''),cvc=$('#pcCvc').value,nm=$('#pcName').value.trim();
    const mm=+ex.slice(0,2),yy=2000+ +ex.slice(2,4),now=new Date();
    if(nm.length<2)return payErr('Enter the name on the card.');
    if(num.length<13||!luhn(num))return payErr('That card number does not look right.');
    if(ex.length<4||mm<1||mm>12||yy<now.getFullYear()||(yy===now.getFullYear()&&mm<now.getMonth()+1))return payErr('Check the expiry date.');
    if(cvc.length<3)return payErr('Enter the 3 or 4 digit security code.');
    card={nm,num,mm,yy,cvc};
  }else if(($('#pwPhone').value||'').replace(/\D/g,'').length<10)return payErr('Enter your mobile number.');
  PAY.busy=true;$('#payGo').disabled=true;$('#payGo').textContent='Processing…';
  try{
    const it=await NET.j('/pay/intent',{order_id:d.id,method:PAY.method});PAY.intent=it.intent_id;
    const prof=JSON.parse(localStorage.sh_prof||'{}'),phone=(card?prof.phone:$('#pwPhone').value)||'',billing={name:card?card.nm:(S.acc.name||'Customer'),email:S.acc.email};
    if(phone.replace(/\D/g,'').length>=10)billing.phone=phone.replace(/\D/g,'');
    const attrs=card?{type:'card',details:{card_number:card.num,exp_month:card.mm,exp_year:card.yy,cvc:card.cvc},billing}:{type:PAY.method,billing};
    const pm=await pmCall('/payment_methods',it.public_key,{data:{attributes:attrs}});
    const ret=location.origin+location.pathname.replace(/[^/]*$/,'')+'?payret=1&o='+encodeURIComponent(d.id);   // back to the shop itself (no separate page)
    const at=await pmCall(`/payment_intents/${it.intent_id}/attach`,it.public_key,{data:{attributes:{payment_method:pm.id,client_key:it.client_key,return_url:ret}}});
    const st=at.attributes.status,nx=at.attributes.next_action;
    if(st==='succeeded'||st==='processing')return payWait(it.intent_id);
    if(st==='awaiting_next_action'&&nx&&nx.redirect){
      if(card)return pay3ds(nx.redirect.url,it.intent_id);
      try{sessionStorage.sh_ret=JSON.stringify({acc:S.acc,tok:NET.tok,order:d.id,pi:it.intent_id})}catch(e){}
      location.href=nx.redirect.url;return;
    }
    const le=at.attributes.last_payment_error;
    payErr((le&&le.failed_message)||'The payment was not accepted. Try another card or method.');
  }catch(e){payErr(e.message||'Payment failed. Please try again.')}
}
async function payStatus(id){return (await NET.j('/pay/status?intent_id='+encodeURIComponent(id))).status}
async function payWait(id,tries=15){
  for(let i=0;i<tries;i++){
    let st;try{st=await payStatus(id)}catch(e){st='processing'}
    if(st==='succeeded')return payDone();
    if(st==='awaiting_payment_method')return payErr('The payment was not completed. Please try again.');
    await new Promise(r=>setTimeout(r,1500));
  }
  payErr('We are still waiting for confirmation. Check your ticket in a moment. You will not be charged twice.');
}
async function payDone(){
  await Repl.tick(true);
  const d=PAY.d;$('#payR').innerHTML=paidHTML(d);PAY.busy=false;toast('Payment received. Thank you!');
}
function pay3ds(url,id){
  $('#pay3F').src=url;$('#pay3').classList.add('on');clearInterval(PAY.poll);let n=0;
  const stop=()=>{clearInterval(PAY.poll);$('#pay3').classList.remove('on');$('#pay3F').src='about:blank'};
  const chk=async()=>{
    let st;try{st=await payStatus(id)}catch(e){return}
    if(st==='succeeded'){stop();payDone()}
    else if(st==='awaiting_payment_method'&&n>0){stop();payErr('The bank did not confirm this payment. Try again or use another card.')}
  };
  PAY.chk=chk;PAY.stop=stop;PAY.poll=setInterval(()=>{if(++n>150)return stop();chk()},2000);
}
addEventListener('message',e=>{if(e.origin===location.origin&&e.data&&e.data.fm==='pay-return'&&PAY.chk)PAY.chk()});
$('#pay3X').onclick=()=>{if(PAY.chk)PAY.chk();if(PAY.stop)PAY.stop();payErr('Payment cancelled.')};
MODAL_CANCEL.pay3='#pay3X';

/* ---- start-up: runs once the whole shop is ready ---- */
async function bootNet(){
  if(!NET.on)return;
  await NET.config();
  Repl.colors();setInterval(()=>Repl.colors(),60000);
  setInterval(()=>Repl.tick(),5000);
  addEventListener('visibilitychange',()=>{if(!document.hidden)Repl.tick()});
  STORE_HOOKS.sh_orders=soon(()=>Repl.tick());STORE_HOOKS.sh_chats=soon(()=>Repl.tick(),400);
  if(NET.cfg&&NET.cfg.onesignal_app_id)Notify.init();
  // coming back from GCash / Maya
  const q=new URLSearchParams(location.search);let ret=null;
  try{ret=JSON.parse(sessionStorage.sh_ret||'null')}catch(e){}
  const pi=q.get('payment_intent_id')||(q.get('payret')&&ret&&ret.pi);
  if(pi&&ret){
    try{sessionStorage.removeItem('sh_ret')}catch(e){}
    history.replaceState({},'',location.pathname);
    S.acc=ret.acc;NET.tok=ret.tok;S.mode='login';
    try{const st=await payStatus(pi);await Repl.tick(true);dash();const i=ORD.findIndex(d=>d.id===ret.order);if(i>=0){openPay(i)}toast(st==='succeeded'?'Payment received. Thank you!':'We are confirming your payment…');if(st!=='succeeded'&&i>=0){PAY.d=ORD[i];payWait(pi,10)}}catch(e){showLogin()}
  }
}

/* ===== design pass: header controls live in the header, editor chat lives in the dock on phones ===== */
const NARROW=matchMedia('(max-width:899px)');
function luxScr(id){
  const u=$('#uit'),slot=document.querySelector('#s-'+id+' .topbar .tr');
  if(u){
    u.hidden=id==='land'||id==='intro';                       /* the video pages look the same in light and dark */
    if(slot){if(u.parentNode!==slot)slot.append(u);u.classList.add('inb')}
    else{if(u.parentNode!==document.body)document.body.append(u);u.classList.remove('inb')}
    $('#tsPop').classList.remove('on');$('#tsB').setAttribute('aria-expanded',false);
  }
  const l=document.querySelector('#s-'+id+' .hlogo');if(l)replayLogo(l);
}
const _chatBadge=chatBadge;
chatBadge=function(){_chatBadge()};
NARROW.addEventListener?.('change',()=>{luxScr(S.scr);fabShow()});
const _applyUI=applyUI;
applyUI=function(){_applyUI();document.querySelector('meta[name=theme-color]')?.setAttribute('content',UI.theme()==='dark'?'#000000':'#ffffff')};
applyUI();
/* chat button rests in the bottom-right corner instead of mid-screen */
fabInit=function(){const s=FSZ(),m=16*REM();FB.x=innerWidth-s-m;FB.y=innerHeight-s-m-(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab'))||0);fabSet()};

/* ===== round 2 ===== */
/* file names come from the list at the top of index.html (window.MEDIA) */
(function(){
  const M=window.MEDIA;if(!M)return;
  const merge=(a,b)=>{for(const k in b){if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])){a[k]=a[k]||{};merge(a[k],b[k])}else a[k]=b[k]}};
  if(M.images)merge(SITE.images,M.images);
  if(M.videos)merge(SITE.videos,M.videos);
  if(Array.isArray(M.how))SITE.how=M.how.map((f,i)=>({img:typeof f==='string'?f:f.img,text:(SITE.how[i]&&SITE.how[i].text)||''}));
})();
/* an empty box shows the file name it is waiting for */
function mediaLabels(root=document){
  root.querySelectorAll('[data-img]').forEach(el=>{
    const f=el.dataset.img.split('.').reduce((o,k)=>o?.[k],SITE);if(!f||typeof f!=='string')return;
    const t=el.matches('.ph,.ph2')?el:el.querySelector(':scope>.ph,:scope>.ph2');
    if(t&&/^\{.*\}$/.test(t.textContent.trim())){t.textContent=f;t.classList.add('fname')}
  });
}
mediaLabels();
new MutationObserver(m=>m.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)mediaLabels(n.parentNode||n)}))).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});

/* log in: names are masked like emails; typing your name lifts your account to the top */
const maskN=n=>String(n||'').trim().split(/\s+/).filter(Boolean).map(w=>w[0].toUpperCase()+'***').join(' ');
const nkey=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
function drawTiles(){
  const l=API.accounts(),q=nkey($('#lFind').value);
  $('#lFindW').hidden=l.length<2;
  if(!l.length){$('#tiles').innerHTML='<div class="card sub">No account on this device yet. Sign up, or tap Forgot PIN to add one.</div>';return}
  const rows=l.map((a,i)=>({a,i,ex:!!q&&nkey(a.name)===q,pre:q.length>=2&&nkey(a.name).startsWith(q)})).sort((x,y)=>(y.ex-x.ex)||(y.pre-x.pre)||(x.i-y.i));
  $('#tiles').innerHTML=rows.map(r=>`<button class="tile${r.ex?' me':''}${r.pre&&!r.ex?' near':''}" data-i="${r.i}"><b>${esc(r.ex?r.a.name:maskN(r.a.name))}</b><small>${esc(mask(r.a.email))}</small>${r.ex?'<span class="tme">This is you</span>':''}</button>`).join('')
    +(q&&!rows.some(r=>r.ex||r.pre)?'<p class="note lnone">No account with that name on this device.</p>':'');
}
showLogin=function(){
  S.acc=null;$('#loginPin').hidden=true;$('#lErr').textContent='';$('#lFind').value='';
  drawTiles();go('login');
};
$('#lFind').oninput=()=>{$('#loginPin').hidden=true;S.acc=null;drawTiles()};
$('#lFind').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();const t=$('#tiles .tile');if(t)t.click()}};
$('#tiles').onclick=e=>{
  const t=e.target.closest('.tile');if(!t)return;
  $$('#tiles .tile').forEach(x=>x.classList.remove('sel'));t.classList.add('sel');
  S.acc=API.accounts()[t.dataset.i];S.tries=0;
  $('#loginWho').textContent=`Hi ${t.classList.contains('me')?S.acc.name:maskN(S.acc.name)}, enter your PIN`;$('#lErr').textContent='';
  $('#loginPin').hidden=false;$('#lFind').blur();
  requestAnimationFrame(()=>$('#loginPin').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'}));
};
luxScr((document.querySelector('.scr.on')?.id||'s-land').slice(2));

/* ===== tutorial spotlight: blur everything except the button being explained ===== */
TUT.touch=[
  ['upload','Add your design','Tap the plus to upload your artwork. It lands right on the shirt.','#upB'],
  ['move','Move and resize','Drag with one finger to move your design. Pinch with two fingers to resize it.','#stage'],
  ['sliders','Advanced editing','Turn a precision wheel to rotate, place it on a pad, and size it to the inch. Pull the panel down to close it.','#adjB'],
  ['undo','Undo, redo, delete','Fix any step with one tap.','#undoB,#redoB,#delB'],
  ['3d','See it in 3D','Turn the shirt around to check your design from every side.','#v3B'],
  ['chat','Questions?','Tap the chat button any time to talk to our team.','#fab'],
  ['next','When you are happy','Continue to the next print area or to your review.','#editB2']
];
TUT.pc=[
  ['upload','Add your design','Click the plus to upload your artwork. It lands right on the shirt.','#upB'],
  ['mouse','Move, resize, rotate','Click and drag to move. Scroll to resize. Hold R and scroll to rotate.','#stage'],
  ['sliders','Advanced editing','Rotate on the wheel, place it on the precision pad, and size it to the inch.','#adj'],
  ['undo','Undo, redo, delete','Ctrl+Z undoes, Delete removes, the arrow keys nudge.','#undoB,#redoB,#delB'],
  ['3d','See it in 3D','Turn the shirt around to check your design from every side.','#v3B'],
  ['next','When you are happy','Continue to the next print area or to your review.','#editB2']
];
const tutEls=s=>String(s&&s[3]||'').split(',').map(q=>document.querySelector(q.trim())).filter(el=>el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
function tutUnion(els){const r=els.map(e=>e.getBoundingClientRect());return{left:Math.min(...r.map(x=>x.left)),top:Math.min(...r.map(x=>x.top)),right:Math.max(...r.map(x=>x.right)),bottom:Math.max(...r.map(x=>x.bottom))}}
function tutClear(){$$('.tut-hl').forEach(e=>e.classList.remove('tut-hl','tut-big'))}
function tutPlace(scroll){
  const t=$('#tut');if(!t.classList.contains('on'))return;
  const els=tutEls(TL[TS]),card=$('#tut .sheet'),veil=$('#tutV'),W=innerWidth,H=innerHeight;
  tutClear();
  if(!els.length){veil.style.clipPath='';t.classList.add('tfree');card.style.left=card.style.top='';card.dataset.arrow='';return}
  t.classList.remove('tfree');
  if(scroll){const u=tutUnion(els);if(u.top<64||u.bottom>H-24)els[0].scrollIntoView({block:'center',behavior:'auto'})}
  const r=tutUnion(els),big=(r.right-r.left)*(r.bottom-r.top)>W*H*.12,p=big?6:9;
  const x1=Math.max(0,r.left-p),y1=Math.max(0,r.top-p),x2=Math.min(W,r.right+p),y2=Math.min(H,r.bottom+p);
  veil.style.clipPath=`polygon(evenodd,0 0,${W}px 0,${W}px ${H}px,0 ${H}px,0 0,${x1}px ${y1}px,${x2}px ${y1}px,${x2}px ${y2}px,${x1}px ${y2}px,${x1}px ${y1}px)`;
  els.forEach(e=>e.classList.add('tut-hl'));if(big)els.forEach(e=>e.classList.add('tut-big'));
  const cwPx=Math.min(W-32,352);card.style.width=cwPx+'px';
  const ch=card.offsetHeight,cx=(r.left+r.right)/2;
  let left=Math.min(Math.max(16,cx-cwPx/2),W-cwPx-16),top,arrow='';
  if(H-y2>ch+28){top=y2+16;arrow='up'}else if(y1>ch+28){top=y1-ch-16;arrow='down'}else{top=H-ch-16}
  card.style.left=left+'px';card.style.top=top+'px';card.dataset.arrow=arrow;card.style.setProperty('--ax',Math.min(Math.max(18,cx-left),cwPx-18)+'px');
}
const _showTut=showTut;
showTut=function(force){_showTut(force);$('#tut').classList.add('spot');requestAnimationFrame(()=>tutPlace(true))};
const _drawTut=drawTut;
drawTut=function(){
  _drawTut();
  $('#tutS').textContent=`${TS+1} of ${TL.length}`;
  if($('#tut').classList.contains('on'))requestAnimationFrame(()=>tutPlace(true));
};
const _closeTut=closeTut;
closeTut=function(){_closeTut();if(!$('#tut').classList.contains('on')){tutClear();$('#tutV').style.clipPath=''}};
$('#tutNext').onclick=()=>{TS<TL.length-1?(TS++,drawTut()):closeTut()};
$('#tutSkip').onclick=closeTut;
/* steps whose button is not on this screen (chat on a PC) drop out */
const _showTut2=showTut;
showTut=function(force){
  const pc=matchMedia('(hover:hover) and (pointer:fine)').matches;
  ['touch','pc'].forEach(k=>{TUT[k+'_all']=TUT[k+'_all']||TUT[k];TUT[k]=TUT[k+'_all'].filter(s=>!s[3]||s[3].split(',').some(q=>{const el=document.querySelector(q.trim());return el&&el.getClientRects().length}))});
  _showTut2(force);
};
let tutRaf=0;const tutRe=()=>{cancelAnimationFrame(tutRaf);tutRaf=requestAnimationFrame(()=>tutPlace(false))};
addEventListener('resize',tutRe);document.addEventListener('scroll',tutRe,true);

/* prices: labels follow the price list; the server copy is fetched with the colors */
function priceLabels(){$$('[data-price]').forEach(e=>e.textContent=money(PR()[e.dataset.price]))}
priceLabels();
addEventListener('storage',e=>{if(e.key==='sh_price'){priceLabels();if(S.scr==='lay'&&typeof drawLay==='function')drawLay()}});
if(typeof Repl!=='undefined'){const _rc=Repl.colors.bind(Repl);Repl.colors=async function(){await _rc();if(!NET.on)return;try{const p=await NET.j('/prices');if(p&&p.base){const s=JSON.stringify(p);if(s!==(localStorage.sh_price||'')){quietSet('sh_price',s);priceLabels()}}}catch(e){}}}

/* ===== chat: pictures and files, unsend ===== */
let CHS=[];                                                    // attachments waiting to be sent
chatDraw=function(scroll=true){
  const{c}=chatGet();
  $('#msgs').innerHTML=c.msgs.map(m=>{
    if(m.del)return`<div class="m ${m.from} del" data-id="${m.id}"><div class="bub">${esc(delTxt(m,'me','FORM/MORE'))}</div><time>${hm(m.t)}</time></div>`;
    const q=m.reply&&c.msgs.find(x=>x.id===m.reply),gr=[];(m.rx||[]).forEach(r=>{const g=gr.find(x=>x.e===r.e);g?g.n++:gr.push({e:r.e,n:1})});
    const qt=q?(q.del?'Deleted message':(q.text||((q.att||[]).length?'Attachment':''))):'';
    return`<div class="m ${m.from}" data-id="${m.id}"><i class="ric">${ic('reply')}</i>${q?`<div class="rep" data-to="${q.id}">${esc(qt.slice(0,60))}</div>`:''}<div class="bub${m.text?'':' only'}" tabindex="0">${attHTML(m)}${m.text?esc(m.text):''}</div>${gr.length?`<div class="rxs">${gr.map(g=>`<span data-e="${g.e}" tabindex="0" role="button" aria-label="Reactions ${g.e}">${g.e}${g.n>1?' '+g.n:''}</span>`).join('')}</div>`:''}<time>${hm(m.t)}${m.from==='me'&&(c.ar||0)>=m.t?' · Seen':''}</time></div>`;
  }).join('');
  if(scroll)$('#msgs').scrollTop=1e9;
};
function chStageDraw(){
  const s=$('#cstage');s.hidden=!CHS.length;
  s.innerHTML=CHS.map((x,i)=>`<span class="cst">${x.att.thumb?`<img src="${x.att.thumb}" alt="">`:`<i>${esc((x.att.n.split('.').pop()||'file').slice(0,4).toUpperCase())}</i>`}<b>${esc(x.att.n)}</b><button data-rm="${i}" aria-label="Remove ${esc(x.att.n)}">×</button></span>`).join('');
}
async function chStage(files){const{ok,bad}=await chPrep(files);if(bad.length)toast(bad[0]);CHS=CHS.concat(ok).slice(0,6);chStageDraw();if(ok.length)$('#cin').focus({preventScroll:true})}
$('#cstage').onclick=e=>{const b=e.target.closest('[data-rm]');if(b){const[x]=CHS.splice(+b.dataset.rm,1);if(x)attForget({att:[x.att]});chStageDraw()}};
$('#catt').onclick=()=>$('#cfile').click();
$('#cfile').accept=CHX.accept;
$('#cfile').onchange=async e=>{await chStage(e.target.files);e.target.value=''};
$('#cin').addEventListener('paste',e=>{const f=[...(e.clipboardData?.files||[])];if(f.length){e.preventDefault();chStage(f)}});
(()=>{const ch=$('#chat');let n=0;
  ch.addEventListener('dragenter',e=>{if([...(e.dataTransfer?.types||[])].includes('Files')){e.preventDefault();n++;ch.classList.add('dropping')}});
  ch.addEventListener('dragover',e=>{if(ch.classList.contains('dropping'))e.preventDefault()});
  ch.addEventListener('dragleave',()=>{if(--n<=0){n=0;ch.classList.remove('dropping')}});
  ch.addEventListener('drop',e=>{e.preventDefault();n=0;ch.classList.remove('dropping');if(e.dataTransfer?.files?.length)chStage(e.dataTransfer.files)});
})();
chatSend=async function(){
  const t=$('#cin').value.trim();if(!t&&!CHS.length)return;
  const id=uid(),list=CHS;
  if(list.length){CHS=[];chStageDraw();$('#csend').disabled=true;
    try{await chUpload(list,id)}catch(e){toast(e.message||'Could not send the file. Try again.');CHS=list;chStageDraw();$('#csend').disabled=false;return}
    $('#csend').disabled=false}
  const g=chatGet(),m={id,from:'me',text:t,t:Date.now()};if(CH.reply)m.reply=CH.reply;if(list.length)m.att=list.map(x=>x.att);
  g.c.msgs.push(m);chatPut(g);CH.reply=null;$('#rbar').hidden=true;$('#cin').value='';grow($('#cin'));chatDraw();
  if(!g.c.msgs.some(x=>x.autoR))setTimeout(()=>{const h=chatGet();h.c.msgs.push({id:uid(),from:'team',text:SITE.chat.auto,t:Date.now(),auto:1,autoR:1});h.c.ur=Date.now();chatPut(h);if(CH.open)chatDraw()},1000);
};
$('#csend').onclick=()=>chatSend();
$('#msgs').addEventListener('click',e=>{
  const a=e.target.closest('[data-att]');if(!a)return;e.stopPropagation();if(Date.now()-(window.LPAT||0)<800){e.preventDefault();return}   /* that tap was a long press for the menu */
  const[mid,aid]=a.dataset.att.split('|'),m=chatGet().c.msgs.find(x=>x.id===mid),x=m&&(m.att||[]).find(y=>y.id===aid);if(x)attOpen(x);
},true);
const _showRx=showRx;
showRx=function(el){
  const m=chatGet().c.msgs.find(x=>x.id===el.dataset.id);if(!m||m.del)return;
  window.LPAT=Date.now();_showRx(el);const d=$('#rxDel');d.hidden=m.from!=='me';d.classList.remove('arm');d.textContent='Delete';
  $('#rxCopy').hidden=!m.text;
};
$('#rxDel').onclick=async e=>{
  e.stopPropagation();const d=$('#rxDel');
  if(!d.classList.contains('arm')){d.classList.add('arm');d.textContent='Tap again to delete';clearTimeout(d._t);d._t=setTimeout(()=>{d.classList.remove('arm');d.textContent='Delete'},3000);return}
  const g=chatGet(),m=g.c.msgs.find(x=>x.id===RXM);rxClose();if(!m||m.from!=='me')return;
  await attForget(m);m.del=1;m.text='';m.att=[];m.rx=[];chatPut(g);chatDraw(false);toast('Message deleted');
};
const _startReply=startReply;startReply=function(id){const m=chatGet().c.msgs.find(x=>x.id===id);if(!m||m.del)return;_startReply(id);if(!m.text)$('#rtxt').textContent='Replying to an attachment'};

/* ===== deleting a request, deleting an account, idle accounts ===== */
const PAID_LIKE=['Paid','In Production','Shipped','Delivered'],BEING_MADE=['Paid','In Production','Shipped'];
const canDelReq=d=>d&&d.placed_at&&!d.gone&&!d.paid_at&&!PAID_LIKE.includes(d.status)&&d.status!=='Cancelled';
async function forgetArt(d){for(const s of Object.keys(d.art||{}))for(const it of d.art[s]||[])if(it.key)try{const db=await IDB.open();db.transaction('art','readwrite').objectStore('art').delete(it.key)}catch(e){}}
/* ticket: "Delete this request" while it is not paid */
const _drawTk=drawTk;
drawTk=function(){
  _drawTk();const d=D();if(!canDelReq(d))return;
  const card=$('#tkBox .tkd .card');if(!card)return;
  card.insertAdjacentHTML('beforeend',`<div class="dz tkdz"><button class="btn ghost dzb" id="tkDel">Delete this request</button><div class="dzf" id="tkDelF" hidden><p class="note">Delete ${esc(d.id)}? Our team will see it as cancelled. This cannot be undone.</p><div class="row dzr"><button class="btn sec sm" id="tkDelN">Keep it</button><button class="btn sm dzy" id="tkDelY">Delete request</button></div></div></div>`);
};
$('#tkBox').addEventListener('click',async e=>{
  const t=e.target;
  if(t.id==='tkDel'){$('#tkDelF').hidden=false;t.hidden=true;return}
  if(t.id==='tkDelN'){$('#tkDelF').hidden=true;$('#tkDel').hidden=false;return}
  if(t.id!=='tkDelY')return;
  const d=D();if(!canDelReq(d))return;t.disabled=true;
  try{
    if(NET.on&&NET.tok){const r=await NET.j(`/me/orders/${encodeURIComponent(d.id)}/delete`,{});Repl.apply([r.order])}
    else{const all=allOrders(),o=all.find(x=>x.id===d.id);if(o){o.status='Cancelled';o.gone=true;(o.hist=o.hist||[]).push({t:new Date().toISOString(),s:'Cancelled',by:'customer',n:'Deleted by the customer'});saveOrders(all)}}
    await forgetArt(d);ORD=ORD.filter(x=>x.id!==d.id);CUR=-1;dash();toast('Request deleted');
  }catch(x){t.disabled=false;toast(x.message||'Could not delete. Try again.')}
},true);
/* remove everything this device keeps for an account; paid orders stay as anonymous records */
async function eraseLocal(email){
  const tag='deleted-'+(email.split('@')[0].slice(0,2))+Math.random().toString(36).slice(2,8);
  const all=allOrders(),keep=[];
  for(const o of all){
    if(o.email!==email){keep.push(o);continue}
    await forgetArt(o);
    if(o.paid_at||PAID_LIKE.includes(o.status))keep.push({id:o.id,O:o.O,status:o.status,hist:o.hist,paid_at:o.paid_at,placed_at:o.placed_at,queued_at:o.queued_at,P:o.P,flow:o.flow,name:'Deleted customer',email:tag+'@deleted.invalid',anon:true,art:{F:[],B:[],SL:[],SR:[]}});
  }
  saveOrders(keep);
  const ch=chatsAll();for(const k of Object.keys(ch))if(k===email||ch[k].email===email){for(const m of ch[k].msgs||[])await attForget(m);delete ch[k]}chatsSave(ch);
  try{localStorage.sh_acc=JSON.stringify(API.accounts().filter(a=>a.email!==email))}catch(e){}
}
function delBlockers(){
  const mine=allOrders().filter(o=>o.email===S.acc?.email&&o.placed_at&&!o.gone);
  const making=mine.filter(o=>BEING_MADE.includes(o.status)).map(o=>o.id),open=mine.filter(canDelReq).map(o=>o.id);
  if(making.length)return`Your paid order ${making.join(', ')} is still being made. You can delete your account once it is delivered.`;
  if(open.length)return`Delete your open requests first: ${open.join(', ')}. Open each one from your dashboard and tap Delete this request.`;
  return'';
}
$('#pDelB').onclick=()=>{
  const why=delBlockers(),m=$('#pDelM');m.hidden=!why;m.textContent=why;if(why)return;
  $('#pDelB').hidden=true;$('#pDelF').hidden=false;$('#pDelE').textContent='';$('#pDelPin').value='';setTimeout(()=>$('#pDelPin').focus(),50);
};
$('#pDelN').onclick=()=>{$('#pDelF').hidden=true;$('#pDelB').hidden=false};
$('#pDelY').onclick=async()=>{
  const pin=$('#pDelPin').value.trim(),err=m=>{$('#pDelE').textContent=m};
  if(!/^\d{4}$/.test(pin))return err('Enter your 4-digit PIN.');
  const why=delBlockers();if(why)return err(why);
  const email=S.acc.email;$('#pDelY').disabled=true;
  try{
    if(NET.on&&NET.tok)await NET.j('/me/delete',{pin});
    else if(!(await API._demo?.checkPin?.call(API,S.acc,pin)??S.acc.pin===pin))throw new Error('Wrong PIN.');
    await eraseLocal(email);
    try{if(localStorage.sh_prof)localStorage.removeItem('sh_prof')}catch(e){}
    $('#profile').classList.remove('on');S.acc=null;ORD=[];NET.tok='';try{sessionStorage.removeItem('sh_tok')}catch(e){}
    S.h=[];go('land');toast('Your account has been deleted.');
  }catch(x){err(x.message||'Could not delete. Try again.')}
  finally{$('#pDelY').disabled=false}
};
/* demo (no server): accounts on this device that are not used for 60 days are removed the same way */
(async()=>{
  const now=Date.now(),day=864e5,l=API.accounts();let ch=false;
  for(const a of l){if(!a.seen){a.seen=now;ch=true}}
  if(ch)try{localStorage.sh_acc=JSON.stringify(l)}catch(e){}
  if(NET.on)return;                                     // with a server, the server does this
  for(const a of API.accounts())if(now-(a.seen||now)>=60*day&&!allOrders().some(o=>o.email===a.email&&BEING_MADE.includes(o.status)))await eraseLocal(a.email);
})();
const _dashSeen=dash;
dash=function(more){if(S.acc?.email){const l=API.accounts(),a=l.find(x=>x.email===S.acc.email);if(a&&(!a.seen||Date.now()-a.seen>36e5)){a.seen=Date.now();try{localStorage.sh_acc=JSON.stringify(l)}catch(e){}}}return _dashSeen(more)};

/* ===== round 5: pictures =====
   A picture loads when its page opens (so the first visit does not download every picture at once), is decoded
   off the main thread, then fades in once. Pictures already seen appear at once. A missing file keeps its placeholder. */
(function(){
  const show=(el,src,fresh)=>{
    el.style.setProperty('--img',`url("${src}")`);el.classList.add('has-img');
    if(fresh){el.classList.add('m-new');setTimeout(()=>el.classList.remove('m-new'),1800)}
  };
  /* the name in the list may be saved as .png, .jpg, .jpeg or .webp: the first one that exists is used */
  const RES=new Map();
  const alts=src=>{const m=src.match(/^(.*)\.(png|jpe?g|webp)$/i);if(!m)return[src];const x=m[2].toLowerCase();return[src,...['webp','jpg','jpeg','png'].filter(e=>e!==x).map(e=>m[1]+'.'+e)]};
  const fetchImg=(el,src,i=0)=>{
    const list=alts(src),u=list[i],im=new Image();im.decoding='async';
    im.onload=()=>{const done=()=>{LOADED.add(src);RES.set(src,u);if(el)show(el,u,true)};(im.decode?im.decode():Promise.resolve()).then(done,done)};
    im.onerror=()=>{if(i+1<list.length)fetchImg(el,src,i+1)};
    im.src=u;
  };
  const io='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{
    if(!e.isIntersecting||e.target.closest('.modal:not(.on)'))return;   // a closed pop-up waits until it opens
    const g=e.target.matches('.hc')?[...e.target.parentNode.children]:[e.target];   // swipe cards: fetch the neighbours too
    g.forEach(t=>{io.unobserve(t);const s=t._mSrc;t._mSrc=null;if(s)fetchImg(t,s)});
  }),{rootMargin:'400px 200px'}):null;
  applyImg=function(el,src){
    if(!src||typeof src!=='string')return;
    if(LOADED.has(src))return show(el,RES.get(src)||src,false);
    if(!io)return fetchImg(el,src);
    el._mSrc=src;io.observe(el);
  };
  /* the rest of an open page (further down, or in a side-scrolling row) follows right after what is on screen */
  const pend=root=>{if(!root)return;[root,...root.querySelectorAll('[data-img]')].forEach(t=>{const s=t._mSrc;if(!s)return;t._mSrc=null;io&&io.unobserve(t);fetchImg(t,s)})};
  const _luxScr=luxScr;luxScr=function(id){_luxScr(id);setTimeout(()=>pend(document.getElementById('s-'+id)),350)};
  const mo=new MutationObserver(ms=>ms.forEach(m=>{if(m.target.classList.contains('on'))pend(m.target)}));
  document.querySelectorAll('.modal').forEach(m=>{if(m.querySelector('[data-img]'))mo.observe(m,{attributes:true,attributeFilter:['class']})});
  /* while the first page is open, quietly fetch the pictures of the next few steps */
  const warm=()=>{const I=SITE.images||{};[I.alcGeneric,I.alcPrompt].forEach(s=>{if(s&&!LOADED.has(s))fetchImg(null,s)})};
  addEventListener('load',()=>setTimeout(()=>(window.requestIdleCallback||(f=>f()))(warm),1200),{once:true});
})();

/* ===== round 6: size chart table (the team fills it in the admin panel) ===== */
function szDraw(){const el=document.getElementById('szChart');if(el)el.innerHTML=szHTML(szStore())}
szDraw();
$('#chartB').addEventListener('click',async()=>{szDraw();if(!NET.on)return;try{const d=await NET.j('/sizechart');if(d&&d.rows){quietSet('sh_size',JSON.stringify(szClean(d)));szDraw()}}catch(e){}});
addEventListener('storage',e=>{if(e.key==='sh_size')szDraw()});

/* ===== round 7: Prompt Alchemy on the intro. Both panels show the exact prompts behind the two pictures =====
   The plain prompt types in grey. The crafted prompt types section by section, each in its own color.
   The full text is laid out from the start (the part not typed yet is invisible), so nothing jumps while it types,
   and the panel scrolls to keep the newest words in view until the reader scrolls it. Reduced motion shows everything at once. */
const ALC_C=[['#ff8f70','#ffd6ca'],['#f5b740','#fbe3b0'],['#e8772e','#f7c6a2'],['#b9a6f2','#ddd3fb'],['#28d0d0','#a9ecec']];
const ALC={tok:0,follow:true,ms:36};
const alcSw=t=>esc(t).replace(/#[0-9A-Fa-f]{6}\b/g,m=>`<span class="sw" style="background:${m}"></span>${m}`);
function alcFade(){const p=document.getElementById('pa');if(!p)return;p.classList.toggle('ft',p.scrollTop>2);p.classList.toggle('fb',p.scrollHeight-p.clientHeight-p.scrollTop>2)}
function alcFollow(el){
  const p=document.getElementById('pa'),c=el.querySelector('.cr');if(!p||!c||!ALC.follow||!p.contains(el))return;
  const y=c.getBoundingClientRect().bottom-p.getBoundingClientRect().top,room=p.clientHeight;
  if(y>room-28||y<16)p.scrollTo({top:Math.max(0,p.scrollTop+y-room*.55),behavior:'smooth'});
}
function alcWords(el,text,ms,tok){
  return new Promise(res=>{
    const w=String(text||'').split(' ');let i=0;
    const n=()=>{
      if(tok!==ALC.tok||!$('#sl1').classList.contains('on'))return res(false);
      if(i<w.length){i++;el.innerHTML=alcSw(w.slice(0,i).join(' '))+'<span class="cr" aria-hidden="true"></span>'+(i<w.length?'<span class="rest" aria-hidden="true"> '+alcSw(w.slice(i).join(' '))+'</span>':'');alcFollow(el);setTimeout(n,ms)}
      else{el.innerHTML=alcSw(text);res(true)}
    };n();
  });
}
function alcRun(){
  const pg=document.getElementById('pg'),pa=document.getElementById('pa');if(!pg||!pa)return;
  const tok=++ALC.tok,T=SITE.text||{};ALC.follow=true;
  const P=Array.isArray(T.alcPrompt)?T.alcPrompt:[{title:'Prompt',text:String(T.alcPrompt||'')}];
  if(!pa.dataset.wired){
    pa.dataset.wired=1;const stop=()=>{ALC.follow=false};
    ['wheel','touchstart','pointerdown'].forEach(e=>pa.addEventListener(e,stop,{passive:true}));
    pa.addEventListener('scroll',alcFade,{passive:true});
  }
  const hold=t=>`<span class="rest">${alcSw(t)}</span>`;
  pg.classList.remove('caret');pg.innerHTML=hold(T.alcGeneric||'');
  pa.innerHTML=P.map((x,i)=>{const [c,tn]=ALC_C[i%ALC_C.length];return `<div class="as" style="--c:${c};--tn:${tn}"><div class="ah"><i></i>${esc(x.title||'')}</div><p class="at">${hold(x.text||'')}</p></div>`}).join('');
  pa.scrollTop=0;requestAnimationFrame(alcFade);
  const secs=[...pa.children];
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){
    pg.textContent=T.alcGeneric||'';secs.forEach((s,i)=>{s.querySelector('.at').innerHTML=alcSw(P[i].text||'');s.classList.add('on')});return;
  }
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  (async()=>{
    await wait(600);if(tok!==ALC.tok)return;
    alcWords(pg,T.alcGeneric,45,tok);
    await wait(600);
    for(let i=0;i<secs.length;i++){
      if(tok!==ALC.tok||!$('#sl1').classList.contains('on'))return;
      secs[i].classList.add('on');await wait(160);
      if(!await alcWords(secs[i].querySelector('.at'),P[i].text,ALC.ms,tok))return;
    }
  })();
}

/* ===== advanced editing: rotate wheel, precision pad, size ruler =====
   Built on the existing editing functions (rotSet, nudge, place, commit, zone), so undo, 3D preview and saving work as before. */
const AX={ang:0,drag:null,raf:0,tw:0,lastSnap:null};
const sgnA=a=>{a=((Math.round(a*10)/10%360)+360)%360;return a>180?a-360:a};
const RM=matchMedia('(prefers-reduced-motion:reduce)');
const WCX=200,WCY=330,WR=300;                         // wheel geometry in its own 400 x 210 drawing
(function buildWheel(){
  let t=`<circle cx="${WCX}" cy="${WCY}" r="${WR}" class="axRing"/><circle cx="${WCX}" cy="${WCY}" r="${WR-58}" class="axRing2"/>`;
  for(let a=0;a<360;a++){
    const q=a*Math.PI/180,s=Math.sin(q),c=Math.cos(q),M=a%45===0,m=a%15===0,f=a%5===0,l=M?24:m?17:f?11:6;
    t+=`<line x1="${(WCX+WR*s).toFixed(2)}" y1="${(WCY-WR*c).toFixed(2)}" x2="${(WCX+(WR-l)*s).toFixed(2)}" y2="${(WCY-(WR-l)*c).toFixed(2)}" class="${M?'tM':m?'tm':f?'tf':'t1'}"/>`;
    if(m){const v=a>180?a-360:a,r=WR-36,x=(WCX+r*s).toFixed(2),y=(WCY-r*c).toFixed(2);t+=`<text x="${x}" y="${y}" transform="rotate(${a} ${x} ${y})" class="${M?'tL tLM':'tL'}">${v>0?'+':''}${v}</text>`}
  }
  $('#axDial').innerHTML=t;
})();
function axWheelDraw(a){$('#axDial').setAttribute('transform',`rotate(${-a} ${WCX} ${WCY})`)}
const pxPerDeg=()=>{const w=$('#axWheel').getBoundingClientRect().width||1;return WR*Math.PI/180*(w/400)};
function axSetAngle(a,live=true){
  const it=act();if(!it)return;
  if(SNAP){const n=Math.round(a/45)*45;if(Math.abs(a-n)<=3){a=n;if(AX.lastSnap!==n){AX.lastSnap=n;navigator.vibrate?.(8)}}else AX.lastSnap=null}
  AX.ang=a;rotSet(Math.round(a));if(live&&M3E)live3();
}
function axTween(to,ms=420){
  const it=act();if(!it)return;cancelAnimationFrame(AX.raf);
  let from=sgnA(it.r);let d=((to-from+540)%360)-180;if(Math.abs(to-from)===180)d=to-from;
  if(RM.matches){rotSet(from+d);commit();if(M3E)live3();return}
  const t0=performance.now(),ease=t=>1-Math.pow(1-t,3);
  const step=now=>{const k=Math.min(1,(now-t0)/ms);rotSet(Math.round(from+d*ease(k)));if(M3E)live3();if(k<1)AX.raf=requestAnimationFrame(step);else commit()};
  AX.raf=requestAnimationFrame(step);
}
/* the wheel turns under your finger, keeps a little momentum, and settles on 45 degree marks when Snap is on */
const W=$('#axWheel');
W.addEventListener('pointerdown',e=>{
  const it=act();if(!it)return;cancelAnimationFrame(AX.raf);
  try{W.setPointerCapture(e.pointerId)}catch(_){}
  AX.drag={x:e.clientX,a0:sgnA(it.r),lx:e.clientX,lt:performance.now(),v:0};W.classList.add('grab');
});
W.addEventListener('pointermove',e=>{
  const d=AX.drag;if(!d)return;const now=performance.now(),dt=Math.max(1,now-d.lt);
  d.v=(e.clientX-d.lx)/dt*.7+d.v*.3;d.lx=e.clientX;d.lt=now;
  axSetAngle(d.a0-(e.clientX-d.x)/pxPerDeg());
});
const wheelEnd=()=>{
  const d=AX.drag;if(!d)return;AX.drag=null;W.classList.remove('grab');
  let v=-d.v/pxPerDeg()*16;                                  // degrees per frame
  if(RM.matches||Math.abs(v)<.15){commit();return}
  const glide=()=>{v*=.92;const it=act();if(!it){return}let a=sgnA(it.r)+v;
    if(Math.abs(v)<.12){if(SNAP){const n=Math.round(a/45)*45;if(Math.abs(a-n)<=6){axTween(n,260);return}}commit();return}
    axSetAngle(a);AX.raf=requestAnimationFrame(glide)};
  AX.raf=requestAnimationFrame(glide);
};
W.addEventListener('pointerup',wheelEnd);W.addEventListener('pointercancel',wheelEnd);
W.addEventListener('wheel',e=>{const it=act();if(!it)return;e.preventDefault();axSetAngle(sgnA(it.r)+(e.deltaY>0?1:-1)*(e.shiftKey?5:1));clearTimeout(AX.wt);AX.wt=setTimeout(commit,250)},{passive:false});
W.addEventListener('keydown',e=>{const it=act();if(!it)return;const st=e.shiftKey?5:1;let h=true;
  if(e.key==='ArrowRight'||e.key==='ArrowUp')rotSet(it.r+st);else if(e.key==='ArrowLeft'||e.key==='ArrowDown')rotSet(it.r-st);else if(e.key==='Home')axTween(0);else h=false;
  if(h){e.preventDefault();e.stopPropagation();commit();if(M3E)live3()}});
$('#axPre').onclick=e=>{const b=e.target.closest('[data-a]');if(b)axTween(+b.dataset.a)};
$('#rotR').onclick=()=>axTween(0);

/* precision pad: the box is the print area, the mark is your design. Drag anywhere in it. */
const PAD=$('#axPad');let padDrag=null;
PAD.addEventListener('pointerdown',e=>{const it=act();if(!it)return;try{PAD.setPointerCapture(e.pointerId)}catch(_){};padDrag={x:e.clientX,y:e.clientY,ix:it.x,iy:it.y};PAD.classList.add('grab')});
PAD.addEventListener('pointermove',e=>{
  if(!padDrag)return;const it=act();if(!it)return;const z=zone(D(),SIDE),r=PAD.getBoundingClientRect();
  let x=padDrag.ix*300+(e.clientX-padDrag.x)/r.width*z[2],y=padDrag.iy*330+(e.clientY-padDrag.y)/r.height*z[3];
  if(SNAP){const cx=z[0]+z[2]/2,cy=z[1]+z[3]/2;if(Math.abs(x-cx)<1.6)x=cx;if(Math.abs(y-cy)<1.6)y=cy}
  it.x=clamp(x,0,300)/300;it.y=clamp(y,0,330)/330;place(it);axSync();if(M3E)live3();
});
const padEnd=()=>{if(!padDrag)return;padDrag=null;PAD.classList.remove('grab');commit()};
PAD.addEventListener('pointerup',padEnd);PAD.addEventListener('pointercancel',padEnd);
function axMoveTo(x,y){
  const it=act();if(!it)return;const fx=it.x,fy=it.y;
  if(RM.matches){it.x=x;it.y=y;place(it);commit();axSync();return}
  const t0=performance.now(),ease=t=>1-Math.pow(1-t,3);
  const step=now=>{const k=Math.min(1,(now-t0)/320);it.x=fx+(x-fx)*ease(k);it.y=fy+(y-fy)*ease(k);place(it);axSync();if(M3E)live3();if(k<1)requestAnimationFrame(step);else commit()};
  requestAnimationFrame(step);
}
$('#axAlign').onclick=e=>{
  const b=e.target.closest('[data-al]');const it=act();if(!b||!it)return;const z=zone(D(),SIDE),w=it.w*300,h=w*(it.ar||1);let x=it.x,y=it.y;
  ({l:()=>x=(z[0]+w/2)/300,c:()=>x=(z[0]+z[2]/2)/300,r:()=>x=(z[0]+z[2]-w/2)/300,t:()=>y=(z[1]+h/2)/330,m:()=>y=(z[1]+z[3]/2)/330,b:()=>y=(z[1]+z[3]-h/2)/330})[b.dataset.al]();
  axMoveTo(x,y);
};

/* size */
function axSize(pct){const it=act();if(!it)return;const z=zone(D(),SIDE);it.w=clamp(pct,8,130)/100*z[2]/300;place(it);axSync();if(M3E)live3()}
const szNow=()=>{const it=act();if(!it)return 100;const z=zone(D(),SIDE);return Math.round(it.w*300/z[2]*100)};
hold($('#szM'),()=>axSize(szNow()-1));hold($('#szP'),()=>axSize(szNow()+1));
$('#axSzPre').onclick=e=>{const b=e.target.closest('[data-s]');if(!b)return;axSize(+b.dataset.s);commit()};

/* readouts */
const inch=v=>(Math.round(v*10)/10).toFixed(1);
function axSync(){
  if(AX.cr){cancelAnimationFrame(AX.cr);AX.cr=0}
  const it=act(),a=$('#adj');a.classList.toggle('grd',!!GRID);a.classList.toggle('noart',!it);if(!it)return;
  const r=sgnA(it.r),z=zone(D(),SIDE),k=ipu(SIDE),w=it.w*300,h=w*(it.ar||1),pct=Math.round(w/z[2]*100);
  if(!AX.drag)AX.ang=r;axWheelDraw(AX.drag?AX.ang:r);
  $('#axDeg').textContent=(r>0?'+':'')+Math.round(r);$('#axRotV').textContent=(r>0?'+':'')+Math.round(r)+'°';
  W.setAttribute('aria-valuenow',Math.round(r));W.setAttribute('aria-valuetext',Math.round(r)+' degrees');
  $$('#axPre [data-a]').forEach(b=>b.classList.toggle('on',Math.round(r)===+b.dataset.a||(+b.dataset.a===180&&Math.abs(Math.round(r))===180)));
  [['#rotS',SNAP],['#snapB',SNAP],['#gridB',GRID]].forEach(([s,v])=>{const b=$(s);b.classList.toggle('on',v);b.setAttribute('aria-pressed',v)});
  const ox=(it.x*300-(z[0]+z[2]/2))*k,oy=(it.y*330-(z[1]+z[3]/2))*k,cen=Math.abs(ox)<.05&&Math.abs(oy)<.05;
  $('#axCoord').textContent=cen?'Centered in the print area':`${ox>=0?'Right':'Left'} ${inch(Math.abs(ox))} in · ${oy>=0?'down':'up'} ${inch(Math.abs(oy))} in from center`;
  $('#axMovV').textContent=cen?'Centered':`${ox>=0?'+':'−'}${inch(Math.abs(ox))}, ${oy>=0?'+':'−'}${inch(Math.abs(oy))}`;
  PAD.style.aspectRatio=`${z[2]} / ${z[3]}`;PAD.style.setProperty('--ar',(z[2]/z[3]).toFixed(4));
  const dx=(it.x*300-z[0])/z[2]*100,dy=(it.y*330-z[1])/z[3]*100;
  $('#axDot').style.cssText=`left:${dx}%;top:${dy}%`;
  $('#axBox').style.cssText=`left:${dx}%;top:${dy}%;width:${w/z[2]*100}%;height:${h/z[3]*100}%;transform:translate(-50%,-50%) rotate(${r}deg)`;
  $('#sizeV').textContent=pct+'%';$('#axSizV').textContent=pct+'%';$('#size').value=clamp(pct,8,130);
  $('#axInch').textContent=`${inch(w*k)} × ${inch(h*k)} in on the shirt`;
  $$('#axSzPre [data-s]').forEach(b=>b.classList.toggle('on',pct===+b.dataset.s));
}
const _adjSync=adjSync;
adjSync=function(){_adjSync();axSync()};
$('#gridB').onclick=()=>{GRID=!GRID;drawStage();axSync()};
$('#size').addEventListener('input',()=>axSync());

/* modes */
adjTab=function(t){
  ADJ.tab=t;const a=$('#adj');a.dataset.mode=t;
  $$('#adjT [data-t]').forEach(b=>{const on=b.dataset.t===t;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});
  axSync();
};
$('#adjT').onclick=e=>{const b=e.target.closest('[data-t]');if(b)adjTab(b.dataset.t)};
adjTab(ADJ.tab||'rot');
/* the original nudge and center buttons move the design; keep the readouts in step */
const _nudge=nudge;nudge=function(dx,dy){_nudge(dx,dy);if(ADJ.on)axSync()};
const _nc=$('#nc').onclick;$('#nc').onclick=()=>{_nc();axSync()};
const _fit=$('#fitB').onclick;$('#fitB').onclick=()=>{_fit();axSync()};

/* ===== phone: focus mode. While the panel is open, everything except the shirt steps aside and the shirt
   rises into the space above the panel (2D or 3D). Pull the panel down by its top bar to close it. ===== */
const FOC={on:false,t:0};
const VEIL=document.createElement('div');VEIL.className='axVeil';VEIL.setAttribute('aria-hidden','true');document.body.append(VEIL);
const focEl=()=>M3E?$('#v3e'):$('#stage');
function axFit(){const a=$('#adj'),r=document.documentElement.style;r.setProperty('--axH',a.offsetHeight+'px');r.setProperty('--axV',innerHeight+'px')}
function axFlip(el,r0,ms){
  if(RM.matches||!el||!r0.width)return;const r1=el.getBoundingClientRect();if(!r1.width)return;
  const dx=r0.left-r1.left,dy=r0.top-r1.top,s=r0.width/r1.width;if(Math.abs(dx)<1&&Math.abs(dy)<1&&Math.abs(s-1)<.01)return;
  const an=el.animate([{transformOrigin:'0 0',transform:`translate(${dx}px,${dy}px) scale(${s})`},{transformOrigin:'0 0',transform:'none'}],{duration:ms,easing:'cubic-bezier(.16,1,.3,1)'});
  an.onfinish=()=>{if(M3E&&G3)sizeC()};
}
function axFocus(on){
  on=!!on&&!DESK.matches&&$('#s-edit').classList.contains('on');
  if(on===FOC.on){if(on)axFit();return}
  const el=focEl(),r0=el?el.getBoundingClientRect():{width:0},stg=$('#s-edit .stg'),B=document.body;
  clearTimeout(FOC.t);
  if(on){stg.style.minHeight=stg.offsetHeight+'px';axFit()}
  FOC.on=on;B.classList.toggle('axf',on);B.classList.remove('axfr');VEIL.style.opacity='';
  if(M3E&&G3)sizeC();
  axFlip(el,r0,on?700:560);
  FOC.t=setTimeout(()=>{if(FOC.on)B.classList.add('axfr');else stg.style.minHeight=''},720);
}
const _adjOpen=adjOpen;
adjOpen=function(on){const was=ADJ.on;_adjOpen(on);axFocus(ADJ.on);if(ADJ.on&&!was&&ADJ.tab==='siz')axCount()};
DESK.addEventListener&&DESK.addEventListener('change',()=>axFocus(ADJ.on));
addEventListener('resize',()=>{if(FOC.on){axFit();if(M3E&&G3)sizeC()}});

/* pull down to close (the close button is only shown to keyboard users) */
(function(){
  const A=$('#adj'),bar=A.querySelector('.axBar');let g=null;
  bar.addEventListener('pointerdown',e=>{if(A.classList.contains('dk')||!ADJ.on||e.button>0)return;g={x:e.clientX,y:e.clientY,t:performance.now(),dy:0,on:false,id:e.pointerId}});
  bar.addEventListener('pointermove',e=>{
    if(!g||e.pointerId!==g.id)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;
    if(!g.on){
      if(dy>7&&dy>Math.abs(dx)*1.2){g.on=true;try{bar.setPointerCapture(e.pointerId)}catch(_){}A.classList.add('drag')}
      else{if(Math.abs(dx)>12||dy<-12)g=null;return}
    }
    const now=performance.now();g.v=(Math.max(0,dy)-g.dy)/Math.max(1,now-g.t);g.t=now;g.dy=Math.max(0,dy);
    A.style.transform=`translate(-50%,${g.dy}px)`;VEIL.style.opacity=String(Math.max(0,1-g.dy/A.offsetHeight*1.4));
  });
  const end=()=>{
    const G=g;g=null;if(!G||!G.on)return;
    A.classList.remove('drag');A.style.transform='';VEIL.style.opacity='';
    const stop=e=>{e.stopPropagation();e.preventDefault()};addEventListener('click',stop,true);setTimeout(()=>removeEventListener('click',stop,true),60);
    if(G.dy>Math.min(150,A.offsetHeight*.28)||(G.v>.55&&G.dy>24)){navigator.vibrate?.(6);adjOpen(false)}
  };
  bar.addEventListener('pointerup',end);bar.addEventListener('pointercancel',end);
})();

/* size: the number counts up and the ruler glides in when the size tools open */
function axCount(){
  cancelAnimationFrame(AX.cr);const it=act();if(!it||RM.matches)return;
  const to=clamp(szNow(),8,130),R=$('#size'),V=$('#sizeV'),t0=performance.now()+120;V.textContent='8%';R.value=8;
  const step=now=>{const k=clamp((now-t0)/800,0,1),e=1-Math.pow(1-k,3),v=Math.round(8+(to-8)*e);V.textContent=v+'%';R.value=v;if(k<1)AX.cr=requestAnimationFrame(step);else{AX.cr=0;axSync()}};
  AX.cr=requestAnimationFrame(step);
}
['pointerdown','keydown'].forEach(t=>$('#adjSiz').addEventListener(t,()=>{if(AX.cr){cancelAnimationFrame(AX.cr);AX.cr=0;axSync()}},true));
const _adjTab=adjTab;
adjTab=function(t){const was=ADJ.tab;_adjTab(t);if(FOC.on)requestAnimationFrame(axFit);if(t==='siz'&&was!=='siz'&&ADJ.on)axCount()};

/* grid: shown on the flat view and, in 3D, drawn on the shirt itself */
function axGrid3(){if(G3&&M3E){G3.nosl=!stepsOf(D()).some(k=>k==='SL'||k==='SR');G3.ov=[GRID?1:0,GRID?1:0,0];req3()}}
$('#gridB').onclick=()=>{GRID=!GRID;drawStage();axSync();axGrid3()};
const _enter3E=enter3E;enter3E=function(){_enter3E();axGrid3()};

/* ---- start ---- */
S.h=['land'];
icons();applyAssets();growAll();
$('#lgreet').textContent=greetText('');
$('#fabSlot').innerHTML=ic('chat');fabInit();   // replace #fabSlot's content with your animated WebGL canvas
perfInit();setVid();chatBadge();bootNet();
