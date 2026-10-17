// ---------- multiplayer (room presence) ----------
let room=null,myPeer=null,netState='connecting',netWhy='';
const PV=5; // presence protocol version, 5 = chat ch, city rules hr, and the downed dn plus revive rv fields; bump when the presence shape changes
const killXpT={},pvWarn=new Set();
// The city comes from the URL: ?room=code, else the last code used on this device, else the
// public city. A room is 1 to 10 lowercase letters and digits; anything else is invalid.
function roomFrom(u){try{const v=new URL(u,'http://x').searchParams.get('room');return v&&/^[a-z0-9]{1,10}$/.test(v.toLowerCase())?v.toLowerCase():'main'}catch(e){return 'main'}}
const loadRoom=()=>{try{const s=(localStorage.getItem('pr-room')||'').toLowerCase();return /^[a-z0-9]{1,10}$/.test(s)?s:'main'}catch(e){return 'main'}};
const saveRoom=r=>{try{localStorage.setItem('pr-room',r)}catch(e){}};
const inClaude=!!(window.claude&&typeof window.claude.use==='function');
let roomName=/[?&]room=/.test(location.search)?roomFrom(location.search):loadRoom();
const roomTag=inClaude||roomName==='main'?'':' \u00b7 '+roomName.toUpperCase();
saveRoom(roomName);
// Outside Claude (e.g. the Cloudflare site) the game joins the lobby over a WebSocket at
// /ws?room=<room> (see worker/index.js). This object mimics the parts of Claude's room API the game uses.
function wsRoom(url){
  let ws=null,mine={},self=null,snap=Object.freeze([]),dirty=false;const others=new Map(),subs=[];
  const rebuild=()=>{const list=[];if(self)list.push({peer:self,sameTab:true,isMe:true,kind:'viewer',guest:false,presence:mine});
    for(const[peer,d]of others)list.push({peer,sameTab:false,isMe:false,kind:'viewer',guest:false,presence:d});
    snap=Object.freeze(list);for(const f of subs)try{f({peers:snap,joined:[],left:[],updated:[]})}catch(e){}};
  const send=()=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify({t:'p',d:mine}))};
  const connect=()=>{
    try{ws=new WebSocket(url)}catch(e){setTimeout(connect,3000);return}
    ws.onopen=()=>{netState='online';netWhy='';send()};
    ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(_){return}if(!m||typeof m!=='object')return;
      if(m.t==='hello'){self=String(m.peer).slice(0,40);others.clear();for(const q of Array.isArray(m.peers)?m.peers:[])if(q&&q.peer&&q.d&&typeof q.d==='object')others.set(String(q.peer).slice(0,40),q.d);rebuild()}
      else if(m.t==='p'&&m.peer&&m.d&&typeof m.d==='object'){others.set(String(m.peer).slice(0,40),m.d);dirty=true}
      else if(m.t==='leave'&&m.peer){others.delete(String(m.peer));rebuild()}};
    ws.onclose=()=>{self=null;others.clear();rebuild();if(netState==='online'){netState='connecting';netWhy=''}setTimeout(connect,3000)};
    ws.onerror=()=>{netState='solo';netWhy='server offline'}};
  connect();setInterval(()=>{if(dirty){dirty=false;rebuild()}},50);
  return{peers:()=>snap,onPeers(f){subs.push(f);return()=>{}},presence(patch){for(const k in patch){if(patch[k]===null)delete mine[k];else mine[k]=patch[k]}send();return Promise.resolve()}}}
const lobbyHost=/^https?:$/.test(location.protocol)&&!(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&location.port!=='8787');
// On the hosted site, check for a newer deploy every 45 s and offer a reload.
const BUILD_VERSION='__BUILD_VERSION__';
if(lobbyHost&&!window.claude&&BUILD_VERSION.length===12){let shown=false;setInterval(async()=>{if(shown)return;try{const r=await fetch('/version.json',{cache:'no-store'});if(!r.ok)return;const v=(await r.json()).v;
  if(typeof v==='string'&&v!==BUILD_VERSION){shown=true;const b=document.createElement('button');b.type='button';b.textContent='A new version of Palmetto Run is live. Reload';
    b.style.cssText='position:fixed;top:calc(12px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:7;font:16px var(--display);background:var(--gold);color:#1a1205;border:0;padding:10px 18px;cursor:pointer;box-shadow:0 0 24px rgba(255,201,74,.5)';
    b.addEventListener('click',()=>location.reload());document.body.appendChild(b);feed('A new version is live. Click the button at the top to reload')}}catch(e){}},45000)}
const remotes=new Map();
const num=(v,d=0)=>Number.isFinite(v)?v:d;
const hex=(v,d='#ff3ea5')=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v)?v:d;
const str=v=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e]/g,'').slice(0,16):'';
// chat text: like str() but strips the same ranges on any length, collapses whitespace and slices to n (120 by default)
const txt=(v,n=120)=>typeof v!=='string'?'':v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e]/g,'').replace(/\s+/g,' ').trim().slice(0,n);
// City rules: the host sets how the night plays. The host publishes hr=[hrVer,cops,traffic,ff,grav] and
// everyone else applies the lowest peer's copy, so the night keeps its values when the host leaves.
const RULES={cops:1,traffic:1,ff:1,grav:1},HRK=['cops','traffic','ff','grav'],HRCAP={traffic:[12,26,40],peds:[20,44,60],parked:[6,10,14]};
const HRFEED={cops:{0:'Cops are off',1:'Cops are back'},traffic:{0:'Light traffic',1:'Normal traffic',2:'Heavy traffic'},ff:{0:'Friendly fire off',1:'Friendly fire on'},grav:{'0.55':'Moon gravity','1':'Normal gravity','1.4':'Heavy gravity'}};
let hrVer=0;
function carGravity(){return 650*RULES.grav} // carZ falls at 650 m/s2 times the grav rule
function spawnCaps(){return{traffic:HRCAP.traffic[RULES.traffic],peds:HRCAP.peds[RULES.traffic],parked:HRCAP.parked[RULES.traffic],cops:RULES.cops}}
function customRules(){return RULES.cops!==1||RULES.traffic!==1||RULES.ff!==1||RULES.grav!==1}
function ruleVal(k,v){
  if(k==='cops'||k==='ff')return v===0||v===1?v:null;
  if(k==='traffic')return v===0||v===1||v===2?v:null;
  return v===.55||v===1||v===1.4?v:null; // grav: moon, normal, heavy
}
function amHost(f){if(!room||!myPeer)return true;for(const[p,r]of remotes)if((!f||f(r))&&p<myPeer)return false;return true}
function hostPeer(){if(amHost())return myPeer;let lo=null;for(const p of remotes.keys())if(lo===null||p<lo)lo=p;return lo}
function copsOff(){heat=0;policeClear();for(let i=cars.length-1;i>=0;i--)if(cars[i].kind==='police')cars.splice(i,1)}
function hrApply(k,v){if(RULES[k]===v)return;RULES[k]=v;hrVer++;const m=HRFEED[k][String(v)];if(m)feed(m);if(k==='cops'&&v===0)copsOff()}
function setRule(k,v){if(!HRK.includes(k)||!amHost())return false;const rv=ruleVal(k,v);if(rv===null)return false;hrApply(k,rv);return true}
function hrFromHost(){ // the host is the lowest peer id; ignore any element out of range
  if(!room||amHost())return;
  const hp=hostPeer(),r=hp&&remotes.get(hp);
  if(!r||!r.hr||!(Math.floor(num(r.hr[0],-1))>=0))return;
  for(let i=0;i<4;i++){const v=ruleVal(HRK[i],num(r.hr[i+1],-1));if(v!==null)hrApply(HRK[i],v)}
}
(async()=>{
  try{
    if(!window.claude||typeof window.claude.use!=='function'){if(lobbyHost){room=wsRoom((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws?room='+roomName);room.onPeers(ch=>{for(const p of ch.peers)if(p.sameTab)myPeer=p.peer})}else{netState='solo';netWhy='no-viewer'}return}
    room=await window.claude.use('room');
    if(!room){netState='solo';netWhy='not-admitted';return}
    netState='online';
    room.onPeers(ch=>{for(const p of ch.peers)if(p.sameTab)myPeer=p.peer},e=>{netState='solo';netWhy=(e&&e.code)||'error';room=null});
  }catch(e){netState='solo';netWhy='error';room=null}
})();
setTimeout(()=>{if(netState==='connecting'){netState='solo';netWhy='timeout'}},12000);
// revive receive path: a reviver published rv naming us. Stand up with 45 health and 2 s of grace.
// Safe to call twice (two rescuers in one frame): the second call finds me.downed already false.
function applyRevive(peer,seq){
  if(!me.downed)return false;
  const r=peer&&remotes.get(peer);
  if(!r||r.dead||Math.hypot(r.x-A.x,r.y-A.y)>60)return false; // only a living rescuer standing next to you counts
  me.downed=false;me.downT=0;me.hp=45;me.inv=2;
  feed((r?r.name:'A friend')+' revived you');
  gainXP(25,'Revive');return true
}
function syncRoom(dt){
  if(!room)return;
  let ps;try{ps=room.peers()}catch(e){return}
  const seen=new Set();
  for(const p of ps){
    if(p.sameTab){myPeer=p.peer;continue}
    if(p.kind!=='viewer')continue;
    const s=p.presence||{};if(!Number.isFinite(s.x)||!Number.isFinite(s.y))continue;
    seen.add(p.peer);tIn(p.peer,s.seat,s.tb,s.dn===1);
    const pv=num(s.pv)||0;if(pv!==PV&&!pvWarn.has(p.peer)){pvWarn.add(p.peer);feed('Someone is on a different game version. Ask them to reload the page')}
    let r=remotes.get(p.peer);
    if(!r){r={x:s.x,y:s.y,a:num(s.a),shot:Array.isArray(s.s)?s.s[0]:null,ex:Array.isArray(s.ex)?s.ex[0]:null,fl:s.fl,dmgSeen:null,kMe:null,chSeq:null,chatLine:'',chatT:-9,downed:false,rvSeen:null};remotes.set(p.peer,r);feed(`${str(s.n)||'A driver'} rolled into town`)}
    r.tx=clamp(s.x,-50,W+4500);r.ty=clamp(s.y,HILL.edge,W+300);r.ta=num(s.a);r.name=str(s.n)||'Driver';r.color=hex(s.c);r.inCar=s.v===1;r.inHeli=s.v===2;r.inJet=s.v===3;r.cc=hex(s.cc,r.color);r.ng=hex(s.ng,null);r.z=clamp(num(s.z),0,900);r.cz=clamp(num(s.cz),-50,900);r.ct=hasCT(s.ct)?s.ct:'sedan';r.hp=clamp(num(s.h,100),0,100);r.dead=s.dd===1;r.downed=num(s.dn)===1;r.w=clamp(num(s.w),0,5);r.lv=clamp(Math.floor(num(s.lv,1)),1,30);r.lk=str(s.lk);r.ar=Array.isArray(s.ar)?[clamp(num(s.ar[0]),0,99999),clamp(num(s.ar[1]),0,99999)]:[0,0];
    r.k=s.k&&typeof s.k==='object'?s.k:{};r.pm=str(s.pm);
    r.rk=rkParse(s.rk);
    // chat: react once per new seq, and never show or sound anything from a muted peer
    {const cc=Array.isArray(s.ch)?s.ch:null;
     if(cc&&cc.length>=2){const cs=num(cc[0],-1);if(r.chSeq===null)r.chSeq=cs;else if(cs!==r.chSeq){r.chSeq=cs;if(!mutedPeers.has(p.peer))chatGot(r,Math.floor(num(cc[1])),cc)}}}
    // revive: rv=[peerId,seq] in reverse. Only a newer seq counts, and only the named peer stands up.
    // rvSeen null means this peer has never published one, so treat it as -1 and let the first seq count.
    {const rv=Array.isArray(s.rv)?s.rv:null;
     if(rv&&rv.length>=2){const rs=num(rv[1],-1),rp=str(rv[0]);if(rs>(r.rvSeen===null?-1:r.rvSeen)){r.rvSeen=rs;if(rp&&myPeer&&rp===str(myPeer))applyRevive(p.peer,rs)}}}
    r.hr=Array.isArray(s.hr)&&s.hr.length===5?s.hr:null;
    {const cw=Array.isArray(s.cw)?s.cw:[];r.cwId=typeof cw[0]==='string'&&/^[0-9a-f]{1,8}$/.test(cw[0])?cw[0]:'';r.cwM=clamp(Math.floor(num(cw[1])),0,7);r.cwInv=str(cw[2])}
    if(myPeer){
      const dv=s.d&&typeof s.d==='object'?num(s.d[myPeer]):0;
      if(r.dmgSeen===null)r.dmgSeen=dv;else if(dv>r.dmgSeen){const amt=Math.min(dv-r.dmgSeen,120);r.dmgSeen=dv;if(RULES.ff){if(me.jet){me.jet.hp-=amt*BAL.remote.air;me.lastHitBy=p.peer;me.lastHitT=time}else if(me.heli){me.heli.hp-=amt*BAL.remote.air;me.lastHitBy=p.peer;me.lastHitT=time}else if(me.car){const arm=me.car.type==='armored';damageCar(me.car,amt*(arm?BAL.remote.arm:BAL.remote.car),false);if(arm){me.lastHitBy=p.peer;me.lastHitT=time}else hurtMe(amt*BAL.remote.occ,p.peer)}else hurtMe(amt,p.peer)}}else r.dmgSeen=dv; // ff off: the counter still advances so nothing bursts when it is turned back on
      const km=num(r.k[myPeer]);if(r.kMe===null)r.kMe=km;else if(km>r.kMe){r.kMe=km;feed(`You wasted ${r.name}`);me.cash+=50;if(time-(killXpT[p.peer]||-99)>60){killXpT[p.peer]=time;gainXP(50,'Takedown')}}
    }
    if(s.fl!==r.fl){r.fl=s.fl;r.flareT=time;for(let i=0;i<14;i++){const a=rand()*TAU,sp=60+rand()*140;parts.push({x:r.x,y:r.y,z0:(r.inCar?r.cz||0:r.z||0)+6,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:2.4,max:2.4,col:'#ffd27a',k:'flare',sz:3})}}
    // heist progress from a peer: seed must be a positive integer, bits and drill are clamped
    r.hs=Array.isArray(s.hs)&&s.hs.length===4&&s.hs.every(Number.isFinite)&&Number.isInteger(s.hs[0])&&s.hs[0]>0
      ?[s.hs[0],clamp(Math.floor(s.hs[1]),0,15),clamp(num(s.hs[2]),0,100),s.hs[3]?1:0]:null;
    r.sb=Array.isArray(s.sb)?s.sb.slice(0,5).filter(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite)):[];
    // remote explosions are visual only, rate limited, and clamped into the map, so a peer cannot blast the world apart
    if(Array.isArray(s.ex)&&s.ex[0]!==r.ex&&time-(r.exT||-9)>.08){r.ex=s.ex[0];r.exT=time;
      for(let i=1;i+1<s.ex.length&&i<12;i+=2){const ex=num(s.ex[i],NaN),ey=num(s.ex[i+1],NaN);
        if(Number.isFinite(ex)&&Number.isFinite(ey))explode(clamp(ex,-300,W+700),clamp(ey,-700,W+1000),false,true)}}
    if(Array.isArray(s.s)&&s.s[0]!==r.shot){r.shot=s.s[0];r.shotT=time;if(Number.isFinite(s.s[1])&&Number.isFinite(s.s[2])&&Number.isFinite(s.s[3])){const w=WEAPONS[num(s.s[4])|0]||WEAPONS[0];fireZ=clamp(num(s.s[6],12),0,920);fireSlope=clamp(num(s.s[7]),-3,3);fireSpd=w.speed||0;fireLife=w.life||0;if(!w.throw)for(let i=0;i<w.pellets;i++)fire(s.s[1],s.s[2],s.s[3]+rr(-w.spread,w.spread),'remote',0,w.rocket,i>0,w.homing&&typeof s.s[5]==='string'?{peer:s.s[5].slice(0,40)}:null,w.id)}}
  }
  for(const k of[...remotes.keys()])if(!seen.has(k)){feed(`${remotes.get(k).name} left`);remotes.delete(k);pvWarn.delete(k)}
  hrFromHost();
  fireZ=12;fireSpd=0;fireLife=0;fireSlope=0;
  const f=1-Math.exp(-dt*12);
  for(const r of remotes.values()){if(Math.hypot(r.tx-r.x,r.ty-r.y)>300){r.x=r.tx;r.y=r.ty}else{r.x+=(r.tx-r.x)*f;r.y+=(r.ty-r.y)*f}r.a+=wrap(r.ta-r.a)*f}
}
// ---- chat: one presence field ch=[seq,kind,a,b]. kind 0 chat (a text), kind 1 ping (a,b world x,y), kind 2 quick chat (a phrase 0..7)
const CHATMAX=200,QUICK=['Follow me','Wait here','On my way','Need help','Watch out','Nice ride','Come find me','Over here'],QPING={6:1,7:1};
const chatLines=[],chatPings=[],mutedPeers=new Set();
let thisChat=null,chatSeq=0,chatSlowT=-9;
function sendChat(v){
  v=txt(v,120);if(!v)return false;
  if(time-chatSlowT<1.2){feed('Slow down');return false}
  chatSlowT=time;thisChat=[(chatSeq=(chatSeq+1)%1e6),0,v];chatSay(myName,myColor,v);pubT=1;return true;
}
function quickChat(i){
  i=Math.floor(num(i,-1));if(!(i>=0&&i<8))return false;
  const p=QUICK[i];
  if(QPING[i]){thisChat=[(chatSeq=(chatSeq+1)%1e6),1,Math.round(me.x),Math.round(me.y)];chatSay(myName,myColor,p);chatPing(me.x,me.y,myColor);chatBlip()}
  else{thisChat=[(chatSeq=(chatSeq+1)%1e6),2,i];chatSay(myName,myColor,p)}
  pubT=1;return true;
}
function chatGot(r,kind,cs){
  if(kind===0){const v=txt(cs[2],120);if(v)chatSay(r.name,r.color,v)}
  else if(kind===1){const x=num(cs[2],NaN),y=num(cs[3],NaN);if(Number.isFinite(x)&&Number.isFinite(y)){chatSay(r.name,r.color,'pinged');chatPing(clamp(x,-MO,W+400),clamp(y,-MO,W+400),r.color);chatBlip()}}
  else if(kind===2){const i=Math.floor(num(cs[2],-1));if(i>=0&&i<8){chatSay(r.name,r.color,QUICK[i]);r.chatLine=QUICK[i];r.chatT=time+4}}
}
function mutePeer(id){if(mutedPeers.has(id))mutedPeers.delete(id);else mutedPeers.add(id);const r=remotes.get(id);feed((mutedPeers.has(id)?'Muting ':'Unmuting ')+(r?r.name:'a player'));if(phoneOpen&&phApp==='players')phPaint(apps.players);return mutedPeers.has(id)}
if(DBG)Object.defineProperties(DBG,{chatOut:{get:()=>thisChat},chatLines:{get:()=>chatLines},sendChat:{get:()=>sendChat},quickChat:{get:()=>quickChat},mutePeer:{get:()=>mutePeer}});
let pubT=0,pruneT=0,lastRv=null,revSeq=0;
function publish(dt){
  if(!room||state==='menu')return;
  pubT+=dt;pruneT+=dt;
  if(pruneT>3){pruneT=0;for(const m of[dmgOut,killedBy])for(const k of Object.keys(m))if(!remotes.has(k))delete m[k]}
  if(pubT<.066)return;pubT=0;
  const c=me.car,x=c?c.x:A.x,y=c?c.y:A.y,a=c?c.a:me.a; // indoors you appear at the door, not at interior coordinates
  room.presence({lk:lookCode(look3),ar:[arc.hi[0],arc.hi[1]],n:myName,c:myColor,x:Math.round(x),y:Math.round(y),a:Math.round(a*100)/100,v:me.jet?3:me.heli?2:c?1:0,fl:flareSeq,hs:heist.on?[heist.seed,heist.bits,Math.round(heist.drill),heist.drilling?1:0]:null,cc:c?c.color:myColor,ng:c&&c.mods&&c.mods.neon||null,ct:c?c.type:'sedan',h:Math.round(clamp(me.hp,0,100)),z:Math.round(me.car?0:me.z||0),cz:Math.round(me.car?me.car.z||0:0),dd:state==='dead'?1:0,dn:me.downed?1:0,pm:pitState&&!pitState.done?pitState.m:'',d:dmgOut,k:killedBy,ch:thisChat,rv:lastRv,s:lastShot,sb:stickies.map(b=>[Math.round(b.x),Math.round(b.y),Math.round(b.z)]),ex:lastEx,cw:crewPub(),seat:tSit.j>=0?tSit.j+'|'+tSit.bet+'|'+tSit.act+'|'+tSit.seq:null,tb:tHostMe()&&tRound?tbPub():null,w:Math.ceil(heat),lv,rk:rkMine(),hr:amHost()?[hrVer,RULES.cops,RULES.traffic,RULES.ff,RULES.grav]:null,pv:PV}).catch(()=>{});
}
function killsOf(peer){let k=0;for(const r of remotes.values())k+=num(r.k[peer]);if(peer!==myPeer)k+=num(killedBy[peer]);return k}
if(DBG)Object.defineProperties(DBG,{pv:{get:()=>PV}});
if(DBG)Object.defineProperties(DBG,{room:{get:()=>roomName},roomFrom:{get:()=>roomFrom}});
if(DBG)Object.defineProperties(DBG,{rules:{get:()=>RULES},setRule:{get:()=>setRule},amHost:{get:()=>amHost},spawnCaps:{get:()=>spawnCaps},gravity:{get:()=>carGravity}});

