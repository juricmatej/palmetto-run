// ---------- ui ----------
function feed(t){const d=document.createElement('div');d.textContent=t;$('feed').appendChild(d);setTimeout(()=>d.remove(),5000);while($('feed').children.length>5)$('feed').firstChild.remove();phLogAdd(t)}
// ---- chat: HUD lines, the one-line input above the HUD and the quick chat wheel
const chatEl=$('chat'),chatBar=$('chatBar'),chatIn=$('chatIn'),hudChat=[],qsegs=[];
let chatOpen=false,quickOpen=false,quickSel=0;
function chatSay(n,c,v){
  chatLines.unshift({n,c,tx:v,tm:clk()});if(chatLines.length>CHATMAX)chatLines.length=CHATMAX;
  const d=document.createElement('div'),b=document.createElement('b');b.textContent=n;b.style.color=c;d.append(b,document.createTextNode(' '+v));
  chatEl.appendChild(d);hudChat.push({d,t:time+8});
  while(hudChat.length>4)hudChat.shift().d.remove();
}
function chatStep(){
  if(chatOpen&&state!=='play')closeChat();
  if(quickOpen&&state!=='play')closeQuick();
  for(let i=hudChat.length-1;i>=0;i--)if(time>=hudChat[i].t){hudChat[i].d.remove();hudChat.splice(i,1)}
}
function chatBlip(){tone('sine',960,.09,.16);tone('sine',1420,.07,.1,AC?AC.currentTime+.07:0)}
function chatPing(x,y,c){chatPings.push({x,y,c,t:time});if(chatPings.length>4)chatPings.shift()}
function openChat(){
  if(chatOpen||state!=='play'||me.downed||phoneOpen||wheelOpen||quickOpen)return;
  chatOpen=true;for(const k in keys)keys[k]=false;mouse.down=false;touchFire=false;
  try{document.exitPointerLock&&document.exitPointerLock()}catch(_){}
  chatBar.hidden=false;chatIn.value='';chatIn.focus();
}
function closeChat(){
  if(!chatOpen)return;chatOpen=false;chatBar.hidden=true;if(document.activeElement===chatIn)chatIn.blur();
  cv.focus&&cv.focus();lockMouse();
}
chatIn.addEventListener('keydown',e=>{
  e.stopPropagation();
  if(e.code==='Escape'||e.key==='Escape'){e.preventDefault();if(!e.repeat)closeChat();return}
  if(e.code==='Enter'||e.key==='Enter'){e.preventDefault();if(e.repeat)return;const v=chatIn.value;closeChat();sendChat(v);return}
});
chatIn.addEventListener('blur',()=>{if(chatOpen)closeChat()});
function paintQuick(){for(const b of qsegs)b.classList.toggle('sel',+b.dataset.i===quickSel)}
function openQuick(){
  if(quickOpen||state!=='play'||phoneOpen||wheelOpen||chatOpen)return;
  quickOpen=true;quickSel=0;mouse.down=false;
  try{document.exitPointerLock&&document.exitPointerLock()}catch(_){}
  $('qwheel').hidden=false;paintQuick();
}
function closeQuick(){if(!quickOpen)return;quickOpen=false;$('qwheel').hidden=true;cv.focus&&cv.focus();lockMouse()}
function quickKey(e){
  const c=e.code;
  if(c==='Escape'||e.key==='Escape'){e.preventDefault();closeQuick();return}
  if(c==='Enter'||e.key==='Enter'){e.preventDefault();if(!e.repeat){const i=quickSel;closeQuick();quickChat(i)}return}
  const d=c==='ArrowLeft'||c==='ArrowUp'?-1:c==='ArrowRight'||c==='ArrowDown'?1:0;
  if(d){e.preventDefault();if(!e.repeat){quickSel=(quickSel+d+8)%8;paintQuick()}return}
  if(codeToAction(c)==='quickChat'&&!e.repeat)closeQuick();
}
{const w=$('qwheelIn');QUICK.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.className='qseg';b.dataset.i=i;b.textContent=p;
  const a=-Math.PI/2+i*TAU/8;b.style.left=(50+Math.cos(a)*36)+'%';b.style.top=(50+Math.sin(a)*36)+'%';
  b.addEventListener('pointerenter',()=>{quickSel=i;paintQuick()});b.addEventListener('click',()=>{closeQuick();quickChat(i)});w.appendChild(b);qsegs.push(b)})}
$('qwheel').addEventListener('pointerdown',e=>{if(e.target.id==='qwheel')closeQuick()});
let bigT=0;
function showBig(t,col,s,dur){const b=$('big');b.hidden=false;b.querySelector('.t').textContent=t;b.querySelector('.t').style.color=col;b.querySelector('.t').style.textShadow=`0 0 24px ${col}`;b.querySelector('.s').textContent=s||'';bigT=dur||0}
function hideBig(){$('big').hidden=true;bigT=0}
let uiT=0,saveT=0;
function ui(dt){phoneStep(dt);chatStep();
  if(bigT>0){bigT-=dt;if(bigT<=0)hideBig()}
  uiT+=dt;if(uiT<.1)return;uiT=0;
  $('cash').textContent='$'+me.cash.toLocaleString('en-US');
  lvlBar();
  const st=Math.ceil(heat-.001);$('stars').innerHTML='<b>'+'★'.repeat(st)+'</b>'+'★'.repeat(5-st);
  $('stars').style.opacity=heat>0&&unseenT>4&&Math.floor(time/.3)%2?.3:1;
  $('hp').style.width=clamp(me.hp,0,100)+'%';$('hp').style.background=me.hp<35?'var(--danger)':'var(--cyan)';
  $('stamBar').hidden=stam>=1;$('stam').style.width=stam*100+'%';
  {const w=WEAPONS[WI[weap]],el=$('weapon');el.firstChild.nodeValue=me.jet?'Jet missiles':me.heli?'Heli rockets':w.name;el.querySelector('span').textContent=me.jet||me.heli||w.id==='pistol'?'\u221e':String(ammo[w.id]||0)}
  {const nb=$('netb'),on=netState==='online',cls=on?'on':netState==='solo'?'off':'',t=on?`\u25cf Online \u00b7 ${remotes.size+1} in city${roomTag}`:netState==='solo'?'Solo \u00b7 '+(netWhy||'not connected'):'Connecting',cr=state==='play'&&customRules(),k=t+'|'+(cr?1:0);
    if(nb.dataset.k!==k){nb.dataset.k=k;nb.replaceChildren(t);if(cr)nb.append(document.createElement('br'),'\u00b7 custom rules')}if(nb.className!==cls)nb.className=cls}
  if(state==='shop')$('shopCash').textContent='$'+me.cash.toLocaleString('en-US');
  if((saveT+=.1)>3){saveT=0;saveArsenal()}
  {const lk=$('lock');lk.hidden=!lockTarget;if(lockTarget)lk.textContent='Locked: '+lockTarget.name;let inc=false;if(myPeer&&state==='play')for(const b of bullets)if(b.owner==='remote'&&b.home&&b.home.peer===myPeer){inc=true;break}$('warn').hidden=!inc}
  {const dk=$('drunk');dk.hidden=drunk<=0;if(drunk>0)dk.textContent='Drunk '+'●'.repeat(Math.max(1,Math.ceil(drunk/12)));cv.style.filter=((drunk>3?`blur(${Math.min(2.2,drunk/20).toFixed(2)}px) saturate(${(1+Math.min(.8,drunk/40)).toFixed(2)})`:'')+(drugState.k==='speed'?' contrast(1.2) saturate(1.6) brightness(1.08)':'')).trim()}
  drugChip();if(isTouch)$('bNose').hidden=!DK.some(x=>drugs[x]);
  if(isTouch){$('bBoom').hidden=!stickies.length;$('bAim').hidden=!(weap==='sniper'&&!me.car)}
  // downed overlay and the revive ring (both read state the combat and movement sections keep)
  {const dn=$('down');if(me.downed&&state==='play'){dn.hidden=false;$('downTxt').textContent='Bleeding out · '+Math.ceil(Math.max(0,me.downT))+'s';$('downFill').style.width=clamp(me.downT/30*100,0,100)+'%'}else if(!dn.hidden)dn.hidden=true}
  {const on=state==='play'&&!me.downed&&!!revNow&&!revDone&&(held('interact')||touchRev);$('rev').hidden=!on;
    if(on){$('revTxt').textContent='Reviving '+(revNow.r.name||'a driver');const p=Math.min(100,Math.floor(revProg/3*100));if(p!==revPct){revPct=p;$('revRing').style.setProperty('--p',p+'%')}}}
  if(isTouch){$('bNext').hidden=$('bRespawn').hidden=!(state==='dead'&&specR)}
  $('scope').hidden=!scoped;
  {const lm=$('lockMark');if(!qLock)lm.hidden=true;else{const v=new THREE.Vector3(qLock.x,(qLock.z||0)+14,qLock.y).project(camera);lm.hidden=v.z>1||Math.abs(v.x)>1||Math.abs(v.y)>1;lm.style.left=(v.x+1)*50+'%';lm.style.top=(1-v.y)*50+'%'}}
  {const bi=clamp(Math.floor(A.x/B),0,N-1),bj=clamp(Math.floor(A.y/B),0,N-1),dn=me.inside?null:(landmarkKey(A.x,A.y)||(A.y<0?'hills':A.y>W?'beach':district(bi,bj)));if(dn!==ui.area){ui.area=dn;const el=$('area');if(dn){el.replaceChildren();const sm=document.createElement('small');sm.textContent=AREA[dn][1];el.append(document.createTextNode(AREA[dn][0]),sm);el.style.opacity=1;clearTimeout(ui.areaT);ui.areaT=setTimeout(()=>el.style.opacity=0,3500)}}}
  $('carhp').textContent=me.jet?`Fighter jet ${Math.max(0,Math.round(me.jet.hp/BAL.jetHp*100))}% · ${Math.round(me.jet.speed*.6)} km/h · ${Math.round((me.jet.z-heliGround(me.jet.x,me.jet.y))/10)} m up`:me.heli?`Attack helicopter ${Math.max(0,Math.round(me.heli.hp/BAL.heliHp*100))}% · ${Math.round((me.heli.z-heliGround(me.heli.x,me.heli.y))/10)} m up`:me.car?(me.car.burn?'Car on fire! Get out (E)':`${ctOf(me.car).name} ${Math.max(0,Math.round(me.car.hp/ctOf(me.car).hp*100))}%`):'';
  const j=$('job');j.replaceChildren();
  if(mission){
    const jt=document.createElement('strong'),st=mission.def.steps[mission.i],col=mission.def.col;
    jt.textContent=mission.def.title;jt.style.color=col;j.style.borderLeftColor=col;
    const s1=document.createElement('span');s1.textContent=`Step ${mission.i+1} of ${mission.def.steps.length}`;
    const s2=document.createElement('span');s2.textContent=st.type==='talk'?`${st.who}: ${st.text}`:(st.text||'');
    j.append(jt,s1,s2);
    const secs=(st.type==='talk'||st.type==='follow'||st.type==='defend')?mission.tt:(st.time?mission.t:0);
    if(secs>0){const tm=document.createElement('div');tm.style.cssText='color:var(--gold);font-weight:700;margin-top:2px';tm.textContent=`${Math.max(0,Math.ceil(secs))}s left`;j.appendChild(tm)}
    if(mission.msg){const mm=document.createElement('div');mm.textContent=mission.msg;j.appendChild(mm)}
    const w=msWhere();if(w&&!me.inside){const px=me.car?me.car.x:me.x,py=me.car?me.car.y:me.y,dd=document.createElement('div');dd.style.cssText='color:var(--gold);font-weight:700;margin-top:2px';dd.textContent=Math.round(Math.hypot(w[0]-px,w[1]-py)/10)+' m away';j.appendChild(dd)}
  }else{const jt=document.createElement('strong'),jx=document.createElement('span');
    if(!job||job.phase==='wait'){jt.textContent='Missions';jx.textContent=job&&job.msg?job.msg:'Waiting for the next job...'}
    else{jt.textContent=job.title||'Mission';jx.textContent=job.text+(job.timed?` ${Math.max(0,Math.ceil(job.t))}s left.`:'')+(job.reward?` $${job.reward}`:'')}
    jt.style.color=job&&job.col||'';j.style.borderLeftColor=job&&job.col||'';j.append(jt,jx);
    if(job&&job.phase!=='wait'&&!job.noMarker&&!me.inside){const px=me.car?me.car.x:me.x,py=me.car?me.car.y:me.y,dd=document.createElement('div');dd.style.cssText='color:var(--gold);font-weight:700;margin-top:2px';dd.textContent=Math.round(Math.hypot(job.x-px,job.y-py)/10)+' m away';j.appendChild(dd)}}
  // players
  const pl=$('players');
  if(room){
    const rows=[{name:myName+' (you)',color:myColor,k:myPeer?killsOf(myPeer):0,lv}];
    for(const[peer,r]of remotes)rows.push({name:r.name,color:r.color,k:killsOf(peer),lv:r.lv});
    rows.sort((a,b)=>b.k-a.k);
    pl.hidden=false;pl.replaceChildren();
    const h=document.createElement('div');h.className='h';h.textContent=`In the city · ${rows.length}`;pl.appendChild(h);
    for(const r of rows){const d=document.createElement('div');d.className='row';const n=document.createElement('span');const dot=document.createElement('i');dot.className='dot';dot.style.background=r.color;n.appendChild(dot);n.appendChild(document.createTextNode(r.name+' Lv '+r.lv));const k=document.createElement('span');k.className='k';k.textContent=r.k+' KO';d.append(n,k);pl.appendChild(d)}
  }else pl.hidden=true;
  // hint
  const h=$('hint');let t='';
  if(state==='play'){if(me.car){const sp=Math.hypot(me.car.vx,me.car.vy);if(me.car.burn)t=isTouch?'Tap CAR to bail out':kb('interact')+' — bail out!';else if(sp<60)t=isTouch?'Tap CAR to get out':kb('interact')+' — get out'}
    else if(me.inside){const p=nearSpot();t=p?(isTouch?'Tap CAR: ':kb('interact')+': ')+p.label:''}
    else if(nearLadder()){t=(isTouch?'Tap CAR: ':kb('interact')+': ')+(nearLadder().up?'Climb the ladder':'Climb down')}
    else if(me.roof){t=''}
    else if(crewInv)t=(isTouch?'Tap CAR: ':kb('interact')+': ')+'join '+crewInv.name+"'s crew";
    else if(msNear()){const q=msNear(),sn=isTouch?'Tap CAR: ':kb('interact')+': ';
      t=!q.def?`${q.c.name} has no more work`:q.locked?`${q.def.title} needs level ${q.def.level}`:sn+(q.retry?'retry ':'start ')+`${q.def.title} · Lv ${q.def.level} · $${q.def.reward.toLocaleString('en-US')}`}
    else if(nearDealer()){t=(isTouch?'Tap CAR: ':kb('interact')+': ')+`Buy ${DRUGS[DK[drugSel]].name} ($${DRUGS[DK[drugSel]].price})`}
    else{const c=nearestCar();if(c)t=(isTouch?'Tap CAR — ':kb('interact')+' — ')+(c.kind==='traffic'?'jack this car':c.kind==='police'?'steal the cruiser':c.keyed?'take this car':'hotwire this car');else{const q=talkTarget();if(q)t=(isTouch?'Tap CAR: ':kb('interact')+': ')+(robbing(q)?'rob':'talk')}}}
  if(!t&&state==='play'&&!me.car&&!isTouch&&document.pointerLockElement!==cv)t='Click the game to aim with your mouse';
  if(lap)t=`Private dance... ${Math.ceil(lap.dur-lap.t)}s left (${isTouch?'CAR':'Esc'} to leave)`;
  else if(heist.drilling)t=`Drilling the vault... ${Math.floor(heist.drill)}%${crew().length?' (crew helping)':''}`;
  else if(rob)t=`${rob.dur>8?'Cracking the cage':'Emptying the register'}... ${Math.round(rob.t/rob.dur*100)}%. Stay close`;
  else if(state==='play'&&me.jet)t=me.jet.falling?'Going down!':me.jet.z-heliGround(me.jet.x,me.jet.y)>5?(isTouch?'Stick steers, UP / DOWN climb or dive, FIRE for missiles':'Mouse steers, '+kb('up')+'/'+kb('down')+' throttle, '+kb('shoot')+' climb, '+kb('sprint')+' dive, click missiles, '+kb('flares')+' flares'):me.jet.speed<40?(isTouch?'Push the stick up to taxi. Tap CAR to get out':kb('up')+' to throttle up, then hold '+kb('shoot')+' to take off. '+kb('interact')+' to get out'):'Keep speeding up, then hold '+kb('shoot')+' to take off';
  else if(state==='play'&&me.heli)t=me.heli.falling?'Going down!':(me.heli.z-heliGround(me.heli.x,me.heli.y)>14?(isTouch?'UP / DOWN to fly, FIRE for rockets':(flareCd>0?kb('shoot')+' up, '+kb('sprint')+' down, click for rockets (flares reloading)':kb('shoot')+' up, '+kb('sprint')+' down, click for rockets, '+kb('flares')+' flares')):(isTouch?'Tap CAR: get out':kb('interact')+': get out, or '+kb('shoot')+' to take off'));
  else if(state==='play'&&!me.car&&!me.inside&&heli&&!heli.dead&&!heli.falling&&Math.hypot(heli.x-me.x,heli.y-me.y)<50)t=(isTouch?'Tap CAR: ':kb('interact')+': ')+'Fly the attack helicopter';
  else if(state==='play'&&!me.car&&!me.heli&&!me.jet&&!me.inside&&nearJet())t=(isTouch?'Tap CAR: ':kb('interact')+': ')+'Fly the fighter jet';
  if(isTouch){$('bUp').hidden=$('bDn').hidden=$('bFlare').hidden=!(me.heli||me.jet)}
  if(!t&&stickies.length&&state==='play')t=(isTouch?'BOOM':kb('detonate'))+`: detonate ${stickies.length} sticky bomb${stickies.length>1?'s':''}`;
  if(state==='play'&&me.downed)t=isTouch?'':kb('chat')+' to give up';
  else if(state==='play'&&revNow)t=(isTouch?'Hold CAR: ':kb('interact')+': ')+'revive '+revNow.r.name;
  else if(state==='dead'&&specR)t=`Spectating ${specR.name} · ${kb('lockOn')} next · ${kb('chat')} respawn`;
  h.hidden=!t;h.textContent=t;
  // net text on menu
  if(state==='menu'){$('net').textContent=netState==='online'?`Live: ${Math.max(1,remotes.size+1)} in the city. Share this page's link so friends can join.`:netState==='solo'?(window.claude?'Solo mode: you are not connected. Friends need a Claude account, must be signed in, and must be invited to this page by email.':'Solo mode: the multiplayer server is not reachable.'):'Connecting to the city…'}
}

