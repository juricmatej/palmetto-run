// ---------- interior look ----------
// Shared look for every interior: canvas textures, one atlas for every 2D picture, cached geometry and shared
// materials. No PointLights: light is faked with emissive strips, lit fixtures and additive glow planes.
// Helpers take room-relative coordinates (x across, y down the room, z up). iB/iCy/iSp/iPl/iFl/iTo are centre or
// corner based as their comments say.
const ICL={},ICY={},ISP={};
const iCol=c=>ICL[c]||(ICL[c]=new THREE.MeshBasicMaterial({color:c}));
const iAdd=c=>ICL['+'+c]||(ICL['+'+c]=additive(glowTex(c)));
const icyl=(rad,h,s)=>{const k=rad+','+h+','+s;return ICY[k]||(ICY[k]=new THREE.CylinderGeometry(rad,rad,h,s||10))};
const isph=rad=>ISP[rad]||(ISP[rad]=new THREE.IcosahedronGeometry(rad,0));
const iChrome=lam('#cfc8b8'),iMatt=lam('#4a2430');
// tiled box: UVs in world units, so a texture of `tx` units repeats at the same scale on every wall
function iBox(w,h,d,tx){const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0;f<6;f++)for(let k=f*4;k<f*4+4;k++)uv.setXY(k,uv.getX(k)*dims[f][0]/tx,uv.getY(k)*dims[f][1]/tx);return g}
const iPlane=(w,h,tx)=>uvScale(new THREE.PlaneGeometry(w,h),w/tx,h/tx);
// floor, wall and ceiling textures: name -> tile size in world units, emissive tone (lit walls and floors), draw
const IDEF={
  chk:{t:96,e:'#2a2238',d:(g,w,h)=>{for(let j=0;j<8;j++)for(let i=0;i<8;i++){g.fillStyle=(i+j)%2?'#eadff2':'#3d1845';g.fillRect(i*32,j*32,32,32)}grit(g,w,h,1500,21,.05)}},
  carpet:{t:128,e:'#2a1830',d:(g,w,h)=>{g.fillStyle='#24102e';g.fillRect(0,0,w,h);for(let y=0;y<=h;y+=64)for(let x=0;x<=w;x+=64){const X=x+((y/64)%2?32:0);g.fillStyle='#5a1a50';g.beginPath();g.moveTo(X,y-22);g.lineTo(X+22,y);g.lineTo(X,y+22);g.lineTo(X-22,y);g.fill();g.fillStyle='#c9a24a';g.beginPath();g.arc(X,y,3,0,TAU);g.fill()}grit(g,w,h,2500,22,.05)}},
  conc:{t:128,e:'#24262c',d:(g,w,h)=>{g.fillStyle='#3b3e47';g.fillRect(0,0,w,h);grit(g,w,h,9000,23,.07);g.fillStyle='#2a2d34';for(let i=0;i<=w;i+=128)g.fillRect(i,0,2,h);for(let j=0;j<=h;j+=128)g.fillRect(0,j,w,2)}},
  marb:{t:128,e:'#2a2824',d:(g,w,h)=>{g.fillStyle='#cdc8bd';g.fillRect(0,0,w,h);const r=seeded(24);for(let i=0;i<14;i++){g.strokeStyle=r()<.5?'rgba(120,112,96,.5)':'rgba(255,255,255,.5)';g.lineWidth=.6+r()*2;g.beginPath();let x=r()*w,y=r()*h;g.moveTo(x,y);for(let k=0;k<8;k++){x+=r()*40-12;y+=r()*30-12;g.lineTo(x,y)}g.stroke()}g.fillStyle='rgba(60,55,45,.35)';for(let i=0;i<=w;i+=128)g.fillRect(i,0,1.5,h);for(let j=0;j<=h;j+=128)g.fillRect(0,j,w,1.5)}},
  lino:{t:96,e:'#1c2622',d:(g,w,h)=>{g.fillStyle='#cfdcd6';g.fillRect(0,0,w,h);g.fillStyle='#8ea39b';for(let i=0;i<=w;i+=64)g.fillRect(i,0,2.5,h);for(let j=0;j<=h;j+=64)g.fillRect(0,j,w,2.5);grit(g,w,h,2000,25,.04)}},
  inkf:{t:96,e:'#1a1c2a',d:(g,w,h)=>{g.fillStyle='#1f2234';g.fillRect(0,0,w,h);g.fillStyle='#2e3350';for(let i=0;i<=w;i+=32)g.fillRect(i,0,1,h);for(let j=0;j<=h;j+=32)g.fillRect(0,j,w,1);grit(g,w,h,2000,26,.05)}},
  plank:{t:128,e:'#2a1a10',d:(g,w,h)=>{const r=seeded(27);for(let y=0;y<h;y+=32){g.fillStyle=['#5a3a22','#64422a','#52341e'][Math.floor(r()*3)];g.fillRect(0,y,w,32);g.fillStyle='#3a2414';g.fillRect(0,y,w,1.5);g.fillRect(r()*w,y,1.5,32);for(let k=0;k<6;k++){g.strokeStyle='rgba(30,18,8,.35)';g.lineWidth=1;const yy=y+4+r()*24;g.beginPath();g.moveTo(0,yy);g.lineTo(w,yy+r()*4-2);g.stroke()}}}},
  arcf:{t:64,e:'#14082a',d:(g,w,h)=>{for(let j=0;j<8;j++)for(let i=0;i<8;i++){g.fillStyle=(i+j)%2?'#2a1446':'#0c0618';g.fillRect(i*32,j*32,32,32)}g.fillStyle='rgba(255,62,165,.5)';for(let i=0;i<=w;i+=32)g.fillRect(i,0,1,h)}},
  pinkT:{t:128,e:'#3a1830',d:(g,w,h)=>{g.fillStyle='#5a1f47';g.fillRect(0,0,w,h);const r=seeded(28);for(let y=0;y<h;y+=16)for(let x=(y/16)%2?-16:0;x<w;x+=32){g.fillStyle=shade('#d98bb4',.7+r()*.12);g.fillRect(x+1.5,y+1.5,29,13)}grit(g,w,h,1500,29,.04)}},
  panelB:{t:128,e:'#2a3a58',d:(g,w,h)=>{g.fillStyle='#3a5078';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=64){g.fillStyle='#2b3d5c';g.fillRect(x,0,2,h);g.fillStyle='#4d6894';g.fillRect(x+2,0,1,h)}for(let y=0;y<h;y+=64){g.fillStyle='#2b3d5c';g.fillRect(0,y,w,2)}grit(g,w,h,1200,30,.05)}},
  whiteT:{t:96,e:'#7a8a86',d:(g,w,h)=>{g.fillStyle='#9fb5ae';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=12)for(let x=(y/12)%2?-12:0;x<w;x+=24){g.fillStyle='#dfeeea';g.fillRect(x+1,y+1,22,10)}}},
  metal:{t:128,e:'#2a2e36',d:(g,w,h)=>{g.fillStyle='#4a5260';g.fillRect(0,0,w,h);const r=seeded(31);for(let i=0;i<300;i++){g.fillStyle=r()<.5?'rgba(255,255,255,.06)':'rgba(0,0,0,.12)';g.fillRect(r()*w,r()*h,20+r()*60,1)}g.fillStyle='#2c323c';for(let y=16;y<h;y+=32)for(let x=16;x<w;x+=32){g.beginPath();g.arc(x,y,2.2,0,TAU);g.fill()}}},
  wood:{t:128,e:'#2a1a0e',d:(g,w,h)=>{g.fillStyle='#4a2f1a';g.fillRect(0,0,w,h);const r=seeded(32);for(let x=0;x<w;x+=64){g.fillStyle='#2a1a0e';g.fillRect(x,0,2,h);for(let k=0;k<5;k++){g.strokeStyle='rgba(120,80,40,.3)';g.beginPath();const xx=x+4+r()*56;g.moveTo(xx,0);g.lineTo(xx+r()*4-2,h);g.stroke()}}}},
  velvet:{t:96,e:'#2a1030',d:(g,w,h)=>{g.fillStyle='#3a1040';g.fillRect(0,0,w,h);for(let y=0;y<=h;y+=32)for(let x=0;x<=w;x+=32){const X=x+((y/32)%2?16:0);g.fillStyle='#4f1a58';g.beginPath();g.moveTo(X,y-12);g.lineTo(X+12,y);g.lineTo(X,y+12);g.lineTo(X-12,y);g.fill()}grit(g,w,h,1500,33,.05)}},
  arcW:{t:96,e:'#2a1050',d:(g,w,h)=>{g.fillStyle='#120828';g.fillRect(0,0,w,h);g.strokeStyle='#5a2a9a';g.lineWidth=2;for(let x=0;x<=w;x+=48){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()}for(let y=0;y<=h;y+=48){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}g.fillStyle='#ff3ea5';g.fillRect(0,h*.5-1,w,2)}},
  plaster:{t:128,e:'#2e2a24',d:(g,w,h)=>{g.fillStyle='#3c382f';g.fillRect(0,0,w,h);const r=seeded(34);for(let y=0;y<h;y+=32)for(let x=(y/32)%2?-32:0;x<w;x+=64){g.fillStyle=shade('#77736a',.9+r()*.16);g.fillRect(x+1.5,y+1.5,61,29)}grit(g,w,h,2000,35,.05)}},
  stile:{t:96,e:'#0e2a20',d:(g,w,h)=>{g.fillStyle='#8fc9b0';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=16)for(let x=(y/16)%2?-16:0;x<w;x+=32){g.fillStyle='#e6f6ef';g.fillRect(x+1.5,y+1.5,29,13)}grit(g,w,h,1200,42,.03)}},
  brick:{t:96,e:'#3a1a24',d:(g,w,h)=>{g.fillStyle='#4a2a34';g.fillRect(0,0,w,h);const r=seeded(36);for(let y=0;y<h;y+=12)for(let x=(y/12)%2?-16:0;x<w;x+=32){g.fillStyle=shade('#6a3a44',.7+r()*.4);g.fillRect(x+1,y+1,30,10)}}},
  // ceilings are self-lit (MeshBasic): the fixtures are drawn bright
  grid:{t:128,c:1,d:(g,w,h)=>{g.fillStyle='#17132a';g.fillRect(0,0,w,h);const r=seeded(37);for(let y=0;y<h;y+=64)for(let x=0;x<w;x+=64){g.fillStyle=r()<.35?'#fff1d6':'#2a2442';g.fillRect(x+4,y+4,56,24)}g.fillStyle='#3a3256';for(let x=0;x<=w;x+=64)g.fillRect(x,0,2,h)}},
  beams:{t:128,c:1,d:(g,w,h)=>{g.fillStyle='#22242c';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=64){g.fillStyle='#34384a';g.fillRect(0,y,w,10);g.fillStyle='#14161c';g.fillRect(0,y+10,w,2)}g.fillStyle='#55504a';for(let x=20;x<w;x+=56)g.fillRect(x,0,4,h);g.fillStyle='rgba(255,201,74,.4)';g.fillRect(0,96,w,3)}},
  tile:{t:128,c:1,d:(g,w,h)=>{g.fillStyle='#8f9c99';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=32)for(let x=0;x<w;x+=32){g.fillStyle='#c7d2cf';g.fillRect(x+1,y+1,30,30)}g.fillStyle='#ffffff';for(let y=32;y<h;y+=96)for(let x=32;x<w;x+=96)g.fillRect(x-14,y-6,28,12)}},
  haze:{t:128,c:1,d:(g,w,h)=>{g.fillStyle='#1a0a22';g.fillRect(0,0,w,h);const r=seeded(38);g.lineWidth=1.5;for(let i=0;i<10;i++){g.strokeStyle=r()<.5?'rgba(255,62,165,.6)':'rgba(41,230,214,.5)';g.beginPath();const x=r()*w,y=r()*h;g.moveTo(x,y);g.lineTo(x+r()*120-60,y+r()*120-60);g.stroke()}g.fillStyle='rgba(255,62,165,.12)';g.beginPath();g.arc(w/2,h/2,w*.4,0,TAU);g.fill()}},
  neon:{t:128,c:1,d:(g,w,h)=>{g.fillStyle='#0d0718';g.fillRect(0,0,w,h);g.lineWidth=3;for(let i=0;i<4;i++){g.strokeStyle=['#ff3ea5','#29e6d6','#ffc94a','#7dff6a'][i];g.beginPath();g.moveTo(0,(i+1)*h/5);for(let x=0;x<=w;x+=16)g.lineTo(x,(i+1)*h/5+Math.sin(x/w*TAU*2+i)*10);g.stroke()}}},
  // gun shop: vertical wall panels with bevelled seams, a diamond plate floor
  gpan:{t:128,e:'#262a33',d:(g,w,h)=>{g.fillStyle='#3a404c';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=64){g.fillStyle='#1c2029';g.fillRect(x,0,2,h);g.fillStyle='#5a6474';g.fillRect(x+2,0,1,h);g.fillStyle='rgba(0,0,0,.2)';g.fillRect(x+8,0,52,h)}grit(g,w,h,1200,44,.05)}},
  dplate:{t:64,e:'#22262e',d:(g,w,h)=>{g.fillStyle='#4a505b';g.fillRect(0,0,w,h);g.fillStyle='#363c46';for(let i=-h;i<w;i+=16){g.beginPath();g.moveTo(i,0);g.lineTo(i+8,0);g.lineTo(i+8+h,h);g.lineTo(i+h,h);g.closePath();g.fill()}grit(g,w,h,1000,45,.05)}},
  // vault: steel plates with a seam grid
  steel:{t:96,e:'#1b1f27',d:(g,w,h)=>{g.fillStyle='#5d6573';g.fillRect(0,0,w,h);g.fillStyle='#2b3038';for(let i=0;i<=w;i+=64){g.fillRect(i,0,3,h);g.fillRect(0,i,w,3)}g.fillStyle='rgba(255,255,255,.08)';for(let i=0;i<w;i+=64){g.fillRect(i+3,0,1,h);g.fillRect(0,i+3,w,1)}grit(g,w,h,1400,46,.04)}}};
const ITEX={};
// one canvas texture per name; each room gets its own material object on it, so staticBatch keeps a room's shell in its own group
function iMat(n){const D=IDEF[n],tx=ITEX[n]||(ITEX[n]=rtex(256,256,D.d));return D.c?new THREE.MeshBasicMaterial({map:tx}):new THREE.MeshLambertMaterial({map:tx,emissive:new THREE.Color(D.e),emissiveMap:tx})}
// one atlas canvas holds every 2D picture (signs, posters, dartboard, arcade screens), so they share one material
const ATL={c:document.createElement('canvas'),x:0,y:0,rh:0};ATL.c.width=1024;ATL.c.height=4096;ATL.g=ATL.c.getContext('2d');
ATL.m=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(ATL.c)});
if(DBG)Object.defineProperties(DBG,{intLook:{get:()=>({atlas:ATL.y+ATL.rh,room:me.inside&&me.inside.id,ox:me.inside&&me.inside.ox,oy:me.inside&&me.inside.oy})}});
function atlas(w,h,draw){if(ATL.x+w>1024){ATL.x=0;ATL.y+=ATL.rh;ATL.rh=0}const x=ATL.x,y=ATL.y;ATL.x+=w;ATL.rh=Math.max(ATL.rh,h);draw(ATL.g,x,y,w,h);return[x/1024,1-(y+h)/4096,(x+w)/1024,1-y/4096]}
function iUV(geo,u0,v0,u1,v1){const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,u0+uv.getX(i)*(u1-u0),v0+uv.getY(i)*(v1-v0));return geo}
// room-relative helpers. iB: corner at (x,y), base at height z. iCy/iSp: centre at (x,y). iPl: centre (x,y), base z.
function iB(r,x,y,z,w,h,d,m){const b=new THREE.Mesh(box(w,h,d),m);b.position.set(r.ox+x+w/2,z+h/2,r.oy+y+d/2);scene.add(b);return b}
function iCy(r,x,y,z,rad,h,m,s){const c=new THREE.Mesh(icyl(rad,h,s),m);c.position.set(r.ox+x,z+h/2,r.oy+y);scene.add(c);return c}
function iSp(r,x,y,z,rad,m){const s=new THREE.Mesh(isph(rad),m);s.position.set(r.ox+x,z+rad,r.oy+y);scene.add(s);return s}
function iPl(r,x,y,z,w,h,m,ry,uv){const g=new THREE.PlaneGeometry(w,h);if(uv)iUV(g,uv[0],uv[1],uv[2],uv[3]);const p=new THREE.Mesh(g,m);p.position.set(r.ox+x,z+h/2,r.oy+y);p.rotation.y=ry||0;scene.add(p);return p}
function iFl(r,x,y,z,w,d,m,up){const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m);p.rotation.x=up?-Math.PI/2:Math.PI/2;p.position.set(r.ox+x,z,r.oy+y);scene.add(p);return p}
function iTo(r,x,y,z,rad,tube,m,rx,ry){const t=new THREE.Mesh(new THREE.TorusGeometry(rad,tube,6,14),m);t.position.set(r.ox+x,z,r.oy+y);t.rotation.set(rx||0,ry||0,0);scene.add(t);return t}
function iGlow(r,x,y,s,c){return iFl(r,x,y,.5,s,s,iAdd(c),true)}
function iStrip(r,x,y,w,d,c){return iB(r,x,y,69.5,w,1,d,iCol(c))}
// lit sign on a wall: centre (x,y) on the wall face, z is the centre height, ry the way it faces
function iSign(r,x,y,z,t,c,ry,sw,sh){sw=sw||60;sh=sh||15;const uv=atlas(512,128,(g,X,Y,w,h)=>{g.fillStyle='#0b0814';g.fillRect(X,Y,w,h);g.strokeStyle=c;g.lineWidth=8;g.strokeRect(X+6,Y+6,w-12,h-12);g.font=(t.length>10?'50px':'62px')+' Bungee, Impact, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle=c;g.shadowColor=c;g.shadowBlur=18;g.fillText(t,X+w/2,Y+h/2+4)});return iPl(r,x,y,z-sh/2,sw,sh,ATL.m,ry,uv)}
// a 2D picture on a wall: centre (x,y), centre height zc, uv from atlas()
function iPoster(r,x,y,zc,w,h,uv,ry){return iPl(r,x,y,zc-h/2,w,h,ATL.m,ry,uv)}
// one stool: chrome pole, cushion on top
function iStool(r,x,y,m){iCy(r,x,y,0,5,1,M.black,10);iCy(r,x,y,1,.8,20,iChrome,6);iCy(r,x,y,21,6,2,m,12)}
// the exit mat, the same in every room
function iMatExit(r,x,y){iB(r,x-20,y-7,.5,40,.4,14,iMatt)}
// small props in one InstancedMesh per room: one draw call, colour per instance, drawn only while the player is in that room.
// list rows: [x, y, z, w, h, d, colour], corner based like iB
const iBoxMat=new THREE.MeshLambertMaterial({color:'#ffffff'}),iRoomOnly=[],iGlass=new THREE.MeshBasicMaterial({color:'#bff6ff',transparent:true,opacity:.2,depthWrite:false});
function iOnly(r,m){iRoomOnly.push({m,r});m.visible=false;return m}
function iBoxes(r,list){const m=new THREE.InstancedMesh(box(1,1,1),iBoxMat,list.length);
  list.forEach((b,i)=>{inst(m,i,r.ox+b[0]+b[3]/2,b[2]+b[4]/2,r.oy+b[1]+b[5]/2,0,b[3],b[4],b[5]);m.setColorAt(i,new THREE.Color(b[6]))});
  m.frustumCulled=false;scene.add(m);return iOnly(r,m)}
// a street seen through a window: one dim night street in the atlas, drawn once. Centre (x,y), base z, like iPl
let iStreetUV=null;
function iWin(r,x,y,z,w,h){if(!iStreetUV)iStreetUV=atlas(640,128,(g,X,Y,W,H)=>{g.save();g.beginPath();g.rect(X,Y,W,H);g.clip();
  const s=seeded(51),gr=g.createLinearGradient(0,Y,0,Y+H);gr.addColorStop(0,'#040412');gr.addColorStop(1,'#0e0b22');g.fillStyle=gr;g.fillRect(X,Y,W,H);
  for(let bx=X;bx<X+W;){const bw=34+s()*44,bh=H*(.35+s()*.45),base=Y+H-18;g.fillStyle=s()<.5?'#0d0b24':'#14123a';g.fillRect(bx,base-bh,bw,bh);
    for(let wy=base-bh+7;wy<base-8;wy+=11)for(let wx=bx+5;wx<bx+bw-7;wx+=9)if(s()<.2){g.fillStyle=s()<.6?'#ffc94a':'#29e6d6';g.globalAlpha=.5;g.fillRect(wx,wy,4,5);g.globalAlpha=1}
    bx+=bw+3}
  g.fillStyle='#0c0b1c';g.fillRect(X,Y+H-18,W,18);g.fillStyle='#2a2540';g.fillRect(X,Y+H-18,W,2);
  const lg=g.createRadialGradient(X+W*.72,Y+H-50,0,X+W*.72,Y+H-50,80);lg.addColorStop(0,'rgba(255,170,90,.32)');lg.addColorStop(1,'rgba(255,170,90,0)');g.fillStyle=lg;g.fillRect(X,Y,W,H);g.restore()});
  return iPl(r,x,y,z,w,h,ATL.m,0,iStreetUV)}
// a lit promo poster in the atlas: coloured top band, two lines, a row of product dots
function iPromo(a,b,c){return atlas(256,320,(g,X,Y,W,H)=>{g.save();g.beginPath();g.rect(X,Y,W,H);g.clip();g.fillStyle='#0b1412';g.fillRect(X,Y,W,H);g.fillStyle=c;g.fillRect(X,Y,W,70);
  g.fillStyle='#0b1412';g.font='bold 36px Bungee, Impact, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(a,X+W/2,Y+36);
  g.fillStyle=c;g.font='bold 44px Bungee, Impact, sans-serif';g.fillText(b,X+W/2,Y+H/2);
  for(let i=0;i<5;i++){g.fillStyle=['#ff6b3d','#ffc94a','#3dd68c','#ff3ea5','#4aa3ff'][i];g.beginPath();g.arc(X+36+i*46,Y+H-40,14,0,TAU);g.fill()}g.restore()})}
// wall art for the apartments: a sunset over a palm, one picture per property
function iArt(c){return atlas(192,224,(g,X,Y,W,H)=>{g.save();g.beginPath();g.rect(X,Y,W,H);g.clip();const gr=g.createLinearGradient(0,Y,0,Y+H);gr.addColorStop(0,'#0b0a22');gr.addColorStop(.6,c);gr.addColorStop(1,'#1a1030');g.fillStyle=gr;g.fillRect(X,Y,W,H);
  g.fillStyle='#ffd27a';g.beginPath();g.arc(X+W/2,Y+H*.55,W*.2,0,TAU);g.fill();
  g.fillStyle='#07040f';g.fillRect(X,Y+H*.72,W,H*.28);g.save();g.translate(X+W*.66,Y+H*.72);g.fillRect(-2,-H*.4,4,H*.4);
  for(let i=0;i<5;i++){g.save();g.translate(0,-H*.4);g.rotate(-1.3+i*.65);g.beginPath();g.ellipse(0,-12,4,22,0,0,TAU);g.fill();g.restore()}g.restore();g.restore()})}
// the room shell: tiled walls, skirting, ceiling. Floors are added in the interior loop.
const IROOM={guns:{f:'dplate',w:'gpan',c:'beams'},club:{f:'carpet',w:'velvet',c:'haze'},store:{f:'lino',w:'stile',c:'grid'},
  home:{f:'plank',w:'wood',c:'grid'},casino:{f:'carpet',w:'velvet',c:'grid'},bank1:{f:'marb',w:'plaster',c:'tile'},bank2:{f:'conc',w:'metal',c:'beams'},
  bank3:{f:'steel',w:'metal',c:'beams'},diner:{f:'chk',w:'pinkT',c:'grid'},ink:{f:'inkf',w:'brick',c:'grid'},gym:{f:'conc',w:'metal',c:'beams'},
  pd:{f:'conc',w:'panelB',c:'grid'},hosp:{f:'lino',w:'whiteT',c:'tile'},arcade:{f:'arcf',w:'arcW',c:'neon'},anchor:{f:'plank',w:'wood',c:'beams'},
  low:{f:'wood',w:'plaster',c:'beams'},mid:{f:'carpet',w:'wood',c:'grid'},beach:{f:'plank',w:'whiteT',c:'beams'},heights:{f:'marb',w:'plaster',c:'grid'},penth:{f:'carpet',w:'velvet',c:'grid'}};
function iShell(r,L){const t=14,cx=r.ox+r.w/2,cz=r.oy+r.h/2,W=IDEF[L.w],wm=iMat(L.w);
  for(const[x,z,w,dd]of[[cx,r.oy-t/2,r.w+2*t,t],[cx,r.oy+r.h+t/2,r.w+2*t,t],[r.ox-t/2,cz,t,r.h],[r.ox+r.w+t/2,cz,t,r.h]]){const m=new THREE.Mesh(iBox(w,72,dd,W.t),wm);m.position.set(x,36,z);scene.add(m)}
  const ce=new THREE.Mesh(iPlane(r.w,r.h,IDEF[L.c].t),iMat(L.c));ce.rotation.x=Math.PI/2;ce.position.set(cx,72,cz);scene.add(ce);
  for(const[x,z,w,dd]of[[cx,r.oy+.75,r.w,1.5],[cx,r.oy+r.h-.75,r.w,1.5],[r.ox+.75,cz,1.5,r.h],[r.ox+r.w-.75,cz,1.5,r.h]]){const s=new THREE.Mesh(box(w,6,dd),M.black);s.position.set(x,3,z);scene.add(s)}}
const intAnim=[];let danceFloor=null,tv=null,tileT=0;
const tileCols=['#ff3ea5','#29e6d6','#ffc94a','#7b6bff','#3dd68c'].map(c=>new THREE.Color(c));
for(const r of INT){
  const cx=r.ox+r.w/2,cz=r.oy+r.h/2;
  const L=IROOM[r.id],fl=new THREE.Mesh(iPlane(r.w,r.h,IDEF[L.f].t),iMat(L.f));fl.rotation.x=-Math.PI/2;fl.position.set(cx,.2,cz);scene.add(fl);
  iShell(r,L);
  for(let i=1;i<=2;i++){const st=new THREE.Mesh(box(Math.round(r.w*.6),1,4),iCol(r===club?'#ff3ea5':r===casino?'#ffc94a':'#fff1d6'));st.position.set(cx,70,r.oy+r.h*i/3);scene.add(st)}
  for(const p of r.props){if(p.tbl)continue;const m=new THREE.Mesh(box(p.w,p.ht,p.h),lam(p.col));m.position.set(p.x+p.w/2,p.ht/2,p.y+p.h/2);scene.add(m)}
  const ex=new THREE.Mesh(new THREE.PlaneGeometry(26,40),new THREE.MeshBasicMaterial({color:'#29e6d6',transparent:true,opacity:.5}));ex.position.set(r.exit.x,20,r.oy+r.h-.5);ex.rotation.y=Math.PI;scene.add(ex);
  const er=new THREE.Mesh(new THREE.RingGeometry(10,13,28),new THREE.MeshBasicMaterial({color:'#29e6d6',side:THREE.DoubleSide}));er.rotation.x=-Math.PI/2;er.position.set(r.exit.x,.6,r.exit.y);scene.add(er);shopRings.push(er);
  for(const p of r.spots){const sr=new THREE.Mesh(new THREE.RingGeometry(9,12,28),new THREE.MeshBasicMaterial({color:'#ffc94a',side:THREE.DoubleSide}));sr.rotation.x=-Math.PI/2;sr.position.set(p.x,.6,p.y);scene.add(sr);shopRings.push(sr)}
}
// gun shop: glass counter with pistols and till, safe, ammo crates, rifles on the side shelves, cyan neon on the back shelf
{const g=gunInt,wood=lam('#5a3a22'),brass=lam('#c9a24a');
 iB(g,40,40,14,180,1,18,lam('#9fd8e8'));for(let i=0;i<6;i++)iB(g,50+i*28,46,15,12,2,5,M.gun);iB(g,192,46,15,14,6,8,brass);
 iB(g,200,150,0,30,30,30,M.gun);iB(g,213,180,12,8,6,1,brass);
 iB(g,8,150,0,36,16,26,wood);iB(g,8,150,16,36,14,26,wood);iB(g,48,160,0,26,14,22,wood);
 iB(g,0,0,44,260,1,10,iCol('#29e6d6'));
 for(let i=0;i<4;i++){iB(g,2,66+i*22,36,6,2,14,M.gun);iB(g,252,66+i*22,36,6,2,14,M.gun)}
 iMatExit(g,130,179);iPl(g,130,199.4,50,150,12.5,ATL.m,Math.PI,atlas(960,80,(c,X,Y,w,h)=>{c.fillStyle='#0b0814';c.fillRect(X,Y,w,h);c.strokeStyle='#29e6d6';c.lineWidth=5;c.strokeRect(X+4,Y+4,w-8,h-8);c.font='58px Bungee, Impact, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#29e6d6';c.shadowColor='#29e6d6';c.shadowBlur=14;c.fillText('PALMETTO ARMS',X+w/2,Y+h/2+3)}));iGlow(g,130,110,150,'rgba(41,230,214,.22)')}
// safehouse: bed with blanket and lamp, sofa with cushions, kitchen run, fridge, heist board on the right wall, plant
{const h=home,wood=lam('#5a3a22'),fab=lam('#7a3a5a'),paper=lam('#e8e0f0');
 iB(h,20,15,0,62,14,5,wood);iB(h,22,24,10,56,3,72,fab);
 iB(h,84,22,0,12,12,12,wood);iCy(h,90,28,12,2,8,iChrome,6);iCy(h,90,28,20,4.5,5,iCol('#ffc94a'),10);
 iB(h,150,52,12,80,14,6,lam('#4a2f3a'));iB(h,156,34,12,20,6,18,fab);iB(h,190,34,12,20,6,18,fab);
 iB(h,12,150,0,60,14,18,wood);iB(h,12,150,14,60,1,18,lam('#9aa0b8'));
 iB(h,226,150,0,26,30,26,lam('#c9c3d6'));
 iB(h,258.5,108,40,1.2,50,60,lam('#8a6a4a'));
 for(let k=0;k<6;k++)iB(h,257.6,110+(k%3)*18,44+(k>>1)*14,.6,7,9,paper);
 iCy(h,240,40,0,6,8,lam('#8a4a2a'),10);iSp(h,240,40,8,7,lam('#1f6a3a'));
 iMatExit(h,130,177);iSign(h,130,199.4,56,'SAFEHOUSE','#ffc94a',Math.PI,60,15);iGlow(h,150,110,140,'rgba(255,201,74,.2)')}
// Velvet Palms: bottle shelves behind the bar, stools, booth, DJ deck, speakers, haze cones over the floor, laser fan
{const c=club,fab=lam('#7a1f2e'),brass=lam('#c9a24a'),blk=M.black,wood=lam('#3b2416'),BOT=['#29e6d6','#ff3ea5','#ffc94a','#3dd68c','#7b6bff','#ff6b3d'];
 for(const z of[14,26,38])iB(c,110,2,z,220,2,12,wood);
 for(let k=0;k<3;k++)for(let i=0;i<26;i++)iB(c,114+i*8.2,4,16+k*12,3,8,3,iCol(BOT[(i+k)%6]));
 iB(c,108,2,0,3,40,12,wood);iB(c,327,2,0,3,40,12,wood);
 iB(c,110,78,6,220,1.5,2,brass);
 for(const x of[140,170,280,310])iStool(c,x,94,lam('#7a1f2e'));
 for(const[x,y]of[[70,290],[380,280],[90,60],[360,60]]){iCy(c,x+9,y+9,10,9,1.2,brass,12);iCy(c,x+9,y+9,11.2,1,2,iCol('#ffc94a'),6)}
 iB(c,10,110,16,6,28,150,fab);iB(c,18,110,16,26,2,150,fab);
 iB(c,370,150,14,50,1,40,lam('#2a2440'));iCy(c,380,160,15,4,1,blk,12);iCy(c,408,160,15,4,1,blk,12);iB(c,370,190,8,50,1,1,iCol('#ff3ea5'));
 for(const x of[20,400]){iB(c,x,20,0,16,30,16,blk);iTo(c,x+8,36.5,18,5,.8,iCol('#29e6d6'),Math.PI/2)}
 const haze=new THREE.MeshBasicMaterial({color:'#ff3ea5',transparent:true,opacity:.1,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
 for(const[x,y]of[[170,170],[270,170],[220,230]]){const cone=new THREE.Mesh(new THREE.ConeGeometry(60,72,14,1,true),haze);cone.rotation.x=Math.PI;cone.position.set(c.ox+x,36,c.oy+y);scene.add(cone)}
 for(let i=0;i<4;i++){const a=.9+i*.3,m=new THREE.Mesh(box(150,.6,.6),iCol(i%2?'#3dd68c':'#ff3ea5'));m.rotation.y=-a;m.position.set(c.ox+220+Math.cos(a)*75,60,c.oy+20+Math.sin(a)*75);scene.add(m)}
 iCy(c,350,236,0,1.2,18,iChrome,8);iCy(c,350,262,0,1.2,18,iChrome,8);iB(c,349.6,236,15,.8,1.2,26,lam('#8a1a2a'));
 iCy(c,20,300,0,1,50,blk,6);iB(c,12,299.5,46,12,1,1.2,blk);iB(c,11,299,30,6,14,4,lam('#2c1a33'));
 iMatExit(c,220,300);iSign(c,220,329.4,56,'VELVET PALMS','#ff3ea5',Math.PI,60,15);iGlow(c,220,165,260,'rgba(255,62,165,.3)')}
// Lucky Palms: chip wells and card fans on the felt, palms along the walls, a chandelier over the pit, a lit cage sign
{const c=casino,cardM=iCol('#f8f5ff'),chipC=['#ff3ea5','#29e6d6','#ffc94a','#f3ecff'],palm=lam('#1f6a3a'),pot=lam('#5a3a22');
 for(const p of c.props)if(p.tbl){const px=p.x-c.ox,py=p.y-c.oy,top=p.ht;
   for(const fx of[.3,.7])for(let k=0;k<4;k++)iCy(c,px+p.w*fx,py+p.h*.5,top+.4+k*1.2,2.2,1.2,iCol(chipC[(k+(fx>.5?1:0))%4]),12);
   iB(c,px+p.w*.5-14,py+p.h*.25,top+.4,5,.3,7,cardM);iB(c,px+p.w*.5-9,py+p.h*.25+1,top+.4,5,.3,7,cardM)}
 for(const[x,y]of[[24,24],[616,24],[612,300],[24,436],[616,436]]){iCy(c,x,y,0,5,8,pot,10);iSp(c,x,y,8,7,palm)}
 iTo(c,310,200,57,16,1.2,lam('#c9a24a'),Math.PI/2);
 for(let k=0;k<8;k++){const a=k*Math.PI/4;iB(c,310+Math.cos(a)*16-1,200+Math.sin(a)*16-1,53,2,2,2,iCol('#fff0c4'))}
 iB(c,309.5,199.5,57,1,15,1,lam('#c9a24a'));
 iSign(c,495,38,36,'CASHIER','#ffc94a',0,60,14);
 iMatExit(c,300,438);iSign(c,320,459.4,56,'LUCKY PALMS','#c08bff',Math.PI,60,15);iGlow(c,310,200,160,'rgba(255,216,120,.3)')}
// gun shop: a lit pegboard on the back wall above the shelf with two rows of rifles hung on it, a glass case on the counter,
// and a second glass case on the left wall with pistols on its lid
{const g=gunInt,rifles=[],peg=atlas(768,96,(c,X,Y,w,h)=>{const gr=c.createRadialGradient(X+w/2,Y+h/2,8,X+w/2,Y+h/2,w*.6);gr.addColorStop(0,'#33e0d6');gr.addColorStop(1,'#0c4a4e');c.fillStyle=gr;c.fillRect(X,Y,w,h);c.fillStyle='#052326';for(let x=X+8;x<X+w;x+=16)for(let y=Y+8;y<Y+h;y+=16){c.beginPath();c.arc(x,y,3,0,TAU);c.fill()}});
 iPl(g,130,1,44,228,26,ATL.m,0,peg);
 for(const z of[52,64])for(let i=0;i<8;i++){const x=24+i*28;rifles.push([x-2,2,z,30,2.2,1.4,'#9aa2b0'],[x-8,2,z-1.5,8,4.6,2.4,'#8a5a30'])}
 iBoxes(g,rifles);
 iOnly(g,iPl(g,130,58.4,14.5,180,8,iGlass,0));iOnly(g,iPl(g,40,49,14.5,18,8,iGlass,Math.PI/2));iOnly(g,iPl(g,220,49,14.5,18,8,iGlass,-Math.PI/2));
 iB(g,14,94,14,30,1,16,lam('#9fd8e8'));for(let i=0;i<3;i++)iB(g,17+i*9,98,15,6,2,4,M.gun);iOnly(g,iPl(g,29,110.4,14.5,30,8,iGlass,0))}
// Snack & Go: gondola faces with three rows of product, a fridge row with glass doors on the right wall, a counter with a till
// and a card reader, a street in the window, two posters and ceiling panels
{const s=store,r=seeded(43),shelf=lam('#3c4a43'),pal=['#ff6b3d','#ffc94a','#4aa3ff','#3dd68c','#ff3ea5','#29e6d6','#f3ecff','#c0392b'],prod=[];
 for(const[xf,d]of[[44,1],[94,1],[144,1],[30,-1],[80,-1],[130,-1]])for(let k=0;k<3;k++){const z=2+k*8,bx=d>0?xf:xf-6,ex=d>0?xf+6:xf-6.4;
   iB(s,bx,40,z-1,6,1,90,shelf);
   for(let y=41;y<126;y+=4.6+r()*1.2)prod.push([d>0?xf+.6:xf-5.6,y,z,5,3.5+r()*3.5,3.4+r()*1,pal[(r()*pal.length)|0]]);
   for(let y=44;y<128;y+=16)prod.push([ex,y,z-2.2,.4,1.6,5,'#ffe27a']);}
 iBoxes(s,prod);
 // gondola sides and tops: the shelving reads as metal, not as a black block
 for(const xf of[30,80,130]){iB(s,xf-.6,40,0,.6,90,26,iCol('#4d6258'));iB(s,xf+14,40,0,.6,90,26,iCol('#4d6258'));iB(s,xf,40,26,14,.5,90,iCol('#6b8a7c'));iB(s,xf,39.4,0,14,26,.6,iCol('#4d6258'));iB(s,xf,130,0,14,26,.6,iCol('#4d6258'))}
 // fridge row: shell, three shelves of drinks behind glass
 iB(s,214,36,33,26,1,84,lam('#c9c3d6'));iB(s,214,36,0,26,1,84,lam('#c9c3d6'));iB(s,238,36,0,2,34,84,lam('#c9c3d6'));
 iB(s,214,36,0,26,34,1.5,lam('#c9c3d6'));iB(s,214,118.5,0,26,34,1.5,lam('#c9c3d6'));
 const fr=[];for(let k=0;k<3;k++){iB(s,215,36,5+k*8,24,1,84,shelf);for(let y=40;y<116;y+=4.4)fr.push([217,y,6+k*8,5,5+r()*2,3.2,pal[(r()*pal.length)|0]])}
 iBoxes(s,fr);iOnly(s,iPl(s,213.4,78,4,84,28,iGlass,-Math.PI/2));iB(s,215,36,32,24,.8,84,iCol('#9ff0ff'));
 // counter: top, green front, till with a screen, card reader with a light
 iB(s,178,18,14,54,1.4,20,lam('#e8e0f0'));iB(s,180,36,0,50,14,.6,lam('#2e8f63'));
 iB(s,192,24,15.4,14,8,9,M.black);iPl(s,199,33.2,17,10,5,iCol('#9ff0ff'));
 iB(s,209,27,15.4,7,3,5,lam('#1a1a24'));iB(s,211,32.2,17.4,1.4,.8,.6,iCol('#3dff7a'));
 // window in the back wall above the back shelf, two posters, ceiling panels
 iWin(s,120,.6,44,200,24);
 for(const x of[20,120,220])iB(s,x-1,.9,44,2,24,.6,lam('#2b2f3e'));iB(s,20,.9,55,200,1.2,.6,lam('#2b2f3e'));
 iPoster(s,1,62,46,34,44,iPromo('ICE COLD','2 FOR $5','#29e6d6'),Math.PI/2);iPoster(s,239,150,46,34,44,iPromo('FRESH','SNACKS','#ffc94a'),-Math.PI/2);
 for(let i=0;i<4;i++)for(const y of[50,110])iStrip(s,24+i*52,y,34,16,'#fff1d6');
 iMatExit(s,120,160);iSign(s,120,179.4,56,'SNACK & GO','#3dd68c',Math.PI,60,15);iGlow(s,120,100,160,'rgba(61,214,140,.2)')}
// safehouse
{const pil=new THREE.Mesh(box(14,4,60),M.white);pil.position.set(home.ox+28,12,home.oy+60);scene.add(pil);
 tv=new THREE.Mesh(new THREE.PlaneGeometry(60,22),new THREE.MeshBasicMaterial({color:'#4aa3ff'}));tv.position.set(home.ox+190,20,home.oy+6.2);scene.add(tv);
 const rug=new THREE.Mesh(new THREE.PlaneGeometry(90,60),lam('#3a2a4a'));rug.rotation.x=-Math.PI/2;rug.position.set(home.ox+170,.4,home.oy+100);scene.add(rug)}
// Velvet Palms club
const clubLights=['#ff3ea5','#29e6d6'].map(c=>{const l=new THREE.PointLight(c,1.6,340,2);scene.add(l);return l});
{const poleMat=new THREE.MeshBasicMaterial({color:'#e6e1f0'});
 [160,220,280].forEach((dx,i)=>{const pole=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,64,8),poleMat);pole.position.set(club.ox+dx,38,club.oy+48);scene.add(pole);
   const m=personMesh(['#ff3ea5','#ffc94a','#29e6d6'][i],['#c98b6b','#f1c9a5','#8d5a3b'][i],false,{bikini:true,hair:['#2a1a12','#c9a24a','#111111'][i]});scene.add(m);intAnim.push({m,kind:'dancer',cx:club.ox+dx,cz:club.oy+48,ph:i*2.1})});
 const bt=personMesh('#1d1830','#e0b48f',false);bt.position.set(club.ox+8,0,club.oy+185);scene.add(bt);intAnim.push({m:bt,kind:'bob',ph:1});
 const dj=personMesh('#7b6bff','#6b4630',false);dj.position.set(club.ox+400,0,club.oy+170);dj.rotation.y=Math.PI;scene.add(dj);intAnim.push({m:dj,kind:'bob',ph:2});
 for(let i=0;i<7;i++){const m=personMesh(SHIRT[i%SHIRT.length],PEDCOL[i%PEDCOL.length],false);m.position.set(club.ox+130+(i%4)*50+rr(-8,8),0,club.oy+150+Math.floor(i/4)*60+rr(-8,8));m.rotation.y=Math.PI/2;scene.add(m);intAnim.push({m,kind:'bob',ph:i})}
 danceFloor=new THREE.InstancedMesh(box(28,.4,28),new THREE.MeshBasicMaterial({color:'#ffffff'}),40);
 for(let j=0;j<5;j++)for(let i=0;i<8;i++){const k=j*8+i;inst(danceFloor,k,club.ox+115+i*30,.5,club.oy+110+j*30,0);danceFloor.setColorAt(k,tileCols[k%tileCols.length])}
 scene.add(danceFloor);}
let roul=null,clubBall=null;
{const ox=casino.ox,oy=casino.oy;
 const dealer=personMesh('#111018','#e0b48f',false);dealer.position.set(ox+210,0,oy+30);dealer.rotation.y=-Math.PI/2;scene.add(dealer);intAnim.push({m:dealer,kind:'bob',ph:3});
 const pd=personMesh('#111018','#e0b48f',false);pd.position.set(ox+215,0,oy+270);pd.rotation.y=-Math.PI/2;scene.add(pd);intAnim.push({m:pd,kind:'bob',ph:6});
 const rd=personMesh('#2a1a3e','#c98b6b',false);rd.position.set(ox+310,0,oy+150);rd.rotation.y=-Math.PI/2;scene.add(rd);intAnim.push({m:rd,kind:'bob',ph:7});
 const bar=personMesh('#1d1830','#8d5a3b',false);bar.position.set(ox+578,0,oy+145);bar.rotation.y=Math.PI/2;scene.add(bar);intAnim.push({m:bar,kind:'bob',ph:4});
 for(const[y,c]of[[53,'#ff3ea5'],[83,'#29e6d6'],[113,'#ffc94a'],[143,'#ff3ea5'],[173,'#29e6d6'],[203,'#ffc94a'],[243,'#ffd84a'],[273,'#ffd84a']]){const sc=new THREE.Mesh(new THREE.PlaneGeometry(14,10),screenMat(c));sc.position.set(ox+30.2,22,oy+y);sc.rotation.y=Math.PI/2;scene.add(sc)}
 for(let i=0;i<3;i++){const g=personMesh(SHIRT[(i+2)%SHIRT.length],PEDCOL[(i+1)%PEDCOL.length],false);g.position.set(ox+44,0,oy+[80,160,262][i]);g.rotation.y=Math.PI;scene.add(g);intAnim.push({m:g,kind:'bob',ph:i*1.7})}
 for(let i=0;i<2;i++){const g=personMesh(SHIRT[(i+4)%SHIRT.length],PEDCOL[(i+3)%PEDCOL.length],false);g.position.set(ox+410+i*34,0,oy+262);g.rotation.y=Math.PI/2;scene.add(g);intAnim.push({m:g,kind:'bob',ph:i})}
 const glowAt=(x,y,w,h,c)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),additive(glowTex(c)));m.rotation.x=-Math.PI/2;m.position.set(ox+x,.5,oy+y);scene.add(m)};
 glowAt(210,62,220,70,'rgba(41,230,214,.6)');glowAt(310,200,150,120,'rgba(255,201,74,.6)');glowAt(440,175,170,110,'rgba(192,139,255,.65)');glowAt(215,312,200,110,'rgba(61,214,140,.6)');glowAt(548,385,160,120,'rgba(255,62,165,.7)');glowAt(30,135,44,190,'rgba(255,62,165,.45)');glowAt(545,240,130,70,'rgba(255,216,74,.5)');
 const felt=lam('#145a3a'),wheelTop=canvasTex(128,128,(g)=>{for(let i=0;i<36;i++){g.fillStyle=i===0?'#1f8a4c':i%2?'#c2202f':'#141018';g.beginPath();g.moveTo(64,64);g.arc(64,64,62,i/36*TAU,(i+1)/36*TAU);g.closePath();g.fill()}g.fillStyle='#ffc94a';g.beginPath();g.arc(64,64,14,0,TAU);g.fill()});
 roul=new THREE.Mesh(new THREE.CylinderGeometry(22,22,2,32),[lam('#5a3a22'),new THREE.MeshBasicMaterial({map:wheelTop}),lam('#5a3a22')]);roul.position.set(casino.ox+310,11.2,casino.oy+200);scene.add(roul);
 const chipMat=['#ff3ea5','#29e6d6','#ffc94a','#f3ecff'].map(c=>new THREE.MeshBasicMaterial({color:c})),chipG=new THREE.CylinderGeometry(2.2,2.2,1.2,12);
 for(let i=0;i<10;i++){const c=new THREE.Mesh(chipG,chipMat[i%4]);c.position.set(ox+170+(i%5)*20,11.6+Math.floor(i/5)*1.3,oy+70);scene.add(c)}
 const cardM=new THREE.MeshBasicMaterial({color:'#f8f5ff'});for(let i=0;i<4;i++){const c=new THREE.Mesh(new THREE.BoxGeometry(5,.3,7),cardM);c.position.set(ox+185+i*14,11.3,oy+56);c.rotation.y=rr(-.2,.2);scene.add(c)}}
{const clerk=personMesh('#3dd68c','#c98b6b',false);clerk.position.set(store.ox+205,0,store.oy+13);clerk.rotation.y=-Math.PI/2;scene.add(clerk);intAnim.push({m:clerk,kind:'bob',ph:5});
 const cashier=personMesh('#ffc94a','#8d5a3b',false);cashier.position.set(casino.ox+495,0,casino.oy+40);cashier.rotation.y=-Math.PI/2;scene.add(cashier);
 const bars=new THREE.MeshLambertMaterial({color:'#c9c3d6'});for(let i=0;i<8;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(1,30,1),bars);b.position.set(casino.ox+462+i*9,15,casino.oy+37);scene.add(b)}
 const lw=new THREE.Mesh(new THREE.CylinderGeometry(22,22,3,32),new THREE.MeshBasicMaterial({map:canvasTex(128,128,(g)=>{for(let i=0;i<20;i++){g.fillStyle=i%2?'#ffc94a':'#ff3ea5';g.beginPath();g.moveTo(64,64);g.arc(64,64,62,i/20*TAU,(i+1)/20*TAU);g.closePath();g.fill()}g.fillStyle='#16121f';g.beginPath();g.arc(64,64,12,0,TAU);g.fill()})}));
 lw.rotation.x=Math.PI/2;lw.position.set(casino.ox+75,62,casino.oy+372);scene.add(lw);
 const rs=new THREE.Mesh(new THREE.PlaneGeometry(56,24),new THREE.MeshBasicMaterial({color:'#2a0f4a'}));rs.position.set(casino.ox+440,30,casino.oy+202);scene.add(rs);
 const hs=new THREE.Mesh(new THREE.PlaneGeometry(80,16),new THREE.MeshBasicMaterial({color:'#3dd68c'}));hs.position.set(casino.ox+545,30,casino.oy+262);scene.add(hs);
 const vs=new THREE.Mesh(new THREE.PlaneGeometry(60,20),new THREE.MeshBasicMaterial({map:signTex('VIP','#ffc94a'),transparent:true}));vs.position.set(casino.ox+545,34,casino.oy+323);vs.rotation.y=Math.PI;scene.add(vs)}
// Casino look with no real lights (a real light slows every lit material in the scene). Emissive panels,
// neon trim, a diamond carpet and felt tables are plain materials and canvas textures, merged at boot.
{const ox=casino.ox,oy=casino.oy,cw=casino.w,ch=casino.h;
 const carpet=canvasTex(256,256,(g)=>{g.fillStyle='#2a0f22';g.fillRect(0,0,256,256);
   for(const[cx,cy]of[[0,0],[256,0],[0,256],[256,256],[128,128]]){g.beginPath();g.moveTo(cx,cy-62);g.lineTo(cx+62,cy);g.lineTo(cx,cy+62);g.lineTo(cx-62,cy);g.closePath();g.fillStyle='#8a6a1e';g.fill();
     g.beginPath();g.moveTo(cx,cy-46);g.lineTo(cx+46,cy);g.lineTo(cx,cy+46);g.lineTo(cx-46,cy);g.closePath();g.fillStyle='#5a1640';g.fill();
     g.fillStyle='#ffc94a';g.beginPath();g.arc(cx,cy,5,0,TAU);g.fill()}});
 carpet.wrapS=carpet.wrapT=THREE.RepeatWrapping;carpet.repeat.set(cw/128,ch/128);
 const cp=new THREE.Mesh(new THREE.PlaneGeometry(cw,ch),new THREE.MeshLambertMaterial({map:carpet}));cp.rotation.x=-Math.PI/2;cp.position.set(ox+cw/2,.4,oy+ch/2);scene.add(cp);
 const ceil=canvasTex(512,360,(g)=>{g.fillStyle='#24102e';g.fillRect(0,0,512,360);
   g.strokeStyle='rgba(255,201,74,.5)';g.lineWidth=5;for(let i=1;i<4;i++){g.beginPath();g.moveTo(i*128,0);g.lineTo(i*128,360);g.stroke()}
   for(let j=1;j<3;j++){g.beginPath();g.moveTo(0,j*120);g.lineTo(512,j*120);g.stroke()}
   g.fillStyle='#fff0c4';g.shadowColor='#ffb85c';g.shadowBlur=28;for(const[x,y]of[[96,60],[416,60],[96,300],[416,300]])g.fillRect(x-36,y-16,72,32)});
 const cl=new THREE.Mesh(new THREE.PlaneGeometry(cw,ch),new THREE.MeshBasicMaterial({map:ceil}));cl.rotation.x=Math.PI/2;cl.position.set(ox+cw/2,71.5,oy+ch/2);scene.add(cl);
 const pink=new THREE.MeshBasicMaterial({color:'#ff3ea5'}),cyan=new THREE.MeshBasicMaterial({color:'#29e6d6'});
 const trim=(m,x,y,z,w,h,d)=>{const t=new THREE.Mesh(box(w,h,d),m);t.position.set(x,y,z);scene.add(t)};
 for(const y of[5,64]){trim(pink,ox+cw/2,y,oy+.8,cw,2.6,1.2);trim(cyan,ox+.8,y,oy+ch/2,1.2,2.6,ch);trim(pink,ox+cw-.8,y,oy+ch/2,1.2,2.6,ch)}
 for(const p of casino.props)if(p.tbl){const cx=p.x+p.w/2,cz=p.y+p.h/2,top=p.ht,felt=p.col==='#1d2a5a'?'#2a4a8c':'#1f7a48';
   const rim=new THREE.Mesh(box(p.w,2.4,p.h),lam('#6b4426'));rim.position.set(cx,top-1.2,cz);scene.add(rim);
   const fm=new THREE.Mesh(box(p.w-8,.6,p.h-8),lam(felt));fm.position.set(cx,top+.3,cz);scene.add(fm);
   for(const[dx,dz]of[[-1,-1],[1,-1],[-1,1],[1,1]]){const lg=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,top-2.4,6),lam('#3a2212'));lg.position.set(cx+dx*(p.w/2-6),(top-2.4)/2,cz+dz*(p.h/2-6));scene.add(lg)}}}
// decor for the seven plain rooms and the three banks: fixtures on the shared materials, one exit mat and one lit sign each
// Diner: chrome counter with teal skirt, six stools, pendant lamps, booth cushions, window band, jukebox
{const d=diner,pink=lam('#ff5c8a'),ket=iCol('#ff3ea5'),cream=iCol('#fff1d6');
 iB(d,20,34,16,320,1.4,26,iChrome);iB(d,20,59,0,320,16,1,iCol('#29e6d6'));
 for(let i=0;i<6;i++)iStool(d,52+i*52,68,pink);
 for(let i=0;i<5;i++){const x=60+i*64;iB(d,x-.4,43.6,36,.8,36,.8,M.black);iCy(d,x,44,30,5,6,iCol('#ffc94a'),10)}
 for(let i=0;i<4;i++)iCy(d,70+i*70,42,17.4,1.2,4,ket,6);
 for(let i=0;i<3;i++){iB(d,6,118+i*46,12,4,14,36,pink);iB(d,9,120+i*46,12,10,3,32,pink);iB(d,36,130+i*46,9,20,.4,16,cream)}
 for(let i=0;i<2;i++){iB(d,352,118+i*46,12,4,14,36,pink);iB(d,341,120+i*46,12,10,3,32,pink)}
 iCy(d,160,150,10,1.4,5,ket,6);iCy(d,220,186,10,1.4,5,ket,6);iB(d,146,146,10,28,.4,12,cream);iB(d,206,182,10,28,.4,12,cream);
 iB(d,20,.5,36,320,12,.8,cream);for(let x=20;x<=340;x+=40)iB(d,x,.4,36,1.2,12,1.2,M.black);
 iB(d,298,202.4,8,28,16,1,ket);iTo(d,312,202.6,22,9,1,iCol('#ffc94a'));
 iMatExit(d,180,230);iSign(d,180,259.4,56,'PINK FLAMINGO','#ff5c8a',Math.PI,80,15);iGlow(d,180,130,260,'rgba(255,62,165,.3)')}
// Ink & Fade: mirror panels on the slab, five dividers, a red lamp over the chair, cushions, basin, two posters on the left wall, one on the right
{const k=ink,cyan=iCol('#29e6d6'),pink=iCol('#ff3ea5'),paper=iCol('#fff1d6');
 const flash=(t,c)=>atlas(256,320,(g,X,Y,w,h)=>{g.fillStyle='#14111f';g.fillRect(X,Y,w,h);g.strokeStyle=c;g.lineWidth=6;g.strokeRect(X+8,Y+8,w-16,h-16);g.fillStyle=c;g.font='bold 40px Bungee, Impact, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(t,X+w/2,Y+40);for(let i=0;i<5;i++){g.beginPath();g.arc(X+40+(i%3)*88,Y+130+Math.floor(i/3)*90,26,0,TAU);g.stroke()}});
 for(let i=0;i<4;i++)iPl(k,48+i*56,12.6,8,44,30,M.glass);
 for(let i=0;i<5;i++)iB(k,19+i*56,12,6,2,30,1.6,iChrome);
 iB(k,20,12,6,260,1.4,2.4,iChrome);
 for(const x of[50,110]){iB(k,x+1,65,22,26,2,26,pink)}
 iCy(k,240,62,0,1.2,60,iChrome,6);iB(k,222,61,58,18,1.2,1.2,iChrome);iCy(k,222,62,55,2.4,3,paper,8);
 iB(k,192,72,14.1,60,.4,26,iMatt);for(let i=0;i<5;i++)iCy(k,200+i*12,80,14.5,2.6,2.5,pink,8);
 iCy(k,96,104,14,1,12,iChrome,6);for(let i=0;i<4;i++)iCy(k,40+i*18,108,14,2,12,cyan,6);iB(k,130,104,14.1,20,.6,8,iCol('#f8f5ff'));
 iPoster(k,1,43,50,26,34,flash('INK','#29e6d6'),Math.PI/2);iPoster(k,1,84,50,26,34,flash('ROSE','#ff3ea5'),Math.PI/2);iPoster(k,299,60,50,26,34,flash('FADE','#ffc94a'),-Math.PI/2);
 iMatExit(k,150,190);iSign(k,150,219.4,56,'INK & FADE','#ff3ea5',Math.PI,70,15);iGlow(k,150,110,200,'rgba(41,230,214,.22)')}
// Iron Palms: six mirror panels with seven dividers, rack dumbbells, bench press, weight tree, treadmills, loose weights
{const k=gym,pm=M.black,bar=iChrome,red=lam('#c0392b');
 const dumb=(x,y,z)=>{for(const s of[-1,1]){const p=new THREE.Mesh(icyl(4,1.6,10),pm);p.rotation.z=Math.PI/2;p.position.set(k.ox+x+s*8.4,z+4,k.oy+y);scene.add(p)}const b=new THREE.Mesh(icyl(1.3,18,6),bar);b.rotation.z=Math.PI/2;b.position.set(k.ox+x,z+4,k.oy+y);scene.add(b)};
 const cyX=(x,y,z,rad,h,m)=>{const c=new THREE.Mesh(icyl(rad,h,10),m);c.rotation.z=Math.PI/2;c.position.set(k.ox+x,z,k.oy+y);scene.add(c)};
 for(let i=0;i<6;i++)iPl(k,48+i*56,12.6,8,44,30,M.glass);
 for(let i=0;i<7;i++)iB(k,19+i*56,12,6,2,40,1.6,iChrome);
 for(let i=0;i<4;i++)dumb(36+i*26,46,30);
 iB(k,160,40,14,60,1,18,iMatt);for(const x of[146,231])iCy(k,x,49,0,2,44,iChrome,6);iB(k,146,48.4,44,88,1.4,1.4,iChrome);
 for(const s of[-1,1]){cyX(190+s*26,49,44.7,7,3,pm);cyX(190+s*33,49,44.7,7,3,pm)}
 for(let i=0;i<3;i++){const m=i%2?red:pm,z=16+i*20;cyX(291,50,z,8,4,m);cyX(309,50,z,8,4,m)}
 for(const x of[40,150,260]){iB(k,x+64,152,12,4,46,4,M.black);iPl(k,x+66,152.4,44,28,14,iCol('#29e6d6'));iB(k,x+4,154,12,76,.6,20,M.char)}
 dumb(60,220,1);dumb(260,220,1);
 iB(k,170,223,1.2,40,.4,14,iMatt);
 iSign(k,190,259.4,56,'IRON PALMS','#3dd68c',Math.PI,70,15);iGlow(k,190,130,240,'rgba(61,214,140,.2)')}
// Palmetto PD: two desk monitors with keyboards and papers, coffee machine, wanted board, cell bars and sign, locker handles, bench slats
{const k=pd,blue=iCol('#4aa3ff'),paper=iCol('#fff1d6'),pink=iCol('#ff3ea5');
 for(const x of[100,170]){iB(k,x-1,118,18,2,9,2,M.black);iPl(k,x,120.6,27,28,15,blue);iB(k,x-8,110,18,16,.6,5,M.dim)}
 for(const[x,y]of[[80,104],[130,108],[200,104],[240,110]])iB(k,x,y,18,6,.3,8,paper);
 iB(k,250,100,18,10,10,10,M.black);
 for(let i=0;i<4;i++)iPl(k,32+i*22,22.4,22,16,22,paper);iB(k,24,22.2,46,90,1.2,.6,pink);
 for(let i=0;i<10;i++)iCy(k,306+i*8,120.4,0,.6,34,iChrome,6);
 iSign(k,340,120.8,52,'CELLS','#4aa3ff',0,60,14);
 iB(k,42.2,192,18,.6,2,4,iChrome);iB(k,72.2,192,18,.6,2,4,iChrome);
 for(const x of[120,230])for(let i=0;i<4;i++)iB(k,x,201+i*5.5,14,60,1.2,3.4,lam('#6a80ad'));
 iMatExit(k,200,250);iSign(k,200,279.4,56,'PALMETTO PD','#4aa3ff',Math.PI,80,15);iGlow(k,200,140,300,'rgba(41,230,214,.22)')}
// St. Palm's: bay bed headboard and mattress, monitor on the desk, two boxes on the crates
{const k=hosp,sheet=iCol('#f8f5ff');
 iB(k,40,58,18,130,32,2,M.dim);iB(k,42,64,18,126,3,20,sheet);
 iB(k,50,196,22,20,12,2,M.black);iPl(k,60,198.2,24,18,11,iCol('#3dd68c'));
 iB(k,246,46,12,26,6,20,lam('#cfe3ee'));iB(k,300,156,12,26,6,20,lam('#cfe3ee'));
 iMatExit(k,200,250);iSign(k,200,279.4,56,"ST. PALM'S",'#ff4b4b',Math.PI,80,15);iGlow(k,200,140,260,'rgba(41,230,214,.22)')}
// Pixel Palace: pixel screens on every cabinet (one atlas picture), a plush shelf, three neon tubes under the ceiling
{const k=arcade,scr=atlas(128,96,(g,X,Y,w,h)=>{const r=seeded(41),C=['#29e6d6','#ff3ea5','#ffc94a','#7b6bff','#3dd68c'];g.fillStyle='#050510';g.fillRect(X,Y,w,h);for(let y=0;y<6;y++)for(let x=0;x<8;x++){g.fillStyle=r()<.6?C[(r()*5)|0]:'#1a1a2e';g.fillRect(X+x*16+2,Y+y*16+2,12,12)}});
 for(let i=0;i<6;i++){iPl(k,43+i*58,54.4,18,20,14,ATL.m,0,scr);iPl(k,43+i*58,160.4,18,20,14,ATL.m,0,scr)}
 for(let i=0;i<5;i++)iSp(k,160+i*16,6.5,40,3.2,iCol(['#ff3ea5','#29e6d6','#ffc94a','#fff1d6','#3dd68c'][i]));
 iB(k,20,40,68,360,1.2,1.2,iCol('#29e6d6'));iB(k,20,150,68,360,1.2,1.2,iCol('#ff3ea5'));iB(k,20,260,68,360,1.2,1.2,iCol('#ffc94a'));
 iMatExit(k,200,270);iSign(k,200,299.4,56,'PIXEL PALACE','#ffc94a',Math.PI,90,15);iGlow(k,200,150,300,'rgba(255,62,165,.3)')}
// Rusty Anchor: taps and glasses on the bar, bottle rows, pool-table rails and balls, dartboard on the prop, portholes, five stools
{const k=anchor,cols=['#29e6d6','#ff3ea5','#ffc94a','#3dd68c'],wood=lam('#6b4426'),mugs=iCol('#9ff0ff');
 const dart=atlas(128,128,(g,X,Y,w,h)=>{g.fillStyle='#14111f';g.fillRect(X,Y,w,h);for(let i=5;i>=1;i--){g.fillStyle=i%2?'#ffc94a':'#ff3ea5';g.beginPath();g.arc(X+w/2,Y+h/2,i*w/12,0,TAU);g.fill()}});
 for(let i=0;i<6;i++)iCy(k,60+i*32,58,18,1.4,8,iChrome,6);
 for(let i=0;i<5;i++)iCy(k,90+i*28,66,18,2,6,mugs,6);
 for(let i=0;i<12;i++)iCy(k,40+i*16,22,46,2,12,iCol(cols[i%4]),6);
 iB(k,200,148,14,120,2,2,wood);iB(k,200,212,14,120,2,2,wood);iB(k,198,150,14,2,2,64,wood);iB(k,318,150,14,2,2,64,wood);
 iSp(k,240,180,14,2.6,iCol('#fff1d6'));iSp(k,250,176,14,2.6,iCol('#ff3ea5'));iSp(k,262,184,14,2.6,iCol('#ffc94a'));
 iPl(k,365.4,105,14,26,26,ATL.m,-Math.PI/2,dart);
 for(let i=0;i<4;i++)iTo(k,80+i*70,1.4,60,8,1.4,iChrome);
 for(let i=0;i<5;i++)iStool(k,56+i*40,94,lam('#7a4e2a'));
 iMatExit(k,190,230);iSign(k,190,259.4,56,'RUSTY ANCHOR','#ffc94a',Math.PI,80,15);iGlow(k,190,130,260,'rgba(255,201,74,.2)')}
// banks: door mat, lit exit sign and floor glow
{iMatExit(bankL,220,290);iSign(bankL,220,319.4,56,'UNION BANK','#ffc94a',Math.PI,90,15);iGlow(bankL,220,160,300,'rgba(255,201,74,.2)')}
{iMatExit(bankS,190,230);iSign(bankS,190,259.4,56,'FLOOR 12','#29e6d6',Math.PI,70,15);iGlow(bankS,190,130,240,'rgba(41,230,214,.22)')}
{iMatExit(bankV,210,300);iSign(bankV,210,329.4,56,'VAULT','#ffc94a',Math.PI,70,15);iGlow(bankV,210,170,260,'rgba(255,216,120,.3)')}
// vault: 24 safe deposit boxes on the back wall (one merged mesh, lock plates included), a camera on a ceiling bracket, a lit cash cart by the front-left corner
{const v=bankV,st=lam('#aeb7c6'),L=[],mx=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z);
 for(let t=0;t<2;t++)for(let i=0;i<12;i++){const x=v.ox+290+i*10;L.push([box(9,12,8),mx(x+4.5,6+t*12,v.oy+4)],[box(3,3,1),mx(x+4.5,7.5+t*12,v.oy+8.5)])}
 scene.add(new THREE.Mesh(mergeGeos(L),st));
 iB(v,30,18,62,2,10,2,M.black);iB(v,26,14,56,10,6,8,M.black);iB(v,29,22,57,4,4,1.5,st);iB(v,34,22,58,1.2,1.2,.6,iCol('#ff3a3a'));
 const cx=40,cy=262;
 for(const[x,y]of[[cx+2,cy+2],[cx+28,cy+2],[cx+2,cy+16],[cx+28,cy+16]]){iCy(v,x,y,0,2.2,2,M.black,8);iB(v,x-.7,y-.7,2,1.4,14,1.4,st)}
 iB(v,cx,cy,8,30,1.2,18,st);iB(v,cx,cy,16,30,1.2,18,st);
 for(let i=0;i<3;i++)for(let j=0;j<2;j++)iB(v,cx+3+i*9,cy+3+j*7,17.2,7,2.6,5,iCol('#3dd68c'));
 iGlow(v,cx+15,cy+9,70,'rgba(61,214,140,.35)')}
if(DBG)Object.defineProperties(DBG,{testCam:{get:()=>({vault:()=>gotoFloor(bankV,210,300),turn:a=>{look.yaw=a}})}}); // debug only: stand in the vault, turn the camera
// garage markers and for-sale signs on the street (one ring and one sign per house, a sign per unowned house)
function houseMeshes(){for(const p of PROPS){const g=p.garage;
  const ring=new THREE.Mesh(new THREE.RingGeometry(9,12,28),new THREE.MeshBasicMaterial({color:'#4aa3ff',transparent:true,opacity:.85,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(g.x,1.6,g.y);scene.add(ring);
  const gs=new THREE.Mesh(new THREE.PlaneGeometry(56,14),new THREE.MeshBasicMaterial({map:signTex('GARAGE','#4aa3ff')}));gs.position.set(g.x,38,g.y+11.8);gs.rotation.y=Math.PI;scene.add(gs);
  if(p.id!=='home'){const sale=new THREE.Mesh(new THREE.PlaneGeometry(56,14),new THREE.MeshBasicMaterial({map:signTex(`FOR SALE $${p.price/1000}K`,'#ffc94a')}));sale.position.set(p.door.x-64,30,p.door.y+11.8);sale.rotation.y=Math.PI;sale.visible=!p.owned;scene.add(sale);p.sale=sale}}}
houseMeshes();
// property interiors: a window band on the back wall, an exit mat and a lit sign (furniture is in the properties section)
for(const p of PROPS.slice(1)){const r=p.int;iWin(r,r.w/2,.6,36,r.w-40,14);iPoster(r,1,r.h*.5,46,36,46,iArt(p.door.col),Math.PI/2);iStrip(r,r.w/2-30,r.h/2-12,60,20,'#fff1d6');iFl(r,r.w/2,r.h/2+14,.4,r.w*.5,r.h*.4,lam(shade(p.door.col,.3)),true);iMatExit(r,r.w/2,r.h-30);iSign(r,r.w/2,r.h-.6,56,p.tag,'#7dd3fc',Math.PI,80,15);iGlow(r,r.w/2,130,240,'rgba(41,230,214,.22)')}
// rack LEDs: one 8x8 lit grid, its offset steps every quarter second in animInteriors (no redraw, no new material)
const ledTex=rtex(128,128,(g)=>{g.fillStyle='#06100e';g.fillRect(0,0,128,128);const r=seeded(40),C=['#29e6d6','#3dd68c','#ffc94a','#ff3ea5'];for(let y=0;y<8;y++)for(let x=0;x<8;x++){g.fillStyle=r()<.6?C[Math.floor(r()*4)]:'#1a2a2a';g.beginPath();g.arc(x*16+8,y*16+8,4,0,TAU);g.fill()}});
const bankFx={lasers:[],door:null,gold:null};
{const L=bankL,S=bankS,V=bankV;
 for(const[x,y]of[[150,120],[290,120],[150,220],[290,220]]){const c=new THREE.Mesh(new THREE.CylinderGeometry(7,7,72,12),lam('#cfc8b8'));c.position.set(L.ox+x,36,L.oy+y);scene.add(c)}
 const lt=new THREE.Mesh(new THREE.PlaneGeometry(150,36),new THREE.MeshBasicMaterial({map:signTex('Union Bank','#ffc94a')}));lt.position.set(L.ox+220,48,L.oy+.6);scene.add(lt);
 for(let k=0;k<3;k++){const pc=new THREE.Mesh(new THREE.BoxGeometry(14,10,1),new THREE.MeshBasicMaterial({color:'#7fe9ff'}));pc.position.set(L.ox+40,18,L.oy+80+k*76+1);scene.add(pc)}
 const rackMat=new THREE.MeshBasicMaterial({map:ledTex});for(let k=0;k<4;k++)iPl(S,47+k*62,88.6,16,22,32,rackMat);
 const scr=new THREE.Mesh(new THREE.PlaneGeometry(56,20),new THREE.MeshBasicMaterial({color:'#3dd68c'}));scr.position.set(S.ox+190,24,S.oy+140);scr.rotation.x=-.2;scene.add(scr);
 bankFx.door=new THREE.Group();bankFx.door.position.set(V.ox+210-48,0,V.oy+31);const dm=new THREE.Mesh(new THREE.CylinderGeometry(46,46,8,32),lam('#9a8a5a'));dm.rotation.x=Math.PI/2;dm.position.set(48,48,0);bankFx.door.add(dm);
 for(let k=0;k<6;k++){const sp=new THREE.Mesh(new THREE.BoxGeometry(40,3,3),lam('#6a5f3c'));sp.position.set(48,48,4.5);sp.rotation.z=k*Math.PI/6;bankFx.door.add(sp)}scene.add(bankFx.door);
 bankFx.gold=new THREE.Group();const gm=new THREE.MeshBasicMaterial({color:'#ffc94a'});for(const[x,y]of[[64,32],[356,32],[210,84]])for(let k=0;k<9;k++){const bar=new THREE.Mesh(new THREE.BoxGeometry(10,4,5),gm);bar.position.set(V.ox+x-12+(k%3)*12,2+Math.floor(k/3)*4.2,V.oy+y-6+((k*7)%3)*5);bankFx.gold.add(bar)}scene.add(bankFx.gold);
 const lm=new THREE.MeshBasicMaterial({color:'#ff2d2d',transparent:true,opacity:.85});for(let i=0;i<3;i++){const l=new THREE.Mesh(new THREE.BoxGeometry(V.w-24,1.2,1.2),lm);l.position.set(V.ox+V.w/2,12,0);scene.add(l);const l2=new THREE.Mesh(new THREE.BoxGeometry(V.w-24,1.2,1.2),lm);l2.position.set(V.ox+V.w/2,22,0);scene.add(l2);bankFx.lasers.push([l,l2])}}
function bankAnim(dt){for(let i=0;i<3;i++){const y=laserY(i);for(const l of bankFx.lasers[i])l.position.z=y}
  const open=!!(heist.bits&8);bankFx.door.rotation.y+=((open?-1.6:0)-bankFx.door.rotation.y)*Math.min(1,dt*1.5);bankFx.gold.visible=open}
const lapDancer=personMesh('#ff3ea5','#f1c9a5',false,{bikini:true,hair:'#2a1a12'});lapDancer.visible=false;scene.add(lapDancer);
{const C=club,neon=c=>new THREE.MeshBasicMaterial({color:c}),pinkT=new THREE.MeshBasicMaterial({color:'#ff3ea5',transparent:true,opacity:.28,side:THREE.DoubleSide});
 const cur1=new THREE.Mesh(new THREE.PlaneGeometry(90,60),pinkT);cur1.position.set(C.ox+330,30,C.oy+285);cur1.rotation.y=Math.PI/2;scene.add(cur1);
 const cur2=new THREE.Mesh(new THREE.PlaneGeometry(60,60),pinkT);cur2.position.set(C.ox+410,30,C.oy+240);scene.add(cur2);
 const vip=new THREE.Mesh(new THREE.PlaneGeometry(60,20),new THREE.MeshBasicMaterial({map:signTex('VIP','#ff3ea5'),transparent:true}));vip.position.set(C.ox+386,46,C.oy+329.3);vip.rotation.y=Math.PI;scene.add(vip);
 for(const[x,z,c]of[[110,20,'#ff3ea5'],[330,20,'#29e6d6'],[110,80,'#29e6d6'],[330,80,'#ff3ea5']]){const n=new THREE.Mesh(new THREE.BoxGeometry(2,60,2),neon(c));n.position.set(C.ox+x,36,C.oy+z);scene.add(n)}
 const edge=new THREE.Mesh(new THREE.BoxGeometry(220,1,1.5),neon('#ff3ea5'));edge.position.set(C.ox+220,6.2,C.oy+80.5);scene.add(edge);
 const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(9,1),new THREE.MeshPhongMaterial({color:'#e6e1f0',emissive:'#555',shininess:150,specular:'#ffffff',flatShading:true}));ball.position.set(C.ox+220,60,C.oy+170);scene.add(ball);clubBall=ball;
 for(const[x,y]of[[70,295],[140,295],[300,180]]){const cs=new THREE.Mesh(new THREE.BoxGeometry(50,8,18),lam('#5a1a4a'));cs.position.set(C.ox+x,4,C.oy+y+10);scene.add(cs)}
 const st=new THREE.Mesh(new THREE.PlaneGeometry(1,1),additive(glowTex('rgba(255,62,165,.5)')));st.rotation.x=-Math.PI/2;st.scale.set(260,120,1);st.position.set(C.ox+220,6.4,C.oy+50);scene.add(st)}
function lapAnim(dt){lapDancer.visible=!!lap;if(!lap)return;const t=lap.t,ud=lapDancer.userData,spin=(t%7)>6?((t%7)-6)*TAU:0;
  lapDancer.position.set(club.ox+386+Math.sin(t*1.1)*5,Math.abs(Math.sin(t*3.2))*1.4,club.oy+274+Math.sin(t*.8)*4);lapDancer.rotation.set(0,-Math.PI/2+Math.sin(t*2)*.45+spin,Math.sin(t*3.2)*.08);
  ud.l1.rotation.z=Math.sin(t*3.2)*.25;ud.l2.rotation.z=-Math.sin(t*3.2)*.25;ud.a1.rotation.z=0;ud.a2.rotation.z=0;ud.a1.rotation.x=-(1.9+Math.sin(t*3)*.5);ud.a2.rotation.x=1.9+Math.sin(t*3+1)*.5}
function animInteriors(dt){
  for(const q of iRoomOnly)q.m.visible=me.inside===q.r;
  for(const f of fireGlows){const k=f.userData.s*(.85+Math.random()*.3);f.scale.set(k,k,1)}
  lapAnim(dt);landmarkTick();if(clubBall)clubBall.rotation.y+=dt*.8;
  bankAnim(dt);
  if(ferris)ferris.rotation.z+=dt*.12;
  if(roul)roul.rotation.y+=dt*1.6;
  clubHype=Math.max(0,clubHype-dt);const sp=clubHype>0?2.4:1;
  for(const a of intAnim){if(a.kind==='dancer'){a.ph+=dt*sp*1.1;a.m.position.set(a.cx+Math.cos(a.ph)*6,6+Math.abs(Math.sin(a.ph*2.5))*2,a.cz+Math.sin(a.ph)*6);a.m.rotation.y=-a.ph-Math.PI/2;animPerson(a.m,a.ph*3)}
    else a.m.position.y=Math.abs(Math.sin(time*4*sp+a.ph))*1.6}
  tileT-=dt;if(tileT<=0&&danceFloor){tileT=.4/sp;for(let i=0;i<danceFloor.count;i++)danceFloor.setColorAt(i,tileCols[(rand()*tileCols.length)|0]);danceFloor.instanceColor.needsUpdate=true}
  clubLights[0].position.set(club.ox+220+Math.cos(time)*150,58,club.oy+165+Math.sin(time*1.3)*110);
  clubLights[1].position.set(club.ox+220-Math.cos(time*.8)*150,58,club.oy+165-Math.sin(time*1.1)*110);
  ledTex.offset.y=(Math.floor(time*4)&7)/8;
  if(tv)tv.material.color.setHSL(.58+Math.sin(time*3)*.05,.7,.45+Math.sin(time*11)*.08);
}
function heliMesh(){const g=new THREE.Group(),ud=g.userData,mil=lam('#3b4838'),dk=M.black,body=new THREE.Group();g.add(body);ud.body=body;
  const add=(geo,mat,x,y,z,p)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);(p||body).add(m);return m};
  add(box(36,13,16),mil,0,12,0);add(box(12,9,14),M.glass,18,13,0);add(box(10,7,12),mil,26,10,0);add(box(46,4,4),mil,-39,15,0);add(box(9,13,1.5),mil,-60,21,0);add(box(14,1.2,8),mil,-58,16,0);
  add(box(6,1.2,30),mil,4,11,0);for(const z of[-14,14]){const p=add(new THREE.CylinderGeometry(2.4,2.4,16,8),dk,4,9,z);p.rotation.z=Math.PI/2}
  for(const z of[-8,8]){add(box(42,1.3,1.3),dk,0,1,z);for(const x of[-10,10])add(box(1.3,6,1.3),dk,x,4,z)}
  add(box(2,2,2),M.red,-62,26,0);add(box(1.6,1.6,1.6),M.tail,4,11.5,-15.5);add(box(1.6,1.6,1.6),new THREE.MeshBasicMaterial({color:'#3dff7a'}),4,11.5,15.5);
  const rot=new THREE.Group();rot.position.set(0,21,0);for(let i=0;i<2;i++){const bl=new THREE.Mesh(box(112,.7,4),dk);bl.rotation.y=i*Math.PI/2;rot.add(bl)}add(new THREE.CylinderGeometry(2.4,2.4,4,8),dk,0,0,0,rot);body.add(rot);ud.rotor=rot;
  const tr=new THREE.Group();tr.position.set(-60,18,1.8);for(let i=0;i<2;i++){const bl=new THREE.Mesh(box(1,15,1.2),dk);bl.rotation.z=i*Math.PI/2;tr.add(bl)}body.add(tr);ud.trotor=tr;
  const beam=new THREE.Mesh(new THREE.PlaneGeometry(1,1),M.beam);beam.rotation.x=-Math.PI/2;beam.scale.set(110,110,1);ud.beam=beam;
  return g}
const heliObj=heliMesh();scene.add(heliObj);
const heliShadow=new THREE.Mesh(G.blob,M.shadow);heliShadow.rotation.x=-Math.PI/2;scene.add(heliShadow);
// police helicopter: body and rotor from the same model, plus a searchlight aimed at the player
const copHeliObj=heliMesh();copHeliObj.visible=false;scene.add(copHeliObj);
const copHeliCone=new THREE.Mesh(new THREE.ConeGeometry(1,1,16,1,true),new THREE.MeshBasicMaterial({color:'#d8ecff',transparent:true,opacity:.14,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
copHeliCone.visible=false;scene.add(copHeliCone);
const copHeliSpot=new THREE.Mesh(new THREE.PlaneGeometry(1,1),additive(glowTex('rgba(190,224,255,.85)'),.75));copHeliSpot.rotation.x=-Math.PI/2;copHeliSpot.visible=false;scene.add(copHeliSpot);
const copHeliUp=new THREE.Vector3(0,1,0),copHeliAim=new THREE.Vector3();
function copHeliDraw(dt){
  const h=copHeli,live=!!h&&!h.dead;copHeliObj.visible=live;
  if(!live){copHeliCone.visible=copHeliSpot.visible=false;return}
  copHeliObj.position.set(h.x,h.z,h.y);copHeliObj.rotation.set(0,-h.a,0);
  copHeliObj.userData.rotor.rotation.y+=dt*(h.falling?46:26);copHeliObj.userData.trotor.rotation.z+=dt*(h.falling?70:40);
  const beam=!h.falling;copHeliCone.visible=copHeliSpot.visible=beam;
  if(!beam)return;
  const tz=groundZ(copX(),copY())+1,dx=copX()-h.x,dy=tz-h.z,dz=copY()-h.y,len=Math.hypot(dx,dy,dz)||1;
  copHeliAim.set(-dx,-dy,-dz).divideScalar(len);copHeliCone.quaternion.setFromUnitVectors(copHeliUp,copHeliAim);
  copHeliCone.position.set(h.x+dx/2,h.z+dy/2,h.y+dz/2);const rad=clamp(len*.22,16,40);copHeliCone.scale.set(rad,len,rad);
  copHeliSpot.position.set(copX(),tz+.5,copY());const s=44+Math.sin(time*9)*3;copHeliSpot.scale.set(s,s,1);
}
{const pad=new THREE.Mesh(new THREE.CircleGeometry(62,40),lam('#2a2733'));pad.rotation.x=-Math.PI/2;pad.position.set(PAD.x,1.7,PAD.y);scene.add(pad);
 const hT=canvasTex(256,256,(g)=>{g.strokeStyle='#ffc94a';g.lineWidth=12;g.beginPath();g.arc(128,128,112,0,TAU);g.stroke();g.fillStyle='#f3ecff';g.font='170px Bungee, Impact, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('H',128,138)});
 const hm=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial({map:hT,transparent:true}));hm.rotation.x=-Math.PI/2;hm.position.set(PAD.x,1.9,PAD.y);scene.add(hm);
 for(let i=0;i<12;i++){const a=i/12*TAU,l=new THREE.Mesh(box(3,2,3),new THREE.MeshBasicMaterial({color:'#3dff7a'}));l.position.set(PAD.x+Math.cos(a)*64,2.5,PAD.y+Math.sin(a)*64);scene.add(l)}}
// airport, fighter jets, powder dealer
// The airfield (AF, see the district code): the car park, terminal and control tower by the gate on the west side, the runway, taxiway and apron on the east.
{const flat=(x0,y0,x1,y1,col,yy)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,y1-y0),lam(col));m.rotation.x=-Math.PI/2;m.position.set((x0+x1)/2,yy,(y0+y1)/2);scene.add(m)};
 const dmat=new THREE.MeshBasicMaterial({color:'#e8e4f0'}),fm=lam('#5a6270'),tankM=lam('#8a909c');
 flat(AF.x0,AF.y0,AF.x1,AF.y1,'#262830',.35);
 flat(RWX-48,300,RWX+48,2300,'#15161a',.5); // runway, 96 wide, from 300 to 2300
 flat(RWX+60,300,RWX+86,2430,'#1f2129',.6); // taxiway east of the runway, down to the apron
 flat(RWX+48,2290,RWX+86,2320,'#1f2129',.62); // link from the runway end to the taxiway
 flat(RWX+71,300,RWX+73,2430,'#e0b020',.65); // taxiway centre line
 flat(4096,2430,4392,2625,'#2a2d36',.6); // apron: the fighter jets are parked here (JET_SPOTS)
 flat(3650,1140,3770,1510,'#2b2d36',.6); // car park in front of the terminal, across from the gate
 const dashes=new THREE.InstancedMesh(box(3,.2,30),dmat,30);let n=0;for(let y=340;y<2260;y+=70)inst(dashes,n++,RWX,.67,y,0);dashes.count=n;scene.add(dashes);
 for(const yy of[320,2280])for(let i=-4;i<=4;i++){const st=new THREE.Mesh(box(6,.2,24),dmat);st.position.set(RWX+i*10,.67,yy);scene.add(st)}
 const bays=new THREE.InstancedMesh(box(120,.2,.8),new THREE.MeshBasicMaterial({color:'#6d7288'}),30);let k=0;for(let z=1150;z<1500;z+=12)inst(bays,k++,3710,.67,z,0);bays.count=k;scene.add(bays);
 const lights=[];for(let y=320;y<2300;y+=60)for(const sx of[-52,52])lights.push([RWX+sx,y]);
 const lm=new THREE.InstancedMesh(box(2.4,1.4,2.4),new THREE.MeshBasicMaterial({color:'#7fe9ff'}),lights.length);lights.forEach(([x,y],i)=>inst(lm,i,x,1.2,y,0));scene.add(lm);
 const tank=new THREE.CylinderGeometry(13,13,16,16);for(const x of[4118,4150]){const t=new THREE.Mesh(tank,tankM);t.position.set(x,groundZ(x,2285)+8,2285);scene.add(t)}
 const sig=new THREE.Mesh(new THREE.PlaneGeometry(150,34),new THREE.MeshBasicMaterial({map:signTex('Palmetto Intl','#7fe9ff')}));sig.position.set(3779,20,1380);sig.rotation.y=-Math.PI/2;scene.add(sig);
 const door=new THREE.Mesh(new THREE.PlaneGeometry(40,14),doorMat);door.position.set(3779.5,7,1380);door.rotation.y=-Math.PI/2;scene.add(door);
 // control tower (building footprint 3650-3690, 1090-1130, height 150): base, shaft, glass cab, beacon
 const tower=[[box(40,10,40),lam('#4a4f5c'),5],[new THREE.CylinderGeometry(7,9,150,12),lam('#c9c3d6'),75],[new THREE.CylinderGeometry(17,14,18,16),glassMat,141],[box(4,4,4),redLight,154]];
 for(const[g,m,y]of tower){const t=new THREE.Mesh(g,m);t.position.set(3670,y,1110);scene.add(t)}
 for(const b of buildings)if(b.kind==='fence'){const g=b.h>b.w?new THREE.BoxGeometry(1.2,b.H,b.h):new THREE.BoxGeometry(b.w,b.H,1.2),m=new THREE.Mesh(g,fm);m.position.set(b.x+b.w/2,b.H/2,b.y+b.h/2);scene.add(m)}
 const dl=personMesh('#26232e','#6b4630',false);dl.position.set(DEALER.x,0,DEALER.y);dl.rotation.y=-Math.PI/4;scene.add(dl);
 const dr=new THREE.Mesh(new THREE.RingGeometry(9,12,24),new THREE.MeshBasicMaterial({color:'#f3ecff',side:THREE.DoubleSide}));dr.rotation.x=-Math.PI/2;dr.position.set(DEALER.x+12,.8,DEALER.y+12);scene.add(dr);shopRings.push(dr)}
function jetMesh(){const g=new THREE.Group(),ud=g.userData,body=new THREE.Group();g.add(body);ud.body=body;
  const grey=new THREE.MeshPhongMaterial({color:'#7d8594',shininess:60,specular:'#666666'}),dark=lam('#3a404a'),wingM=new THREE.MeshPhongMaterial({color:'#6e7685',shininess:40,side:THREE.DoubleSide});
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);body.add(m);return m};
  add(new THREE.CylinderGeometry(3.4,4.2,46,14),grey,-2,7,0).rotation.z=Math.PI/2;
  add(new THREE.ConeGeometry(3.4,16,14),grey,29,7,0).rotation.z=-Math.PI/2;
  add(new THREE.SphereGeometry(2.8,14,10),glassM,13,10.2,0).scale.set(3.2,1.1,1);
  const ws=new THREE.Shape();ws.moveTo(8,0);ws.lineTo(-12,22);ws.lineTo(-19,22);ws.lineTo(-17,0);ws.closePath();
  const wg=new THREE.ExtrudeGeometry(ws,{depth:1,bevelEnabled:false});wg.rotateX(Math.PI/2);add(wg,wingM,0,6.6,2.5);add(wg,wingM,0,6.6,-2.5).scale.z=-1;
  const fs=new THREE.Shape();fs.moveTo(-12,0);fs.lineTo(-20,13);fs.lineTo(-24,13);fs.lineTo(-23,0);fs.closePath();
  const fg=new THREE.ExtrudeGeometry(fs,{depth:.8,bevelEnabled:false});for(const z of[2.6,-3.4])add(fg,wingM,0,8,z).rotation.x=z>0?-.22:.22;
  const ts=new THREE.Shape();ts.moveTo(-17,0);ts.lineTo(-23,9);ts.lineTo(-26,9);ts.lineTo(-25,0);ts.closePath();const tg=new THREE.ExtrudeGeometry(ts,{depth:.8,bevelEnabled:false});tg.rotateX(Math.PI/2);
  add(tg,wingM,0,6.4,3);add(tg,wingM,0,6.4,-3).scale.z=-1;
  for(const z of[3.6,-3.6])add(box(14,3.4,2.6),dark,8,6,z);
  add(new THREE.CylinderGeometry(3,3.4,3,12),dark,-25.5,7,0).rotation.z=Math.PI/2;
  for(const z of[11,-11])add(new THREE.CylinderGeometry(.7,.7,10,8),M.white,-2,4.8,z).rotation.z=Math.PI/2;
  ud.gear=new THREE.Group();for(const[x,z]of[[18,0],[-6,4],[-6,-4]]){const w=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,1,10),M.wheel);w.rotation.x=Math.PI/2;w.position.set(x,1.4,z);ud.gear.add(w);const st=new THREE.Mesh(box(.6,3,.6),dark);st.position.set(x,3.2,z);ud.gear.add(st)}body.add(ud.gear);
  ud.burner=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('rgba(255,150,60,1)'),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));ud.burner.position.set(-30,7,0);ud.burner.scale.set(8,8,1);body.add(ud.burner);
  return g}
const jetObjs=[],jetShadows=[];
function renderJets(dt){for(let k=0;k<jets.length;k++){const j=jets[k];if(!jetObjs[k]){jetObjs[k]=jetMesh();scene.add(jetObjs[k]);const sd=new THREE.Mesh(G.blob,M.shadow);sd.rotation.x=-Math.PI/2;scene.add(sd);jetShadows[k]=sd}
  const o=jetObjs[k],sd=jetShadows[k];o.visible=sd.visible=!j.dead&&!far(j.x,j.y,2600);if(!o.visible)continue;
  o.position.set(j.x,j.z,j.y);o.rotation.set(0,-j.a,0);o.userData.body.rotation.set(j.roll,0,j.pitch);o.userData.gear.visible=j.z<30;
  const bs=6+j.speed/40;o.userData.burner.scale.set(bs,bs,1);o.userData.burner.material.opacity=clamp(j.speed/300,.15,1);
  const g=heliGround(j.x,j.y),ss=Math.max(.15,1-(j.z-g)/700);sd.position.set(j.x,g+.6,j.y);sd.scale.set(34*ss,24*ss,1)}}
const meMesh=personMesh(myColor,'#e0b48f',true);scene.add(meMesh);let meColorNow=myColor;
const carMeshes=new Map(),pedMeshes=new Map(),remoteMeshes=new Map(),bulletMeshes=new Map(),cashMeshes=new Map(),spikeMeshes=new Map();
const spkMat=new THREE.MeshLambertMaterial({color:'#191921'}),spkTipMat=new THREE.MeshLambertMaterial({color:'#aab0c2'}),spkTip=new THREE.ConeGeometry(1.7,7,6);
function syncMap(map,list,make,update){
  const live=new Set(list);
  for(const[k,m]of map)if(!live.has(k)){scene.remove(m);map.delete(k)}
  for(const o of list){let m=map.get(o);if(!m){m=make(o);map.set(o,m);scene.add(m)}update(o,m)}
}
const far=(x,y,d)=>Math.abs(x-me.x)>d||Math.abs(y-me.y)>d;

// particles
const PMAX=900;
function pointsLayer(blending,size,opacity){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(PMAX*3),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(PMAX*3),3));
  const p=new THREE.Points(g,new THREE.PointsMaterial({size,map:glowTex('rgba(255,255,255,1)'),vertexColors:true,transparent:true,opacity,blending,depthWrite:false}));p.frustumCulled=false;scene.add(p);return p}
const glowPts=pointsLayer(THREE.AdditiveBlending,10,1),smokePts=pointsLayer(THREE.NormalBlending,26,.55);
const pc={};const pcol=s=>pc[s]||(pc[s]=new THREE.Color(s));
// flash lights
const flashes=[0,1,2].map(()=>{const l=new THREE.PointLight('#ffb86b',0,320,2);scene.add(l);return l});let flashI=0;
const headSpot=new THREE.SpotLight('#fff1d0',0,520,.55,.6,1);scene.add(headSpot,headSpot.target);

// sky dome: one sphere and one canvas texture, painted once. Canvas top is the zenith and the middle row is the horizon.
// The moon and the city glow use the same directions as the moon light and the map centre, so they sit where the light comes from.
const MOONDIR=new THREE.Vector3(-.6,1,.4).normalize(),DTC=3.5*(B+R)+B/2; // downtown hotspot: block 3.5,3.5 (see the tall-building density in mkCity)
function skyPaint(g,w,h){
  const r=seeded(4242),hz=h/2,rep=(x,f)=>{for(const d of[-w,0,w])f(x+d)},dot=(x,y,s)=>rep(x,X=>{g.beginPath();g.arc(X,y,s,0,TAU);g.fill()}),azX=(dx,dz)=>((Math.atan2(dz,-dx)/TAU+1)%1)*w;
  const gr=g.createLinearGradient(0,0,0,h);
  gr.addColorStop(0,'#04020c');gr.addColorStop(.3,'#0e0727');gr.addColorStop(.44,'#27103f');gr.addColorStop(.5,'#431656');gr.addColorStop(.56,'#22102f');gr.addColorStop(1,'#0a0517');
  g.fillStyle=gr;g.fillRect(0,0,w,h);
  for(let i=0;i<600;i++){const e=90*Math.pow(r(),.85),y=hz*(1-e/90),b=r(),s=b>.92?1:.65;
    g.fillStyle=r()<.12?'#ffd6f2':r()<.25?'#bfe6ff':'#ffffff';g.globalAlpha=(.55+.45*b)*Math.min(1,.4+e/40);dot(r()*w,y,s)}
  g.globalAlpha=1;
  for(const e of[10,22,34]){const y=hz*(1-e/90);for(let k=0;k<70;k++){const x=r()*w,rx=40+r()*130,ry=2+r()*4,yy=y+r()*6-3,a=.25+r()*.25;
    rep(x,X=>{g.fillStyle=`rgba(8,4,20,${a})`;g.beginPath();g.ellipse(X,yy,rx,ry,0,0,TAU);g.fill()})}}
  g.globalCompositeOperation='lighter';
  const band=g.createLinearGradient(0,hz-70,0,hz+20);band.addColorStop(0,'rgba(200,50,160,0)');band.addColorStop(.78,'rgba(200,50,160,.26)');band.addColorStop(1,'rgba(200,50,160,0)');
  g.fillStyle=band;g.fillRect(0,hz-70,w,90);
  const dx=azX(DTC,DTC);
  g.save();g.translate(0,hz);g.scale(1,.22);
  rep(dx,X=>{const dg=g.createRadialGradient(X,0,0,X,0,340);dg.addColorStop(0,'rgba(255,110,70,.55)');dg.addColorStop(.3,'rgba(255,50,140,.3)');dg.addColorStop(1,'rgba(255,40,140,0)');g.fillStyle=dg;g.fillRect(X-340,-340,680,680)});
  g.restore();
  const mx=azX(MOONDIR.x,MOONDIR.z),my=Math.acos(MOONDIR.y)/Math.PI*h;
  rep(mx,X=>{const mg=g.createRadialGradient(X,my,0,X,my,130);mg.addColorStop(0,'rgba(190,205,255,.5)');mg.addColorStop(.25,'rgba(140,160,255,.2)');mg.addColorStop(1,'rgba(120,140,255,0)');g.fillStyle=mg;g.fillRect(X-130,my-130,260,260)});
  g.globalCompositeOperation='source-over';
  rep(mx,X=>{const mg=g.createRadialGradient(X,my,0,X,my,9);mg.addColorStop(0,'#ffffff');mg.addColorStop(.8,'#eef2ff');mg.addColorStop(1,'rgba(220,228,255,.4)');g.fillStyle=mg;g.beginPath();g.arc(X,my,9,0,TAU);g.fill()});
}
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(6500,48,24),new THREE.MeshBasicMaterial({map:canvasTex(1024,512,skyPaint),side:THREE.BackSide,fog:false,depthWrite:false}));
skyDome.frustumCulled=false;skyDome.renderOrder=-1;scene.add(skyDome);scene.add(rain);
// the outdoor fog colour is the horizon; indoors keeps the old colour so interiors look exactly as before
let fogIn=false;function roomFog(){const on=!!me.inside;if(on===fogIn)return;fogIn=on;skyLook()}

// camera state
const camPos=new THREE.Vector3(me.x,40,me.y+60);
if(DBG)Object.defineProperties(DBG,{view:{get:()=>view}});
function view(x,y,yaw,pitch){me.x=x;me.y=y;me.z=groundZ(x,y);me.vx=me.vy=0;look.yaw=yaw;look.pitch=clamp(pitch,-.45,1.3);camPos.set(x,60,y)}
const aimRay=new THREE.Raycaster(),ndcX=new THREE.Vector2(0,.08),ndc0=new THREE.Vector2(0,0);
