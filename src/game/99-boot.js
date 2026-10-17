// ---------- boot ----------
function seedWorld(){
  for(let i=0;i<24;i++)laneSpawn('traffic',120,1500);
  for(let i=0;i<45;i++){const[x,y]=pointAway(60,1300);spawnPed(x,y)}
for(const[x,y]of VENDORS){const p=spawnPed(x,y);p.kind='vendor';p.vendor=true;p.hx=x;p.hy=y}
  for(let i=0;i<10;i++){const[s]=parkSpot(40,1300);if(s)cars.push(mkCar(s[0],s[1],s[2],'parked',CARCOL[Math.floor(rand()*CARCOL.length)]))}
  {const c=mkCar(4*B+R+40,4*B+108,0,'parked','#ff3ea5','sports');c.keyed=1;cars.push(c)} // your ride: the first car you meet needs no hotwire
  newJob('courier');spawnGuards();msSeed();
}
const SWATCH=['#ff3ea5','#29e6d6','#ffc94a','#7b6bff','#3dd68c','#ff6b3d','#4aa3ff','#f3ecff'];
function start(data){
  try{const n=localStorage.getItem('pr-name'),c=localStorage.getItem('pr-color');if(n)myName=n;if(c&&SWATCH.includes(c))myColor=c}catch(e){}
  try{const s=JSON.parse(localStorage.getItem('pr-settings')||'null');if(s&&typeof s==='object'){if(Number.isFinite(s.sens))settings.sens=clamp(s.sens,.3,3);if(typeof s.inv==='boolean')settings.inv=s.inv;if([0,4,8].includes(s.assist))settings.assist=s.assist;if(Number.isFinite(s.veh))settings.veh=clamp(s.veh,.3,2);if(Number.isFinite(s.scope))settings.scope=clamp(s.scope,.2,1);if(s.sprintMode==='toggle'||s.sprintMode==='hold')settings.sprintMode=s.sprintMode;if(s.time==='night'||s.time==='auto')settings.time=s.time}}catch(e){}
  try{loadBinds(JSON.parse(localStorage.getItem('pr-keys')||'null'))}catch(e){}
  try{loadArsenal(JSON.parse(localStorage.getItem('pr3d-arsenal')||'null'))}catch(e){}
  if(data&&typeof data.name==='string'){myName=data.name;myColor=hex(data.color,myColor);loadArsenal(data)}
  $('name').value=myName;
  const sw=$('swatches');
  SWATCH.forEach(c=>{const b=document.createElement('button');b.type='button';b.style.background=c;b.setAttribute('aria-label','Colour '+c);b.setAttribute('aria-pressed',String(c===myColor));
    b.onclick=()=>{myColor=c;sw.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))};sw.appendChild(b)});
  $('startForm').addEventListener('submit',e=>{e.preventDefault();
    myName=str($('name').value.trim())||'Nightrider';
    try{localStorage.setItem('pr-name',myName);localStorage.setItem('pr-color',myColor)}catch(_){}
    audioInit();lockMouse();$('start').hidden=true;$('name').blur();state='play';me.inv=2.5;
    if(isTouch)$('touch').hidden=false;
    if(!inClaude&&roomName!=='main')feed('Private city '+roomName.toUpperCase()+'. Only players with the link can join.');
  });
  // City panel: current room, join by code, copy the link. Claude keeps its single room.
  $('cityLine').textContent=inClaude?'Claude room':'City: '+roomName.toUpperCase()+(roomName==='main'?' \u00b7 public':'');
  $('cityPanel').hidden=inClaude;
  if(!inClaude){
    $('roomCode').value=roomName==='main'?'':roomName;
    const goRoom=r=>{myName=str($('name').value.trim())||myName;try{localStorage.setItem('pr-name',myName);localStorage.setItem('pr-color',myColor)}catch(e){};saveRoom(r);const q=new URLSearchParams(location.search);if(r==='main')q.delete('room');else q.set('room',r);location.search=q.toString()};
    const joinRoom=()=>goRoom(roomFrom('?room='+$('roomCode').value.trim()));
    $('roomJoin').onclick=joinRoom;
    $('roomCode').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();joinRoom()}});
    $('roomNew').onclick=()=>{const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c='';for(let i=0;i<6;i++)c+=A[Math.floor(rand()*32)];goRoom(c.toLowerCase())};
    $('roomPublic').onclick=()=>goRoom('main');
    $('roomCopy').onclick=()=>{const u=location.origin+location.pathname+(roomName==='main'?'':'?room='+roomName);
      const done=()=>{const b=$('roomCopy');b.textContent='Copied';setTimeout(()=>b.textContent='Copy link',1200)};
      const fallback=()=>{const t=document.createElement('textarea');t.value=u;t.style.cssText='position:fixed;opacity:0';document.body.appendChild(t);t.select();let yes=false;try{yes=document.execCommand('copy')}catch(e){}t.remove();if(yes)done();else{try{prompt('Copy this link',u)}catch(e){}}};
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(u).then(done,fallback);else fallback()};
  }
  terrainCheck();seedWorld();staticBatch();
  if(data&&data.playing){$('start').hidden=true;state='play';if(isTouch)$('touch').hidden=false}
  let last=performance.now(),modalF=0;
  const loop=now=>{const raw=(now-last)/1000;let dt=clamp(raw,0,.033);last=now;perfTick(raw);if(wheelOpen)dt*=.25;
    try{const t0=performance.now();update(dt);const t1=performance.now();
      // a full screen table or menu covers the world: draw it at about 10 fps instead of every frame,
      // which leaves the GPU free for the table itself (this is what made the blackjack felt feel slow)
      if(state==='shop'&&(modalF=(modalF+1)%6)!==0){ui(dt);soundStep(dt);perfFrame(raw*1000,t1-t0,0,0)}
      else{render(dt);const t2=performance.now();drawMini();const t3=performance.now();ui(dt);soundStep(dt);perfFrame(raw*1000,t1-t0,t3-t2,performance.now()-t3)}
    }catch(err){console.error(err)}
    requestAnimationFrame(loop)};
  requestAnimationFrame(loop);
}
if(DBG)Object.defineProperties(DBG,{me:{get:()=>me},cars:{get:()=>cars},peds:{get:()=>peds},job:{get:()=>job},heat:{get:()=>heat},state:{get:()=>state},time:{get:()=>time},weap:{get:()=>weap},owned:{get:()=>owned},cash:{get:()=>me.cash},calls:{get:()=>renderer.info.render.calls}});
window.claude?.hot?.snapshot?.(()=>({name:myName,color:myColor,cash:me.cash,bonus10k:true,owned,ammo,weap,playing:state!=='menu'}));
window.claude?.hot?.ready?window.claude.hot.ready(start):start(window.claude?.hot?.data??{});
})();
