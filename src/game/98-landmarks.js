// ---------- landmarks meshes ----------
// Built after the terrain meshes and before staticBatch. Static pieces merge per material; animated ones are instanced or kept apart.
function landmarkMeshes(){
  const lmm={};for(const k in LMC)lmm[k]=new THREE.MeshLambertMaterial({color:LMC[k]});
  lmm.water.emissive=new THREE.Color('#0a3346');
  for(const b of LMS){const cx=b.x+b.w/2,cz=b.y+b.h/2,m=new THREE.Mesh(new THREE.BoxGeometry(b.w,b.H,b.h),lmm[b.m]);m.position.set(cx,groundZ(cx,cz)+b.H/2,cz);scene.add(m)}
  // fountain: round basin, water disc, spout (the spray is animated in landmarkTick)
  const fx=1160,fy=2040,fg=groundZ(fx,fy);
  const basin=new THREE.Mesh(new THREE.CylinderGeometry(20,22,3.2,24),lmm.stone);basin.position.set(fx,fg+1.6,fy);scene.add(basin);
  const wat=new THREE.Mesh(new THREE.CylinderGeometry(17,17,.3,24),lmm.water);wat.position.set(fx,fg+2.4,fy);scene.add(wat);
  const spout=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.5,9,6),lmm.stone);spout.position.set(fx,fg+8,fy);scene.add(spout);
  LMA.spray=new THREE.InstancedMesh(new THREE.SphereGeometry(1.1,6,4),new THREE.MeshBasicMaterial({color:'#bfeaf5',transparent:true,opacity:.8}),8);scene.add(LMA.spray);
  // planters carry a tree each
  const pl=LMS.filter(b=>b.m==='planter'),tr=new THREE.InstancedMesh(new THREE.CylinderGeometry(.9,1.3,8,6),new THREE.MeshLambertMaterial({color:'#4a3426'}),Math.max(1,pl.length)),
    lf=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:'#2a7a4c',flatShading:true}),Math.max(1,pl.length));
  pl.forEach((b,i)=>{const x=b.x+b.w/2,y=b.y+b.h/2,g=groundZ(x,y);inst(tr,i,x,g+4+4,y,0);inst(lf,i,x,g+4+10,y,i,6,7,6)});tr.count=lf.count=pl.length;scene.add(tr,lf);
  // benches and lamps on the plaza walks, kept out of ramp landing zones
  const bench=mergeGeos([[new THREE.BoxGeometry(14,1.2,4.5),new THREE.Matrix4().makeTranslation(0,3.4,0)],[new THREE.BoxGeometry(14,5,.8),new THREE.Matrix4().makeTranslation(0,6,-2.2)],[new THREE.BoxGeometry(1,3,4),new THREE.Matrix4().makeTranslation(-5.5,1.5,0)],[new THREE.BoxGeometry(1,3,4),new THREE.Matrix4().makeTranslation(5.5,1.5,0)]]);
  const bl=[[1100,2000,0],[1220,2000,0],[1100,2090,Math.PI],[1220,2090,Math.PI]].filter(([x,y])=>!rampZone(x,y));
  const bm=new THREE.InstancedMesh(bench,new THREE.MeshLambertMaterial({color:'#5a4030'}),Math.max(1,bl.length));bl.forEach(([x,y,r],i)=>inst(bm,i,x,groundZ(x,y)+1.3,y,r));bm.count=bl.length;scene.add(bm);
  const lp=[[1040,2000],[1280,2000],[1040,2080],[1280,2080]].filter(([x,y])=>!rampZone(x,y)),lpo=new THREE.InstancedMesh(new THREE.CylinderGeometry(.5,.7,16,6),lmm.metal,Math.max(1,lp.length)),
    lhd=new THREE.InstancedMesh(new THREE.SphereGeometry(1.6,8,6),new THREE.MeshBasicMaterial({color:'#ffdf9e'}),Math.max(1,lp.length));
  lp.forEach(([x,y],i)=>{const g=groundZ(x,y);inst(lpo,i,x,g+8,y);inst(lhd,i,x,g+16.4,y)});lpo.count=lhd.count=lp.length;scene.add(lpo,lhd);
  // alleys: fire escape platforms and ladders on the alley side of the west half, a steam vent per alley
  {for(const a of ALLEYS){for(const fy of[18,36,54]){const pl=new THREE.Mesh(new THREE.BoxGeometry(2.5,.8,a.h*.5),lmm.metal);pl.position.set(a.x+1.25,fy,a.y+a.h*.5);scene.add(pl)}
    const ld=new THREE.Mesh(new THREE.BoxGeometry(.6,56,.6),lmm.metal);ld.position.set(a.x+3,28,a.y+a.h*.3);scene.add(ld);
    const vt=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.6,3,6),lmm.metal);vt.position.set(a.x+15,1.5,a.y+a.h*.7);scene.add(vt);
    const st=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('rgba(200,200,225,.35)'),transparent:true,depthWrite:false}));st.position.set(a.x+15,9,a.y+a.h*.7);st.scale.set(26,26,1);scene.add(st)}}
  // skate park: graffiti on the wall faces and two rails across the deck
  {const g1=new THREE.Mesh(new THREE.PlaneGeometry(64,16),graffMats[0]);g1.position.set(2140,groundZ(2140,3206)+5,3208.3);scene.add(g1);
   const g2=new THREE.Mesh(new THREE.PlaneGeometry(64,16),graffMats[2]);g2.rotation.y=Math.PI/2;g2.position.set(1888.3,groundZ(1888,3340)+5,3340);scene.add(g2);
   for(const[x,y,w,d]of[[2000,3440,30,1],[2000,3380,1,30]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,1,d),lmm.metal);m.position.set(x,groundZ(x,y)+6.5,y);scene.add(m)}}
  // marina: basin water, three moored boats (one shared bob in landmarkTick), containers, the crane is drawn by the cranes list
  // the basin is the canal mouth now (ticket 63), so no separate water plane here
  const hull=mergeGeos([[new THREE.BoxGeometry(24,2.2,8),new THREE.Matrix4()],[new THREE.BoxGeometry(8,3,6),new THREE.Matrix4().makeTranslation(-3,2.4,0)]]),hm=new THREE.MeshLambertMaterial({color:'#e8e4f0'});
  LMA.boats=new THREE.InstancedMesh(hull,hm,3);LMA.boats.userData.pos=[[200,3720],[248,3840],[200,3910]];scene.add(LMA.boats);
  // floodlight masts: a pole, a lit head and a glow sprite per mast. The Pit and the stadium share it
  const flHead=new THREE.MeshBasicMaterial({color:'#fff1c4'});
  const flood=(pyl,H)=>{const pp=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.2,1.6,H,6),lmm.metal,pyl.length),ph=new THREE.InstancedMesh(new THREE.BoxGeometry(8,2.4,8),flHead,pyl.length);
    pyl.forEach(([x,y],i)=>{inst(pp,i,x,H/2,y);inst(ph,i,x,H+1,y)});pp.count=ph.count=pyl.length;scene.add(pp,ph);
    for(const[x,y]of pyl){const g=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex('rgba(255,240,200,.8)'),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));g.position.set(x,H+2,y);g.scale.set(40,40,1);scene.add(g)}};
  // the Pit: floodlight pylons with glow sprites, a pink ring on the floor
  flood([[3218,3218],[3502,3218],[3218,3502],[3502,3502]],36);
  const ring=new THREE.Mesh(new THREE.RingGeometry(58,60,48),new THREE.MeshBasicMaterial({color:'#ff3ea5'}));ring.rotation.x=-Math.PI/2;ring.position.set(3360,1.4,3360);scene.add(ring);pitMeshes();
  // pier: a lit arcade front, a chip shack with a flue and a stack of crates at the boardwalk end
  {const gz=groundZ(2100,4560),shack=mergeGeos([[new THREE.BoxGeometry(16,10,9),new THREE.Matrix4().makeTranslation(0,5,0)],
     [new THREE.BoxGeometry(17,1.2,10),new THREE.Matrix4().makeTranslation(0,10.4,0)]]);
   const sm=new THREE.Mesh(shack,lmm.wood);sm.position.set(2062,gz+4,4610);scene.add(sm);
   const fl=new THREE.Mesh(new THREE.CylinderGeometry(.8,.8,7,6),lmm.metal);fl.position.set(2066,gz+14,4613);scene.add(fl);
   const sg=new THREE.Mesh(new THREE.PlaneGeometry(12,3),new THREE.MeshBasicMaterial({map:signTex('CHIPS','#ffc94a')}));sg.position.set(2062,gz+12.4,4614.6);scene.add(sg);
   for(const[w,h,d,x,z,ry]of[[6,5,5,2100,4600,.3],[5,4,5,2093,4606,-.2],[5,5,5,2106,4596,.6]]){const c=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),lmm.wood);c.position.set(x,gz+6+h/2,z);c.rotation.y=ry;scene.add(c)}
   for(const sx of[-26,26]){const lp=new THREE.Mesh(new THREE.CylinderGeometry(.5,.7,14,6),lmm.metal);lp.position.set(2100+sx,gz+17,4590);scene.add(lp);
    const lh=new THREE.Mesh(new THREE.SphereGeometry(1.4,8,6),new THREE.MeshBasicMaterial({color:'#ffdf9e'}));lh.position.set(2100+sx,gz+24.2,4590);scene.add(lh)}}
  // pier: pilings under the deck, a rail along the boardwalk's sea edge, stall awnings
  const pg=[];for(let y=4584;y<4772;y+=24)for(const x of[2084,2116])pg.push([new THREE.CylinderGeometry(.9,1,9,5).translate(x,0,y),new THREE.Matrix4()]);scene.add(new THREE.Mesh(mergeGeos(pg),lmm.wood));
  // sea east of the pier: a water plane over the beach sand (sand is at -0.5), above the -6 bed from the heightmap
  {const sea=new THREE.Mesh(new THREE.PlaneGeometry(150,212),lmm.water);sea.rotation.x=-Math.PI/2;sea.position.set(2195,.3,4674);scene.add(sea)}
  // the rail and its posts stop at the pier's sides, so the pier is open to cars
  const rg=[];for(let i=0;i<=W/30;i++){const x=i*30;if(x>2060&&x<2140)continue;rg.push([new THREE.BoxGeometry(.8,5,.8).translate(x,groundZ(x,4568)+2.5,4568),new THREE.Matrix4()])}scene.add(new THREE.Mesh(mergeGeos(rg),lmm.metal));
  for(const[a,b]of[[0,2060],[2140,W]]){const rail=new THREE.Mesh(new THREE.BoxGeometry(b-a,.7,.7),lmm.metal);rail.position.set((a+b)/2,6.3,4568);scene.add(rail)}
  const awm=new THREE.MeshLambertMaterial({color:'#ff3ea5'});LMS.filter(b=>b.m==='stall').forEach(b=>{const m=new THREE.Mesh(new THREE.BoxGeometry(b.w+4,1.2,b.h+6),b.aw?lmm[b.aw]:awm);m.position.set(b.x+b.w/2,groundZ(b.x,b.y)+b.H+1,b.y+b.h/2);scene.add(m)});
  // roller-coaster frame east of the pier: towers and a track of boxes along a wave, merged into two meshes
  const trk=[],tow=[],cz=4650;let px=null;
  for(let i=0;i<=24;i++){const x=2280+i*15,h=groundZ(x,cz)+30+22*Math.abs(Math.sin(i*.5));
    if(i%4===0)tow.push([new THREE.BoxGeometry(2,h,2),new THREE.Matrix4().makeTranslation(x,h/2,cz)]);
    if(px){const dh=h-px[1],L=Math.hypot(15,dh),mid=new THREE.Matrix4().makeTranslation((px[0]+x)/2,(px[1]+h)/2,cz).multiply(new THREE.Matrix4().makeRotationZ(Math.atan2(dh,15)));trk.push([new THREE.BoxGeometry(L,1.4,1.4),mid])}
    px=[x,h]}
  scene.add(new THREE.Mesh(mergeGeos(trk),lmm.metal),new THREE.Mesh(mergeGeos(tow),lmm.metal));
  // Palmetto Stadium (block 7,6): taller floodlights at the corners, a pink crown on the wall tops, a scoreboard over the north stand and the pitch on the green sand
  flood([[3232,2792],[3488,2792],[3232,3048],[3488,3048]],56);
  const crownM=new THREE.MeshBasicMaterial({color:'#ff3ea5'}),crown=[];
  for(const[x,y,w,d]of[[3222,2782,276,3],[3222,3053,276,3],[3222,2782,3,274],[3495,2782,3,274]])crown.push([new THREE.BoxGeometry(w,2,d).translate(x+w/2,17,y+d/2),new THREE.Matrix4()]);
  scene.add(new THREE.Mesh(mergeGeos(crown),crownM));
  const board=new THREE.Mesh(new THREE.PlaneGeometry(60,15),new THREE.MeshBasicMaterial({map:signTex('HOME 2 : 1','#29e6d6'),side:THREE.DoubleSide}));board.position.set(3360,22,2790);scene.add(board);
  const pitch=new THREE.Mesh(new THREE.PlaneGeometry(240,200),new THREE.MeshLambertMaterial({color:'#2f8f4e'}));pitch.rotation.x=-Math.PI/2;pitch.position.set(3360,groundZ(3360,2920)+1.4,2920);scene.add(pitch);
  // Half-built tower (block 6,6): scaffold on the east and south faces, a tower crane with a counterweight and a red light, a silo cap, a hoarding poster and two warning lamps that blink in landmarkTick
  {const M=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z),sc=[],yc=[];
   for(let u=2820;u<=3020;u+=20)sc.push([new THREE.BoxGeometry(1,102,1),M(3024.5,51,u)],[new THREE.BoxGeometry(1,102,1),M(u,51,3024.5)]);
   for(let h=17;h<=102;h+=17)sc.push([new THREE.BoxGeometry(1,.8,200),M(3024.5,h,2920)],[new THREE.BoxGeometry(200,.8,1),M(2920,h,3024.5)]);
   yc.push([new THREE.BoxGeometry(110,4,5),M(2861,116,2809)],[new THREE.BoxGeometry(14,8,10),M(2800,116,2809)]);
   scene.add(new THREE.Mesh(mergeGeos(sc),lmm.metal),new THREE.Mesh(mergeGeos(yc),lmm.yel));
   scene.add(new THREE.Mesh(new THREE.BoxGeometry(3,3,3).translate(2809,122,2809),crownM));
   scene.add(new THREE.Mesh(new THREE.ConeGeometry(9.5,6,10).translate(2808,39,3008),lmm.conc));
   const poster=new THREE.Mesh(new THREE.PlaneGeometry(40,10),new THREE.MeshBasicMaterial({map:signTex('BUILD 2027','#ffc94a')}));poster.rotation.y=Math.PI;poster.position.set(2920,4.5,2789.4);scene.add(poster);
   LMA.lamps=new THREE.InstancedMesh(new THREE.SphereGeometry(1.2,6,4),new THREE.MeshBasicMaterial({color:'#ffb13b'}),2);LMA.lamps.userData.pos=[[2848,104,2848],[2992,104,2992]];scene.add(LMA.lamps)}
  // Night Market (block 3,7): string lights along the four light poles and a clock face on the post (meshes only)
  {const wire=[],bulbs=[],M=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z);
   const string=(x0,z0,x1,z1)=>{const L=Math.abs(x1-x0)+Math.abs(z1-z0),ax=z0===z1;
     wire.push([ax?new THREE.BoxGeometry(L,.3,.3):new THREE.BoxGeometry(.3,.3,L),M((x0+x1)/2,13,(z0+z1)/2)]);
     for(let t=0;t<=L;t+=12)bulbs.push([new THREE.BoxGeometry(1.4,1.4,1.4),M(ax?x0+t:x0,12.2,ax?z0:z0+t)])};
   string(1457.5,3227.5,1742.5,3227.5);string(1457.5,3492.5,1742.5,3492.5);string(1457.5,3227.5,1457.5,3492.5);string(1742.5,3227.5,1742.5,3492.5);
   scene.add(new THREE.Mesh(mergeGeos(wire),lmm.metal),new THREE.Mesh(mergeGeos(bulbs),new THREE.MeshBasicMaterial({color:'#ffdf9e'})));
   scene.add(new THREE.Mesh(new THREE.CylinderGeometry(4,4,1,12).rotateX(Math.PI/2).translate(1600,19,3364.5),new THREE.MeshBasicMaterial({color:'#f3ecff'})))}
  // Grid Substation (block 1,6): a lattice pylon 40 high with two cross-arms and insulators, bushings on the transformers, a pink trim on the control hut and a warning sign on the west fence
  {const cx=780,cz=2930,lat=[],ins=[],M=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z);
   for(const[dx,dz]of[[-4,-4],[4,-4],[-4,4],[4,4]])lat.push([new THREE.CylinderGeometry(.5,1.2,40,4),M(cx+dx,20,cz+dz)]);
   for(let y=6;y<40;y+=8)for(const o of[-4,4])lat.push([new THREE.BoxGeometry(8,.5,.5),M(cx,y,cz+o)],[new THREE.BoxGeometry(.5,.5,8),M(cx+o,y,cz)]);
   for(const y of[38,32]){lat.push([new THREE.BoxGeometry(22,1,1),M(cx,y,cz)]);for(const x of[cx-10,cx+10])ins.push([new THREE.CylinderGeometry(.8,.8,3,6),M(x,y-2,cz)])}
   for(const y of[2832,2972])for(const x of[650,670])ins.push([new THREE.CylinderGeometry(.8,.8,6,6),M(x,17,y)]);
   scene.add(new THREE.Mesh(mergeGeos(lat),lmm.metal),new THREE.Mesh(mergeGeos(ins),new THREE.MeshLambertMaterial({color:'#d9d4e6'})));
   scene.add(new THREE.Mesh(new THREE.BoxGeometry(26,1,18).translate(712,10.5,2808),lmm.trim));
   const sign=new THREE.Mesh(new THREE.PlaneGeometry(14,3.5),new THREE.MeshBasicMaterial({map:signTex('DANGER','#ff6b3d')}));sign.rotation.y=-Math.PI/2;sign.position.set(587.4,5,2850);scene.add(sign)}
}
// on foot or in a car, falling into the sea east of the pier puts you back at the pier start (same rule as lakeFall)
function pierFall(){
  if(state!=='play'||groundZ(me.x,me.y)>-2)return;
  if(!(me.y>W-40||(me.x>2100&&me.x<2280&&me.y>4550)))return; // the sea south and east of the pier only; the canal has its own rule
  if(me.heli||me.jet||(me.z||0)>groundZ(me.x,me.y)+6)return; // flying over the water is not falling in
  const x=2100,y=4600;
  if(me.car){me.car.x=x;me.car.y=y;me.car.vx=me.car.vy=0}
  me.x=x;me.y=y;me.vx=me.vy=0;me.z=groundZ(x,y);feed('You fell in the sea. Back to the pier');
}
// per-frame motion for landmarks: the fountain spray
function landmarkTick(){
  const bo=LMA.boats;if(bo){const p=bo.userData.pos;for(let i=0;i<p.length;i++)inst(bo,i,p[i][0],-2.6+Math.sin(time*1.3+i*2)*.15,p[i][1],Math.sin(time*.9+i)*.03);bo.instanceMatrix.needsUpdate=true}
  const lp=LMA.lamps;if(lp){const p=lp.userData.pos;p.forEach(([x,y,z],i)=>{const k=Math.sin(time*5+i*3)>0?1.3:.7;inst(lp,i,x,y,z,0,k,k,k)});lp.instanceMatrix.needsUpdate=true}
  const sp=LMA.spray;if(!sp)return;const fx=1160,fy=2040,fg=groundZ(fx,fy);
  for(let i=0;i<8;i++){const a=i/8*TAU+time*.6,r=7+Math.sin(time*3+i)*1.5,y=fg+6+(Math.sin(time*6+i*.9)+1)*2.2;inst(sp,i,fx+Math.cos(a)*r,y,fy+Math.sin(a)*r)}
  sp.instanceMatrix.needsUpdate=true;
}
