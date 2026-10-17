// ---------- phone ----------
// T opens a phone over the game. The game keeps running and WASD still walks. World keys and shooting wait while it is open.
// Other features add an app with phoneApp(id,name,icon,render,colour) and send a text with phoneNotify(from,text,action).
let phoneOpen=false,phCam=false,phApp=null,phBat=100,phEyes=0,phIdle=90,phLiveT=0,phBanTm=0,phCallTm=0,phTaxiTm=0,phDown=false,phTabOn=null,phClk='',phBatS=-1,phBadge=-1,phDistr=null;
let waypoint=null,wpGroup=null,mapCur=null;
let phLast=null,phDrv=false,phSeenJob=null,phSeenB=null;
const relMsg=n=>{if(mission){const c=MCON.find(q=>q.id===mission.def.contact);return!c||n.from===c.name} // a mission shows its own contact's texts
  if(!job||job.phase==='wait')return true;return n.from==='Vic'};
const apps={},notes=[],phLog=[],phHeld=[];
const mk=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const clk=()=>{const m=Math.floor(9*60+time)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
const starsNow=()=>Math.ceil(heat-.001),dnd=()=>starsNow()>=3;
const phFrame=$('phFrame'),phHome=$('phHome'),phAppEl=$('phApp'),phBody=$('phBody'),phTitle=$('phTitle'),phBan=$('phBan'),phTab=$('phTab'),phFade=$('phFade'),phWarn=$('phWarn'),phCallEl=$('phCall'),phCallName=$('phCallName');
const ICO=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC={map:'<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  contacts:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
  msg:'<path d="M4 5h16v11h-9l-5 4v-4H4z"/>',
  jobs:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12.5h18"/>',
  career:'<path d="M4 20V11M10 20V5M16 20v-6M22 20H2"/>',
  players:'<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.6-3.5 3.1-5.5 6.5-5.5s5.9 2 6.5 5.5"/><circle cx="17" cy="9" r="2.8"/><path d="M16.5 14.7c2.6.2 4.4 1.9 5 4.8"/>',
  places:'<path d="M3.5 20.5h17M5.5 20.5v-10l6.5-5 6.5 5v10M10 20.5v-5h4v5"/>',
  radio:'<rect x="3" y="8" width="18" height="12" rx="2"/><circle cx="15.5" cy="14" r="2.5"/><path d="M7 12h4M7 16h3M8 8l9-4"/>',
  cam:'<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1"/>',
  crew:'<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
  rules:'<path d="M3 8l4.5 4L12 5l4.5 7L21 8v10H3z"/>'};
function phoneApp(id,name,icon,render,col){apps[id]={name,icon:ICO(icon),render,col:col||'#ff3ea5'};phDrawHome()}
function phDrawHome(){phHome.replaceChildren();for(const id in apps){const a=apps[id],b=mk('button','ph-app');b.type='button';b.dataset.nav='';b.style.setProperty('--c',a.col);const ic=mk('span','ph-ic');ic.innerHTML=a.icon;a.bd=mk('b','ph-bd');a.bd.hidden=true;b.append(ic,mk('span','',a.name),a.bd);b.onclick=()=>phShow(id);phHome.append(b)}}
const phNavEls=()=>[...(phApp?phBody:phHome).querySelectorAll('[data-nav]:not(:disabled)')];
function phFocus(i){const els=phNavEls();if(els[i])els[i].focus({preventScroll:true})}
function phMove(dx,dy){const els=phNavEls();if(!els.length)return;let i=els.indexOf(document.activeElement);i=i<0?0:clamp(i+dx+dy*(phApp?1:4),0,els.length-1);els[i].focus({preventScroll:true});els[i].scrollIntoView({block:'nearest'})}
function phShow(id){const a=apps[id];if(!a)return;phApp=phLast=id;if(id==='map')mapCur={x:A.x,y:A.y};phHome.hidden=true;phAppEl.hidden=false;phTitle.textContent=a.name;phBody.replaceChildren();phPaint(a,true);phFocus(0)}
function phHomeShow(){phApp=null;phAppEl.hidden=true;phHome.hidden=false;phFocus(0)}
// re-renders into a detached copy and swaps only when the markup changed, so a tap is never lost to a repaint
function phPaint(a,force){const t=phBody.cloneNode(false);a.render(t);if(!force&&t.innerHTML===phBody.innerHTML)return;const was=phNavEls().indexOf(document.activeElement);phBody.replaceChildren(...t.childNodes);if(!force&&was>=0)phFocus(was)}
function phoneOpenNow(toMsg){
  if(phoneOpen||chatOpen||state!=='play'||me.downed)return;
  phoneOpen=true;for(const k in keys)if(!WALKC[k])keys[k]=false;$('phone').classList.add('open');phBan.classList.remove('show');
  try{document.exitPointerLock&&document.exitPointerLock()}catch(_){}
  mouse.down=false;touchFire=false;
  phEyes=me.car&&Math.hypot(me.car.vx,me.car.vy)>200?2.5:0;
  if(toMsg)phShow('messages');else if(phLast)phShow(phLast);else phHomeShow();
}
function phoneClose(){if(!phoneOpen)return;phoneOpen=false;phCam=false;document.body.classList.remove('phone-cam');phApp=null;$('phone').classList.remove('open');$('phCamBar').hidden=true;if(phFrame.contains(document.activeElement))document.activeElement.blur();phEyes=0;phAbortPending()}
function phCamOn(){phCam=true;document.body.classList.add('phone-cam');$('phone').classList.remove('open');$('phCamBar').hidden=false;if(phFrame.contains(document.activeElement))document.activeElement.blur()}
function phCamOff(){phCam=false;document.body.classList.remove('phone-cam');$('phCamBar').hidden=true;$('phone').classList.add('open');phHomeShow()}
function phSnap(){renderer.render(scene,camera);phFade.className='snap';setTimeout(()=>{phFade.className=''},120);
  cv.toBlob(b=>{if(!b)return;const u=URL.createObjectURL(b),a=mk('a');a.href=u;a.download=`palmetto-run-${Math.floor(time)}.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)},'image/png');feed('Photo saved')}
function phFadeTo(on){phFade.className=on?'on':''}
function phRing(){tone('triangle',mf(84),.16,.12);tone('triangle',mf(79),.22,.12,AC?AC.currentTime+.22:0)}
// a pending call or cab is dropped when you go down or the phone closes, so it cannot fire from a downed or indoor state
function phAbortPending(){if(phCallTm){clearTimeout(phCallTm);phCallTm=0}phCallEl.hidden=true;if(phTaxiTm){clearTimeout(phTaxiTm);phTaxiTm=0;phFadeTo(false)}}
function phCallTo(name,f){if(phCallTm)return;phCallName.textContent=name;phCallEl.hidden=false;phRing();phCallTm=setTimeout(()=>{phCallTm=0;phCallEl.hidden=true;if(state==='play'&&!me.downed&&!me.climb)f()},1200)}

// notifications: texts from contacts. Held while the cops are on you (3 stars or more), then delivered.
function phAdd(n){notes.unshift(n);if(notes.length>30)notes.length=30;if(!phoneOpen&&state==='play'){phBan.replaceChildren(mk('b','',n.from),mk('span','',n.text));phBan.classList.add('show');clearTimeout(phBanTm);phBanTm=setTimeout(()=>phBan.classList.remove('show'),4500)}}
function phoneNotify(from,text,action){const n={from,text,action:action||null,t:clk(),read:false};if(dnd()){phHeld.push(n);if(phHeld.length>30)phHeld.shift();return}phAdd(n)}
phBan.onclick=()=>{phBan.classList.remove('show');phoneOpenNow(true)};
// the log: everything feed() shows
function phLogAdd(t){phLog.unshift({t:clk(),text:t});if(phLog.length>30)phLog.length=30}
function acceptJob(){if(job&&job.phase!=='wait')return feed('You already have a job');newJob()}

// ---- contact actions
function phTaxi(){
  if(!waypoint)return phoneNotify('Taxi','Set a waypoint on the map first.');
  if(starsNow()>0)return phoneNotify('Taxi','No cab will pick you up with the cops on you.');
  if(me.heli||me.jet)return phoneNotify('Taxi','Not from up there.');
  if(!plPay(100))return;
  const wx=clamp(waypoint.x,MAPB.x0,MAPB.x1),wy=clamp(waypoint.y,MAPB.y0,MAPB.y1);waypoint=null;phoneClose();phFadeTo(true);
  phTaxiTm=setTimeout(()=>{phTaxiTm=0;
    if(state!=='play'||me.downed||me.climb){phFadeTo(false);return} // no cab arrives for a downed or mid-ladder player
    const b=me.car||me;me.inside=null;me.roof=null;me.z=0;me.vx=me.vy=0;b.x=wx;b.y=wy;b.vx=b.vy=0;
    for(let i=0;i<3;i++)collide(b,b.x,b.y,me.car?14:8);me.x=b.x;me.y=b.y;phFadeTo(false)},reduced?0:1000);
}
function phLawyer(){const s=starsNow();if(s>=3)return phoneNotify('Lawyer','Not with three stars on you. Lose the cops first.');if(s<=0)return phoneNotify('Lawyer','You are clean. Keep your cash.');if(!plPay(1000*s))return;heat=0;coolT=0;jingle('pass');phoneNotify('Lawyer',`Done. ${s} star${s>1?'s':''} gone for ${money(1000*s)}.`)}
function phVic(){if(!unlocked('bank'))return phoneNotify('Vic',`Come back at level ${UNLOCK.bank}.`);phoneClose();openBrief()}
function phDealer(){waypoint={x:DEALER.x,y:DEALER.y};phoneNotify('Dealer','Pin is on your map. Come alone.')}
// the Mechanic brings a stored car to the nearest lane, so a personal car is never stranded in a garage
function phMechanic(){
  const L=ownedCars().filter(x=>x.ready);
  if(!L.length)return phoneNotify('Mechanic','No cars on file yet. Store one in a garage first.');
  const pick=L.find(x=>!x.out)||L[0],c=deliverCar(pick.propId,pick.slot);
  if(!c)return phoneNotify('Mechanic','Nowhere to drop it. Get out in the open and call again.');
  phoneClose();feed(`The Mechanic left your ${CT[c.type].name} nearby`);phoneNotify('Mechanic',`Your ${CT[c.type].name} is parked nearby. Keys are in it.`)
}
const CONTACTS=[['Taxi','Cab to your waypoint, $100',phTaxi],['Lawyer','Clears 1 or 2 stars, $1,000 each',phLawyer],['Vic','Heists',phVic],['Dealer','Sends you a pin',phDealer],['Mechanic','Brings a stored car to you',phMechanic]];

// ---- map: the whole map (city and hills) with relief, spots, a zoom, the waypoint and a GPS line along the roads
const mapCv=mk('canvas','ph-map');mapCv.style.aspectRatio='5 / 6';
// view: the whole map fits the canvas at zoom 1. Above 1 the view centres on the player. Zoom runs from 1 to 5.
let mapZ=1;
function mapView(){const cw=mapCv.clientWidth||1,ch=mapCv.clientHeight||1,fit=Math.min(cw/(MAPB.x1-MAPB.x0),ch/(MAPB.y1-MAPB.y0)),s=fit*mapZ,far=mapZ>1.001,cx=far?A.x:(MAPB.x0+MAPB.x1)/2,cy=far?A.y:(MAPB.y0+MAPB.y1)/2;
  return{cw,ch,s,cx,cy,X:x=>cw/2+(x-cx)*s,Y:y=>ch/2+(y-cy)*s}}
// the bitmap is at device pixels (devicePixelRatio, capped at 2); drawing uses CSS pixels
function mapSize(){const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.round(mapCv.clientWidth*dpr),h=Math.round(mapCv.clientHeight*dpr);if(mapCv.width!==w||mapCv.height!==h){mapCv.width=w;mapCv.height=h}return dpr}
// GPS route along the road grid from the nearest intersection. Cached by the snapped start and the waypoint, so it is rebuilt only when either moves.
let wpRC=[],wpRK='';
function wpRouteC(x,y,wx,wy){const sn=v=>Math.round((v-60)/B)*B+60,ax=sn(x),ay=sn(y),k=ax+','+ay+','+wx+','+wy;
  if(k!==wpRK){wpRK=k;const p=[[ax,ay],[ax,sn(wy)],[wx,sn(wy)],[wx,wy]];wpRC=p.filter((q,i)=>!i||q[0]!==p[i-1][0]||q[1]!==p[i-1][1])}
  return wpRC}
function mapPick(p){if(waypoint&&Math.hypot(waypoint.x-p.x,waypoint.y-p.y)<130){waypoint=null;feed('Waypoint cleared')}else{waypoint={x:clamp(p.x,MAPB.x0,MAPB.x1),y:clamp(p.y,MAPB.y0,MAPB.y1)};feed('Waypoint set')}} // a pin is always on the map, never indoors or off the edge
const mapPts=new Map();let mapPinch=null;
mapCv.addEventListener('pointerdown',e=>{mapCv.setPointerCapture(e.pointerId);mapPts.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,moved:false});
  if(mapPts.size===2){const[a,b]=[...mapPts.values()];for(const p of mapPts.values())p.moved=true;mapPinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:mapZ}}});
mapCv.addEventListener('pointermove',e=>{const p=mapPts.get(e.pointerId);if(!p)return;p.x=e.clientX;p.y=e.clientY;if(Math.hypot(p.x-p.sx,p.y-p.sy)>8)p.moved=true;
  if(mapPinch&&mapPts.size===2){const[a,b]=[...mapPts.values()];mapZ=clamp(mapPinch.z*Math.hypot(a.x-b.x,a.y-b.y)/mapPinch.d,1,5)}});
function mapUp(e){const p=mapPts.get(e.pointerId);if(!p)return;mapPts.delete(e.pointerId);if(!mapPts.size)mapPinch=null;
  if(!p.moved&&!mapPinch){const r=mapCv.getBoundingClientRect(),v=mapView();mapCur={x:v.cx+(e.clientX-r.left-v.cw/2)/v.s,y:v.cy+(e.clientY-r.top-v.ch/2)/v.s};mapPick(mapCur)}}
mapCv.addEventListener('pointerup',mapUp);
mapCv.addEventListener('pointercancel',e=>{mapPts.delete(e.pointerId);if(!mapPts.size)mapPinch=null});
mapCv.addEventListener('wheel',e=>{e.preventDefault();mapZ=clamp(mapZ*Math.exp(-e.deltaY*.002),1,5)},{passive:false});
const PHSHORT={airport:'Airport',hood:'Low Palms',beach:'Beach',industrial:'Docks',suburb:'Heights',park:'Lagoon',downtown:'Downtown',midtown:'Midtown'};
function phDistricts(){const acc={};for(let i=0;i<N;i++)for(let j=0;j<N;j++){const k=district(i,j);if(!AREA[k])continue;const a=acc[k]||(acc[k]={x:0,y:0,n:0});a.x+=i*B+R+(B-R)/2;a.y+=j*B+R+(B-R)/2;a.n++}return Object.keys(acc).map(k=>({name:PHSHORT[k],x:acc[k].x/acc[k].n,y:acc[k].y/acc[k].n}))}
// outdoor spots (rings) and enterable places (squares in the door colour), named when zoomed in
function mapSpots(){return[...HILL_SPOTS.map(s=>({x:s.x,y:s.y,name:s.name,icon:s.icon,door:false,col:'#ffc94a'})),...LANDMARKS.map(l=>({x:l.x+l.w/2,y:l.y+l.h/2,name:l.name,icon:l.ic,door:false,col:'#ffc94a'})),
  {x:GARAGE.x,y:GARAGE.y,name:'Garage',icon:'C',door:false,col:'#ffc94a'},...DOORS.map(d=>({x:d.x,y:d.y,name:d.label,icon:DOORICON[d.label]||d.label[0],door:true,col:d.col}))]}
let mapSpotsC=null;
// the base layer is blitted, then the icons, markers and the player are drawn over it. Only this runs per frame.
function phMapDraw(){
  const dpr=mapSize(),c=mapCv.getContext('2d'),v=mapView(),X=v.X,Y=v.Y,s=v.s;
  c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#0b2a3d';c.fillRect(0,0,v.cw,v.ch);
  c.drawImage(mapBase,X(MAPB.x0),Y(MAPB.y0),(MAPB.x1-MAPB.x0)*s,(MAPB.y1-MAPB.y0)*s);
  phDistr=phDistr||phDistricts();
  c.textAlign='center';c.textBaseline='middle';
  c.font='700 13px "Chakra Petch",sans-serif';c.fillStyle='rgba(243,236,255,.9)';c.shadowColor='#0b0814';c.shadowBlur=6;
  for(const d of phDistr)c.fillText(d.name,X(d.x),Y(d.y));
  c.shadowBlur=0;
  mapSpotsC=mapSpotsC||mapSpots();
  c.font='700 11px "Chakra Petch",sans-serif';
  for(const p of mapSpotsC){const px=X(p.x),py=Y(p.y);if(px<-20||py<-20||px>v.cw+20||py>v.ch+20)continue;
    mapIcon(c,px,py,8,p.door,p.col,p.icon);
    if(mapZ>1.5){c.textAlign='left';c.strokeStyle='#0b0814';c.lineWidth=3;c.strokeText(p.name,px+12,py);c.fillStyle='#f3ecff';c.fillText(p.name,px+12,py);c.textAlign='center'}}
  for(const r of remotes.values()){if(r.dead)continue;c.fillStyle=r.color;c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.arc(X(r.x),Y(r.y),6,0,TAU);c.fill();c.stroke()}
  if(job&&job.phase!=='wait'&&!job.noMarker){c.fillStyle=jobCol();c.strokeStyle='#0b0814';c.lineWidth=2;c.beginPath();c.arc(X(job.x),Y(job.y),9,0,TAU);c.fill();c.stroke()}
  if(waypoint){const rt=wpRouteC(A.x,A.y,waypoint.x,waypoint.y);c.strokeStyle='#29e6d6';c.lineWidth=2.5;c.setLineDash([6,5]);c.beginPath();c.moveTo(X(A.x),Y(A.y));rt.forEach(([x,y])=>c.lineTo(X(x),Y(y)));c.stroke();c.setLineDash([]);
    c.fillStyle='#29e6d6';c.strokeStyle='#0b0814';c.lineWidth=2.5;c.beginPath();c.arc(X(waypoint.x),Y(waypoint.y),8,0,TAU);c.fill();c.stroke()}
  c.save();c.translate(X(me.inside?A.x:me.x),Y(me.inside?A.y:me.y));c.rotate(me.car?me.car.a:me.a);c.scale(1.15,1.15);c.fillStyle='#fff';c.strokeStyle='#0b0814';c.lineWidth=2;c.beginPath();c.moveTo(11,0);c.lineTo(-7,8);c.lineTo(-3,0);c.lineTo(-7,-8);c.closePath();c.fill();c.stroke();c.restore();
  if(mapCur){c.strokeStyle='#ffc94a';c.lineWidth=2.5;c.beginPath();c.arc(X(mapCur.x),Y(mapCur.y),12,0,TAU);c.stroke()}
}

// ---- 3D waypoint: the job beacon look in cyan
function wpBuild(){wpGroup=new THREE.Group();const cyl=new THREE.Mesh(new THREE.CylinderGeometry(15,15,160,24,1,true),new THREE.MeshBasicMaterial({color:'#29e6d6',transparent:true,opacity:.26,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  cyl.position.y=80;const ring=new THREE.Mesh(new THREE.RingGeometry(15,19,32),new THREE.MeshBasicMaterial({color:'#29e6d6',side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=1.8;wpGroup.add(cyl,ring);scene.add(wpGroup)}

// ---- apps
function mapZoomBtn(t,label,fn){const b=mk('button','',t);b.type='button';b.dataset.nav='';b.setAttribute('aria-label',label);b.style.cssText='width:34px;height:34px;padding:0;border-radius:50%;border:1px solid rgba(243,236,255,.35);background:rgba(11,8,20,.82);color:#f3ecff;font:700 20px/1 var(--body);cursor:pointer';b.onclick=fn;return b}
function mapLegend(){const L=mk('div','ph-sub');L.style.cssText='display:flex;flex-wrap:wrap;gap:5px 11px';
  const sw=css=>{const s=mk('span');s.style.cssText='display:inline-block;width:10px;height:10px;margin-right:4px;vertical-align:-1px;box-sizing:border-box;'+css;return s},
    item=(css,t)=>{const i=mk('span');i.append(sw(css),t);return i};
  L.append(item('border-radius:50%;border:2px solid #ffc94a;background:#0b0814','Outdoor spot'),item('border:2px solid #29e6d6;background:#0b0814;border-radius:2px','Enterable place'),
    item('border-radius:50%;background:#ffc94a;border:2px solid #0b0814','Mission'),item('border-radius:50%;background:#29e6d6;border:2px solid #0b0814','Waypoint'),
    item('width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:10px solid #fff;background:none','You'));
  return L}
phoneApp('map','Map',IC.map,el=>{
  const wrap=mk('div');wrap.style.cssText='position:relative;margin:0 -12px';
  const zb=mk('div');zb.style.cssText='position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:6px';
  zb.append(mapZoomBtn('+','Zoom in',()=>{mapZ=clamp(mapZ*1.6,1,5)}),mapZoomBtn('−','Zoom out',()=>{mapZ=clamp(mapZ/1.6,1,5)}));
  wrap.append(mapCv,zb);
  el.append(wrap,mapLegend(),mk('div','ph-sub','Click or press Enter to drop a pin. Click the pin again to clear it. Scroll or pinch to zoom.'));
},'#29e6d6');
phoneApp('contacts','Contacts',IC.contacts,el=>{for(const[n,r,f]of CONTACTS){const b=mk('button','ph-row');b.type='button';b.dataset.nav='';const g=mk('span','ph-grow');g.append(mk('b','',n),mk('span','ph-sub',r));b.append(mk('span','ph-av',n[0]),g,mk('span','ph-go','Call'));b.onclick=()=>phCallTo(n,f);el.append(b)}},'#ff3ea5');
phoneApp('messages','Messages',IC.msg,el=>{
  const ns=notes.filter(relMsg); // show them all, so every note can be marked read and the badge clears
  if(!ns.length&&!phLog.length&&!chatLines.length)el.append(mk('div','ph-sub','No messages yet.'));
  for(const n of ns){const w=mk('div','ph-card');w.append(mk('div','ph-from',n.from),mk('div','ph-txt',n.text),mk('div','ph-tm',n.t));
    if(n.action){const b=mk('button','ph-btn',n.action.label);b.type='button';b.dataset.nav='';b.onclick=()=>{const f=n.action.fn;n.action=null;f();phPaint(apps.messages,true)};w.append(b)}
    n.read=true;el.append(w)}
  if(chatLines.length){el.append(mk('div','ph-sec','Chat'));for(const l of chatLines.slice(0,100)){const w=mk('div','ph-log'),nm=mk('b','',l.n+' ');nm.style.color=l.c;w.append(nm,mk('span','',l.tx),mk('em','chTm',l.tm));el.append(w)}}
  if(phLog.length){el.append(mk('div','ph-sec','Log'));for(const l of phLog)el.append(mk('div','ph-log',`${l.t}  ${l.text}`))}
},'#3dd68c');
phoneApp('jobs','Jobs',IC.jobs,el=>{const on=!!job&&job.phase!=='wait';
  const c=mk('div','ph-card');c.append(mk('b','ph-big',on?(job.title||'Mission'):'No job'),mk('div','ph-sub',on?job.text+(job.reward?` Pays ${money(job.reward)}.`:''):(job&&job.msg)||'Nothing on. The next one comes in a moment.'));
  const d=mk('button','ph-btn alt','Drop the job');d.type='button';d.dataset.nav='';d.disabled=!on;d.onclick=()=>jobFail('You dropped the job');
  const n=mk('button','ph-btn','Ask for a new job');n.type='button';n.dataset.nav='';n.disabled=on;n.onclick=()=>newJob();
  el.append(c,d,n,mk('div','ph-sub',`Fuel: ${fuelState.u} unit${fuelState.u===1?'':'s'}, one per minute in the air. Buy at the Lagoon helipad for $200 when you have none.`),...['heli','jet'].filter(k=>!unlocked(k)).map(k=>mk('div','ph-sub',`${UNLOCK_NAME[k]}: ${gateWhy(k)}.`)))},'#ffc94a');
phoneApp('career','Career',IC.career,el=>{const b=bounty,P=jobPos(),c=mk('div','ph-card'),s=mk('div','ph-card');
  c.append(mk('b','ph-big',b?`Bounty ${money(b.pay)}`:'No bounty'),mk('div','ph-sub',b?`${Math.round(Math.hypot(b.x-P.x,b.y-P.y)/10)} m away. ${Math.ceil(b.t)} s left.`:'The next one goes up in a few minutes.'));
  s.append(mk('b','ph-big','Career'),mk('div','ph-sub',`Kills ${career.kills}. Cars stolen ${career.cars}. Cash earned ${money(career.cash)}.`),mk('div','ph-sub',`Longest chase ${career.chase} s. Farthest drive ${career.drive} m.`),mk('div','ph-sub',`Deaths ${career.deaths}. Jobs done ${career.jobs}.`));
  el.append(c,s)},'#ffc94a');
phoneApp('missions','Missions',IC.jobs,el=>{
  if(!mission){el.append(mk('div','ph-sub','No mission running. Ask a contact in the city.'));return}
  const c=mk('div','ph-card');c.append(mk('b','ph-big',mission.def.title),mk('div','ph-sub',`Step ${mission.i+1} of ${mission.def.steps.length}. Next: ${msStep().text}`));
  el.append(c,...mission.log.map(t=>mk('div','ph-sub',t)))},'#ffc94a');
phoneApp('players','Players',IC.players,el=>{
  if(!remotes.size){el.append(mk('div','ph-sub',room?'Nobody else is in the city right now.':'Solo for now. Other players show up once the city is online.'));return}
  for(const[id,r]of remotes){const w=mk('div','ph-prow'),b=mk('button','ph-row');b.type='button';b.dataset.nav='';const g=mk('span','ph-grow');g.append(mk('b','',r.name),mk('span','ph-sub',`Lv ${r.lv} · ${Math.round(Math.hypot(r.x-me.x,r.y-me.y)/10)} m`));
    const dot=mk('i','ph-dot');dot.style.background=r.color;b.append(dot,g,mk('span','ph-go','GPS'));b.onclick=()=>{waypoint={x:r.x,y:r.y,peer:id};feed(`GPS on ${r.name}`)};
    const far=Math.hypot(r.x-A.x,r.y-A.y)>60,inC=!!crewS&&crewS.members.includes(id);
    const iv=mk('button','ph-mute',inC?'In crew':far?'Too far':'Invite');iv.type='button';iv.dataset.nav='';iv.disabled=far||inC;iv.onclick=()=>crewInvite(id);
    const mu=mk('button','ph-mute',mutedPeers.has(id)?'Unmute':'Mute');mu.type='button';mu.dataset.nav='';mu.onclick=()=>mutePeer(id);
    w.append(b,iv,mu);el.append(w)}
},'#7b6bff');
phoneApp('places','Places',IC.places,el=>{const best={};for(const d of DOORS){const dd=Math.hypot(d.x-A.x,d.y-A.y),o=best[d.label];if(!o||dd<o.dd)best[d.label]={d,dd}}
  for(const[k,{d,dd}]of Object.entries(best).sort((a,b)=>a[1].dd-b[1].dd)){const b=mk('button','ph-row');b.type='button';b.dataset.nav='';const dt=mk('span','ph-dt',DOORICON[k]||'?');dt.style.color=d.col;
    b.append(dt,mk('span','ph-grow',k),mk('span','ph-sub',`${Math.round(dd/10)} m`),mk('span','ph-go','GPS'));b.onclick=()=>{waypoint={x:d.x,y:d.y};feed(`GPS set to ${k}`)};el.append(b)}
},'#ff6b3d');
phoneApp('radio','Radio',IC.radio,el=>{const b=mk('button','ph-btn','Next station');b.type='button';b.dataset.nav='';b.onclick=()=>cycleRadio();
  el.append(mk('div','ph-big',RADIO[radio]),mk('div','ph-sub',radio?'Playing now':'The radio is off'),b)},'#4aa3ff');
phoneApp('camera','Camera',IC.cam,el=>{const b=mk('button','ph-btn','Open the camera');b.type='button';b.dataset.nav='';b.onclick=phCamOn;
  el.append(mk('div','ph-sub','The phone and the HUD hide. Enter takes the shot, Escape comes back.'),b)},'#9d97ad');
phoneApp('settings','Settings',IC.gear,el=>{const b=mk('button','ph-btn','Open settings');b.type='button';b.dataset.nav='';b.onclick=()=>{phoneClose();openSettings()};
  el.append(mk('div','ph-sub','Sensitivity, invert Y and aim assist.'),b)},'#5a5570');
// City rules: the host tunes the night. Controls are live for the host only; everyone else watches.
const HRNAME={cops:'Police',traffic:'Traffic',ff:'Friendly fire',grav:'Gravity'};
const HRVAL={cops:v=>v?'On':'Off',traffic:v=>['Light','Normal','Heavy'][v],ff:v=>v?'On':'Off',grav:v=>v===.55?'Moon':v===1.4?'Heavy':'Normal'};
const hrNext=k=>k==='traffic'?(RULES.traffic+1)%3:k==='grav'?(RULES.grav===1?.55:RULES.grav===.55?1.4:1):(RULES[k]?0:1);
phoneApp('rules','City rules',IC.rules,el=>{const host=amHost(),r=host?null:remotes.get(hostPeer());
  el.append(mk('div','ph-big',host?'You are the host':r?r.name:'The host'));
  if(!host)el.append(mk('div','ph-sub','Host sets the rules tonight.'));
  for(const k of HRK){const b=mk('button','ph-row');b.type='button';b.dataset.nav='';b.disabled=!host;
    const g=mk('span','ph-grow');g.append(mk('b','',HRNAME[k]),mk('span','ph-sub',HRVAL[k](RULES[k])));
    b.append(g,mk('span','ph-go',host?'Change':''));b.onclick=()=>{setRule(k,hrNext(k));phPaint(apps.rules,true)};el.append(b)}
},'#ffc94a');

// ---- keys while the phone is open
function phoneKey(e){
  const c=e.code,rep=e.repeat;
  if(phCam){if(c==='Enter'&&!rep)phSnap();else if(c==='Escape')phCamOff();return}
  if(phDrv&&c!=='Escape'&&codeToAction(c)!=='phone')return; // no typing while driving over 100
  if(c==='Escape'||(codeToAction(c)==='phone'&&!rep)){phoneClose();return}
  if(/^Arrow/.test(c)){e.preventDefault();const dx=c==='ArrowLeft'?-1:c==='ArrowRight'?1:0,dy=c==='ArrowUp'?-1:c==='ArrowDown'?1:0;
    if(phApp==='map'&&mapCur){mapCur.x=clamp(mapCur.x+dx*70,MAPB.x0,MAPB.x1);mapCur.y=clamp(mapCur.y+dy*70,MAPB.y0,MAPB.y1)}else phMove(dx,dy);return}
  if(c==='Enter'){e.preventDefault();if(rep)return;if(phApp==='map'&&mapCur)mapPick(mapCur);else{const el=document.activeElement;if(el&&el.matches&&el.matches('[data-nav]'))el.click()}return}
  if(c==='Backspace'){e.preventDefault();if(phApp)phHomeShow()}
}
$('phBack').onclick=phHomeShow;$('phTab').onclick=()=>{if(phoneOpen)phoneClose();else phoneOpenNow(false)};
$('phClose').onclick=()=>phoneClose();
$('phSnapBtn').onclick=()=>{if(phCam)phSnap()};
$('phCamBack').onclick=()=>{if(phCam)phCamOff()};
phFrame.addEventListener('pointerdown',()=>{phDown=true});
addEventListener('pointerup',()=>{phDown=false});addEventListener('pointercancel',()=>{phDown=false});

// ---- per frame (called from ui)
function phoneStep(dt){
  phBat=Math.max(3,phBat-dt/20);
  if(phoneOpen&&state!=='play')phoneClose();
  if(state!=='play')phBan.classList.remove('show');
  if(!dnd()&&phHeld.length)while(phHeld.length)phAdd(phHeld.shift());
  if(state==='play'&&!phoneOpen&&(!job||job.phase==='wait')&&!starsNow()&&!me.inside){phIdle-=dt;if(phIdle<=0){phIdle=70+rand()*50;phoneNotify('Vic','Got a job for you.',{label:'Accept',fn:acceptJob})}}
  if(waypoint&&waypoint.peer){const r=remotes.get(waypoint.peer);if(r){waypoint.x=r.x;waypoint.y=r.y}else{waypoint=null;feed('Lost sight of them. Waypoint cleared')}}
  if(waypoint&&Math.hypot(waypoint.x-A.x,waypoint.y-A.y)<40){waypoint=null;feed('Waypoint reached')}
  if(waypoint&&!wpGroup)wpBuild();
  if(wpGroup){wpGroup.visible=!!waypoint&&state==='play'&&!me.inside;if(waypoint)wpGroup.position.set(waypoint.x,groundZ(waypoint.x,waypoint.y),waypoint.y)}
  const drv=!!me.car&&Math.hypot(me.car.vx,me.car.vy)>100;if(drv!==phDrv){phDrv=drv;$('phone').style.opacity=drv?'.35':'';$('phone').style.pointerEvents=drv?'none':''}
  if(job!==phSeenJob){phSeenJob=job;if(job&&job.phase!=='wait')phoneNotify('Vic','New job: '+(job.title||'see the Jobs app'))}
  if(bounty!==phSeenB){phSeenB=bounty;if(bounty)phoneNotify('Career','Bounty up: '+money(bounty.pay))}
  if(phEyes>0)phEyes-=dt;
  phWarn.hidden=!(phoneOpen&&phEyes>0);
  const tabOn=state==='play'&&!phoneOpen;if(tabOn!==phTabOn){phTabOn=tabOn;phTab.hidden=!tabOn}
  if(phoneOpen&&phApp==='map')phMapDraw();
  if(phoneOpen&&phApp&&phApp!=='map'&&!phDown&&(phLiveT-=dt)<=0){phLiveT=.5;phPaint(apps[phApp])}
  const cs=clk(),bs=Math.round(phBat);
  if(cs!==phClk){phClk=cs;$('phClock').textContent=cs;$('phDnd').hidden=!dnd()}
  if(bs!==phBatS){phBatS=bs;$('phBatF').style.width=bs+'%'}
  const u=notes.filter(n=>!n.read).length;
  if(u!==phBadge){phBadge=u;apps.messages.bd.textContent=u;apps.messages.bd.hidden=!u;$('phTabN').textContent=u;$('phTabN').hidden=!u}
}
if(DBG)Object.defineProperties(DBG,{phoneOpen:{get:()=>phoneOpen},waypoint:{get:()=>waypoint},phoneNotify:{get:()=>phoneNotify},phoneApps:{get:()=>Object.keys(apps)},mapTest:{get:()=>({zoom:z=>{mapZ=z},level:()=>mapZ})}});
if(DBG)DBG.phoneTest=id=>{phoneOpenNow(false);phShow(id)};

// ---------- perf ----------
// Frame cost for ?perf (overlay) and F3. The boot loop passes ms for update() and ui(); render() sets pf.gl around renderer.render.
const pf={on:/[?&]perf\b/.test(location.search),gl:0,n:0,s:{fr:0,up:0,mi:0,ui:0,gl:0},avg:{fps:0,fr:0,up:0,mi:0,ui:0,gl:0,calls:0,tris:0,geo:0,tex:0,heap:0},el:$('perf')};
pf.el.hidden=!pf.on;
function perfFrame(fr,up,mi,ui){const s=pf.s;s.fr+=fr;s.up+=up;s.mi+=mi;s.ui+=ui;s.gl+=pf.gl;if(++pf.n<60)return;
  const a=pf.avg,ri=renderer.info;for(const k in s){a[k]=s[k]/pf.n;s[k]=0}pf.n=0;
  a.fps=1000/a.fr;a.calls=ri.render.calls;a.tris=ri.render.triangles;a.geo=ri.memory.geometries;a.tex=ri.memory.textures;a.heap=performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):0;
  if(!pf.el.hidden)pf.el.textContent=`${a.fps.toFixed(0)} fps  ${a.fr.toFixed(1)} ms\nupdate ${a.up.toFixed(2)}  gl ${a.gl.toFixed(2)}  ui ${a.ui.toFixed(2)}  mini ${a.mi.toFixed(2)}\ncalls ${a.calls}  tris ${(a.tris/1000).toFixed(0)}k  geo ${a.geo}  tex ${a.tex}  heap ${a.heap} MB`}
addEventListener('keydown',e=>{if(e.code==='F3'){e.preventDefault();pf.el.hidden=!pf.el.hidden}});
if(DBG)Object.defineProperties(DBG,{perf:{get:()=>pf.avg}});

// ---------- career ----------
// Lifetime counters (pr3d-career, written by saveArsenal) and one bounty at a time. Counters come from die(), gainXP() and careerStep().
// ponytail: kills counts gang members knocked down (the only kill event with a hook), bounty target is a street spot you reach, not a ped.
let career={kills:0,cars:0,cash:0,chase:0,drive:0,deaths:0,jobs:0,crew:0};
try{const d=JSON.parse(localStorage.getItem('pr3d-career')||'null');if(d&&typeof d==='object')for(const k in career)if(Number.isFinite(d[k])&&d[k]>=0)career[k]=d[k]}catch(_){}
let bounty=null,bountyCd=180,chaseT=0,driveT=0,carNow=null,lastX=0,lastY=0,lastCash=null;
const bountyPay=()=>Math.min(2000,200+(lv-1)*65);
function careerStep(dt){
  if(lastCash==null)lastCash=me.cash;
  if(me.cash>lastCash)career.cash+=me.cash-lastCash;lastCash=me.cash;
  if(heat>0)chaseT+=dt;else if(chaseT>0){career.chase=Math.max(career.chase,Math.round(chaseT));chaseT=0}
  const c=me.car;
  if(c&&c!==carNow){if(c.stolenFlag&&!c.counted){c.counted=1;career.cars++}driveT=0;lastX=c.x;lastY=c.y}
  if(c){driveT+=Math.hypot(c.x-lastX,c.y-lastY);lastX=c.x;lastY=c.y;career.drive=Math.max(career.drive,Math.round(driveT/10))}
  carNow=c;
  bountyCd-=dt;
  if(!bounty&&bountyCd<=0){const[x,y]=sidewalkPoint();bountyCd=180;bounty={x,y,pay:bountyPay(),t:180};feed(`Bounty up: ${money(bounty.pay)}. See the Career app.`)}
  if(bounty){const P=jobPos();bounty.t-=dt;if(Math.hypot(P.x-bounty.x,P.y-bounty.y)<40){me.cash+=bounty.pay;showBig('BOUNTY PAID','#ffc94a',`+${money(bounty.pay)}`,2.5);bounty=null}else if(bounty.t<=0)bounty=null}
}
if(DBG)Object.defineProperties(DBG,{career:{get:()=>career},bountyTest:{get:()=>()=>{const P=jobPos();bounty={x:P.x,y:P.y,pay:bountyPay(),t:180}}}});

// ---------- drugs ----------
// Timed abilities bought at the dealer. One is active at a time. A third dose within 60 s knocks you down for 4 s.
function useDrug(){const k=DK[drugSel];if(!drugs[k]||state!=='play'||me.downed)return;
  drugs[k]--;drugHist=drugHist.filter(x=>time-x<60);const od=drugHist.length>=2;drugHist.push(time);
  drugState={k,t:DRUGS[k].t};showBig(DRUGS[k].name.toUpperCase(),DRUGS[k].col,DRUGS[k].t+' seconds',1.4);noise(.5,5000,.18);
  if(od&&goDown())odT=4;saveArsenal()}
function drugStep(dt){
  if(drugState.k&&(drugState.t-=dt)<=0){feed(DRUGS[drugState.k].name+' has worn off');drugState={k:null,t:0}}
  if(odT>0&&(odT-=dt)<=0&&me.downed){me.downed=false;me.downT=0;feed('You get back up')}}
const drugMul=f=>DRUGS[drugState.k]?.fx?.[f]||1;
// coke: the shot bends halfway toward the nearest person or car inside 40 degrees
function drugAim(a){if(drugState.k!=='coke')return a;let best=null,bd=500;
  for(const t of[...peds,...cars]){if(t.down||t.kind==='dead'||t.kind==='mine'||t===me.car)continue;const dx=t.x-me.x,dy=t.y-me.y,d=Math.hypot(dx,dy),ta=Math.atan2(dy,dx);if(d<bd&&Math.abs(wrap(ta-a))<40*Math.PI/180){bd=d;best=ta}}
  return best===null?a:a+wrap(best-a)*.5}
function drugChip(){const pw=$('power'),k=DK[drugSel];pw.hidden=!drugState.k&&!DK.some(x=>drugs[x]);
  if(drugState.k){pw.style.color=drugState.t>10?'#3dd68c':drugState.t>4?'#ffc94a':'#ff4b4b';pw.textContent=`${DRUGS[drugState.k].name} ${Math.ceil(drugState.t)}s`}
  else{pw.style.color=DRUGS[k].col;pw.textContent=`${DRUGS[k].name} x${drugs[k]} (${isTouch?'BUMP':kb('drug')} use, ${kb('drugSwitch')} switch)`}}
function drugTest(k){drugs[k]++;drugSel=DK.indexOf(k);useDrug()} // debug only
if(DBG)Object.defineProperties(DBG,{drug:{get:()=>drugState},drugTest:{get:()=>drugTest}});
// ---------- minigames ----------
// Hotwire (a locked car) and lockpick (prize counter, gun shop safe) run in the #minigame overlay.
// Both are the same timing game on one dial: press the interact key (or Space) when the white sweep
// is inside the green arc. Hotwire wants 3 clean passes; lockpick wants 3 in a row, and its misses
// make noise that draws the law. The world stays paused and nothing is drawn in the scene.
let miniState=null,miniLast=0,miniFxT=0;
const miniBand=()=>24-(clamp(lv,1,15)-1)*10/14; // green band in degrees: 24 at level 1, 14 at level 15
const miniHit=m=>((m.a-m.s+360)%360)<m.b;
function miniFx(hit){const c=$('minigame').querySelector('.card');
  c.classList.toggle('mini-hit',hit);c.classList.toggle('mini-miss',!hit);
  clearTimeout(miniFxT);miniFxT=setTimeout(()=>c.classList.remove('mini-hit','mini-miss'),280)}
function miniOpen(k,done){const b=miniBand();miniState={k,a:rand()*360,b,s:rr(0,360-b),hits:0,miss:0,res:null,done};
  miniLast=performance.now();openModal('minigame');miniPaint();requestAnimationFrame(miniFrame)}
function miniFrame(t){const m=miniState;if(!m||m.res)return;m.a=(m.a+175*(t-miniLast)/1000)%360;miniLast=t;miniPaint();requestAnimationFrame(miniFrame)}
function miniEnd(ok){const m=miniState;if(!m||m.res)return;m.res=ok===true?'win':ok===false?'fail':'cancel';
  if(m.k==='hot')feed(ok===true?'Hotwired. The engine turns over':ok===false?'The wires sparked out. Try again':'You left the car alone');
  else feed(ok===true?'The lock clicks open':ok===false?'The picks slipped. Someone may have heard that':'You put the picks away');
  closeShop();if(ok===true)m.done()}
function miniTap(){const m=miniState;if(!m||m.res)return;
  if(miniHit(m)){m.hits++;miniFx(true);noise(.06,6000,.1);
    if(m.hits>=3){miniEnd(true);return}}
  else{m.hits=0;m.miss++;miniFx(false);tone('triangle',170,.2,.09);
    if(m.k==='lock')addHeat(.5);
    if(m.miss>=3){miniEnd(false);return}}
  m.s=rr(0,360-m.b)}
function miniKey(e){const m=miniState;if(!m||m.res||e.repeat)return;
  if(e.code==='Escape'){miniEnd();return}
  if(e.code!=='Space'&&!BINDS.interact.includes(e.code))return; // the key you used to get here, or Space
  e.preventDefault();miniTap()}
addEventListener('keydown',miniKey);
$('minigame').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;e.preventDefault();miniTap()}); // touch and mouse tap the same way
$('miniCancel').addEventListener('click',()=>miniEnd());
function miniPaint(){const m=miniState;if(!m)return;
  $('miniHand').style.transform=`rotate(${m.a}deg)`;
  $('miniDial').style.background=`conic-gradient(transparent ${m.s}deg,#3dd68c ${m.s}deg ${m.s+m.b}deg,transparent ${m.s+m.b}deg)`;
  $('miniTitle').textContent=m.k==='hot'?'Hotwire the car':'Pick the lock';
  $('miniKey').textContent=isTouch?'TAP':kb('interact');
  $('miniInfo').textContent=m.res?'Done: '+m.res:
    `${isTouch?'Tap the dial':'Press the key or click the dial'} when the sweep is in the green arc. Passes ${m.hits} of 3${m.k==='lock'?' in a row':''}. Misses ${m.miss} of 3. ${isTouch?'Cancel leaves it alone':'Esc cancels'}`}
if(DBG)Object.defineProperties(DBG,{mini:{get:()=>miniState}});
if(DBG){DBG.hotwireTest=()=>miniOpen('hot',()=>{});DBG.lockTest=()=>miniOpen('lock',()=>{})}

// ---------- pit modes ----------
// E at the board on the Pit's north wall opens a picker. Three local runs: King of the Pit (hold the ring), Last Cars Standing (you and three rival cars), Gauntlet (six marks on the catwalk).
const PIT_MODES=['king','cars','gauntlet'],PIT_NAME={king:'King of the Pit',cars:'Last Cars Standing',gauntlet:'Gauntlet'};
const PIT_C={x:3360,y:3360,r:58},PIT_BOARD={x:3360,y:3228},PIT_START={x:3360,y:3400};
const PIT_MARKS=[[3280,3262],[3310,3262],[3340,3262],[3370,3262],[3400,3262],[3430,3262]];
const pitNear=()=>Math.hypot(me.x-PIT_BOARD.x,me.y-PIT_BOARD.y)<40;
let pitState=null,pitCars=[],pitBoard=null,pitMark=null,pitTxt='THE PIT',pitBT=0;
const pitRec={g:null,w:{king:0,cars:0,gauntlet:0}};
try{const d=JSON.parse(localStorage.getItem('pr3d-pit'));if(d&&typeof d==='object'){if(Number.isFinite(d.g)&&d.g>0)pitRec.g=d.g;for(const k of PIT_MODES)if(d.w&&Number.isFinite(d.w[k]))pitRec.w[k]=Math.max(0,Math.floor(d.w[k]))}}catch(e){}
function pitSave(){try{localStorage.setItem('pr3d-pit',JSON.stringify(pitRec))}catch(e){}}
function pitBoardSet(txt){if(txt===pitTxt)return;pitTxt=txt;const m=pitBoard.material;m.map.dispose();m.map=signTex(txt,'#ff3ea5');m.needsUpdate=true}
function pitRemote(){for(const r of remotes.values())if(PIT_MODES.includes(r.pm))return PIT_NAME[r.pm];return 'THE PIT'}
function pitMarkAt(i){const T=PIT_MARKS[i];if(!T){pitMark.visible=false;return}pitMark.visible=true;pitMark.position.set(T[0],groundZ(T[0],T[1])+8,T[1])}
function pitMeshes(){
  pitBoard=new THREE.Mesh(new THREE.PlaneGeometry(24,6),new THREE.MeshBasicMaterial({map:signTex(pitTxt,'#ff3ea5')}));
  pitBoard.rotation.y=Math.PI;pitBoard.position.set(PIT_BOARD.x,groundZ(PIT_BOARD.x,PIT_BOARD.y)+5,PIT_BOARD.y);scene.add(pitBoard);
  pitMark=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,16,8),new THREE.MeshBasicMaterial({color:'#ffd23f'}));pitMark.visible=false;scene.add(pitMark);
}
function pitOpen(){$('pitK').textContent='King of the Pit. Wins '+pitRec.w.king;$('pitC').textContent='Last Cars Standing. Wins '+pitRec.w.cars;$('pitG').textContent='Gauntlet. Best '+(pitRec.g?pitRec.g.toFixed(1)+' s':'none');openModal('pit')}
for(const[id,k]of[['pitK','king'],['pitC','cars'],['pitG','gauntlet']])$(id).addEventListener('click',()=>{closeShop();pitStart(k)});
$('pitClose').addEventListener('click',closeShop);
function pitStart(m){
  if(!PIT_MODES.includes(m))return;
  const x=PIT_START.x,y=PIT_START.y;
  pitState={m,t:0,s:0,a:0,n:0,done:0,rank:0};pitCars=[];pitMarkAt(m==='gauntlet'?0:-1);
  me.x=x;me.y=y;me.z=groundZ(x,y);me.vx=me.vy=0;
  if(m==='cars'){
    const c=mkCar(x,y,-Math.PI/2,'mine',myColor);cars.push(c);me.car=c;pitCars.push(c);
    for(const[rx,ry]of[[3270,3440],[3450,3440],[3270,3330]]){const r=mkCar(rx,ry,Math.atan2(y-ry,x-rx),'rival','#e9e9f2');cars.push(r);pitCars.push(r)}
  }
  pitBoardSet(PIT_NAME[m]);feed(`The Pit: ${PIT_NAME[m]}`);
}
function pitFinish(rank){
  const s=pitState,w=pitRec.w;s.done=1;s.rank=rank;pitMarkAt(-1);
  let pay=0,msg=`Place ${rank}`;
  if(s.m==='gauntlet'){msg=`${s.t.toFixed(1)} s`;if(!pitRec.g||s.t<pitRec.g){if(s.t<45)pay=800;pitRec.g=s.t;msg+=', new best'}}
  else pay=rank===1?1500:rank===2?500:0;
  if(rank===1)w[s.m]++;
  me.cash+=pay;
  if(me.car&&pitCars.includes(me.car))leaveCar(true);
  for(const c of pitCars){if(c.kind==='rival'||c.kind==='mine')c.kind='dead';const i=cars.indexOf(c);if(i>=0)cars.splice(i,1)} // the Pit owns these cars: clear them off the map
  pitCars=[];pitSave();saveArsenal();
  feed(`The Pit: ${PIT_NAME[s.m]}. ${msg}${pay?', '+money(pay):''}`);
  showBig(rank===1?'PIT WON':'PIT PLACE '+rank,'#ffc94a',msg+(pay?', '+money(pay):''),3);jingle('pass');
}
function pitCancel(){if(!pitState||pitState.done)return;pitState.done=1;pitMarkAt(-1);
  if(me.car&&pitCars.includes(me.car))leaveCar(true);
  for(const c of pitCars){if(c.kind==='rival'||c.kind==='mine')c.kind='dead';const i=cars.indexOf(c);if(i>=0)cars.splice(i,1)}
  pitCars=[];pitBoardSet(pitRemote());feed('You left the Pit. The board is open again')}
function pitTick(dt){
  const s=pitState;pitBT+=dt;
  if(pitBT>1){pitBT=0;pitBoardSet(s&&!s.done?PIT_NAME[s.m]:pitRemote())}
  if(!s||s.done||state!=='play'||me.downed)return;
  s.t+=dt;
  if(s.m!=='cars'){const away=Math.hypot(me.x-PIT_C.x,me.y-PIT_C.y)>700;s.away=away?(s.away||0)+dt:0;if(s.away>8)return pitCancel()} // leaving the Pit abandons the run
  if(s.m==='king'){if(Math.hypot(me.x-PIT_C.x,me.y-PIT_C.y)<PIT_C.r){s.a+=dt;if(s.a>=1){s.a-=1;s.s++;if(s.s>=60)pitFinish(1)}}else s.a=0} // the clock only runs while you hold the ring
  else if(s.m==='cars'){
    const p=pitCars[0];let alive=0;for(const c of pitCars)if(c.kind==='rival'&&!c.burn)alive++;
    if(me.car!==p||p.burn>0)return pitFinish(1+alive); // out of the car or wrecked
    if(!alive)return pitFinish(1);
    if(s.t>=90)return pitFinish(1+alive);
    for(const r of pitCars){if(r===p||r.kind!=='rival'||r.burn)continue;
      const st=clamp(wrap(Math.atan2(p.y-r.y,p.x-r.x)-r.a)*2.2,-1,1);
      r.stk=Math.hypot(r.vx,r.vy)<4?(r.stk||0)+dt:0;const bk=r.stk>1.5;if(r.stk>2.3)r.stk=0; // back off for a moment when stuck on a wall
      drive(r,bk?-1:1,bk?-st:st,false,dt);carWalls(r)}
  }
  else{
    const T=PIT_MARKS[s.n];
    if(T&&Math.hypot(me.x-T[0],me.y-T[1])<16){s.n++;if(s.n<PIT_MARKS.length)pitMarkAt(s.n);else pitFinish(1)}
  }
}
if(DBG)Object.defineProperties(DBG,{pit:{get:()=>pitState},pitStart:{get:()=>pitStart}});
// ---------- weather ----------
// One in-game day is 20 real minutes. clock 0 is midnight. Each page load starts at 0.9 (night, the old look).
// Timers run at 4 Hz (wxTick). Rain is one LineSegments object with a pooled buffer moved in place.
let clock=.9,wx='clear',wxLeft=rr(90,270),wxAcc=0,wxGrip=1;
const WXS=['clear','overcast','rain'],C=h=>new THREE.Color(h),V=(x,y,z)=>new THREE.Vector3(x,y,z);
// sky keys at clock 0 (midnight), .25 (dawn), .5 (day), .75 (dusk), 1 (midnight). Night keys are the old look.
const SKYK=[
 {bg:C('#1a0c2e'),fog:C('#2e1442'),sun:C('#a9bbff'),si:.5,hi:.85,pos:V(-.6,1,.4),sky:1,day:0},
 {bg:C('#4a2046'),fog:C('#8a4a5a'),sun:C('#ffb07a'),si:.9,hi:1,pos:V(-1,.5,.2),sky:.5,day:.35},
 {bg:C('#79b8ee'),fog:C('#b7d8f0'),sun:C('#fff4e0'),si:1.2,hi:1.3,pos:V(-.3,1,.3),sky:0,day:1},
 {bg:C('#4a2046'),fog:C('#8a4a5a'),sun:C('#ffb07a'),si:.9,hi:1,pos:V(1,.5,-.2),sky:.5,day:.35},
 {bg:C('#1a0c2e'),fog:C('#2e1442'),sun:C('#a9bbff'),si:.5,hi:.85,pos:V(-.6,1,.4),sky:1,day:0}];
const WXK={clear:{si:1,fog:1,dim:1,grip:1,road:C('#ffffff')},overcast:{si:.6,fog:1.15,dim:.82,grip:1,road:C('#ffffff')},rain:{si:.4,fog:1.6,dim:.6,grip:.85,road:C('#8c97ad')}},INSIDE_FOG=C('#160f28');
// Day/night material pass. A material registered here follows the clock in skyLook(): [material, property, night, day].
// Colours are kept as hex strings in userData because staticBatch() deep-copies userData when it clones a material;
// fadeApply() re-registers those clones, whose colour staticBatch has whitened (the tint moved into vertex colours).
const FADE=[],FADEC=[],CWN=new THREE.Color('#ffffff');
function fade(m,p,n,d){m.userData.fade=(m.userData.fade||[]).concat([[p,n,d]]);FADE.push([m,p,n,d]);return m}
function fadeC(m,p,n,d){m.userData.fadeC=(m.userData.fadeC||[]).concat([[p,n,d]]);FADEC.push([m,p,new THREE.Color(n),new THREE.Color(d)]);return m}
function fadeApply(m){const u=m.userData;if(!u||(!u.fade&&!u.fadeC))return;
  for(const e of u.fade||[])FADE.push([m,...e]);
  for(const[p,n,d]of u.fadeC||[])FADEC.push([m,p,CWN,new THREE.Color(d)])}
const RAIN_N=300,rainPos=new Float32Array(RAIN_N*6),rainGeo=new THREE.BufferGeometry();
rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#b9c8ff',transparent:true,opacity:.6,depthWrite:false}));
rain.frustumCulled=false;rain.visible=false;
for(let o=0;o<rainPos.length;o+=6){rainPos[o]=rr(-80,80);rainPos[o+1]=rr(-60,40);rainPos[o+2]=rr(-80,80);rainPos[o+3]=rainPos[o]+1.5;rainPos[o+4]=rainPos[o+1]+14;rainPos[o+5]=rainPos[o+2]}
function rainStep(dt){if(!rain.visible)return;rain.position.copy(camera.position);const d=dt*400,P=rainPos;
  for(let o=0;o<P.length;o+=6){let y=P[o+1]-d;if(y<-60){y+=100;P[o]=rr(-80,80);P[o+2]=rr(-80,80)}P[o+1]=y;P[o+3]=P[o]+1.5;P[o+4]=y+14;P[o+5]=P[o+2]}
  rainGeo.attributes.position.needsUpdate=true}
// sets sky, fog, sun and road colours from the clock and weather. Interiors use the night look with clear weather.
// The day amount (0 night, 1 noon) also drives the registered day/night materials.
let dAlast=-1;
function skyLook(){
  const inside=!!me.inside,W=WXK[inside?'clear':wx],f=(settings.time==='night'||inside?0:clock)*4,i=Math.min(3,f|0),t=f-i,A=SKYK[i],B=SKYK[i+1];
  scene.background.lerpColors(A.bg,B.bg,t).multiplyScalar(W.dim);
  scene.fog.color.lerpColors(A.fog,B.fog,t).multiplyScalar(W.dim);
  if(inside)scene.fog.color.copy(INSIDE_FOG);
  scene.fog.density=(fogHill?.00026:.00105)*(inside?1:W.fog);
  moon.color.lerpColors(A.sun,B.sun,t);moon.position.lerpVectors(A.pos,B.pos,t);
  moon.intensity=(A.si+(B.si-A.si)*t)*W.si;hemi.intensity=A.hi+(B.hi-A.hi)*t;
  skyDome.visible=A.sky+(B.sky-A.sky)*t>.5;
  asphMat.color.copy(W.road);wxGrip=W.grip;rain.visible=wx==='rain'&&!inside;
  const dA=inside?0:A.day+(B.day-A.day)*t;
  if(dA!==dAlast){dAlast=dA;for(const e of FADE)e[0][e[1]]=e[2]+(e[3]-e[2])*dA;for(const e of FADEC)e[0][e[1]].copy(e[2]).lerp(e[3],dA)}
}
function wxTick(dt){rainStep(dt);wxAcc+=dt;if(wxAcc<.25)return;const s=wxAcc;wxAcc=0;
  clock=(clock+s/1200)%1;wxLeft-=s;
  if(wxLeft<=0){wx=WXS[(WXS.indexOf(wx)+1+(rand()*2|0))%3];wxLeft=rr(90,270)}
  skyLook()}
if(DBG)Object.defineProperties(DBG,{weather:{get:()=>({clock,wx})}});
if(DBG)DBG.setWeather=k=>{wx=k;wxLeft=rr(90,270);skyLook()};
if(DBG)DBG.setClock=c=>{clock=c;skyLook()};
// ---------- events ----------
// Street events, one at a time, 90 s apart. Actors are peds and traffic cars within 200 units, checked at 2 Hz. When the street has none, evRecruit spawns them beside the player.
const EV_KINDS=['fight','crash','broke','rob','race'];
const evNear=(o,r)=>Math.hypot(o.x-me.x,o.y-me.y)<(r||200);
const evCiv=p=>!p.down&&!p.gang&&!p.guard&&!p.cop&&!p.vendor&&!p.flee&&!p.stopT&&!p.bag&&!p.msG&&evNear(p);
const evTraffic=c=>c.kind==='traffic'&&!c.rv&&!c.ms&&!c.mark&&evNear(c); // never touch race rivals or mission cars
const evPick=(L,f)=>{L=L.filter(f);return L.length?L[Math.floor(rand()*L.length)]:null};
const evNearest=(a,f)=>{let b=null,bd=1e9;for(const c of cars)if(c!==a&&f(c)){const d=Math.hypot(c.x-a.x,c.y-a.y);if(d<bd){bd=d;b=c}}return b};
const EVK={
  fight:{len:12,start(){ // two civilians square off, a bystander runs off
    const L=peds.filter(evCiv).sort(()=>rand()-.5);let a,b,r;
    for(a of L){b=L.find(q=>q!==a&&Math.hypot(q.x-a.x,q.y-a.y)<60);r=b&&L.find(q=>q!==a&&q!==b&&Math.hypot(q.x-a.x,q.y-a.y)<120);if(r)break}
    if(!r)return;
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;a.a=Math.atan2(b.y-a.y,b.x-a.x);b.a=a.a+Math.PI;a.stopT=b.stopT=12;r.flee=6;r.fx=mx;r.fy=my;
    return{actors:[a,b,r],mx,my}},
    tick(e){burst(e.mx,e.my,3,'#ffd27a',60,.3)}},
  crash:{len:10,start(){ // two traffic cars meet head on; the second is moved in front of the first
    const a=evPick(cars,evTraffic),b=a&&evNearest(a,c=>c.kind==='traffic');if(!b)return;
    const cs=Math.cos(a.a),sn=Math.sin(a.a);
    b.x=a.x+cs*24;b.y=a.y+sn*24;b.a=a.a+Math.PI;a.kind=b.kind='parked';
    a.vx=cs*45;a.vy=sn*45;b.vx=-cs*45;b.vy=-sn*45;
    return{actors:[a,b]}},
    tick(e){for(const c of e.actors)parts.push({x:c.x,y:c.y,vx:rr(-6,6),vy:rr(-6,6),life:1.6,max:1.6,col:'rgba(90,85,100,1)',k:'smoke',sz:rr(5,9)})}},
  broke:{len:25,start(){ // a traffic car stops; its brake lights blink as hazards
    const a=evPick(cars,evTraffic);if(!a)return;a.spd=0;return{actors:[a]}},
    tick(e){e.actors[0].brk=Math.floor(time*2)%2===0},
    end(e){const a=e.actors[0];a.brk=false;if(a.kind==='traffic')a.spd=rr(95,140)}},
  rob:{len:25,start(){ // a civilian runs off from a shop door with a bag
    const p=evPick(peds,evCiv);if(!p)return;let d=DOORS[0],dd=1e9;for(const v of DOORS){const x=Math.hypot(v.x-p.x,v.y-p.y);if(x<dd){dd=x;d=v}}
    p.bag=1;p.flee=25;p.fx=d.x;p.fy=d.y;return{actors:[p]}},
    tick(e){const p=e.actors[0];parts.push({x:p.x,y:p.y,vx:0,vy:0,life:.6,max:.6,col:'#ffe066',k:'spark',sz:2})},
    over:e=>{const p=e.actors[0];return!p.bag||p.down||!evNear(p,400)},
    end(e){e.actors[0].bag=0}},
  race:{len:20,start(){ // two traffic cars drive flat out for 20 s
    const a=evPick(cars,evTraffic),b=a&&evNearest(a,c=>c.kind==='traffic');if(!b)return;
    a.spd=b.spd=235;return{actors:[a,b]}},
    end(e){for(const c of e.actors)if(c.kind==='traffic')c.spd=rr(95,140)}},
};
// The ambient crowd spawns 450 to 1500 units from the start point, so a player standing elsewhere often has no actor within 200.
// evRecruit adds what the kind needs: sidewalk peds on the block edge nearest the player, or a traffic car level with the player on the nearest lane.
const evSide=()=>{
  const bi=clamp(Math.floor((me.x-R/2)/B),0,N-1),bj=clamp(Math.floor((me.y-R/2)/B),0,N-1),x0=bi*B+R+7,y0=bj*B+R+7,x1=(bi+1)*B-7,y1=(bj+1)*B-7;
  const x=clamp(me.x,x0,x1),y=clamp(me.y,y0,y1),dd=[x-x0,x1-x,y-y0,y1-y];
  return[[x0,y],[x1,y],[x,y0],[x,y1]][dd.indexOf(Math.min(...dd))];
};
const evRecruit=kind=>{
  if(kind==='fight'||kind==='rob'){for(let n=kind==='fight'?3:1;n--;){const[x,y]=evSide();spawnPed(x+rr(-15,15),y+rr(-15,15))}return}
  let L=null;const r0=Math.floor(me.y/B); // the lane nearest the player's y is never more than 196 away
  for(let r=r0;r<=r0+1&&r<=N;r++)for(const d of[0,2]){const y=r*B+laneOff(d);if(!L||Math.abs(y-me.y)<Math.abs(L.y-me.y))L={d,road:r,y}}
  const k=Math.floor(me.x/B),c=mkCar(0,0,L.d*Math.PI/2,'traffic',CARCOL[Math.floor(rand()*CARCOL.length)]);
  c.d=L.d;c.road=L.road;c.cross=POS(L.d)?k+1:k;setAlong(c,me.x);if(laneShut(c))return;decide(c,false);c.spd=rr(95,140);c.cur=c.spd*.6;cars.push(c);
};
function eventStart(kind){const k=EVK[kind];if(!k)return false;let e=k.start();if(!e){evRecruit(kind);e=k.start()}if(!e)return false;eventState=Object.assign({kind,t0:time,len:k.len,actors:[]},e);return true}
let eventState=null,eventNext=8,eventCheck=0,eventWant=null;
function eventStep(dt){ // runs the 2 Hz check; a finished event sets the next start 90 s later
  eventCheck-=dt;if(eventCheck>0)return;eventCheck=.5;
  const e=eventState;
  if(e){const k=EVK[e.kind];if(k.tick)k.tick(e);if(time-e.t0>=e.len||k.over&&k.over(e)){if(k.end)k.end(e);eventState=null;eventNext=time+90}return}
  if(state==='play'&&!me.inside&&!raceState.on&&!pitState&&!mission&&time>=eventNext&&eventStart(eventWant||EV_KINDS[Math.floor(rand()*EV_KINDS.length)]))eventWant=null;
}
if(DBG)Object.defineProperties(DBG,{events:{get:()=>eventState}});
if(DBG)DBG.eventTest=k=>{eventWant=k;eventNext=0}; // starts that kind at the next 2 Hz check, bringing its actors if the street has none
// ---------- races ----------
// Street races on three loops of the road grid. Intersection (i,j) sits at (i*B+60, j*B+60). Each loop has 6 checkpoints, about 2.6 km.
// Rivals are traffic cars with c.rv set: decide() steers them toward c.rv.g, and they drive the lanes like traffic.
const RACE_LOOPS=[[[2,6],[3,6],[4,6],[4,7],[3,7],[2,7]],[[6,2],[7,2],[7,3],[7,4],[6,4],[6,3]],[[4,3],[5,3],[5,4],[5,5],[4,5],[4,4]]];
const RACES=['Midtown loop','Suburb loop','Downtown loop'].map((name,k)=>{const l=RACE_LOOPS[k];return{name,p:l.map(([i,j])=>({x:i*B+60,y:j*B+60,i,j})),board:{x:l[0][0]*B+130,y:l[0][1]*B+130}}});
let raceBest=[null,null,null];
try{const v=JSON.parse(localStorage.getItem('pr3d-races'));if(Array.isArray(v))raceBest=RACES.map((_,k)=>typeof v[k]==='number'&&v[k]>0&&v[k]<3600?v[k]:null)}catch(e){}
let raceState={on:false,c:0,cd:0,t:0,i:1,n:0,pen:0,pos:0,fin:[]},rvs=[],rmesh=null;
const rnear=(q,r)=>Math.hypot(r.x-q.x,r.y-q.y)<50,fmtT=s=>`${Math.floor(s/60)}:${(s%60).toFixed(2).padStart(5,'0')}`;
function raceStart(k){
  if(raceState.on||state!=='play'||me.downed)return;
  const p=RACES[k].p,n=p.length,d=p[1].x>p[0].x?0:p[1].x<p[0].x?2:p[1].y>p[0].y?1:3,ev=d%2===0,sg=d<2?1:-1;
  raceState={on:true,c:k,cd:3,t:0,i:1,n,pen:0,pos:0,fin:[]};
  if(!rmesh){rmesh=new THREE.InstancedMesh(new THREE.RingGeometry(26,34,24),new THREE.MeshBasicMaterial({color:'#ffc94a',transparent:true,opacity:.8,side:THREE.DoubleSide}),9);rmesh.frustumCulled=false;scene.add(rmesh)}
  p.forEach((q,j)=>inst(rmesh,j,q.x,.6,q.y,0,1,1,1,-Math.PI/2));
  rmesh.count=n;rmesh.instanceMatrix.needsUpdate=true;rmesh.visible=true;
  if(!me.car){const c=mkCar(p[0].x,p[0].y,d*Math.PI/2,'mine','#ff3ea5','sports');cars.push(c);me.car=c;me.x=c.x;me.y=c.y;me.a=c.a;handsUp=false}
  rvs=[];
  for(let j=0;j<2;j++){const c=mkCar(0,0,d*Math.PI/2,'traffic',CARCOL[6+j]);
    c.d=d;c.road=ev?p[0].j:p[0].i;c.cross=ev?p[0].i:p[0].j;setAlong(c,(ev?p[0].x:p[0].y)-sg*(30+80*j));
    c.spd=rr(150,170);c.cur=c.spd*.6;c.rv={i:1,g:p[1],n:p[2],done:false};decide(c,true);cars.push(c);rvs.push(c)}
  showBig('3','#ffc94a',RACES[k].name,.9);
}
function rsHit(k){inst(rmesh,k%raceState.n,0,-999,0);rmesh.instanceMatrix.needsUpdate=true}
function raceEnd(ok){
  const rs=raceState,T=rs.t+rs.pen;rs.on=false;rmesh.visible=false;
  for(const c of rvs){
    if(c===me.car){c.rv=null;c.kind='parked';c.keyed=1;continue} // a stolen rival stays yours, it just stops chasing
    const i=cars.indexOf(c);if(i>=0)cars.splice(i,1)}
  rvs=[];
  if(!ok){feed('Race over. No pay.');return}
  rs.pos=1+rs.fin.length;const pay=[800,400,200][rs.pos-1]||0,b=raceBest[rs.c];me.cash+=pay;
  if(!b||T<b){raceBest[rs.c]=T;try{localStorage.setItem('pr3d-races',JSON.stringify(raceBest))}catch(e){}}
  const el=$('raceRes');el.textContent=`${RACES[rs.c].name}: P${rs.pos}, ${fmtT(T)}, best ${fmtT(raceBest[rs.c])}, +$${pay}`;el.hidden=false;setTimeout(()=>el.hidden=true,8000);
}
function raceStep(dt){
  const rs=raceState;if(!rs.on)return;
  const p=RACES[rs.c].p,n=rs.n;
  if(rs.cd>0){const was=Math.ceil(rs.cd);rs.cd-=dt;if(rs.cd<=0)showBig('GO','#3dd68c',RACES[rs.c].name,.8);else if(Math.ceil(rs.cd)!==was)showBig(String(Math.ceil(rs.cd)),'#ffc94a',RACES[rs.c].name,.8);
    return} // nothing counts, not even the rivals, until GO
  rs.t+=dt;
  if(state==='dead'||me.downed||me.inside){raceEnd(false);return}
  if(rs.t>300){feed('Race timed out. Find the board to try again');raceEnd(false);return}
  // rings 1 to n-1 are checkpoints, ring n (the start ring again) is the finish
  if(rnear(p[rs.i%n],me)){rsHit(rs.i);rs.i++;if(rs.i<=n)feed(`Checkpoint ${rs.i-1} of ${n-1}`)}
  else if(rnear(p[(rs.i+1)%n],me)){rs.pen+=5;feed('Missed a checkpoint. +5 s');rsHit(rs.i);rsHit(rs.i+1);rs.i+=2}
  if(rs.i>n){raceEnd(true);return}
  for(const c of rvs){const v=c.rv;if(v.done||c.kind!=='traffic'||!rnear(p[v.i%n],c))continue;
    if(++v.i>n){v.done=true;rs.fin.push(rs.t)}else{v.g=p[v.i%n];v.n=p[(v.i+1)%n];decide(c,true)}}
}
if(DBG)Object.defineProperties(DBG,{race:{get:()=>raceState},raceStart:{value:raceStart},rivals:{get:()=>rvs.map(c=>({x:c.x|0,y:c.y|0,i:c.rv.i,k:c.kind}))}});

// ---------- crews ----------
// A crew is 2 to 4 players in one room. The leader invites a player within 60 units from the Players app and the
// invitee presses E. Both ride on the presence field cw=[crewId, stations held as bits, invitee]. Crews live in memory only.
let crewS=null,crewRd=null,crewInv=null,crewHold=[0,0,0];
const CREW_STN=[{x:940,y:1380},{x:1820,y:3140},{x:2700,y:940}]; // bank van spots, one in each block
function crewOn(){return!!crewS&&crewS.members.length>=2}
function crewCnt(m){return(m&1)+(m>>1&1)+(m>>2&1)}
function crewMask(){let m=crewRd?crewRd.m:0;if(crewOn())for(const p of crewS.members)if(p!==myPeer){const r=remotes.get(p);if(r)m|=r.cwM}return m}
function crewPub(){return crewS?[crewS.id,crewRd?crewRd.m:0,crewS.inv?crewS.inv.peer:'']:null}
// members are the remotes whose cw names this crew. The lowest peer id leads if the leader is gone.
function crewFrame(dt){
  if(crewRd&&(crewRd.t-=dt)<=0){if(crewRd.m&&!crewRd.done)feed('The crew stations reset');crewRd=null}
  if(!room||!myPeer){crewS=null;crewInv=null;return}
  const was=crewInv;crewInv=null;
  for(const[p,r]of remotes)if(r.cwInv===str(myPeer)&&r.cwId&&!(crewS&&crewS.id===r.cwId)){crewInv={peer:p,name:r.name,id:r.cwId};break}
  if(crewInv&&(!was||was.peer!==crewInv.peer||was.id!==crewInv.id))feed(`${crewInv.name} invites you to a crew. Press ${kb('interact')} to join.`);
  if(!crewS)return;
  if(crewS.inv&&(time>crewS.inv.t||crewS.members.includes(crewS.inv.peer)))crewS.inv=null;
  crewS.members=[myPeer];for(const[p,r]of remotes)if(r.cwId===crewS.id&&crewS.members.length<4)crewS.members.push(p);
  if(!crewS.members.includes(crewS.leader))crewS.leader=crewS.members.reduce((a,b)=>b<a?b:a);
}
function crewInvite(peer){
  const r=remotes.get(peer);if(!r||!myPeer)return;
  if(Math.hypot(r.x-A.x,r.y-A.y)>60)return feed(`${r.name} is too far. Get within 60 units`);
  if(!crewS)crewS={id:(Math.random()*0x7fffffff|0).toString(16),leader:myPeer,members:[myPeer],inv:null};
  if(crewS.leader!==myPeer)return feed('Only the crew leader can invite');
  if(crewS.members.length>=4)return feed('A crew is four at most');
  crewS.inv={peer,t:time+15};pubT=1;
  feed(`Invited ${r.name}. Stand close, they press ${kb('interact')} to join`);
}
function crewAccept(){
  if(!crewInv||me.car||me.heli||me.jet||me.inside)return false;
  const r=remotes.get(crewInv.peer);
  // the invite only counts up close, and only while that player still leads the crew they named
  if(!r||r.cwId!==crewInv.id||Math.hypot(r.x-A.x,r.y-A.y)>80){feed('They are out of reach');crewInv=null;return false}
  crewS={id:crewInv.id,leader:crewInv.peer,members:[myPeer],inv:null};crewRd=null;crewInv=null;pubT=1;
  feed('You joined the crew');return true;
}
function crewLeave(){if(!crewS)return;crewS=null;crewRd=null;pubT=1;feed('You left the crew')}
// co-op job: each spot needs one crew member in its ring for 4 s. A held spot stays held for the minute.
function crewStep(st,dt){
  if(!crewOn())return'fail:The crew broke up';
  const P=jobPos();let near=-1,nd=18;
  for(let i=0;i<3;i++){const d=Math.hypot(CREW_STN[i].x-P.x,CREW_STN[i].y-P.y);if(d<nd){nd=d;near=i}}
  for(let i=0;i<3;i++)if(i!==near)crewHold[i]=0;
  if(near>=0&&!(crewMask()>>near&1)&&(crewHold[near]+=dt)>=4){crewRd=crewRd||{t:60,m:0,done:false};crewRd.m|=1<<near}
  const got=crewMask();
  if(got===7){if(crewRd)crewRd.done=true;return'next'}
  mission.msg=`Stations ${crewCnt(got)} of 3 held`+(crewRd?` · ${Math.ceil(crewRd.t)} s`:'');
}
function crewWhere(){const m=crewMask();let b=null,bd=1e9;for(let i=0;i<3;i++)if(!(m>>i&1)){const d=Math.hypot(CREW_STN[i].x-me.x,CREW_STN[i].y-me.y);if(d<bd){bd=d;b=CREW_STN[i]}}return b?[b.x,b.y]:null}
// co-op pay is per player: the mission pays each client that finishes it, so nobody loses a share to an idle crewmate
phoneApp('crew','Crew',IC.crew,el=>{
  if(!crewOn()){el.append(mk('div','ph-sub',crewInv?`${crewInv.name} invites you. Press ${kb('interact')} to join.`:'No crew yet. Invite a player within 60 units from the Players app.'));return}
  for(const p of crewS.members){const r=p===myPeer?null:remotes.get(p),c=mk('div','ph-card');
    c.append(mk('b','ph-big',r?r.name:myName+' (you)'),mk('div','ph-sub',(p===crewS.leader?'Leader':'Member')+(r?` · ${Math.round(Math.hypot(r.x-me.x,r.y-me.y)/10)} m away`:'')));el.append(c)}
  el.append(mk('div','ph-sub',mission&&mission.def.crew?`Bank van pickup: ${crewCnt(crewMask())} of 3 stations held.`:'No crew job running. Vic has one for crews.'));
  const b=mk('button','ph-btn alt','Leave crew');b.type='button';b.dataset.nav='';b.onclick=crewLeave;el.append(b)},'#ff6b3d');
if(DBG)Object.defineProperties(DBG,{crew:{get:()=>crewS}});
// test hook: a fake remote 20 units away. With no argument it takes the invite at once and the bank job starts.
// With true it is the leader inviting you, so press E to join.
if(DBG)DBG.crewTest=inv=>{
  const bot={peer:'bot',kind:'viewer',presence:{n:'Tester',c:'#3dd68c',pv:PV,v:0,x:0,y:0,cw:null}};
  room={presence:()=>Promise.resolve(),peers:()=>{bot.presence.x=me.x+20;bot.presence.y=me.y;
    bot.presence.cw=inv&&!(crewS&&crewS.id==='c0ffee')?['c0ffee',0,'me']:crewS?[crewS.id,0,'']:null;return[{peer:'me',sameTab:true},bot]}};
  syncRoom(0);
  if(!inv){crewInvite('bot');syncRoom(0);crewFrame(0);startMission('bank',true)}
  return crewS};

