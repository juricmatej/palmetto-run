// ---------- 3D scene ----------
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:!isTouch,powerPreference:'high-performance'});
let curPR=Math.min(window.devicePixelRatio||1,isTouch?1:1.3);const maxPR=curPR;renderer.setPixelRatio(curPR);const perf={t:0,n:0};
function perfTick(raw){if(raw>.5||state==='menu')return;perf.t+=raw;perf.n++;if(perf.t>2.5){const fps=perf.n/perf.t;perf.t=perf.n=0;let np=curPR;
  if(fps<45&&curPR>.6)np=Math.max(.6,curPR-.15);else if(fps>58&&curPR<maxPR)np=Math.min(maxPR,curPR+.1);if(np!==curPR){curPR=np;renderer.setPixelRatio(curPR);resize3d()}}}
const scene=new THREE.Scene();
scene.background=new THREE.Color('#1a0c2e');
scene.fog=new THREE.FogExp2('#2e1442',0.00105);
const camera=new THREE.PerspectiveCamera(62,1,1,7000);
function resize3d(){renderer.setSize(VW,VH,false);camera.aspect=VW/Math.max(1,VH);camera.updateProjectionMatrix()}
addEventListener('resize',resize3d);resize3d();
const hemi=new THREE.HemisphereLight('#6a58a8','#1a1020',0.85);scene.add(hemi);
scene.add(new THREE.AmbientLight('#3a2d55',0.45));
const moon=new THREE.DirectionalLight('#a9bbff',0.5);moon.position.set(-0.6,1,0.4);scene.add(moon);

const dummy=new THREE.Object3D();
function mergeGeos(list){const hasUv=list.every(([g])=>g.attributes.uv),hasCol=list.every(([g])=>g.attributes.color);let total=0;
  const parts=list.map(([g,mx])=>{const q=g.index?g.toNonIndexed():g.clone();q.applyMatrix4(mx);total+=q.attributes.position.count;return q});
  const pos=new Float32Array(total*3),nor=new Float32Array(total*3),uv=hasUv?new Float32Array(total*2):null,col=hasCol?new Float32Array(total*3):null;let o=0;
  for(const q of parts){pos.set(q.attributes.position.array,o*3);if(q.attributes.normal)nor.set(q.attributes.normal.array,o*3);if(uv)uv.set(q.attributes.uv.array,o*2);if(col)col.set(q.attributes.color.array,o*3);o+=q.attributes.position.count;q.dispose()}
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.BufferAttribute(pos,3));out.setAttribute('normal',new THREE.BufferAttribute(nor,3));if(uv)out.setAttribute('uv',new THREE.BufferAttribute(uv,2));if(col)out.setAttribute('color',new THREE.BufferAttribute(col,3));out.computeBoundingSphere();return out}
// Static world meshes merge into one draw per look (same map, emissive, side, blend and flags). Colour goes into vertex colours,
// so meshes with the same look but different material objects still share a draw. Animated or toggled objects stay apart.
function staticBatch(){
  const skip=new Set([...shopRings,roul,clubBall,beaconRing,beacon,skyDome,tv,heliShadow,copHeliCone,copHeliSpot,LMA.boats,...fireGlows].filter(Boolean)),groups=new Map(),gone=[],tinted=new Map();scene.updateMatrixWorld(true);
  const look=m=>[m.type,m.map?m.map.uuid:'',m.emissiveMap?m.emissiveMap.uuid:'',m.emissive?m.emissive.getHex():'',m.side,+!!m.flatShading,+!!m.transparent,m.opacity,m.blending,+!!m.depthWrite,+!!m.depthTest,+!!m.fog,+!!m.vertexColors,m.specular?m.specular.getHex():'',m.shininess||'',m.userData.fade?JSON.stringify(m.userData.fade):'',m.userData.fadeC?JSON.stringify(m.userData.fadeC):''].join('|');
  for(const o of scene.children){
    if(!o.isMesh&&!o.isInstancedMesh||!o.visible||Array.isArray(o.material)||skip.has(o))continue;const m=o.material,g=o.geometry;
    if(m.transparent&&!(m.blending===THREE.AdditiveBlending&&!m.depthWrite))continue; // additive glows can join a batch: additive blending does not depend on draw order
    if(!g.attributes.position||!g.attributes.normal)continue;
    if(o.isInstancedMesh&&o.instanceColor)continue; // coloured per instance at runtime (traffic lights)
    const key=look(m)+(g.attributes.uv?'u':'n')+(g.attributes.color?'c':'-');let L=groups.get(key);if(!L){L={mats:new Set(),list:[]};groups.set(key,L)}
    L.mats.add(m);gone.push(o);
    if(o.isInstancedMesh){for(let i=0;i<Math.min(o.count,o.instanceMatrix.count);i++){const im=new THREE.Matrix4();o.getMatrixAt(i,im);if(!im.determinant())continue; // unwritten slot, zero matrix
      L.list.push([g,new THREE.Matrix4().multiplyMatrices(o.matrixWorld,im),m])}}
    else L.list.push([g,o.matrixWorld.clone(),m])}
  for(const o of gone)scene.remove(o);
  for(const{mats,list}of groups.values()){if(!list.length)continue;
    const one=[...mats][0],plain=mats.size===1&&one.color.getHex()===0xffffff&&!one.vertexColors; // a lone white material is used as it is, so runtime edits to it still apply
    const mat=plain?one:Object.assign(one.clone(),{vertexColors:true});
    if(!plain){mat.color.set(0xffffff);mat.needsUpdate=true;if(one.userData)mat.userData=JSON.parse(JSON.stringify(one.userData));
      fadeApply(mat)} // a clone keeps its day/night registration (its colour is white; the tint moved into vertex colours)
    const parts=plain?list.map(([g,mx])=>[g,mx]):list.map(([g,mx,mt])=>{const k=g.uuid+mt.uuid;if(!tinted.has(k))tinted.set(k,tintGeo(g,mt));return[tinted.get(k),mx]});
    if(parts.length===1){const[g,mx]=parts[0];const m=new THREE.Mesh(g,mat);m.matrixAutoUpdate=false;m.matrix.copy(mx);scene.add(m);continue}
    const m=new THREE.Mesh(mergeGeos(parts),mat);m.matrixAutoUpdate=false;scene.add(m)}
}
// a copy of g with every vertex coloured by the material colour (times its own vertex colour, when the material uses those)
function tintGeo(g,mt){const n=g.attributes.position.count,a=new Float32Array(n*3),c=mt.color,vc=mt.vertexColors&&g.attributes.color;
  for(let i=0;i<n;i++){a[i*3]=c.r*(vc?vc.getX(i):1);a[i*3+1]=c.g*(vc?vc.getY(i):1);a[i*3+2]=c.b*(vc?vc.getZ(i):1)}
  const q=g.clone();q.setAttribute('color',new THREE.BufferAttribute(a,3));return q}
function inst(mesh,i,x,y,z,ry,sx,sy,sz,rx){dummy.position.set(x,y,z);dummy.rotation.set(rx||0,ry||0,0);dummy.scale.set(sx||1,sy||1,sz||1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);return new THREE.CanvasTexture(c)}
const texCache={};
function glowTex(col){return texCache[col]||(texCache[col]=new THREE.CanvasTexture(glow(col)))}
const additive=(map,opacity)=>new THREE.MeshBasicMaterial({map,transparent:true,opacity:opacity??1,blending:THREE.AdditiveBlending,depthWrite:false});

// world textures: drawn once on canvas, tiled with RepeatWrapping. Colours match the old flat materials so the night stays as dark.
const rtex=(w,h,draw,rx,ry)=>{const t=canvasTex(w,h,draw);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx||1,ry||1);t.anisotropy=4;return t};
const grit=(g,w,h,n,seed,a)=>{const r=seeded(seed);for(let i=0;i<n;i++){g.fillStyle=r()<.5?`rgba(255,255,255,${a})`:`rgba(0,0,0,${a*1.6})`;g.fillRect(r()*w,r()*h,1+r()*1.5,1+r()*1.5)}};
function uvScale(geo,su,sv){const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);return geo}
// asphalt tile is one block pitch: 440 units, 1024 px. Roads sit at 0 to 120 of each tile with lanes at 36 and 84,
// so the kerb shading lands on every road edge and no crack or patch repeats twice within a block.
const asphTex=rtex(1024,1024,(g,w,h)=>{const k=w/B;g.fillStyle='#1d1b26';g.fillRect(0,0,w,h);grit(g,w,h,240000,1,.05);
 for(const e of[-3,120]){g.fillStyle='rgba(0,0,0,.22)';g.fillRect(e*k,0,6*k,h);g.fillRect(0,e*k,w,6*k)}
 for(const c of[36,84])for(const d of[-9,9]){g.fillStyle='rgba(0,0,0,.05)';g.fillRect((c+d-7)*k,0,14*k,h);g.fillRect(0,(c+d-7)*k,w,14*k)}});
const asphGeo=new THREE.PlaneGeometry(W,W);{const u=asphGeo.attributes.uv,p=asphGeo.attributes.position;for(let i=0;i<u.count;i++)u.setXY(i,(p.getX(i)+W/2)/B,1-(W/2-p.getY(i))/B)}
// sidewalk: one texture per block (block is B-R=320 units): 23 slabs per side, kerb band on the outer edge
const walkTex=rtex(512,512,(g,w,h)=>{const r=seeded(3),n=23,q=w/n;g.fillStyle='#36313f';g.fillRect(0,0,w,h);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){g.fillStyle=`rgba(${r()<.5?'255,255,255':'0,0,0'},${r()*.05})`;g.fillRect(i*q,j*q,q,q)}
 grit(g,w,h,20000,4,.05);g.fillStyle='rgba(0,0,0,.4)';for(let i=0;i<=n;i++){g.fillRect(i*q,0,1,h);g.fillRect(0,i*q,w,1)}
 g.fillStyle='#575167';g.fillRect(0,0,w,4);g.fillRect(0,h-4,w,4);g.fillRect(0,0,4,h);g.fillRect(w-4,0,4,h);
 g.fillStyle='rgba(0,0,0,.6)';g.fillRect(0,0,w,1);g.fillRect(0,h-1,w,1);g.fillRect(0,0,1,h);g.fillRect(w-1,0,1,h)});
// sidewalk paving: 23 slabs per block side with dark joints and a light stone edge. One texture for every sidewalk.
const pavTex=rtex(512,512,(g,w,h)=>{const r=seeded(12),n=23,q=w/n;g.fillStyle='#3a3544';g.fillRect(0,0,w,h);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){g.fillStyle=`rgba(${r()<.5?'255,255,255':'0,0,0'},${.03+r()*.06})`;g.fillRect(i*q,j*q,q,q)}
 grit(g,w,h,15000,12,.05);g.fillStyle='rgba(20,16,28,.8)';for(let i=0;i<=n;i++){g.fillRect(i*q,0,1.5,h);g.fillRect(0,i*q,w,1.5)}
 g.fillStyle='#6b6680';g.fillRect(0,0,w,6);g.fillRect(0,h-6,w,6);g.fillRect(0,0,6,h);g.fillRect(w-6,0,6,h)});
const IN=(B-R-2*SW);
const grassTex=rtex(256,256,(g,w,h)=>{const r=seeded(5);g.fillStyle='#1f4a2c';g.fillRect(0,0,w,h);
 for(let i=0;i<1800;i++){g.strokeStyle=r()<.5?'#2a6a3a':'#16381f';const x=r()*w,y=r()*h;g.beginPath();g.moveTo(x,y);g.lineTo(x+r()*3-1.5,y-2-r()*4);g.stroke()}
 for(let i=0;i<5;i++){g.fillStyle='rgba(120,110,50,.1)';g.beginPath();g.ellipse(r()*w,r()*h,8+r()*20,5+r()*10,0,0,TAU);g.fill()}},IN/36,IN/36);
const sandTex=rtex(256,256,(g,w,h)=>{g.fillStyle='#8a7350';g.fillRect(0,0,w,h);grit(g,w,h,5000,6,.06);
 for(let y=0;y<h;y+=16){for(const[c,o]of[['rgba(255,235,190,.1)',0],['rgba(40,25,10,.16)',3]]){g.strokeStyle=c;g.lineWidth=2;g.beginPath();for(let x=0;x<=w;x+=8)g.lineTo(x,y+o+Math.sin(x/w*TAU*3+y)*3);g.stroke()}}},IN/64,IN/64);
const dockTex=rtex(256,256,(g,w,h)=>{const r=seeded(7);g.fillStyle='#2c2c31';g.fillRect(0,0,w,h);grit(g,w,h,6000,8,.05);
 g.fillStyle='rgba(0,0,0,.45)';for(let i=0;i<4;i++){g.fillRect(i*64,0,2,h);g.fillRect(0,i*64,w,2)}
 for(let i=0;i<5;i++){const x=r()*w,y=r()*h,rx=14+r()*26,gr=g.createRadialGradient(x,y,0,x,y,rx);gr.addColorStop(0,'rgba(90,130,180,.5)');gr.addColorStop(1,'rgba(90,130,180,0)');g.fillStyle=gr;g.beginPath();g.ellipse(x,y,rx,rx*.55,0,0,TAU);g.fill()}},IN/52,IN/52);
const roofTex=rtex(128,128,(g,w,h)=>{const r=seeded(9);g.fillStyle='#1c1826';g.fillRect(0,0,w,h);grit(g,w,h,3000,10,.09);
 g.fillStyle='rgba(0,0,0,.35)';for(let i=0;i<3;i++){g.beginPath();g.ellipse(r()*w,r()*h,10+r()*14,6+r()*8,0,0,TAU);g.fill()}
 for(let i=0;i<4;i++){const x=8+r()*(w-30),y=8+r()*(h-30);g.fillStyle='#34303f';g.fillRect(x,y,14,12);g.fillStyle='#0c0a12';g.fillRect(x+2,y+2,10,3)}
 g.fillStyle='#2f2b3a';g.fillRect(0,h*.62,w,3)});
const roofMat=new THREE.MeshLambertMaterial({map:roofTex});
// roof cap: the top face tiles every 60 units, the sides sample one texel
function roofBox(w,hh,d){const g=new THREE.BoxGeometry(w,hh,d),uv=g.attributes.uv;for(let k=0;k<24;k++){if(k>=8&&k<12)uv.setXY(k,uv.getX(k)*w/60,uv.getY(k)*d/60);else uv.setXY(k,.01,.01)}return g}
// facades: 4 variants for each of glass office, brick, stucco, industrial. Colour and emissive (lit windows) canvases are drawn together.
const FAC={glass:[['#2a3f66','#101a30'],['#1f4f5c','#0a2229'],['#3b3470','#171230'],['#4a4256','#1d1826']],
 brick:[['#5a3028','#2a1814'],['#4a3040','#241420'],['#5a4030','#2a1c12'],['#3c3040','#1c1420']],
 stucco:[['#4a3c58','#a99ab8'],['#3c4c58','#9db4be'],['#58423e','#bfa6a0'],['#3e5846','#a4c0aa']],
 ind:[['#3e444e','#2a2f36'],['#4a3e36','#33291f'],['#363f3a','#262d28'],['#443636','#2e2222']]};
const WTONE=['#ffcf86','#ffb86b','#fff1c4','#ff9ad5','#7fe9ff','#a9bbff'],facMats={},FACADES=[];
function facMat(type,v){const key=type+v;if(facMats[key])return facMats[key];
 const[base,edge]=FAC[type][v],r=seeded(v*977+type.charCodeAt(0)*131),mk=()=>{const c=document.createElement('canvas');c.width=c.height=256;return c},cg=mk(),ce=mk(),g=cg.getContext('2d'),e=ce.getContext('2d');
 g.fillStyle=base;g.fillRect(0,0,256,256);e.fillStyle='#000';e.fillRect(0,0,256,256);grit(g,256,256,5000,v+5,.06);
 const lightIt=(x,y,w,h,p)=>{if(r()>=p)return;e.globalAlpha=.5+r()*.5;e.fillStyle=WTONE[Math.floor(r()*6)];e.fillRect(x,y,w,h);e.globalAlpha=1;
  if(r()<.25){e.fillStyle='#000';for(let k=y+2;k<y+h;k+=4)e.fillRect(x,k,w,2)}}; // blinds
 if(type==='ind'){
  for(let x=0;x<256;x+=4){g.fillStyle='rgba(255,255,255,.07)';g.fillRect(x,0,2,256);g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x+2,0,1,256)}
  g.fillStyle=edge;for(let x=0;x<256;x+=64)g.fillRect(x,0,2,256);g.fillRect(0,150,256,2);
  for(let i=0;i<9;i++){g.fillStyle='rgba(120,60,20,.18)';g.fillRect(r()*256,150+r()*100,2+r()*3,20+r()*60)}
  for(let x=0;x<256;x+=64){g.fillStyle='#10151c';g.fillRect(x+8,192,48,10);lightIt(x+8,192,48,10,.3)}
  const dx=60+v*30;g.fillStyle='#262b33';g.fillRect(dx,214,70,42);g.fillStyle='rgba(0,0,0,.4)';for(let y=216;y<256;y+=4)g.fillRect(dx,y,70,1);
  g.fillStyle='#c9a227';for(let x=dx;x<dx+70;x+=10)g.fillRect(x,206,5,6);lightIt(dx+20,206,30,5,.5)}
 else for(let y=0;y<8;y++)for(let x=0;x<8;x++){const X=x*32,Y=y*32;
  if(type==='glass'){g.fillStyle=shade(base,.62);g.fillRect(X+1,Y+2,30,28);g.fillStyle='rgba(255,255,255,.05)';g.fillRect(X+1,Y+2,30,10);lightIt(X+3,Y+4,26,24,.38)}
  else{if(type==='brick'&&x===0&&y===0)for(let b=0;b<256;b+=8){g.fillStyle=edge;g.fillRect(0,b,256,1);for(let c=(b/8%2)*8;c<256;c+=16)g.fillRect(c,b,1,8)}
   g.fillStyle=type==='stucco'?edge:'#8d8aa0';g.fillRect(X+7,Y+6,18,22);g.fillStyle='#14111d';g.fillRect(X+9,Y+8,14,18);lightIt(X+9,Y+8,14,18,.4);
   g.fillStyle=edge;g.fillRect(X+5,Y+27,22,3);
   const p=r();if(p<.2){g.fillStyle='#8d8aa0';g.fillRect(X+10,Y+24,12,5);g.fillStyle='#4a4756';g.fillRect(X+10,Y+28,12,1)} // AC unit
   else if(p<.32&&y>0){g.fillStyle='#aaa5b8';g.fillRect(X+2,Y+26,28,3);g.fillStyle='#6d6980';for(let b=3;b<28;b+=4)g.fillRect(X+b,Y+20,1,6)}} // balcony
  if(type==='glass'){g.fillStyle=edge;g.fillRect(X,Y,2,32);g.fillRect(X,Y,32,2)}
  if(type==='stucco'){g.fillStyle='rgba(255,255,255,.07)';g.fillRect(0,Y+30,256,2)}}
 const t=new THREE.CanvasTexture(cg),l=new THREE.CanvasTexture(ce);for(const q of[t,l]){q.wrapS=q.wrapT=THREE.RepeatWrapping;q.anisotropy=4}
 FACADES.push(key);return facMats[key]=fade(new THREE.MeshLambertMaterial({map:t,emissive:new THREE.Color('#ffffff'),emissiveMap:l}),'emissiveIntensity',1,.25)}
const facPick=b=>Math.floor(seeded((b.x*131+b.y*17)|0)()*4);
// shopfronts: a sign, an awning, lit display panes and a door, one canvas per facade style. Repeats every 120 units along the face.
const SHOPCOL=['#ff3ea5','#29e6d6','#ffc94a','#3dd68c'],shopMats=SHOPCOL.map(c=>new THREE.MeshBasicMaterial({map:rtex(256,64,(g)=>{g.fillStyle='#17131f';g.fillRect(0,0,256,64);
 g.shadowColor=c;g.shadowBlur=6;g.fillStyle=c;g.fillRect(6,4,244,11);g.shadowBlur=0;
 for(let x=0;x<256;x+=16){g.fillStyle=c;g.globalAlpha=x%32?.55:.2;g.fillRect(x,17,16,7)}g.globalAlpha=1;
 for(const x of[8,96]){g.fillStyle=WTONE[x%6];g.globalAlpha=.55;g.fillRect(x,26,80,30);g.globalAlpha=1;g.fillStyle='#17131f';g.fillRect(x+38,26,3,30)}
 g.fillStyle='#0d0b14';g.fillRect(198,24,32,40);g.fillStyle='#ffcf86';g.globalAlpha=.5;g.fillRect(204,29,20,12);g.globalAlpha=1;
 g.fillStyle='#2b2636';g.fillRect(0,58,256,6)})}));for(const m of shopMats)fadeC(m,'color','#ffffff','#8a8a92');
const ledgeMat=new THREE.MeshLambertMaterial({color:'#4a4362'});
// window grid per building: tile size in units, so neighbours do not share one grid
const tileOf=b=>{const r=seeded((b.x*29+b.y*13+b.H)|0);return[96+r()*60,96+r()*60]};
// a shopfront band and a ledge on each face that looks onto a road (within 30 units of the block edge)
function shopfronts(b,k){const bx=Math.floor((b.x+b.w/2)/B),bz=Math.floor((b.y+b.h/2)/B),x0=bx*B+R,y0=bz*B+R,x1=(bx+1)*B,y1=(bz+1)*B;
 for(const[px,pz,nx,nz,len,dist]of[[b.x,b.y+b.h/2,-1,0,b.h,b.x-x0],[b.x+b.w,b.y+b.h/2,1,0,b.h,x1-b.x-b.w],[b.x+b.w/2,b.y,0,-1,b.w,b.y-y0],[b.x+b.w/2,b.y+b.h,0,1,b.w,y1-b.y-b.h]]){
  if(dist>=30||len<28)continue;const L=len-8,ry=Math.atan2(nx,nz);
  const sp=new THREE.Mesh(uvScale(new THREE.PlaneGeometry(L,14),L/120,1),shopMats[k]);sp.position.set(px+nx*.5,7,pz+nz*.5);sp.rotation.y=ry;scene.add(sp);
  const lg=new THREE.Mesh(new THREE.BoxGeometry(L,1.4,1.4),ledgeMat);lg.position.set(px+nx*.7,15.2,pz+nz*.7);lg.rotation.y=ry;scene.add(lg)}}
if(DBG)Object.defineProperties(DBG,{texCount:{get:()=>Object.keys(facMats).length}});

// ground
const asphMat=new THREE.MeshLambertMaterial({map:asphTex}); // weather tints this in rain
{const water=new THREE.Mesh(new THREE.PlaneGeometry(W*5,W*5),new THREE.MeshLambertMaterial({color:'#0b2436',emissive:'#05131f'}));water.rotation.x=-Math.PI/2;water.position.set(W/2,-3,W/2);scene.add(water);
 const sand=new THREE.Mesh(new THREE.PlaneGeometry(W+80,W+80),new THREE.MeshLambertMaterial({color:'#3d3242'}));sand.rotation.x=-Math.PI/2;sand.position.set(W/2,-1,W/2);scene.add(sand);
 const asph=new THREE.Mesh(asphGeo,asphMat);asph.rotation.x=-Math.PI/2;asph.position.set(W/2,0,W/2);scene.add(asph);}

// road markings. Lane dashes and crosswalks are instanced; everything else (avenue double lines, stop lines,
// parking bays, arrows, drains, manholes) merges into one vertex-coloured mesh. Decal quads add patches,
// cracks and stains that never repeat along a road.
const AVENUE=[3,6]; // the two north-south and east-west avenues: double lines, arrows, no centre dashes
{const per=Math.ceil(W/40),dash=new THREE.InstancedMesh(new THREE.BoxGeometry(20,.3,2),new THREE.MeshBasicMaterial({color:'#9c8240'}),2*(N+1)*per);let n=0;
 for(let k=0;k<=N;k++)for(let i=0;i<per;i++){const p=i*40+10;
   if(!AVENUE.includes(k)){if(!inAF(p,k*B+60))inst(dash,n++,p,.15,k*B+60,0);if(!inAF(k*B+60,p))inst(dash,n++,k*B+60,.15,p,Math.PI/2)}}
 dash.count=n;scene.add(dash);
 const cw=new THREE.InstancedMesh(new THREE.BoxGeometry(7,.3,12),new THREE.MeshBasicMaterial({color:'#4a4658'}),(N+1)*(N+1)*4*8);n=0;
 for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const ix=i*B,iy=j*B;
   for(let s=12;s<R-8&&n<cw.count-4;s+=14){ // the outer bands of the border junctions fall outside the city: skip them
     if(j>0&&!inAF(ix+s,iy-8))inst(cw,n++,ix+s,.15,iy-8,0);
     if(j<N&&!inAF(ix+s,iy+R+8))inst(cw,n++,ix+s,.15,iy+R+8,0);
     if(i>0&&!inAF(ix-8,iy+s))inst(cw,n++,ix-8,.15,iy+s,Math.PI/2);
     if(i<N&&!inAF(ix+R+8,iy+s))inst(cw,n++,ix+R+8,.15,iy+s,Math.PI/2)}}
 cw.count=n;scene.add(cw);
 // paint: a vertex-coloured merged mesh. Colours are worn paint, bay lines, iron drains and manhole covers.
 const parts=[],vc=(geo,hex)=>{const c=new THREE.Color(hex),cnt=geo.attributes.position.count,a=new Float32Array(cnt*3);
   for(let i=0;i<cnt;i++){a[i*3]=c.r;a[i*3+1]=c.g;a[i*3+2]=c.b}geo.setAttribute('color',new THREE.BufferAttribute(a,3));return geo},
  LINE='#9c8240',PAINT='#8f8a99',IRON='#1a1720',MH='#23202b',stopX=vc(new THREE.BoxGeometry(58,.3,4),PAINT),
  put=(g,x,y,z,ry)=>parts.push([g,new THREE.Matrix4().makeRotationY(ry||0).setPosition(x,y,z)]),
  stopG=vc(new THREE.BoxGeometry(4,.3,58),PAINT),lineG=vc(new THREE.BoxGeometry(1.6,.3,308),LINE),
  bayG=vc(new THREE.BoxGeometry(1,.3,10),PAINT),drainG=vc(new THREE.BoxGeometry(6,.3,3),IRON),
  mhG=vc(new THREE.CircleGeometry(4.5,18).rotateX(-Math.PI/2),MH),
  arrow=vc(mergeGeos([[new THREE.BoxGeometry(3.2,.3,14),new THREE.Matrix4().makeTranslation(0,0,-4)],
   [new THREE.BoxGeometry(3,.3,9),new THREE.Matrix4().makeRotationY(.62).setPosition(-3,0,8)],
   [new THREE.BoxGeometry(3,.3,9),new THREE.Matrix4().makeRotationY(-.62).setPosition(3,0,8)]]),PAINT);
 for(const k of AVENUE)for(let s=0;s<N;s++){ // avenue double lines, broken at every junction
   const mid=s*B+R+(B-R-12)/2;
   put(lineG,k*B+56.4,.15,mid);put(lineG,k*B+63.6,.15,mid);
   put(lineG,mid,.15,k*B+56.4,Math.PI/2);put(lineG,mid,.15,k*B+63.6,Math.PI/2)}
 const mh=seeded(7);
 for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const ix=i*B,iy=j*B;if(inAF(ix+60,iy+60))continue;
   // stop lines on the incoming lane of all four approaches, straight arrows 30 before them on the avenues
   if(j>0){put(stopX,ix+90,.15,iy-20);if(AVENUE.includes(i))put(arrow,ix+84,.16,iy-50,0)}
   if(j<N){put(stopX,ix+30,.15,iy+R+20);if(AVENUE.includes(i))put(arrow,ix+36,.16,iy+R+50,Math.PI)}
   if(i>0){put(stopG,ix-20,.15,iy+90);if(AVENUE.includes(j))put(arrow,ix-50,.16,iy+84,Math.PI/2)}
   if(i<N){put(stopG,ix+R+20,.15,iy+30);if(AVENUE.includes(j))put(arrow,ix+R+50,.16,iy+36,-Math.PI/2)}
   put(drainG,ix+112,.15,iy-4);put(drainG,ix-4,.15,iy+112,Math.PI/2)}
 for(let bj=0;bj<N;bj++)for(let bi=0;bi<N;bi++){const t=blockType[bj*N+bi];if(t!=='city'&&t!=='midtown')continue;
   const x0=bi*B+R,y0=bj*B+R,s=B-R; // parking bays along both kerbs of downtown and midtown streets
   for(let u=12;u<s-12;u+=34)for(const side of[0,1,2,3]){
     const [x,z,ry]=side===0?[x0-7,y0+u,0]:side===1?[x0+s+7,y0+u,0]:side===2?[x0+u,y0-7,Math.PI/2]:[x0+u,y0+s+7,Math.PI/2];
     if(!DOORS.some(d=>Math.hypot(d.x-x,d.y-z)<34)&&!rampZone(x,z))put(bayG,x,.15,z,ry)}}
 for(let k=0;k<=N;k++)for(let i=0;i<6;i++){const p=(i+.5)*W/6+(mh()-.5)*50; // manhole covers on the road centres
   if(mh()<.6&&!inAF(p,k*B+30))put(mhG,p,.16,k*B+30);
   if(mh()<.6&&!inAF(k*B+90,p))put(mhG,k*B+90,.16,p)}
 scene.add(new THREE.Mesh(mergeGeos(parts),new THREE.MeshBasicMaterial({vertexColors:true})));
 // decals: patches, cracks and stains on one atlas, one instanced quad set per variant so each can offset its quarter
 const dtex=rtex(512,512,(g)=>{const r=seeded(21);g.clearRect(0,0,512,512);
   g.fillStyle='rgba(0,0,0,.20)';g.beginPath();g.ellipse(128,128,92,72,0,0,TAU);g.fill();
   g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=3;for(let c=0;c<5;c++){let x=300+r()*120,y=70+r()*110;g.beginPath();g.moveTo(x,y);for(let t=0;t<6;t++){x+=r()*24-12;y+=r()*24-12;g.lineTo(x,y)}g.stroke()}
   const gr=g.createRadialGradient(128,384,6,128,384,88);gr.addColorStop(0,'rgba(0,0,0,.28)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.beginPath();g.arc(128,384,88,0,TAU);g.fill();
   g.fillStyle='rgba(255,255,255,.05)';g.fillRect(302,302,180,180);g.strokeStyle='rgba(0,0,0,.3)';g.lineWidth=4;g.strokeRect(302,302,180,180)});
 const DEC=[[],[],[]],dr=seeded(23);
 for(let k=0;k<=N;k++)for(let i=0;i<22;i++){const p=(i+dr())*W/22,v=dr(),a=k*B+12+dr()*96,b=p,s=26+dr()*40,r=dr()*TAU;
   if(!inAF(a,b))DEC[v<.45?0:v<.72?1:2].push([a,b,r,s]);
   if(!inAF(b,a))DEC[v<.45?0:v<.72?1:2].push([b,a,r,s])}
 DEC.forEach((list,v)=>{if(!list.length)return;const t=dtex.clone();t.needsUpdate=true;
   t.offset.set(v===1?.5:0,v===2?0:.5);t.repeat.set(.5,.5);
   const m=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshLambertMaterial({map:t,transparent:true,depthWrite:false}),list.length);
   list.forEach(([x,y,r,s],i)=>inst(m,i,x,.06,y,r,s,s,1,-Math.PI/2));scene.add(m)});}

// blocks
function lam0(c){return new THREE.MeshLambertMaterial({color:c})}
{const sw=new THREE.MeshLambertMaterial({map:pavTex}),inner={plaza:lam0('#3b3748'),marina:lam0('#2a3138'),skate:lam0('#2e2a26'),pit:lam0('#2a2d36'),airport:lam0('#2f333b'),hood:new THREE.MeshLambertMaterial({color:'#2e2a26'}),beach:new THREE.MeshLambertMaterial({map:sandTex}),suburb:new THREE.MeshLambertMaterial({map:grassTex}),industrial:new THREE.MeshPhongMaterial({map:dockTex,specular:'#33425a',shininess:50}),city:new THREE.MeshLambertMaterial({color:'#25212f'}),park:new THREE.MeshLambertMaterial({map:grassTex,color:'#bdccd6'}),lot:new THREE.MeshLambertMaterial({color:'#211f2a'})};
 const s=B-R,swGeo=new THREE.BoxGeometry(s,1,s),inGeo=new THREE.BoxGeometry(s-2*SW,.3,s-2*SW);
 const lines=new THREE.InstancedMesh(new THREE.BoxGeometry(1.5,.3,40),new THREE.MeshBasicMaterial({color:'#5a566a'}),lots.length*27);let ln=0;
 for(let bj=0;bj<N;bj++)for(let bi=0;bi<N;bi++){const t=blockType[bj*N+bi],cx=bi*B+R+s/2,cz=bj*B+R+s/2;
   if(t==='airport')continue;
   const a=new THREE.Mesh(swGeo,sw);a.position.set(cx,.5,cz);scene.add(a);
   const b=new THREE.Mesh(inGeo,inner[t]);b.position.set(cx,1.1,cz);scene.add(b);
   if(t==='lot')for(let r=0;r<3;r++)for(let c=0;c<=8;c++)inst(lines,ln++,bi*B+R+23+c*34,1.3,bj*B+R+70+r*90,0);
   if(t==='park'&&!cells[bj*N+bi].length&&groundZ(cx,cz)===0){const f=new THREE.Mesh(new THREE.CylinderGeometry(22,24,4,24),new THREE.MeshLambertMaterial({color:'#1d4a5a',emissive:'#0b3a44'}));f.position.set(cx,2,cz);scene.add(f)}}
 lines.count=ln;scene.add(lines);
 // trees
 let tc=0;for(const p of parks)tc+=p.trees.length;
 const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.6,2.2,14,6),new THREE.MeshLambertMaterial({color:'#4a3426'}),tc),leaf=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:'#2a7a4c',flatShading:true}),tc);let ti=0;
 for(const p of parks)for(const[x,y,r]of p.trees){inst(trunk,ti,x,8+groundZ(x,y),y,0);inst(leaf,ti,x,16+r*.6+groundZ(x,y),y,x,r*1.1,r*1.3,r*1.1);ti++}
 scene.add(trunk,leaf);}

// terrain meshes: one per shape, built on the heightmap cells that groundZ reads. Only cells that rise are drawn.
// Ramps get yellow and black chevrons; parks grass, the city concrete, the beach sand.
const tgrass=new THREE.MeshLambertMaterial({map:grassTex}),tsand=new THREE.MeshLambertMaterial({map:sandTex}),tconc=new THREE.MeshLambertMaterial({map:walkTex});
const twood=new THREE.MeshLambertMaterial({map:rtex(128,128,(g,w,h)=>{g.fillStyle='#6b4a32';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=16){g.fillStyle='#3e2a1c';g.fillRect(0,y,w,2);g.fillStyle='rgba(255,220,170,.06)';g.fillRect(0,y+2,w,12)}grit(g,w,h,800,11,.06)},1,1)});
const tchev=new THREE.MeshLambertMaterial({map:canvasTex(64,64,(g,w,h)=>{g.fillStyle='#ffc94a';g.fillRect(0,0,w,h);g.fillStyle='#141218';for(let k=-1;k<3;k++){g.beginPath();g.moveTo(k*32,0);g.lineTo(k*32+16,0);g.lineTo(k*32+48,h);g.lineTo(k*32+32,h);g.fill()}})});
tchev.map.wrapS=tchev.map.wrapT=THREE.RepeatWrapping;
function terrainMesh(s){
  const[i0,j0,i1,j1]=s.box,nw=i1-i0+1,nh=j1-j0+1,pos=[],uv=[],ix=[],hz=(i,j)=>HM.a[j*HM.gw+i];
  const bd=district(Math.floor((s.x-R/2)/B),Math.floor((s.y-R/2)/B)),mat=s.kind==='ramp'?tconc:s.mat==='wood'?twood:bd==='park'?tgrass:bd==='beach'?tsand:tconc;
  const sc=mat===tchev?1/40:mat===twood?1/24:mat===tconc?1/(B-R):1/IN;
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=HM.x0+i*HM.cell,z=HM.y0+j*HM.cell;pos.push(x,hz(i,j),z);uv.push(x*sc,z*sc)}
  for(let j=0;j<nh-1;j++)for(let i=0;i<nw-1;i++){const a=j*nw+i,b=a+1,c=a+nw,d=c+1;if(Math.max(hz(i0+i,j0+j),hz(i0+i+1,j0+j),hz(i0+i,j0+j+1),hz(i0+i+1,j0+j+1))<=0)continue;ix.push(a,c,b,b,c,d)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
  const out=new THREE.Mesh(g,mat);
  if(s.kind!=='ramp')return out;
  // hazard band: the last 6 units before the lip, flat chevrons, normals forced up
  const ca=Math.cos(s.a),sa=Math.sin(s.a),px=-sa,py=ca,hw=s.w/2-1,
   at=(d,l)=>{const hh=Math.max(0,s.h*(1-d/s.len));return[s.x+ca*(s.len-d)+px*l,hh+.35,s.y+sa*(s.len-d)+py*l]},
   q=[at(0,-hw),at(0,hw),at(6,-hw),at(6,hw)],pp=[];
  for(const v of q)pp.push(v[0],v[1],v[2]);
  const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(pp,3));
  bg.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));
  bg.setIndex([0,1,2,1,3,2]);bg.computeVertexNormals();
  const na=bg.attributes.normal;for(let i=0;i<na.count;i++)na.setXYZ(i,0,1,0);
  return [out,new THREE.Mesh(bg,tchev)];
}
// footpaths: visual strips that follow the slope from a park edge to the mound top (no physics)
const tpath=new THREE.MeshLambertMaterial({color:'#5d5670'});
function footpath(x0,y0,x1,y1,w){
  const L=Math.hypot(x1-x0,y1-y0),n=Math.max(2,Math.ceil(L/10)),nx=-(y1-y0)/L*w/2,ny=(x1-x0)/L*w/2,pos=[],ix=[];
  for(let k=0;k<=n;k++){const t=k/n,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t,h=groundZ(x,y)+.5;pos.push(x+nx,h,y+ny,x-nx,h,y-ny)}
  for(let k=0;k<n;k++){const a=2*k;ix.push(a,a+2,a+1,a+1,a+2,a+3)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();
  return new THREE.Mesh(g,tpath)
}
for(const[x0,y0,x1,y1]of[[hillA.x,hillA.y,hillA.x,440],[hillA.x,hillA.y,1440,hillA.y],[hillB.x,hillB.y,1440,hillB.y],[hillB.x,hillB.y,hillB.x,562]])scene.add(footpath(x0,y0,x1,y1,10));
// Sunset Beach: seeded walkable dunes on the sand blocks, plus huts, lifeguard towers, volleyball, boats,
// a foam line and a shallow band so the waterline reads as water and not a wall.
{for(let bj=0;bj<N;bj++)for(let bi=0;bi<N;bi++){if(blockType[bj*N+bi]!=='beach')continue;
  const x0=bi*B+R,y0=bj*B+R,s=B-R,dr=seeded(bi*29+bj*83+7);
  for(let k=0;k<2;k++){const dx=x0+70+dr()*(s-140),dy=y0+70+dr()*(s-140),r0=38+dr()*20,h=2.6+dr()*2.2;
    if(!rampZone(dx,dy))addShape({kind:'mound',x:dx,y:dy,r:r0,h})}}}

for(const s of TERRAIN){const m=terrainMesh(s);Array.isArray(m)?scene.add(...m):scene.add(m)}
for(const m of hillMeshes())scene.add(m);
// buildings
const wallTex=canvasTex(256,256,(g)=>{g.fillStyle='#a49ebb';g.fillRect(0,0,256,256);g.fillStyle='#8c86a3';for(let y=0;y<8;y++)g.fillRect(0,y*32+29,256,3);g.fillStyle='#262233';for(let y=0;y<8;y++)for(let x=0;x<8;x++)g.fillRect(8+x*32,8+y*32,18,18)});
const litTex=canvasTex(256,256,(g)=>{g.fillStyle='#000';g.fillRect(0,0,256,256);const r=seeded(99);for(let y=0;y<8;y++)for(let x=0;x<8;x++){const v=r();if(v<.42){g.globalAlpha=.45+r()*.55;g.fillStyle=v<.1?'#7fe9ff':v<.3?'#ffcf86':'#ff9ad5';g.fillRect(8+x*32,8+y*32,18,18)}}g.globalAlpha=1});
for(const t of[wallTex,litTex]){t.wrapS=t.wrapT=THREE.RepeatWrapping}
const trimMats={},capMat=new THREE.MeshLambertMaterial({color:'#17131f'});
// hip or gable roof: eaves rectangle w by d at y 0, ridge at y rise, pulled in by ins (0 makes a gable)
function hipGeo(w,d,rise,ins,alongX){
 const A=[-w/2,0,-d/2],B=[w/2,0,-d/2],C=[w/2,0,d/2],D=[-w/2,0,d/2],R1=[-w/2+ins,rise,0],R2=[w/2-ins,rise,0],
  pos=[A,R1,R2, A,R2,B, C,R2,R1, C,R1,D, A,D,R1, C,B,R2].flat(),g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 if(!alongX){const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setX(i,z);p.setZ(i,-x)}} // ridge along z: rotate a quarter turn
 g.computeVertexNormals();return g}
function boxUV(geo,w,h,d,tw=120,th=120){const uv=geo.attributes.uv,sx=[d,d,w,w,w,w],sy=[h,h,d,d,h,h];for(let f=0;f<6;f++)for(let i=0;i<4;i++){const k=f*4+i;if(f===2||f===3)uv.setXY(k,.01,.01);else uv.setXY(k,uv.getX(k)*sx[f]/tw,uv.getY(k)*sy[f]/th)}uv.needsUpdate=true}
const graffMats=['KINGS','LOW PALMS','LPK 4 LIFE','PALM CITY','VIPERS'].map((t,i)=>new THREE.MeshBasicMaterial({map:canvasTex(512,136,(g)=>{const cols=[['#9a5ad8','#ffc94a'],['#ff3ea5','#29e6d6'],['#7b3fb8','#3dd68c'],['#ffc94a','#ff3ea5'],['#3d9a4a','#e8e4f0']][i];
  g.fillStyle='#171310';g.fillRect(0,0,512,136);g.fillStyle='rgba(255,255,255,.05)';for(let y=0;y<136;y+=17)g.fillRect(0,y,512,2);
  g.font='bold 86px Impact, "Arial Black", sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=14;g.strokeStyle='#101010';g.strokeText(t,256,64);g.fillStyle=cols[0];g.fillText(t,256,64);
  g.lineWidth=4;g.strokeStyle=cols[1];g.strokeText(t,256,64);g.fillStyle=cols[0];for(let k=0;k<9;k++){const x=60+Math.random()*390;g.fillRect(x,92,4,14+Math.random()*30)}})}));
const chainTex=rtex(64,64,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle='rgba(196,200,214,.85)';g.lineWidth=2;
 for(let k=-2;k<6;k++){g.beginPath();g.moveTo(k*16,0);g.lineTo(k*16+32,h);g.stroke();g.beginPath();g.moveTo(k*16,0);g.lineTo(k*16-32,h);g.stroke()}});
const chainMat=new THREE.MeshBasicMaterial({map:chainTex,alphaTest:.45,side:THREE.DoubleSide}),
 chainPost=mergeGeos([[new THREE.CylinderGeometry(.5,.5,7,5),new THREE.Matrix4().makeTranslation(0,3.5,0)],[new THREE.BoxGeometry(.5,.5,.5),new THREE.Matrix4().makeTranslation(0,7,0)]]);
const bLam={},blam=(c,o)=>bLam[c]||(bLam[c]=new THREE.MeshLambertMaterial(Object.assign({color:c},o||{})));
const glassMat=fade(new THREE.MeshLambertMaterial({color:'#6a9cc8',map:wallTex,emissive:new THREE.Color('#ffffff'),emissiveMap:litTex}),'emissiveIntensity',1,.3);
const winMat=fadeC(new THREE.MeshBasicMaterial({color:'#ffd28a'}),'color','#ffd28a','#2f3f5c'),doorMat=new THREE.MeshLambertMaterial({color:'#2a2633'}),redLight=new THREE.MeshBasicMaterial({color:'#ff2d55'});
// rooftop dressing: parapets, set-backs, roof plant, lit crowns and shop blade signs.
// Per-building detail runs on its own seeded stream (keyed off the footprint), so the world stream never moves.
const mtx=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z);
const roofG={
 tank:mergeGeos([[new THREE.CylinderGeometry(6,6,13,10),mtx(0,8.5,0)],[new THREE.CylinderGeometry(6.4,6.4,1.5,10),mtx(0,15.7,0)],
  ...[[-5.5,6],[5.5,6],[-5.5,-6],[5.5,-6]].map(([x,z])=>[new THREE.BoxGeometry(1.3,4.5,1.3),mtx(x,2.2,z)])]),
 bulk:mergeGeos([[new THREE.BoxGeometry(15,11,13),mtx(0,5.5,0)],[new THREE.BoxGeometry(5,8,1),mtx(0,4,6.8)]]),
 ac:mergeGeos([[new THREE.BoxGeometry(9,4,6),mtx(-7,2,0)],[new THREE.BoxGeometry(7,3.4,5),mtx(3,1.7,1)],[new THREE.BoxGeometry(6,3.4,5),mtx(2,1.7,-5)]]),
 ant:mergeGeos([[new THREE.BoxGeometry(1.1,24,1.1),mtx(0,12,0)],[new THREE.BoxGeometry(3.6,1.2,1.2),mtx(0,19,0)],[new THREE.BoxGeometry(3.6,1.2,1.2),mtx(0,23.5,0)]])};
const crownMats={},BLADE=[['PALMETTO LIQUOR','#3dd68c'],['24 HR','#29e6d6'],['DINER','#ff3ea5'],['LAUNDRY','#4aa3ff'],['PAWN','#ffc94a'],['TATTOO','#ff7ad9'],['NOODLES','#ff6b3d'],['MOTEL','#c08bff']],
 bladeMats=BLADE.map(([t,c])=>fadeC(new THREE.MeshBasicMaterial({map:signTex(t,c),side:THREE.DoubleSide}),'color','#ffffff','#8f8f96'));
const roofN={blade:0,parapet:0,clutter:0,crown:0,setback:0,blades:[]};
if(DBG)Object.defineProperties(DBG,{roof:{get:()=>roofN}});
for(const b of buildings){
  if(b.kind==='lm')continue; // landmark solids are drawn by landmarkMeshes
  if(b.kind==='fence'||b.kind==='ctower')continue; // airfield fence and control tower: drawn with the airfield
  const H=b.H,cx=b.x+b.w/2,cz=b.y+b.h/2;
  const put=(geo,mat,x,y,z,ry)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);if(ry)m.rotation.y=ry;scene.add(m);return m};
  if(b.kind==='water'){const w=new THREE.Mesh(new THREE.CircleGeometry(.5,40),new THREE.MeshLambertMaterial({color:'#12506a',emissive:'#0a3346'}));w.rotation.x=-Math.PI/2;w.scale.set(b.w+30,b.h+30,1);w.position.set(cx,1.5,cz);scene.add(w);continue}
  if(b.kind==='house'){
    // a proper suburb house: hip or gable roof, porch on the street side, garage and drive, picket fence, windows all round.
    const hr=seeded((b.x*131+b.y*7717+b.w*29)|0),wood=blam('#8a6a44'),picket=blam('#b9b2c0'),hard=blam('#3a3742');
    const bi=Math.floor(cx/B),bj=Math.floor(cz/B),X0=bi*B+R,Y0=bj*B+R,X1=X0+B-R,Y1=Y0+B-R,
      dN=cz-Y0,dS=Y1-cz,dW=cx-X0,dE=X1-cx,front=dN<=dS&&dN<=dW&&dN<=dE?[0,-1]:dS<=dW&&dS<=dE?[0,1]:dW<=dE?[-1,0]:[1,0],
      fx=front[0],fz=front[1],edge=fz?(fz<0?dN:dS):(fx<0?dW:dE),sideL=fz?b.w:b.h,half=fz?b.h/2:b.w/2,
      ry=Math.atan2(fx,fz),CM=new THREE.Matrix4().makeRotationY(ry).setPosition(cx,0,cz),
      pc=(geo,mat,lx,ly,lz,rz2)=>{const m=new THREE.Mesh(geo,mat);m.position.set(lx,ly,lz).applyMatrix4(CM);if(rz2)m.rotation.y=ry+rz2;scene.add(m);return m};
    put(new THREE.BoxGeometry(b.w,H,b.h),blam(b.roof),cx,H/2,cz);
    // roof: hip (ridge pulled in) or gable (ridge full length), ridge along the longer axis
    const over=1.8,W2=b.w/2+over,D2=b.h/2+over,rise=9+hr()*4,alongX=W2>=D2,gable=hr()<.4,
      ins=gable?0:Math.min((alongX?W2:D2)*.35,16),rg=hipGeo(alongX?W2:D2,alongX?D2:W2,rise,ins,alongX);
    const rm=new THREE.Mesh(rg,blam(b.trim,{flatShading:true}));rm.position.set(cx,H,cz);scene.add(rm);
    // porch: slab, steps, two posts and a small roof over the front door
    pc(new THREE.BoxGeometry(18,1.4,8),wood,0,1.6,half+4);pc(new THREE.BoxGeometry(12,1.4,4),wood,0,.8,half+9);
    pc(new THREE.BoxGeometry(1.2,12,1.2),wood,-7,7,half+7.5);pc(new THREE.BoxGeometry(1.2,12,1.2),wood,7,7,half+7.5);
    pc(new THREE.BoxGeometry(20,1.2,9),blam(b.trim),0,14,half+4.5);
    // garage to one side with a door and a drive to the kerb
    const gs=hr()<.5?-1:1,gx=gs*(sideL/2+13);
    pc(new THREE.BoxGeometry(18,14,20),blam(b.roof),gx,7,2);pc(new THREE.BoxGeometry(13,11,1),hard,gx,5.6,12.2);
    {const d0=13,el=Math.max(d0+6,edge),len=el-d0;pc(new THREE.BoxGeometry(9,.16,len),hard,gx,1.32,d0+len/2)}
    // windows on all four faces (local frame: +z is the front, so the front-axis half is fHalf, the side half is sHalf)
    {const fHalf=half,sHalf=fz?b.w/2:b.h/2;
     for(const[ox,oz]of[[0,-1],[0,1],[-1,0],[1,0]]){
      const across=oz?sHalf:fHalf,n=across>30?2:1;
      for(const yy of[9,16.5])for(let i=0;i<n;i++){const u=(i-(n-1)/2)*across*1.1;
        if(oz)pc(new THREE.PlaneGeometry(11,9),winMat,u,yy,oz*(fHalf+.3));
        else pc(new THREE.PlaneGeometry(11,9),winMat,ox*(sHalf+.3),yy,u,ox*Math.PI/2)}}}
    pc(new THREE.PlaneGeometry(9,14),doorMat,0,7,half+.3);
    // picket fence along the front yard, gate at the porch and a gap at the drive
    {const fy=edge-26,kx=-sideL/2+6,ex=sideL/2-6,runs=[[kx,Math.min(0,gx)-6],[Math.min(0,gx)+6,Math.max(0,gx)-6],[Math.max(0,gx)+6,ex]];
     for(const[a,b2]of runs){const len=b2-a;if(len<10)continue;
       pc(new THREE.BoxGeometry(len,2.6,.8),picket,(a+b2)/2,2.6,fy);
       for(let u=a+2;u<b2-1;u+=9)pc(new THREE.BoxGeometry(1.1,4.4,1.1),picket,u,2.6,fy)}}
    continue}
  if(b.kind==='container'){put(new THREE.BoxGeometry(b.w,H,b.h),blam(b.roof),cx,H/2,cz);for(let x=-b.w/2+6;x<b.w/2;x+=8)put(new THREE.BoxGeometry(1.2,H-2,b.h+.6),blam(shade(b.roof,.7)),cx+x,H/2,cz);continue}
  if(b.kind==='shack'){put(new THREE.BoxGeometry(b.w,H,b.h),blam(b.roof),cx,H/2,cz);put(new THREE.BoxGeometry(b.w+10,2,18),blam('#ff3ea5'),cx,H-2,b.y+b.h+8);put(new THREE.PlaneGeometry(b.w*.6,8),winMat,cx,H*.5,b.y+b.h+.3);continue}
  if(b.kind==='warehouse'){const g=new THREE.BoxGeometry(b.w,H,b.h);boxUV(g,b.w,H,b.h);
    put(g,facMat('ind',facPick(b)),cx,H/2,cz);put(new THREE.PlaneGeometry(50,30),doorMat,cx+b.w*.2,15,b.y+b.h+.3);
    put(new THREE.BoxGeometry(b.w+1,1.5,b.h+1),blam('#ffc94a'),cx,H,cz);continue}
  if(b.kind==='brick'){
    // Low Palms: the footprint becomes a row of two to four row houses, stoops on the street side, windows all round,
    // a mural on a blind end and a corner store in some runs. The footprint itself does not move, so block edges stay open.
    const hr=seeded((b.x*17+b.y*131+b.w*7)|0),alongX=b.w>=b.h,len=alongX?b.w:b.h,dep=alongX?b.h:b.w,
      n=clamp(Math.round(len/34),2,4),uw=len/n,fc=facMat('brick',facPick(b)),
      bi=Math.floor(cx/B),bj=Math.floor(cz/B),X0=bi*B+R,Y0=bj*B+R,X1=X0+B-R,Y1=Y0+B-R,
      dN=cz-Y0,dS=Y1-cz,dW=cx-X0,dE=X1-cx,front=dN<=dS&&dN<=dW&&dN<=dE?[0,-1]:dS<=dW&&dS<=dE?[0,1]:dW<=dE?[-1,0]:[1,0],
      fx=front[0],fz=front[1],store=hr()<.34;
    for(let i=0;i<n;i++){
      const u=(i+.5)*uw-len/2,uh=H*(.82+hr()*.3),x=cx+(alongX?u:0),z=cz+(alongX?0:u),
        gw=alongX?uw-.5:dep,gd=alongX?dep:uw-.5,g=new THREE.BoxGeometry(gw,uh,gd);boxUV(g,gw,uh,gd);
      put(g,fc,x,uh/2,z);put(roofBox(gw+1,1.3,gd+1),roofMat,x,uh+.65,z);
      // windows: two per floor on the long faces, one on the ends
      for(const sgn of[-1,1])for(const fy of[.5,.76]){
        if(alongX){put(new THREE.PlaneGeometry(8,7),winMat,x,uh*fy,cz+sgn*(dep/2+.3))}
        else{const wm=new THREE.Mesh(new THREE.PlaneGeometry(8,7),winMat);wm.position.set(cx+sgn*(dep/2+.3),uh*fy,z);wm.rotation.y=sgn*Math.PI/2;scene.add(wm)}}
      // stoop on the street side of every unit
      const sx=cx+(alongX?u:0)+fx*(dep/2+.9),sz=cz+(alongX?0:u)+fz*(dep/2+.9);
      put(new THREE.BoxGeometry(fz?11:2.6,2.6,fz?2.6:11),blam('#6a5a4a'),sx,1.3,sz);
      // corner store: a shutter, a canopy and a sign on the first unit
      if(store&&i===0){const mv=(fx||fz)*(dep/2+.35),mx=cx+(alongX?u:0)+(fx?mv:0),mz=cz+(alongX?0:u)+(fz?mv:0),
        ry2=fz?(fz>0?0:Math.PI):(fx>0?Math.PI/2:-Math.PI/2);
        put(new THREE.BoxGeometry(fz?18:14,.4,fz?14:18),blam('#3a3742'),mx,3.4,mz);
        const sh=new THREE.Mesh(new THREE.PlaneGeometry(12,8),blam('#2e2b36'));sh.position.set(mx+(fz?0:fx*.4),5,mz+(fz?fz*.4:0));sh.rotation.y=ry2;scene.add(sh);
        const cn=new THREE.Mesh(new THREE.BoxGeometry(fz?20:8,.8,fz?8:20),blam('#c0283c'));cn.position.set(mx+(fz?0:fx*2.6),9.4,mz+fz*2.6);scene.add(cn);
        const sg=new THREE.Mesh(new THREE.PlaneGeometry(15,3.6),new THREE.MeshBasicMaterial({map:signTex(['SNACK & GO','LIQUOR','DELI'][hr()<.5?0:hr()<.5?1:2],'#ffc94a')}));sg.position.set(mx+(fz?0:fx*.5),12.4,mz+(fz?fz*.5:0));sg.rotation.y=ry2;scene.add(sg)}}
    // mural on the face away from the street
    {const g=(b.graffiti>=0?b.graffiti:hr()<.5?3:4),matt=graffMats[g],wdt=Math.min(64,len*.7),
      mvx=cx-fx*(dep/2+.35),mvz=cz-fz*(dep/2+.35),ry3=fz?(fz>0?Math.PI:0):(fx>0?-Math.PI/2:Math.PI/2),
      mp=new THREE.Mesh(new THREE.PlaneGeometry(wdt,17),matt);mp.position.set(mvx,9,mvz);mp.rotation.y=ry3;scene.add(mp)}
    continue}
  if(b.kind==='bank'){const gm=fade(new THREE.MeshLambertMaterial({color:'#d4aa4c',map:wallTex,emissive:new THREE.Color('#ffffff'),emissiveMap:litTex}),'emissiveIntensity',1,.3),gold=new THREE.MeshBasicMaterial({color:'#ffc94a'});
    const tiers=[[1,0,.62],[.78,.62,.26],[.5,.88,.12]];
    for(const[sc,y0,hh]of tiers){const w=b.w*sc,dd=b.h*sc,hgt=H*hh,g=new THREE.BoxGeometry(w,hgt,dd);boxUV(g,w,hgt,dd);put(g,gm,cx,H*y0+hgt/2,cz);put(new THREE.BoxGeometry(w+3,3,dd+3),gold,cx,H*(y0+hh),cz)}
    put(new THREE.CylinderGeometry(1.5,3.5,140,6),capMat,cx,H+70,cz);put(new THREE.BoxGeometry(5,5,5),redLight,cx,H+142,cz);
    const st=signTex('Union Bank','#ffc94a'),sm=new THREE.MeshBasicMaterial({map:st});
    for(const[ox,oz,ry]of[[0,b.h*.39+.8,0],[0,-b.h*.39-.8,Math.PI],[b.w*.39+.8,0,Math.PI/2],[-b.w*.39-.8,0,-Math.PI/2]]){const pl=new THREE.Mesh(new THREE.PlaneGeometry(150,38),sm);pl.position.set(cx+ox,H*.72,cz+oz);pl.rotation.y=ry;scene.add(pl)}
    const gl=new THREE.Mesh(new THREE.PlaneGeometry(1,1),additive(glowTex('rgba(255,201,74,.35)')));gl.rotation.x=-Math.PI/2;gl.scale.set(b.w*1.6,b.h*1.6,1);gl.position.set(cx,1.8,cz);scene.add(gl);
    continue}
  const glass=b.kind==='glass',fv=facPick(b),ft=glass?'glass':(b.x*7+b.y)%3<1?'brick':'stucco';
  const br=seeded((b.x*197+b.y*73+b.w*31+b.h*7)|0),setback=glass&&H>140&&!b.ladder,rw=setback?b.w-14:b.w,rh=setback?b.h-14:b.h;
  if(setback){roofN.setback++;const g0=new THREE.BoxGeometry(b.w,34,b.h);boxUV(g0,b.w,34,b.h,...tileOf(b));put(g0,facMat(ft,fv),cx,17,cz);
   const g1=new THREE.BoxGeometry(rw,H-34,rh);boxUV(g1,rw,H-34,rh,...tileOf(b));put(g1,facMat(ft,fv),cx,34+(H-34)/2,cz)}
  else{const geo=new THREE.BoxGeometry(b.w,H,b.h);boxUV(geo,b.w,H,b.h,...tileOf(b));put(geo,facMat(ft,fv),cx,H/2,cz)}
  shopfronts(b,fv);
  const tm=trimMats[b.trim]||(trimMats[b.trim]=new THREE.MeshBasicMaterial({color:b.trim}));
  put(new THREE.BoxGeometry(b.w+1.6,2.4,b.h+1.6),tm,cx,H,cz);
  put(roofBox(rw-3,1.4,rh-3),roofMat,cx,H+.9,cz);
  if(br()<.75){roofN.parapet++;put(new THREE.BoxGeometry(rw+1.2,1.5,1.4),tm,cx,H+.75,cz-(rh/2-.7));put(new THREE.BoxGeometry(rw+1.2,1.5,1.4),tm,cx,H+.75,cz+(rh/2-.7));
   put(new THREE.BoxGeometry(1.4,1.5,rh-1.4),tm,cx-(rw/2-.7),H+.75,cz);put(new THREE.BoxGeometry(1.4,1.5,rh-1.4),tm,cx+(rw/2-.7),H+.75,cz)}
  if(rw>50&&rh>50&&br()<.5){roofN.clutter++;const t=['tank','bulk','ac','ant'][Math.floor(br()*4)];
   put(roofG[t],capMat,cx+(br()-.5)*Math.max(8,rw-46),H+.1,cz+(br()-.5)*Math.max(8,rh-46))}
  if(H>200){roofN.crown++;const cm=crownMats[b.trim]||(crownMats[b.trim]=fadeC(new THREE.MeshBasicMaterial({color:b.trim}),'color',b.trim,shade(b.trim,.5)));
   put(new THREE.BoxGeometry(rw+1.6,2.2,1.2),cm,cx,H-1.1,cz-(rh/2+.1));put(new THREE.BoxGeometry(rw+1.6,2.2,1.2),cm,cx,H-1.1,cz+(rh/2+.1));
   put(new THREE.BoxGeometry(1.2,2.2,rh+1.6),cm,cx-(rw/2+.1),H-1.1,cz);put(new THREE.BoxGeometry(1.2,2.2,rh+1.6),cm,cx+(rw/2+.1),H-1.1,cz)}
  if(b.sign)put(new THREE.BoxGeometry(Math.min(60,b.w*.6),7,1),tm,cx,30,b.y+b.h+.6);
  if(b.vent)put(new THREE.BoxGeometry(Math.min(26,b.w*.3),8,Math.min(18,b.h*.25)),capMat,b.x+b.w*(b.vent[0]+.1),H+5,b.y+b.h*(b.vent[1]+.1));
  if(glass&&H>240){put(new THREE.CylinderGeometry(1,1.6,60,6),capMat,cx,H+30,cz);put(new THREE.BoxGeometry(3,3,3),redLight,cx,H+61,cz)}
  if(b.kind!=='brick'&&(b.sign||br()<.55)){ // a blade sign on the face that fronts a street
   const bx=Math.floor(cx/B),bz=Math.floor(cz/B),x0=bx*B+R,y0=bz*B+R,x1=(bx+1)*B,y1=(bz+1)*B,faces=[];
   for(const f of[[b.x,b.y+b.h/2,-1,0,b.h,b.x-x0],[b.x+b.w,b.y+b.h/2,1,0,b.h,x1-b.x-b.w],[b.x+b.w/2,b.y,0,-1,b.w,b.y-y0],[b.x+b.w/2,b.y+b.h,0,1,b.w,y1-b.y-b.h]])
    if(f[5]<30&&f[4]>=28)faces.push(f);
   if(faces.length){roofN.blade++;const f=faces[Math.floor(br()*faces.length)],mat=bladeMats[Math.floor(br()*bladeMats.length)],w=Math.min(9,f[4]*.35);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,4.4),mat);m.position.set(f[0]+f[2]*4.9,18.5,f[1]+f[3]*4.9);if(f[2]!==0)m.rotation.y=Math.PI/2;scene.add(m);
    if(roofN.blades.length<12)roofN.blades.push([Math.round(m.position.x),Math.round(m.position.z),f[2]!==0?1:0,f[0],f[1]])}}
}
// Rustwater Docks dressing on the industrial blocks: silos, pipe racks, a gantry crane, floodlight masts,
// a decorative rail spur along the kerb of the north blocks, and puddles between the stacks.
{const siloG=mergeGeos([[new THREE.CylinderGeometry(11,11,44,12),mtx(0,22,0)],[new THREE.ConeGeometry(11,9,12),mtx(0,48,0)]]),
  mastG=mergeGeos([[new THREE.CylinderGeometry(.5,.8,30,6),mtx(0,15,0)],[new THREE.BoxGeometry(7,2.4,2.4),mtx(0,30,0)]]),
  A=[],B2=[],C=[],D=[],
  push=(L,g,x,y,z,ry)=>L.push([g,new THREE.Matrix4().makeRotationY(ry||0).setPosition(x,y,z)]);
 for(let bj=0;bj<N;bj++)for(let bi=0;bi<N;bi++){if(blockType[bj*N+bi]!=='industrial')continue;
  const x0=bi*B+R,y0=bj*B+R,s=B-R,dr=seeded(bi*97+bj*61+13);
  if((bi+bj)%3===0)for(let k=0;k<3;k++)push(A,siloG,x0+s-46-k*24,1.25,y0+60);
  if(dr()<.5){const ry=y0+s-42,xa=x0+30,xb=x0+s-30,mid=(xa+xb)/2,len=xb-xa;
   for(const y of[8,14])push(A,new THREE.BoxGeometry(len,1.6,2.4),mid,y,ry);
   for(let u=xa+10;u<xb;u+=34){push(A,new THREE.BoxGeometry(1.6,16,1.6),u,8.5,ry);push(A,new THREE.BoxGeometry(1.6,10,1.6),u,5.5,ry+9)}}
  if(dr()<.28){const gx=x0+70,gy=y0+170;
   for(const dx of[-26,26])for(const dz of[-14,14])push(C,new THREE.BoxGeometry(3,32,3),gx+dx,17,gy+dz);
   push(C,new THREE.BoxGeometry(80,4,4),gx,34,gy-14);push(C,new THREE.BoxGeometry(80,4,4),gx,34,gy+14);
   push(C,new THREE.BoxGeometry(10,6,8),gx,28,gy)}
  push(C,mastG,x0+22,1.25,y0+s-22);push(C,new THREE.BoxGeometry(7,2.2,2.4),x0+22,31.2,y0+s-22);
  if(bj<=3&&!DOORS.some(d=>Math.abs(d.x-(x0+8))<60&&d.y>y0-40&&d.y<y0+s+40)){
   const rx=x0+8,yb=y0+22,ye=y0+s-22,ln=ye-yb;
   push(B2,new THREE.BoxGeometry(7,.3,ln),rx,1.12,(yb+ye)/2);
   for(const o of[-1.6,1.6])push(A,new THREE.BoxGeometry(.7,.3,ln),rx+o,1.3,(yb+ye)/2);
   for(let u=yb+3;u<ye-2;u+=5)push(C,new THREE.BoxGeometry(4.4,.35,1.2),rx,1.2,u);
   push(C,new THREE.BoxGeometry(5,3,3),rx,2.8,ye)}
  for(let k=0;k<5;k++){const px=x0+30+dr()*(s-60),py=y0+30+dr()*(s-60);D.push([px,py,7+dr()*15,4+dr()*8])}}
 if(A.length)scene.add(new THREE.Mesh(mergeGeos(A),blam('#5a5a60')));
 if(B2.length)scene.add(new THREE.Mesh(mergeGeos(B2),blam('#57544a')));
 if(C.length)scene.add(new THREE.Mesh(mergeGeos(C),blam('#3a3742')));
 if(D.length){const pg=new THREE.CircleGeometry(1,14).rotateX(-Math.PI/2),pl=[];
  for(const[x,y,rx,ry]of D)pl.push([pg,new THREE.Matrix4().makeScale(rx,1,ry).setPosition(x,1.31,y)]);
  scene.add(new THREE.Mesh(mergeGeos(pl),new THREE.MeshBasicMaterial({color:'#2a3140'})))}}
{const T_=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z),BM={},bmat=c=>BM[c]||(BM[c]=new THREE.MeshLambertMaterial({color:c})),huts=[],tows=[],nets=[],boats=[],parts=[],
 push=(L,g,c,x,y,z,ry)=>L.push([g,bmat(c),new THREE.Matrix4().makeRotationY(ry||0).setPosition(x,y,z)]),
 cabinG=mergeGeos([[new THREE.BoxGeometry(13,9,11),T_(0,0,0)],[new THREE.BoxGeometry(15,1.2,13),T_(0,5,0)]]),
 legG=new THREE.BoxGeometry(1.1,11,1.1),netG=mergeGeos([[new THREE.BoxGeometry(.6,9,.6),T_(0,4.5,0)]]),
 hullG=mergeGeos([[new THREE.BoxGeometry(11,3.4,4.4),T_(0,1.7,0)],[new THREE.BoxGeometry(11.6,.8,5),T_(0,3.5,0)]]),
 flagG=mergeGeos([[new THREE.BoxGeometry(4,2.6,.2),T_(2,1.3,0)]]);
 for(let bj=0;bj<N;bj++)for(let bi=0;bi<N;bi++){if(blockType[bj*N+bi]!=='beach')continue;
  const x0=bi*B+R,y0=bj*B+R,s=B-R,dr=seeded(bi*37+bj*19+5);
  for(let k=0;k<(2+Math.round(dr()*2));k++){const hx=x0+40+dr()*(s-80),hy=y0+60+dr()*(s-140),ry2=dr()*TAU;
   if(rampZone(hx,hy)||DOORS.some(d=>Math.hypot(d.x-hx,d.y-hy)<24))continue;
   push(huts,cabinG,['#e8b4c8','#b4d8e8','#f1e3a8'][Math.floor(dr()*3)],hx,5,hy,ry2);
   push(huts,new THREE.BoxGeometry(3.4,7.4,.4),'#3a3742',hx,3.6,hy+5.6,ry2);
   push(huts,new THREE.BoxGeometry(6,1,.9),'#ff3ea5',hx+2.6,10.2,hy+5.4,ry2)}
  if((bi+bj)%3===0){const hx=x0+s-40,hy=y0+60;
   for(const[dx,dz]of[[-5,-4],[5,-4],[-5,4],[5,4]])push(tows,legG,'#8a6a44',hx+dx,7,hy+dz);
   push(tows,cabinG,'#f1e3a8',hx,13.5,hy);
   push(tows,new THREE.BoxGeometry(9,1,1),'#8a6a44',hx,9.5,hy+8,0);
   push(tows,flagG,'#ff3ea5',hx+6,18,hy)}
  if(dr()<.5){const nx=x0+s/2+dr()*20-10,ny=y0+s/2-10;
   if(!rampZone(nx,ny)){const nm=new THREE.Mesh(new THREE.PlaneGeometry(26,3.2),chainMat);
    nm.position.set(nx,7,ny);nm.rotation.y=Math.PI/2;scene.add(nm);
    push(nets,netG,'#c9c3d6',nx,0,ny-13);push(nets,netG,'#c9c3d6',nx,0,ny+13)}}
  if(dr()<.5)push(boats,hullG,['#d23c5a','#4aa3ff','#e8e4f0'][Math.floor(dr()*3)],x0+70+dr()*80,y0+s-70,dr()*TAU)}
 const build=(L)=>{if(!L.length)return;const byMat=new Map();
  for(const[g,m,mx]of L){const k=m.uuid;let a=byMat.get(k);if(!a){a={m,list:[]};byMat.set(k,a)}a.list.push([g,mx])}
  for(const{m,list}of byMat.values())scene.add(new THREE.Mesh(mergeGeos(list),m))};
 build(huts);build(tows);build(nets);build(boats);
 // foam at the waterline and a pale shallow band over the sea bed
 const foam=(z,w,op)=>{const f=new THREE.Mesh(new THREE.BoxGeometry(W+600,.5,w),new THREE.MeshBasicMaterial({color:'#e8f8ff',transparent:true,opacity:op}));
  f.position.set(W/2,-.35,z);scene.add(f)};
 foam(W+320,4,.5);foam(W+300,10,.22);
 const shal=new THREE.Mesh(new THREE.PlaneGeometry(1,1),fade(additive(glowTex('rgba(62,166,200,.5)')),'opacity',.7,.25));
 shal.rotation.x=-Math.PI/2;shal.scale.set(W+700,320,1);shal.position.set(W/2,-2.5,W+430);scene.add(shal)}
// Lagoon Park: a path loop on every park block, pond stones, reeds and a lamp, a gazebo, a playground,
// flowerbeds and hedges along the street sides.
{const T_=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z),BM={},bmat=c=>BM[c]||(BM[c]=new THREE.MeshLambertMaterial({color:c})),
  A=[],B=[],push=(L,g,c,x,y,z,ry)=>L.push([g,bmat(c),new THREE.Matrix4().makeRotationY(ry||0).setPosition(x,y,z)]);
 const paths=(x0,y0,s)=>{const p=60,q=4;
  for(const[a,b2,c,d]of[[x0+p,y0+p,x0+s-p,y0+p],[x0+s-p,y0+p,x0+s-p,y0+s-p],[x0+s-p,y0+s-p,x0+p,y0+s-p],[x0+p,y0+s-p,x0+p,y0+p]])scene.add(footpath(a,b2,c,d,q))};
 parks.forEach((pk,i)=>{const{x,y,s}=pk,cr=seeded(Math.round(x*3+y*7)|0);
  paths(x,y,s);
  // flowerbeds with a stone rim
  for(let k=0;k<3;k++){const bx=x+70+cr()*(s-140),by=y+70+cr()*(s-140);
   if(Math.hypot(bx-(x+s/2),by-(y+s/2))<70)continue;
   push(A,new THREE.BoxGeometry(16,1.6,7),'#6a655c',bx,groundZ(bx,by)+1.1,by);
   push(A,new THREE.BoxGeometry(13,.8,4.4),['#c94a6a','#c9a24a','#7b6bff'][Math.floor(cr()*3)],bx,groundZ(bx,by)+1.7,by);
   for(let d2=0;d2<4;d2++)push(A,new THREE.IcosahedronGeometry(1,0),'#2a7a4c',bx-4.5+d2*3,groundZ(bx,by)+2.4,by+(cr()-.5)*2)}
  // hedges along the north and west sides with a gap at the paths
  for(const[side]of[[0],[1]]){const hx=side?x+6:x+s/2,hz=side?y+s/2:y+6;
   for(const seg of[-1,1]){const len=s/2-70;
    push(A,new THREE.BoxGeometry(side?3.4:len,3.4,side?len:3.4),'#2a6a3a',side?hx:x+s/4+seg*(s/4-20),groundZ(hx,hz)+2.9,side?y+s/4+seg*(s/4-20):hz)}}});
 // pond: stones, reeds, benches and a lamp on the block that holds the water
 {const pk=parks.find(p=>p.x===4*B+R&&p.y===R);if(pk){const cx=pk.x+pk.s/2,cy=pk.y+pk.s/2,r0=(pk.s-100)/2;
   for(let k=0;k<26;k++){const a=k/26*TAU,q=2.6+((k*7)%5)*.5,px=cx+Math.cos(a)*(r0+q*.6),py=cy+Math.sin(a)*(r0+q*.6);
    push(A,new THREE.IcosahedronGeometry(q*.9,0),'#6e655c',px,groundZ(px,py)+q*.4,py)}
   for(const a of[.4,1.6,2.9,4.4]){const px=cx+Math.cos(a)*(r0+8),py=cy+Math.sin(a)*(r0+8);
    for(let k=0;k<4;k++)push(A,new THREE.ConeGeometry(.35,3.4,4),'#4d6b3a',px+(k-1.5)*1.6,groundZ(px,py)+2,py)}
   for(const sx of[-1,1])push(A,new THREE.BoxGeometry(14,1.2,4.5),'#5a4030',cx+sx*46,groundZ(cx+sx*46,cy-r0-16)+1.8,cy-r0-16);
   push(A,new THREE.CylinderGeometry(.5,.7,14,6),'#2c2938',cx-r0-8,groundZ(cx-r0-8,cy)+8,cy);
   push(B,new THREE.SphereGeometry(.8,8,6),'#ffdf9e',cx-r0-8,groundZ(cx-r0-8,cy)+15.6,cy)}}
 // gazebo and playground on the two blocks without a mound under them
 {const pk=parks[3];if(pk){const gx=pk.x+pk.s*.62,gy=pk.y+pk.s*.4,gz=groundZ(gx,gy);
   push(A,new THREE.CylinderGeometry(13,13,1.6,8),'#6a655c',gx,gz+1,gz?0+gy:gy);
   for(let k=0;k<8;k++){const a=k/8*TAU;push(A,new THREE.BoxGeometry(1.2,11,1.2),'#8a6a44',gx+Math.cos(a)*11,gz+6.6,gy+Math.sin(a)*11)}
   push(A,new THREE.ConeGeometry(15,7,8),'#5a3328',gx,gz+15.6,gy);
   push(B,new THREE.SphereGeometry(.9,8,6),'#ffdf9e',gx,gz+11.4,gy)}
  const pk2=parks[2];if(pk2){const px=pk2.x+pk2.s-70,py=pk2.y+pk2.s-70,pz=groundZ(px,py);
   push(A,new THREE.CylinderGeometry(26,26,.4,18),'#8a7350',px,pz+.35,py); // sand patch
   for(const sx of[-6,6]){const ax=px+sx,ay=py-8;
    for(const ex of[-4,4]){push(A,new THREE.BoxGeometry(1.2,11,1.2),'#8a8699',ax+ex,pz+5.5,ay+3);push(A,new THREE.BoxGeometry(1.2,11,1.2),'#8a8699',ax+ex,pz+5.5,ay-3)}
    push(A,new THREE.BoxGeometry(.5,.6,7),'#4a4658',ax,pz+9.4,ay);push(A,new THREE.BoxGeometry(3.4,.5,1.6),'#c0283c',ax,pz+6.4,ay)}
   push(A,new THREE.BoxGeometry(4,9,4),'#4aa3ff',px+16,pz+4.5,py+6);push(A,new THREE.BoxGeometry(4,1,9),'#4aa3ff',px+13.5,pz+2.4,py+6);
   for(let k=0;k<4;k++)push(A,new THREE.BoxGeometry(2,1.4,2),'#ffc94a',px+16,pz+1.6+k*2.2,py+6-(k<2?0:0));
   push(A,new THREE.BoxGeometry(14,1.2,14),'#3a3742',px-14,pz+.8,py+10);
   for(const[ox,oz]of[[-19,-6],[9,-6],[9,24],[-19,24]])push(A,new THREE.BoxGeometry(1.4,8,1.4),'#3a3742',px+ox,pz+5,py+oz)}}
 const build=L=>{if(!L.length)return;const by=new Map();for(const[g,m,mx]of L){let a=by.get(m.uuid);if(!a){a={m,list:[]};by.set(m.uuid,a)}a.list.push([g,mx])}
  for(const{m,list}of by.values())scene.add(new THREE.Mesh(mergeGeos(list),m))};
 build(A);build(B)}

// Low Palms lot lines: chain-link runs along the back lines between the row-house yards, with posts
{const cl=[];
 for(let bj=0;bj<N;bj++)for(let bi=0;bi<N;bi++){if(blockType[bj*N+bi]!=='hood')continue;
   const x0=bi*B+R,y0=bj*B+R,s=B-R,m=26,cr=seeded(bi*71+bj*13+3);
   if(cr()<.6){const x=x0+s/2+9,y0b=y0+m,y1b=y0+s-m;cl.push([x,(y0b+y1b)/2,1,y1b-y0b])}
   if(cr()<.6){const y=y0+s/2+9,x0b=x0+m,x1b=x0+s-m;cl.push([(x0b+x1b)/2,y,0,x1b-x0b])}}
 const parts=[];for(const[x,y,vert,len]of cl){const g=new THREE.PlaneGeometry(len,6.4);
   const m=new THREE.Mesh(g,chainMat);m.position.set(x,4.75,y);if(vert)m.rotation.y=Math.PI/2;scene.add(m);
   for(let u=-len/2;u<=len/2;u+=Math.max(8,len/10)){const px=vert?x:x+u,py=vert?y+u:y;
     parts.push([chainPost,new THREE.Matrix4().makeTranslation(px,1.55,py)])}}
 if(parts.length)scene.add(new THREE.Mesh(mergeGeos(parts),new THREE.MeshLambertMaterial({color:'#8a8699'})))}
landmarkMeshes(); // after graffMats
// ladders
{const rail=new THREE.MeshLambertMaterial({color:'#a7a1ba'}),rungs=[];
 for(const b of ladders){const L=b.ladder,z=b.y+b.h+1.6;for(const dx of[-5,5]){const m=new THREE.Mesh(new THREE.BoxGeometry(1,b.H+5,1),rail);m.position.set(L.x+dx,(b.H+5)/2,z);scene.add(m)}for(let y=6;y<b.H+2;y+=8)rungs.push([L.x,y,z])}
 const rm=new THREE.InstancedMesh(new THREE.BoxGeometry(10,.8,.8),rail,Math.max(1,rungs.length));rungs.forEach(([x,y,z],i)=>inst(rm,i,x,y,z,0));rm.count=rungs.length;scene.add(rm);
 const mk=new THREE.InstancedMesh(new THREE.RingGeometry(6,8,20),new THREE.MeshBasicMaterial({color:'#a7a1ba',side:THREE.DoubleSide}),Math.max(1,ladders.length));ladders.forEach((b,i)=>inst(mk,i,b.ladder.x,1.6,b.ladder.base,0,1,1,1,-Math.PI/2));mk.count=ladders.length;scene.add(mk);}
// Low Palms decor: burning barrels and a basketball court
const fireGlows=[];
{const bm=new THREE.MeshLambertMaterial({color:'#4a4038'}),bg=new THREE.CylinderGeometry(3.4,3.4,10,10);
 for(const[x,y]of barrels){const m=new THREE.Mesh(bg,bm);m.position.set(x,5,y);scene.add(m);const f=new THREE.Mesh(new THREE.PlaneGeometry(1,1),additive(glowTex('rgba(255,120,40,.9)')));f.rotation.x=-Math.PI/2;f.position.set(x,10.5,y);f.userData.s=26;f.scale.set(26,26,1);scene.add(f);fireGlows.push(f);
   const gl=new THREE.Mesh(new THREE.PlaneGeometry(1,1),additive(glowTex('rgba(255,140,50,.5)')));gl.rotation.x=-Math.PI/2;gl.position.set(x,1.5,y);gl.userData.s=110;gl.scale.set(110,110,1);scene.add(gl);fireGlows.push(gl)}
 for(const[x0,y0,sz]of courts){const ct=new THREE.Mesh(new THREE.PlaneGeometry(sz-50,sz-90),new THREE.MeshLambertMaterial({color:'#3a5a8a'}));ct.rotation.x=-Math.PI/2;ct.position.set(x0+sz/2,1.3,y0+sz/2-10);scene.add(ct);
   const mid=new THREE.Mesh(new THREE.BoxGeometry(sz-50,.2,1.2),new THREE.MeshBasicMaterial({color:'#e8e4f0'}));mid.position.set(x0+sz/2,1.5,y0+sz/2-10);scene.add(mid);
   for(const sx of[-1,1]){const px=x0+sz/2+sx*(sz/2-34),py=y0+sz/2-10;const pole=new THREE.Mesh(new THREE.CylinderGeometry(1,1,34,8),capMat);pole.position.set(px+sx*6,17,py);scene.add(pole);
     const bb=new THREE.Mesh(new THREE.BoxGeometry(1,12,18),new THREE.MeshLambertMaterial({color:'#e8e4f0'}));bb.position.set(px,32,py);scene.add(bb);
     const rim=new THREE.Mesh(new THREE.TorusGeometry(4,.5,6,16),new THREE.MeshBasicMaterial({color:'#ff6b3d'}));rim.rotation.x=Math.PI/2;rim.position.set(px-sx*4.5,28,py);scene.add(rim)}
    // court surround: chain-link on all four sides with gates east and west, a mural wall behind the north hoop, benches
    {const ccx=x0+sz/2,ccy=y0+sz/2-10,hw=145,hd=125,posts=[];
     const run=(x,z,w,vert)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,6.8),chainMat);m.position.set(x,4.9,z);if(vert)m.rotation.y=Math.PI/2;scene.add(m);
       for(let u=-w/2;u<=w/2;u+=Math.max(8,w/12)){const px2=vert?x:x+u,pz2=vert?z+u:z;posts.push([chainPost,new THREE.Matrix4().makeTranslation(px2,1.75,pz2)])}};
     run(ccx,ccy-hd,hw*2,false);run(ccx,ccy+hd,hw*2,false);
     for(const sx of[-1,1])for(const seg of[-1,1]){const z0=ccy+seg*(15+ (hd-15)/2);run(ccx+sx*hw,z0,hd-15,true)}
     scene.add(new THREE.Mesh(mergeGeos(posts),new THREE.MeshLambertMaterial({color:'#8a8699'})));
     const wall=new THREE.Mesh(new THREE.BoxGeometry(64,9,2.4),blam('#5a4a44'));wall.position.set(ccx,5.7,ccy-hd-2.4);scene.add(wall);
     const gg=new THREE.Mesh(new THREE.PlaneGeometry(60,8.4),graffMats[1]);gg.position.set(ccx,5.7,ccy-hd-1.1);scene.add(gg);
     for(const sx of[-1,1]){const bn=new THREE.Mesh(new THREE.BoxGeometry(14,1.2,4.5),blam('#5a4030'));bn.position.set(ccx+sx*60,2.6,ccy-hd-5);scene.add(bn)}}}}
// landscape: beach, pier, ferris wheel, palms, pools, cranes, mountains
let ferris=null;
{const sand=new THREE.Mesh(uvScale(new THREE.PlaneGeometry(W+600,300),(W+600)/IN,300/IN),new THREE.MeshLambertMaterial({map:sandTex}));sand.rotation.x=-Math.PI/2;sand.position.set(W/2,-.5,W+150);scene.add(sand);
 const surf=new THREE.Mesh(new THREE.BoxGeometry(W+600,.6,5),new THREE.MeshBasicMaterial({color:'#bfeaf5',transparent:true,opacity:.55}));surf.position.set(W/2,-.4,W+300);scene.add(surf);
 const plank=new THREE.MeshLambertMaterial({color:'#5a4030'});
 ferris=new THREE.Group();ferris.position.set(2100,140,4700);
 const rimMat=new THREE.MeshBasicMaterial({color:'#ff3ea5'}),spokeMat=new THREE.MeshBasicMaterial({color:'#29e6d6'});
 ferris.add(new THREE.Mesh(new THREE.TorusGeometry(115,2.5,8,48),rimMat));
 const spk=[],cabs=[[],[],[]],I=new THREE.Matrix4();for(let i=0;i<12;i++){const a=i/12*TAU;spk.push([new THREE.BoxGeometry(230,1.2,1.2).rotateZ(a),I]);cabs[i%3].push([new THREE.BoxGeometry(12,12,10).translate(Math.cos(a)*115,Math.sin(a)*115,0),I])}
 ferris.add(new THREE.Mesh(mergeGeos(spk),spokeMat));cabs.forEach((l,k)=>ferris.add(new THREE.Mesh(mergeGeos(l),new THREE.MeshBasicMaterial({color:['#ffc94a','#7b6bff','#3dd68c'][k]}))));
 scene.add(ferris);for(const dx of[-40,40]){const leg=new THREE.Mesh(new THREE.BoxGeometry(4,150,4),plank);leg.position.set(2100+dx,70,4700);leg.rotation.z=dx>0?-.25:.25;scene.add(leg)}
 const fg=new THREE.Mesh(new THREE.PlaneGeometry(1,1),fade(additive(glowTex('rgba(255,62,165,.4)')),'opacity',1,.3));fg.scale.set(240,240,1);fg.position.set(2100,140,4690);scene.add(fg);
 // palms
 const trunkG=new THREE.CylinderGeometry(1.4,2.4,1,6),trunk=new THREE.InstancedMesh(trunkG,new THREE.MeshLambertMaterial({color:'#6b4a32'}),Math.max(1,palms.length)),frond=new THREE.InstancedMesh(new THREE.BoxGeometry(24,1,6),new THREE.MeshLambertMaterial({color:'#2f8a4e'}),Math.max(1,palms.length*6));
 palms.forEach(([x,y,rot],i)=>{const h=44;inst(trunk,i,x,h/2,y,0,1,h,1);for(let k=0;k<6;k++){const a=rot+k/6*TAU;dummy.position.set(x+Math.cos(a)*10,h-2,y+Math.sin(a)*10);dummy.rotation.set(0,-a,-.45);dummy.scale.set(1,1,1);dummy.updateMatrix();frond.setMatrixAt(i*6+k,dummy.matrix)}});
 trunk.count=palms.length;frond.count=palms.length*6;scene.add(trunk,frond);
 // umbrellas
 for(const[x,y,c]of umbrellas){const u=new THREE.Mesh(new THREE.ConeGeometry(14,5,8),new THREE.MeshLambertMaterial({color:c}));u.position.set(x,20,y);scene.add(u);const p=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,20,4),M0());p.position.set(x,10,y);scene.add(p);const t=new THREE.Mesh(new THREE.BoxGeometry(10,1,20),new THREE.MeshLambertMaterial({color:'#f3ecff'}));t.position.set(x+12,1.6,y+4);scene.add(t)}
 function M0(){return new THREE.MeshLambertMaterial({color:'#d9d4e6'})}
 // pools
 const poolMat=new THREE.MeshBasicMaterial({color:'#2bb8e6'});for(const p of pools){const m=new THREE.Mesh(new THREE.PlaneGeometry(p.w,p.h),poolMat);m.rotation.x=-Math.PI/2;m.position.set(p.x+p.w/2,1.5,p.y+p.h/2);scene.add(m);const gl=new THREE.Mesh(new THREE.PlaneGeometry(1,1),fade(additive(glowTex('rgba(43,184,230,.45)')),'opacity',1,.4));gl.rotation.x=-Math.PI/2;gl.scale.set(90,70,1);gl.position.set(p.x+p.w/2,1.6,p.y+p.h/2);scene.add(gl)}
 // cranes
 const yel=new THREE.MeshLambertMaterial({color:'#e0a92a'});for(const[x,y]of cranes){const t=new THREE.Mesh(new THREE.BoxGeometry(7,150,7),yel);t.position.set(x,75,y);scene.add(t);const arm=new THREE.Mesh(new THREE.BoxGeometry(6,5,150),yel);arm.position.set(x,148,y-40);scene.add(arm);const l=new THREE.Mesh(new THREE.BoxGeometry(4,4,4),redLight);l.position.set(x,154,y);scene.add(l);const cb=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,60,4),capMat);cb.position.set(x,118,y-100);scene.add(cb)}
 // mountains across the bay to the north and west: flat-shaded cones, dark base, lighter peak and a random tint per cone (vertex colours)
 const mtn=fadeC(new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true,fog:false}),'color','#ffffff','#9aa0b8'),mr=seeded(77);
 const mtnCone=(r0,h,k)=>{const g=new THREE.ConeGeometry(r0,h,9),p=g.attributes.position,a=new Float32Array(p.count*3),s=.85+.3*k;
   for(let i=0;i<p.count;i++){const q=Math.pow((p.getY(i)+h/2)/h,2),tn=.3*q*q;// peaks lean 30% toward a pale sky lavender so the top of the frame stays lit
     a[i*3]=((.082+q*.27)*(1-tn)+.6*tn)*s;a[i*3+1]=((.055+q*.18)*(1-tn)+.42*tn)*s;a[i*3+2]=((.149+q*.39)*(1-tn)+.74*tn)*s*(1+(k-.5)*.2)}
   g.setAttribute('color',new THREE.BufferAttribute(a,3));return g};
 for(let i=0;i<22;i++){const r0=280+mr()*380,h=380+mr()*620,m=new THREE.Mesh(mtnCone(r0,h,mr()),mtn);m.position.set(-1200+i*290+mr()*120,h/2-4,-2700-mr()*900);m.rotation.y=mr()*3;scene.add(m)}
 for(let i=0;i<8;i++){const r0=260+mr()*300,h=300+mr()*400,m=new THREE.Mesh(mtnCone(r0,h,mr()),mtn);m.position.set(-1100-mr()*700,h/2-4,-400+i*520);scene.add(m)}
 // skyline: a ring of low blocks on the water just outside the city edge (the city spans 0 to W). Windows are an emissive map on one
 // shared material, so the whole ring is one draw. No fog on it: at 1300 to 1800 units the fog hid about 90 percent of the ring. The top faces catch a faint pink rim.
 const skyWin=rtex(96,96,(g,w,h)=>{g.fillStyle='#000';g.fillRect(0,0,w,h);const q=w/6,wr=seeded(31);
   for(let j=0;j<6;j++)for(let i=0;i<6;i++)if(wr()<.16){g.fillStyle=WTONE[Math.floor(wr()*6)];g.fillRect(i*q+3,j*q+3,q-6,q-6)}}),
  skyMat=fade(new THREE.MeshLambertMaterial({vertexColors:true,emissive:'#ffffff',emissiveMap:skyWin,fog:false}),'emissiveIntensity',1,.35),sr=seeded(908),skyParts=[];
 const skyBlock=(w,d,h,s)=>{const g=new THREE.BoxGeometry(w,h,d).translate(0,h/2,0),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,a=new Float32Array(p.count*3);
   for(let i=0;i<p.count;i++){const top=n.getY(i)>.5,u=Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i),f=top?[1.8,1.35,1.8]:[1,1,1];
     uv.setXY(i,top?.002:u/24,p.getY(i)/24);for(let c=0;c<3;c++)a[i*3+c]=Math.min(1,[.16,.1,.25][c]*s*f[c])}
   g.setAttribute('color',new THREE.BufferAttribute(a,3));return g};
 for(let side=0;side<4;side++)for(let row=0;row<2;row++)for(let t=-260;t<W+260;t+=50+sr()*40){
   const out=(side===1?340:110)+row*200+sr()*150,along=34+sr()*40,depth=30+sr()*30,h=40+sr()*sr()*200,s=.75+sr()*.5; // south sits past the beach strip and the ferris wheel
   const[x,z]=side===0?[t,-out]:side===1?[t,W+out]:side===2?[-out,t]:[W+out,t],wx=side<2?along:depth,wz=side<2?depth:along;
   if(z<-40)continue; // north of the city is the hills (y below -40): no skyline there
   skyParts.push([skyBlock(wx,wz,h,s),new THREE.Matrix4().makeTranslation(x,-3,z)])}
 scene.add(new THREE.Mesh(mergeGeos(skyParts),skyMat));
 }
// street furniture, placed by rule along the road grid (every block side, every intersection corner)
const STREET_PROPS=[];
{const s=B-R,lp=[],tl=[],hy=[],bn=[],bch=[],sh=[],bl=[],tr=[],pm=[],AV=[2,4,6],mx=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z);
 for(let bj=0;bj<N;bj++)for(let bi=0;bi<N;bi++){const x0=bi*B+R,y0=bj*B+R,t=blockType[bj*N+bi],rq=seeded(bi*53+bj*29+11);
   for(const o of[25,135,245])lp.push([x0+7,y0+o,-1,0],[x0+s-7,y0+o,1,0],[x0+o,y0+7,0,-1],[x0+o,y0+s-7,0,1]); // lamps every 110 on both sides of each road
   for(const[cx,cy]of[[0,0],[1,0],[0,1],[1,1]])tl.push([x0+(cx?s-7:7),y0+(cy?s-7:7),cx?-1:1,cy?-1:1,(bi+cx+bj+cy)%2]); // corner housing; index 4 = cycle phase group
   if(t!=='airport'){hy.push([x0+10,y0+80]);for(const o of[80,190])bl.push([x0+4,y0+o],[x0+s-4,y0+o])}
   if(t==='city')for(const[ok,x,y,ry]of[[bi,x0+8,y0+105,-Math.PI/2],[bi+1,x0+s-8,y0+105,Math.PI/2],[bj,x0+105,y0+8,Math.PI],[bj+1,x0+105,y0+s-8,0]])if(AV.includes(ok))sh.push([x,y,ry]);
   // street trees (suburb, city, midtown, hood) and boulevard palms (beach), 13 in from the block edge
   if(t==='suburb')for(const o of[46,150,254])tr.push([x0+13,y0+o],[x0+s-13,y0+o],[x0+o,y0+13],[x0+o,y0+s-13]);
   else if(t==='city'){const o=rq()<.5?[90]:[70,210];for(const u of o)tr.push([x0+13,y0+u],[x0+s-13,y0+u],[x0+u,y0+13],[x0+u,y0+s-13])}
   else if(t==='hood'&&rq()<.6)tr.push([x0+13,y0+180],[x0+s-13,y0+180]);
   else if(t==='beach')for(const o of[40,140,240])pm.push([x0+12,y0+o,rq()*TAU],[x0+s-12,y0+o,rq()*TAU]);}
 for(let i=lp.length-1;i>=0;i--)if(rampZone(lp[i][0],lp[i][1])||inAF(lp[i][0],lp[i][1]))lp.splice(i,1); // no lamp in a ramp's landing zone or in the airfield
 for(let i=tl.length-1;i>=0;i--)if(inAF(tl[i][0],tl[i][1]))tl.splice(i,1); // no traffic light in the airfield
 for(let i=bl.length-1;i>=0;i--)if(rampZone(bl[i][0],bl[i][1])||DOORS.some(d=>Math.hypot(d.x-bl[i][0],d.y-bl[i][1])<30))bl.splice(i,1); // no bollard in a ramp zone or at a door
 for(const d of DOORS){const big=d.int===club||d.int===casino||d.int===bankL;for(const o of[-1,1])bch.push([d.x+o*(big?70:48),d.y-3,Math.PI]);bn.push([d.x+(big?92:72),d.y-3])}
 for(const p of parks)for(const o of[-1,1]){bch.push([p.x+p.s/2+o*45,p.y+24,0],[p.x+p.s/2+o*45,p.y+p.s-24,Math.PI]);bn.push([p.x+p.s/2+o*75,p.y+22],[p.x+p.s/2+o*75,p.y+p.s-22])}
 for(const[x,y,ry]of sh)bch.push([x,y,ry]);
 STREET_PROPS.push(...hy,...bn,...bl,...sh);
 const lam=c=>new THREE.MeshLambertMaterial({color:c}),IM=(g,m,n)=>new THREE.InstancedMesh(g,m,Math.max(1,n));
 // street trees and boulevard palms, instanced, clear of doors, ramps and buildings
 {const qc=(x,y)=>!rampZone(x,y)&&!inAF(x,y)&&groundZ(x,y)===0&&!DOORS.some(d=>Math.hypot(d.x-x,d.y-y)<26)&&!solidAt(x,y,2);
  const T=tr.filter(([x,y])=>qc(x,y)),P=pm.filter(([x,y])=>qc(x,y));
  const tk=IM(new THREE.CylinderGeometry(1.1,1.5,9,6),lam('#4a3426'),T.length),tc2=IM(new THREE.IcosahedronGeometry(1,0),lam('#2a7a4c'),T.length);
  T.forEach(([x,y],i)=>{const sc=.85+((x*7+y*13)%100)/100*.5;inst(tk,i,x,4.5*sc,y,0,1,sc,1);inst(tc2,i,x,11.5*sc,y,(x+y)%6,sc*3.4,sc*3,sc*3.4)});
  tk.count=tc2.count=T.length;scene.add(tk,tc2);
  const pk=IM(new THREE.CylinderGeometry(1.4,2.2,16,6),lam('#6b4a32'),P.length),pf=IM(new THREE.BoxGeometry(24,1,6),lam('#2f8a4e'),P.length*6);
  P.forEach(([x,y,rot],i)=>{inst(pk,i,x,8,y,0);for(let k=0;k<6;k++){const a=rot+k/6*TAU;inst(pf,i*6+k,x+Math.cos(a)*10,15,y+Math.sin(a)*10,-a)}});
  pk.count=P.length;pf.count=P.length*6;scene.add(pk,pf);}
 // lamps: slim pole with an arm and a small tapered six-sided shade with a warm bulb under it
 const post=IM(mergeGeos([[new THREE.CylinderGeometry(.9,1.3,40,6),mx(0,20,0)],[new THREE.BoxGeometry(8,1,1.2),mx(4,39.5,0)]]),lam('#2c2938'),lp.length),
  hd=IM(mergeGeos([[new THREE.CylinderGeometry(2.1,2.6,1.1,6),mx(0,.55,0)],[new THREE.CylinderGeometry(.7,.7,1.6,6),mx(0,-.6,0)]]),lam('#25222e'),lp.length),hb=IM(new THREE.SphereGeometry(.62,6,4),fadeC(new THREE.MeshBasicMaterial({color:'#ffdf9e'}),'color','#ffdf9e','#8f8776'),lp.length),
  pool=IM(new THREE.PlaneGeometry(1,1),fade(additive(glowTex('rgba(255,176,90,.55)'),.4),'opacity',.4,.06),lp.length);
 lp.forEach(([x,y,dx,dz],i)=>{const ry=Math.atan2(-dz,dx),hx=x+dx*7.5,hz=y+dz*7.5;inst(post,i,x,0,y,ry);inst(hd,i,hx,39.5,hz);inst(hb,i,hx,38.5,hz);inst(pool,i,x+dx*10,1.7,y+dz*10,0,96,96,1,-Math.PI/2)});
 // traffic lights: pole, housing and two lamp cubes per corner; colours cycle green/yellow/red in trafficStep via one instanceColor pass per phase change
 const tp=IM(new THREE.CylinderGeometry(.8,1,24,6),post.material,tl.length),th=IM(new THREE.BoxGeometry(4,9,4),lam('#17131f'),tl.length),
  tc=IM(new THREE.BoxGeometry(2.6,2.6,2.6),new THREE.MeshBasicMaterial({color:'#ffffff'}),tl.length*2),
  red=new THREE.Color('#ff2d55'),grn=new THREE.Color('#3dd68c'),tlY=new THREE.Color('#ffcf4d');
 tl.forEach(([x,y,dx,dz,k],i)=>{inst(tp,i,x,13,y,0);inst(th,i,x,28,y,0);inst(tc,i*2,x-dx*2.9,28,y,0);inst(tc,i*2+1,x,28,y-dz*2.9,0);tc.setColorAt(i*2,k?red:grn);tc.setColorAt(i*2+1,k?grn:red)});
 tlPaint=ph=>{for(let i=0;i<tl.length;i++){const k=tl[i][4];for(let ax=0;ax<2;ax++){const own=(ph>>1)===(ax===k?0:1);tc.setColorAt(i*2+ax,own?(ph&1?tlY:grn):red)}}tc.instanceColor.needsUpdate=true};
 // hydrants, bins, benches, bus shelters
 const hg=mergeGeos([[new THREE.CylinderGeometry(1.8,2.2,5,8),mx(0,2.5,0)],[new THREE.SphereGeometry(1.9,8,6),mx(0,5.2,0)],[new THREE.BoxGeometry(6,1.2,1.2),mx(0,3.4,0)]]);
 const hm=IM(hg,lam('#c0283c'),hy.length);hy.forEach(([x,y],i)=>inst(hm,i,x,1,y,0));
 const bm=IM(new THREE.CylinderGeometry(2.4,2,6,8),lam('#2f3a3c'),bn.length);bn.forEach(([x,y],i)=>inst(bm,i,x,4,y,0));
 const bg=mergeGeos([[new THREE.BoxGeometry(14,1.2,4.5),mx(0,3.4,0)],[new THREE.BoxGeometry(14,5,.8),mx(0,6,-2.2)],[new THREE.BoxGeometry(1,3,4),mx(-5.5,1.5,0)],[new THREE.BoxGeometry(1,3,4),mx(5.5,1.5,0)]]);
 const be=IM(bg,lam('#5a4030'),bch.length);bch.forEach(([x,y,ry],i)=>inst(be,i,x,1.3,y,ry));
 const fr=IM(mergeGeos([[new THREE.BoxGeometry(26,1,9),mx(0,11,0)],[new THREE.BoxGeometry(1,11,1),mx(-12,5.5,-3.5)],[new THREE.BoxGeometry(1,11,1),mx(12,5.5,-3.5)]]),lam('#2a2735'),sh.length),
  pn=IM(new THREE.BoxGeometry(22,8,.6),new THREE.MeshBasicMaterial({color:'#1c6b78'}),sh.length);
 sh.forEach(([x,y,ry],i)=>{inst(fr,i,x,1.3,y,ry);const c=Math.cos(ry),sn=Math.sin(ry);inst(pn,i,x-sn*3.5,6.3,y-c*3.5,ry)});
 const bo=IM(new THREE.CylinderGeometry(.9,1,3,6),lam('#8a8699'),bl.length);bl.forEach(([x,y],i)=>inst(bo,i,x,1.5,y,0));bo.count=bl.length;scene.add(bo);
 for(const m of[post,hd,hb,pool,tp,th,tc,hm,bm,be,fr,pn]){m.count=m===tc?tl.length*2:m===tp||m===th?tl.length:m===hm?hy.length:m===bm?bn.length:m===be?bch.length:m===fr||m===pn?sh.length:lp.length;scene.add(m)}}
if(DBG)Object.defineProperties(DBG,{street:{get:()=>({facades:FACADES.length,props:STREET_PROPS.length})}});
// kerbs along every block side, and planters, a bench and a bin on the sidewalk. Skipped on slopes, ramps and door points.
// Props are painted by vertex colour and merged into one mesh.
{const kerbMat=new THREE.MeshLambertMaterial({color:'#8d8aa0'}),parts=[],onFlat=(x,z)=>groundZ(x,z)===0&&!rampZone(x,z);
 const vc=(g,hex)=>{const c=new THREE.Color(hex),n=g.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=c.r;a[i*3+1]=c.g;a[i*3+2]=c.b}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g},
  pBox=vc(new THREE.BoxGeometry(9,2.6,4),'#5a5068'),pLeaf=vc(new THREE.IcosahedronGeometry(2.1,0),'#2a7a4c'),
  bSeat=vc(new THREE.BoxGeometry(14,1.2,4.5),'#5a4030'),bBack=vc(new THREE.BoxGeometry(14,5,.8),'#5a4030'),bArm=vc(new THREE.BoxGeometry(1,3,4),'#5a4030'),
  binG=vc(new THREE.CylinderGeometry(1.6,1.9,4,6),'#2f3a3c'),hEdge=vc(new THREE.BoxGeometry(26,3.4,5),'#2a6a3a');
 // local frame: front is +z, which faces the road
 const prop=(x,y,z,ry,items)=>{const M=new THREE.Matrix4().makeRotationY(ry).setPosition(x,y,z);for(const[g,lx,ly,lz]of items)parts.push([g,new THREE.Matrix4().multiplyMatrices(M,new THREE.Matrix4().makeTranslation(lx,ly,lz))])};
 for(let bj=0;bj<N;bj++)for(let bi=0;bi<N;bi++){const t=blockType[bj*N+bi];if(t==='airport')continue;
  const x0=bi*B+R,y0=bj*B+R,s=B-R,r=seeded(bi*31+bj*7+5),city=t==='city',hood=t==='hood'||t==='industrial',sub=t==='suburb',pk=t==='park',bc=t==='beach',street=t!=='lot'&&t!=='plaza'&&t!=='skate'&&t!=='pit'&&t!=='marina';
  for(let side=0;side<4;side++){ // 0 west, 1 east, 2 north, 3 south
   const ox=side===0?-1:side===1?1:0,oz=side===2?-1:side===3?1:0,ry=Math.atan2(ox,oz);
   const at=(u,d)=>side<2?[side===0?x0+d:x0+s-d,y0+u]:[x0+u,side===2?y0+d:y0+s-d]; // u along the side, d in from its edge
   if([at(0,0),at(s/2,0),at(s,0)].every(([x,z])=>onFlat(x,z))){const[kx,kz]=at(s/2,1.1),k=new THREE.Mesh(side<2?new THREE.BoxGeometry(2.2,1.6,s):new THREE.BoxGeometry(s,1.6,2.2),kerbMat);k.position.set(kx,.8,kz);scene.add(k)}
   if(!street)continue;
   const spot=(u,d)=>{const[x,z]=at(u,d);return onFlat(x,z)&&!DOORS.some(v=>Math.hypot(v.x-x,v.y-z)<30)?[x,z]:null},plant=[[pBox,0,1.3,0],[pLeaf,-2.2,3.4,0],[pLeaf,2.2,3.6,0]],
    seat=[[bSeat,0,3.4,0],[bBack,0,6,-2.2],[bArm,-5.5,1.5,0],[bArm,5.5,1.5,0]],bin=[[binG,0,2,0]],hedge=[[hEdge,0,1.6,0]];
   let p;
   if((city||hood)&&r()<.7&&(p=spot(60,16)))prop(p[0],1.25,p[1],ry,plant);
   if((city||hood)&&r()<.5&&(p=spot(260,16)))prop(p[0],1.25,p[1],ry,plant);
   if((pk||sub?r()<.85:r()<.5)&&(p=spot(160,17)))prop(p[0],1.25,p[1],ry,seat);
   if((pk?.2:bc?.3:sub?.4:.6)>r()&&(p=spot(44,12)))prop(p[0],1,p[1],ry,bin);
   if(sub&&r()<.8&&(p=spot(110,13)))prop(p[0],1.25,p[1],ry,hedge);
  }}
 if(DBG)Object.defineProperty(DBG,'furniture',{get:()=>parts.length});
 if(parts.length)scene.add(new THREE.Mesh(mergeGeos(parts),new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true})));
}
// neon billboards on downtown and midtown roofs
{const names=[['Lucky Palms Casino','#c08bff'],['Velvet Palms','#ff3ea5'],['Snack & Go','#3dd68c'],['Union Bank','#ffd76a'],['Palmetto International','#29e6d6']],r=seeded(555),spots=[];
 for(const b of buildings)if((b.kind==='glass'||b.kind==='tower')&&b.H>=90&&b.w>=56&&b.x<3600&&r()<.3)spots.push(b);
 const frame=new THREE.InstancedMesh(mergeGeos([[new THREE.BoxGeometry(58,18,1),new THREE.Matrix4().makeTranslation(0,15,0)],[new THREE.BoxGeometry(2,6,2),new THREE.Matrix4().makeTranslation(-22,3,0)],[new THREE.BoxGeometry(2,6,2),new THREE.Matrix4().makeTranslation(22,3,0)]]),capMat,Math.max(1,spots.length));
 spots.forEach((b,i)=>inst(frame,i,b.x+b.w/2,b.H+1.6,b.y+b.h-5,0));frame.count=spots.length;scene.add(frame);
 names.forEach(([t,c],k)=>{const mine=spots.filter((_,i)=>i%5===k);if(!mine.length)return;
  const tex=canvasTex(1024,288,(g,w,h)=>{g.fillStyle='#0b0814';g.fillRect(0,0,w,h);g.strokeStyle=c;g.shadowColor=c;g.shadowBlur=22;g.lineWidth=10;g.strokeRect(14,14,w-28,h-28);
   let fs=150;g.font=fs+'px Bungee, Impact, sans-serif';while(g.measureText(t.toUpperCase()).width>w-110&&fs>30){fs-=6;g.font=fs+'px Bungee, Impact, sans-serif'}
   g.textAlign='center';g.textBaseline='middle';g.fillStyle=c;g.shadowBlur=28;g.fillText(t.toUpperCase(),w/2,h/2+6)});
  const pm=new THREE.InstancedMesh(new THREE.PlaneGeometry(55,15.5),fadeC(new THREE.MeshBasicMaterial({map:tex}),'color','#ffffff','#8f8f96'),mine.length*2);
  mine.forEach((b,i)=>{inst(pm,i*2,b.x+b.w/2,b.H+16.6,b.y+b.h-4.4,0);inst(pm,i*2+1,b.x+b.w/2,b.H+16.6,b.y+b.h-5.6,Math.PI)});scene.add(pm)})}

const shopRings=[];
// job beacon
const beacon=new THREE.Mesh(new THREE.CylinderGeometry(15,15,160,24,1,true),new THREE.MeshBasicMaterial({color:'#ffc94a',transparent:true,opacity:.28,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
beacon.position.y=80;scene.add(beacon);
const beaconRing=new THREE.Mesh(new THREE.RingGeometry(15,19,32),new THREE.MeshBasicMaterial({color:'#ffc94a',side:THREE.DoubleSide}));beaconRing.rotation.x=-Math.PI/2;beaconRing.position.y=1.8;scene.add(beaconRing);
const gpsMat=new THREE.MeshBasicMaterial({color:'#ffc94a',transparent:true,opacity:.8,depthTest:false});
const gps=new THREE.Group();{const shaft=new THREE.Mesh(new THREE.BoxGeometry(12,2.4,4.5),gpsMat);shaft.position.x=-3;const head=new THREE.Mesh(new THREE.ConeGeometry(6,11,4),gpsMat);head.rotation.z=-Math.PI/2;head.rotation.x=Math.PI/4;head.position.x=8;gps.add(shaft,head);gps.children.forEach(m=>m.renderOrder=9)}
gps.visible=false;scene.add(gps);
const reticle=new THREE.Sprite(new THREE.SpriteMaterial({map:canvasTex(128,128,(g)=>{g.strokeStyle='#ff4b4b';g.lineWidth=7;g.shadowColor='#ff4b4b';g.shadowBlur=10;for(const[x,y,dx,dy]of[[14,14,1,1],[114,14,-1,1],[14,114,1,-1],[114,114,-1,-1]]){g.beginPath();g.moveTo(x,y+dy*28);g.lineTo(x,y);g.lineTo(x+dx*28,y);g.stroke()}}),depthTest:false,transparent:true}));
reticle.scale.set(44,44,1);reticle.renderOrder=11;reticle.visible=false;scene.add(reticle);

