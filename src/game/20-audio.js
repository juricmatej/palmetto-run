// ---------- audio ----------
let AC=null;
function audioInit(){try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume()}catch(e){AC=null}}
function noise(dur,freq,vol){if(!AC||muted||vol<.01)return;try{const n=Math.floor(AC.sampleRate*dur),buf=AC.createBuffer(1,n,AC.sampleRate),d=buf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(rand()*2-1)*Math.pow(1-i/n,3);
  const s=AC.createBufferSource();s.buffer=buf;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=freq;const g=AC.createGain();g.gain.value=vol;s.connect(f);f.connect(g);g.connect(SND.master||AC.destination);s.start()}catch(e){}}
const vol=(x,y)=>clamp(1-Math.hypot(x-me.x,y-me.y)/900,0,1);
// [pitch factor, cylinders, redline rpm, gear top speeds]
const ENG={sedan:[1,4,6500,[0,50,100,160,225,300,360]],taxi:[1,4,6200,[0,50,100,160,225,300,360]],sports:[1.25,6,8400,[0,62,125,190,262,340,460]],muscle:[.7,8,6200,[0,58,120,185,260,340,420]],
  suv:[.85,6,5800,[0,42,88,145,205,280,320]],van:[.8,4,5200,[0,36,78,128,185,250,280]],pickup:[.78,8,5600,[0,42,88,145,205,280,330]],police:[.9,8,6800,[0,52,108,170,235,310,360]],armored:[.6,8,4800,[0,32,72,122,180,240,300]]};
const SND={ready:false};
function sndInit(){if(SND.ready||!AC)return;try{
  const m=AC.createGain();SND.master=m;
  // master chain: compressor, then a soft clip that never exceeds 0.95. The analyser taps the master before both.
  const comp=AC.createDynamicsCompressor();comp.threshold.value=-10;comp.knee.value=6;comp.ratio.value=12;comp.attack.value=.003;comp.release.value=.25;
  const clip=AC.createWaveShaper(),cv=new Float32Array(1025);for(let i=0;i<cv.length;i++){const x=i/512-1,a=Math.abs(x);cv[i]=Math.sign(x)*(a<.7?a:.7+.25*Math.tanh((a-.7)/.25))}clip.curve=cv;
  m.connect(comp);comp.connect(clip);clip.connect(AC.destination);
  SND.an=AC.createAnalyser();SND.an.fftSize=32768;m.connect(SND.an);
  // room: a generated 1.2 s impulse with exponential decay. SND.room feeds the master dry and a send into the reverb.
  const rn=Math.floor(AC.sampleRate*1.2),rb=AC.createBuffer(2,rn,AC.sampleRate);for(let c=0;c<2;c++){const d=rb.getChannelData(c);for(let i=0;i<rn;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(AC.sampleRate*.3))}
  const verb=AC.createConvolver();verb.buffer=rb;verb.connect(m);
  SND.room=AC.createGain();SND.room.connect(m);const send=AC.createGain();send.gain.value=.35;SND.room.connect(send);send.connect(verb);
  const nb=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const nsrc=()=>{const s=AC.createBufferSource();s.buffer=nb;s.loop=true;s.start();return s};
  const gain=(v,to)=>{const g=AC.createGain();g.gain.value=v;if(to)g.connect(to);return g};
  const filt=(type,f,q,to)=>{const b=AC.createBiquadFilter();b.type=type;b.frequency.value=f;if(q)b.Q.value=q;if(to)b.connect(to);return b};
  const osc=(type,f,to)=>{const o=AC.createOscillator();o.type=type;o.frequency.value=f;if(to)o.connect(to);o.start();return o};
  const hg=gain(0,m),hm=gain(.5,hg),lfo=osc('sine',12),lg=gain(.5);lfo.connect(lg);lg.connect(hm.gain);nsrc().connect(filt('lowpass',320,0,hm));
  const wg=gain(0,m);osc('sine',1150,wg);SND.heli={hg,lfo,wg};
  const sg=gain(0,m),so=osc('sawtooth',700,filt('lowpass',2200,0,sg));SND.siren={so,sg};
  const tgg=gain(0,m),to=osc('sawtooth',40,filt('lowpass',240,0,tgg));SND.traffic={to,tgg};
  nsrc().connect(filt('lowpass',180,0,gain(.015,m)));
  const be=gain(0,m),bw=gain(.025,be),bf=filt('lowpass',500,0,bw);nsrc().connect(bf);const wl=osc('sine',.12,gain(.025,bw.gain));wl.connect(gain(200,bf.frequency));SND.beach=be;
  const wn=gain(0,m);nsrc().connect(filt('bandpass',600,1,wn));SND.wind=wn;
  const sc=gain(0,m);osc('sawtooth',900,filt('bandpass',900,2,sc));SND.screech=sc;
  // engine: two detuned sawtooths through a lowpass, a tremolo at the firing rate, and intake noise
  const eg=gain(0,m),ef=filt('lowpass',600,1,eg),e1=osc('sawtooth',60,ef),e2=osc('sawtooth',61,ef),dp=gain(0,eg.gain),pl=osc('sine',30,dp);
  const ig=gain(0,m),intake=filt('bandpass',900,1.5,ig);nsrc().connect(intake);
  SND.engine={eg,ef,e1,e2,dp,pl,ig,intake};
  SND.rg=gain(.05,m);
  SND.ready=true}catch(e){SND.ready=false}}
function soundStep(dt){if(!AC)return;sndInit();if(!SND.ready)return;const t=AC.currentTime,S=(p,v,k)=>p.setTargetAtTime(v,t,k||.05);
  S(SND.master.gain,muted||state==='menu'?0:1,.1);
  // helicopter rotor
  {let hv=0,rate=12;if(heli&&!heli.dead){const d=me.heli===heli?0:Math.hypot(heli.x-A.x,heli.y-A.y);hv=heli.spin/28*clamp(1-d/1100,0,1);rate=8+heli.spin/28*6}
   S(SND.heli.hg.gain,hv*.32,.15);S(SND.heli.lfo.frequency,rate,.2);S(SND.heli.wg.gain,hv*.012,.2)}
  // sirens
  {let best=1e9;if(!me.inside)for(const v of cars)if(v.kind==='police'&&heat>0){const d=Math.hypot(v.x-me.x,v.y-me.y);if(d<best)best=d}
   S(SND.siren.sg.gain,best<900?.05*(1-best/900):0,.1);S(SND.siren.so.frequency,Math.floor(time*1.6)%2?980:720,.03);S(SND.rg.gain,best<900?.02:.05,.2)}
  const shift=held('sprint'),onFoot=state==='play'&&!me.car&&!me.heli&&!me.jet;
  // tyres: sliding sideways, or handbrake at speed
  {const c=me.car,lat=c?Math.abs(-Math.sin(c.a)*c.vx+Math.cos(c.a)*c.vy):0;
   S(SND.screech.gain,c&&state==='play'&&(lat>120||shift&&Math.hypot(c.vx,c.vy)>150)?.05:0,.05)}
  // engine: the player's car. Speed picks the gear and rpm; rpm x cylinders / 2 is the firing rate that sets pitch and tremolo
  {const c=me.car,E=SND.engine,on=c&&state==='play'&&!me.inside?1:0,T=ENG[c?c.type:'sedan']||ENG.sedan,sp=c?Math.hypot(c.vx,c.vy):0,G=T[3];
   let k=1;while(k<G.length-1&&sp>G[k])k++;
   const fr=clamp((sp-G[k-1])/(G[k]-G[k-1]),0,1),rpm=900+(T[2]-900)*(sp>3?.25+.75*fr:0),F=T[0]*rpm/60*T[1]/2,lv=on*(.035+.05*fr);
   S(E.e1.frequency,2*F,.05);S(E.e2.frequency,2*F*1.013,.05);S(E.pl.frequency,F,.05);S(E.ef.frequency,400+1200*fr,.1);
   S(E.eg.gain,lv,.08);S(E.dp.gain,lv*.6,.08);S(E.ig.gain,on*(.01+.03*fr),.1);S(E.intake.frequency,300+rpm*.4,.1)}
  // footsteps
  if(onFoot&&Math.hypot(me.vx,me.vy)>40){stepT-=dt;if(stepT<=0){stepT=shift?.25:.34;const dn=district(clamp(Math.floor(me.x/B),0,N-1),clamp(Math.floor(me.y/B),0,N-1));footSnd(dn==='beach'||dn==='park'?400:700)}}else stepT=0;
  // ambience: beach waves, wind, club bass
  const bd=Math.max(0,(N-1)*B-me.y),dr=doorAt(3,3),kd=Math.hypot(dr.x-me.x,dr.y-me.y);
  S(SND.beach.gain,clamp(1-bd/600,0,1),.3);
  S(SND.wind.gain,state==='play'&&(me.roof||me.heli||me.jet||(me.z||0)>8)?.03:0,.3);
  clubT-=dt;if(clubT<=0){clubT+=60/118;const kv=me.inside===club?.12:kd<450?.06*(1-kd/450):0;if(kv)tone('sine',55,.15,kv)}
  // car radio: look ahead 0.2 s and schedule notes
  if(!me.car){if(radOsc.size)radStop()}
  else if(radio&&state==='play'){if(radNext<t)radNext=t+.05;while(radNext<t+.2){radSched(radN++,radNext);radNext+=60/RBPM[radio]/4}}
}

// one oscillator note, held then faded out over dur
function tone(type,f,dur,v,at,to,f2){if(!AC||muted)return;try{const t=at||AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);g.gain.setValueAtTime(v,t);g.gain.linearRampToValueAtTime(0,t+dur);o.connect(g);g.connect(to||SND.master);o.start(t);o.stop(t+dur);return o}catch(e){}}
// noise burst through one filter; f2 sweeps the filter to that frequency over dur
function sfx(dur,type,f,v,at,f2,to){if(!AC||muted||v<.01)return;try{const t=at||AC.currentTime,n=Math.floor(AC.sampleRate*dur),buf=AC.createBuffer(1,n,AC.sampleRate),d=buf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(rand()*2-1)*Math.pow(1-i/n,3);
  const s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();s.buffer=buf;fl.type=type;fl.frequency.setValueAtTime(f,t);if(f2)fl.frequency.linearRampToValueAtTime(f2,t+dur);g.gain.value=v;s.connect(fl);fl.connect(g);g.connect(to||SND.master);s.start(t);return s}catch(e){}}
let stepT=0,clubT=0,thudT=0;
// footstep: a short click, then a low body. The pitch moves a little each step so repeats differ
function footSnd(f){const r=rr(.85,1.15);sfx(.012,'highpass',2000*r,.05);sfx(.05,'lowpass',f*r,.07)}
// per weapon: tr = transient [dur, highpass Hz, amp], body = noise [dur, lowpass Hz, amp, sweep-to Hz], th = sine thump [start Hz, end Hz, dur, amp]
const GUN={pistol:{tr:[.01,3000,.2],body:[.09,1800,.3],th:[170,55,.1,.2]},smg:{tr:[.008,3600,.16],body:[.065,2200,.26],th:[210,70,.07,.14]},
  shotgun:{tr:[.015,2000,.25],body:[.16,900,.32],th:[110,35,.22,.3]},mg:{tr:[.008,3200,.14],body:[.06,1600,.26],th:[190,80,.06,.1]},
  sniper:{tr:[.012,4000,.25],body:[.16,2500,.3,700],th:[90,30,.3,.3]},rpg:{tr:[.02,1500,.3],body:[.5,700,.35,2000],th:[60,30,.4,.25]},
  homing:{tr:[.02,1800,.25],body:[.45,900,.3,2400],th:[70,35,.35,.25]},sticky:{tr:[.01,3000,.12],body:[.06,2000,.12],th:[120,60,.05,.08]}};
// shot sound for a WEAPONS id. fire() calls it for the player, remote players and NPCs, throwSticky() for bombs
function gunSnd(id,x,y){if(!AC||muted)return;const v=vol(x,y),G=GUN[id]||GUN.pistol,r=rr(.95,1.05),to=SND.room;
  sfx(G.tr[0],'highpass',G.tr[1]*r,G.tr[2]*v,0,0,to);
  sfx(G.body[0],'lowpass',G.body[1]*r,G.body[2]*v,0,G.body[3]||0,to);
  tone('sine',G.th[0]*r,G.th[2],G.th[3]*v,0,to,G.th[1]);
}
// car impact; at most one per 0.15 s: a click, a low body and a falling sine thump, into the room send
function thud(s){if(time<thudT)return;thudT=time+.15;const v=clamp(s/400,0,.4),to=SND.room;sfx(.012,'highpass',rr(2000,3000),v*.5,0,0,to);sfx(.2,'lowpass',rr(250,350),v*.8,0,0,to);tone('sine',rr(90,130),.2,v*.6,0,to,40)}
function hornSnd(){const h=MODS_HORN.find(h=>h[0]===(me.car&&me.car.mods&&me.car.mods.horn))||MODS_HORN[0];tone('square',h[0],.4,.08);tone('square',h[1],.4,.08)}
const mf=m=>440*Math.pow(2,(m-69)/12);
const JINGLE={pass:[[60,.08],[64,.08],[67,.08],[72,.08]],fail:[[64,.15],[60,.2]],buy:[[84,.05],[88,.05]],level:[[60,.15],[64,.15],[67,.15],[72,.15],[76,.15],[79,.3]]};
function jingle(k){if(!AC||muted)return;let t=AC.currentTime;for(const[m,d]of JINGLE[k]){tone('triangle',mf(m),d,.2,t);t+=d}}
// car radio. Station 0 is off. Chords are Am F C G as MIDI notes.
const RADIO=['Off','Neon FM','Palm Wave','Low Palms Radio'],RBPM=[0,100,70,90],CHORDS=[[57,60,64],[53,57,60],[60,64,67],[55,59,62]];
let radio=0,radN=0,radNext=0;const radOsc=new Set();
function rtrack(o){if(o){radOsc.add(o);o.onended=()=>radOsc.delete(o)}}
function radNote(type,m,at,dur,v){rtrack(tone(type,mf(m),dur,v,at,SND.rg))}
function radSched(n,t){const c=CHORDS[(n>>4)&3];
  if(radio===1){if(n%2===0)radNote('sawtooth',c[0]-12,t,.12,.5);if(n%8===0)for(const m of c)radNote('square',m,t,.1,.12)}
  else if(radio===2){if(n%16===0)for(const m of c)radNote('triangle',m,t,1.5,.25)}
  else{if(n%8===0)rtrack(tone('sine',120,.2,.9,t,SND.rg,50));if(n%8===4)rtrack(sfx(.15,'bandpass',1800,.6,t,0,SND.rg));if(n%4===2)radNote('sawtooth',c[0]-24,t,.1,.4)}}
function radStop(){for(const o of radOsc)try{o.stop()}catch(e){}radOsc.clear();radNext=0}
function cycleRadio(){radio=(radio+1)%RADIO.length;radStop();feed('Radio: '+RADIO[radio])}
if(DBG)Object.defineProperties(DBG,{audio:{get:()=>AC&&AC.state},radio:{get:()=>radio},
  // peak of the master over the last 0.5 s, in dBFS, read before the limiter
  sndPeak:{get:()=>{if(!SND.an)return null;const b=new Float32Array(SND.an.fftSize),n=Math.round(AC.sampleRate*.5);SND.an.getFloatTimeDomainData(b);let p=0;for(let i=b.length-n;i<b.length;i++)p=Math.max(p,Math.abs(b[i]));return p?+(20*Math.log10(p)).toFixed(1):-120}}});

// ---------- combat ----------
function fire(x,y,a,owner,dmg,rocket,quiet,home,snd){const sp=home?470:rocket?(fireSpd||560):(fireSpd||950);bullets.push({x,y,px:x,py:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:home?4.5:rocket?(fireLife||1.6):(fireLife||.7),z:fireZ+(owner==='me'||owner==='remote'?0:groundZ(x,y)),vz:fireSlope*sp,owner,dmg,rocket:!!rocket,home:home||null});
  if(quiet)return;
  parts.push({x:x+Math.cos(a)*6,y:y+Math.sin(a)*6,vx:0,vy:0,life:.06,max:.06,col:'#ffe9a8',k:'flash',sz:rocket?30:16});if(snd)gunSnd(snd,x,y);else gunSnd(rocket?'rpg':'pistol',x,y);scare(x,y,320);}
function segDist(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;let t=l?((px-ax)*dx+(py-ay)*dy)/l:0;t=clamp(t,0,1);return Math.hypot(px-ax-dx*t,py-ay-dy*t)}
function myShoot(){
  if(me.fireCd>0||state!=='play'||wheelOpen||phoneOpen||quickOpen||chatOpen||me.downed)return;
  if(me.heli){heliFire();return}
  if(me.jet){jetFire();return}
  let w=WEAPONS[WI[weap]];
  if(w.id!=='pistol'&&!(ammo[w.id]>0)){weap='pistol';w=WEAPONS[0];feed('Out of ammo. Back to the pistol')}
  me.fireCd=w.cd*(me.car?1.15:1);
  if(w.id!=='pistol')ammo[w.id]--;lastFireT=time;if(me.inside&&me.inside.bank)triggerAlarm('Shots fired!');
  if(w.throw){if(!throwSticky())ammo[w.id]++;return}
  fireZ=(me.car?me.car.z||0:me.z||0)+12;fireSpd=w.speed||0;fireLife=w.life||0;fireSlope=0;
  if(!me.car&&aimPt){const dx=aimPt[0]-me.x,dy=aimPt[1]-me.y,dh=Math.hypot(dx,dy);if(dh>4){me.a=Math.atan2(dy,dx);fireSlope=clamp((aimPt[2]-fireZ)/dh,-3,3)}}
  const c=me.car,a=drugAim(c?c.a:(aimPt?me.a:(me.a=look.yaw))),x=c?c.x+Math.cos(a)*26:me.x+Math.cos(a)*12,y=c?c.y+Math.sin(a)*26:me.y+Math.sin(a)*12;
  for(let i=0;i<w.pellets;i++)fire(x,y,a+rr(-w.spread,w.spread)*drugMul('spread'),'me',w.dmg,w.rocket,i>0,w.homing&&lockTarget?lockTarget:null,w.id);
  shotSeq=(shotSeq+1)%1e6;lastShot=[shotSeq,Math.round(x),Math.round(y),Math.round(a*100)/100,WI[w.id],w.homing&&lockTarget&&lockTarget.peer?lockTarget.peer:null,Math.round(fireZ),Math.round(fireSlope*100)/100];
  fireZ=12;fireSpd=0;fireLife=0;fireSlope=0;
  if(w.rocket)shake=Math.max(shake,5);
  if(time>heatShotT)for(const p of cars)if(p.kind==='police'&&Math.hypot(p.x-me.x,p.y-me.y)<450){addHeat(.08);heatShotT=time+2;break}
}
function addHeat(v){if(!RULES.cops)return;heat=clamp(heat+v*drugMul('heat'),0,5);coolT=0} // cops off: heat cannot rise
function explode(x,y,byMe,cosmetic,ez,k=1,sk){const gz=groundZ(x,y);ez=ez===undefined?gz:Math.max(0,ez);burstZ=ez;
  burst(x,y,40,'#ffb347',320,.7);burst(x,y,26,'#ff3ea5',220,.5);burst(x,y,18,'rgba(60,50,70,1)',90,2.2,'smoke');
  parts.push({x,y,z0:ez,vx:0,vy:0,life:.25,max:.25,col:'#fff1c2',k:'flash',sz:180});
  noise(1.1,380,.7*vol(x,y));shake=Math.max(shake,14*vol(x,y));
  if(!cosmetic){ // a remote player's explosion is a light show only: it never damages cars or people
    for(const c of cars){const d=Math.hypot(c.x-x,c.y-y);if(d<BAL.exp.veh[1]&&ez-gz<50){damageCar(c,fall(d,BAL.exp.veh)*k*(sk&&c===sk.car?BAL.exp.sticky:1),byMe);if(d>1&&dynamic(c)){c.vx+=(c.x-x)/d*260;c.vy+=(c.y-y)/d*260}}}
    for(const p of peds){const d=Math.hypot(p.x-x,p.y-y);if(d<BAL.exp.ped&&ez-gz<50)knockPed(p,(p.x-x)*4,(p.y-y)*4,byMe)}
  }
  for(const v of[heli,...jets]){if(!v||v.dead||cosmetic)continue;v.hp-=fall(Math.hypot(v.x-x,v.y-y,(v.z||0)-ez),BAL.exp.air)*k}
  const dm=Math.hypot(me.x-x,me.y-y);
  if(dm<BAL.exp.player[1]&&Math.abs((me.z||0)-ez)<45&&!me.heli&&!me.jet&&!cosmetic&&!(me.car&&me.car.type==='armored'))hurtMe(fall(dm,BAL.exp.player)*k*(byMe?BAL.exp.self:1)*(me.car?BAL.exp.occupant:1),null);
  if(byMe&&RULES.ff)for(const[peer,r]of remotes){const d=Math.hypot(r.x-x,r.y-y);if(d<BAL.exp.player[1]&&!r.dead&&Math.abs((r.inCar?(r.cz||0):(r.z||0))-ez)<50)dmgOut[peer]=(dmgOut[peer]||0)+Math.round(fall(d,BAL.exp.player)*k*(sk&&peer===sk.peer?BAL.exp.sticky:1))}
  scare(x,y,400);burstZ=0;
}
function hurtMe(amt,from){
  if(state!=='play'||me.inv>0||amt<=0)return;amt*=drugMul('hurt');
  if(me.downed){me.downT-=amt*palmMul()*1.5;me.lastHurt=time;if(from){me.lastHitBy=from;me.lastHitT=time}
    $('vig').style.boxShadow='inset 0 0 140px rgba(255,40,60,.55)';setTimeout(()=>$('vig').style.boxShadow='',180);
    if(me.downT<=0)bleedout();return}
  me.hp-=amt*palmMul();me.lastHurt=time;if(from){me.lastHitBy=from;me.lastHitT=time}
  $('vig').style.boxShadow='inset 0 0 140px rgba(255,40,60,.55)';setTimeout(()=>$('vig').style.boxShadow='',180);
  if(me.hp<=0)die('WASTED');
}
function die(word,fine,noDown){
  if(state!=='play')return;
  if(word==='WASTED'&&!noDown&&remoteNear(700)){goDown();return} // company: down instead of dead, no cash loss, the gold stays
  me.downed=false;me.downT=0;
  if(word==='WASTED'&&placesRevive())return;if(heist.carry){feed('You dropped the gold');heist.carry=0;heist.looted={};if(heist.on)feed('The vault gold is back in place')}
  if(mission)msDie(word);
  career.deaths++;state='dead';deadT=3.2;me.hp=0;if(word==='BUSTED')policeClear();
  if(me.lastHitBy&&time-me.lastHitT<5&&remotes.has(me.lastHitBy)){killedBy[me.lastHitBy]=(killedBy[me.lastHitBy]||0)+1;feed(`${remotes.get(me.lastHitBy).name} wasted you`)}
  me.climb=null;if(me.car){leaveCar(true)}if(me.jet)me.jet=null;if(me.heli){me.heli=null;me.z=groundZ(me.x,me.y)}
  const loss=Math.floor(me.cash*(fine||(word==='BUSTED'?.15:.1)));me.cash-=loss;
  showBig(word,word==='BUSTED'?'#4aa3ff':'#ff4b4b',loss?`-$${loss}`:'');
}
// downed: with a living player within 700 units a lethal hit leaves you on the street at 1 hp instead of
// dead. You crawl at 0.35 speed, cannot shoot, drive, use anything or open the phone, and bleed out in 30 s
// unless a living player revives you (see the movement and multiplayer sections).
function remoteNear(d){for(const r of remotes.values())if(!r.dead&&Math.hypot(r.x-me.x,r.y-me.y)<d)return true;return false}
function goDown(){
  if(me.downed)return false;
  me.downed=true;me.downT=30;me.hp=1;me.lastHurt=time;me.vx=me.vy=0;
  me.climb=null;if(me.car){leaveCar(true)}if(me.jet)me.jet=null;if(me.heli){me.heli=null;me.roof=null;me.z=groundZ(me.x,me.y)} // an overdose cannot happen mid air
  if(phoneOpen)phoneClose();if(chatOpen)closeChat();if(quickOpen)closeQuick();if(wheelOpen)closeWheel(false);
  feed('You are down. A friend can revive you, or give up');return true
}
function bleedout(){if(!me.downed)return;me.downed=false;me.downT=0;die('WASTED',null,true)}
function respawn(){for(const q of peds){q.calling=0;q.fight=0;q.armed=0}handsUp=false;me.inside=null;me.heli=null;me.jet=null;me.z=0;jvz=0;stam=1;stamOut=false;me.roof=null;me.climb=null;drunk=0;me.downed=false;me.downT=0;pitCancel();
  const[x,y]=job&&job.respawn||hospitalSpot();me.x=x;me.y=y;me.z=groundZ(x,y);me.vx=me.vy=0;me.hp=BAL.playerHp;me.inv=2.5;me.bustT=0;heat=0;state='play';hideBig();
  for(let i=cars.length-1;i>=0;i--)if(cars[i].kind==='police')cars.splice(i,1);
  if(msDeath){showBig('MISSION FAILED','#ff4b4b',msDeath,3.5);msDeath=null}
  policeClear();
}

// ---------- enter / exit ----------
function nearestCar(){let best=null,bd=48;for(const c of cars){if(c.kind==='dead'||c.burn)continue;
  if(Math.abs((c.z||0)-(me.z||0))>26)continue; // a car on a roof or on the rocks below is out of reach
  if(inBuilding(c.x,c.y))continue; // no reaching through a wall
  const d=Math.hypot(c.x-me.x,c.y-me.y);if(d<bd){bd=d;best=c}}return best}
function nearLadder(){if(me.car||me.inside||me.climb)return null;for(const b of ladders){const L=b.ladder;if(me.roof===b){if(Math.hypot(L.x-me.x,L.top-me.y)<20)return{b,up:false}}else if(!me.roof&&Math.hypot(L.x-me.x,L.base-me.y)<18)return{b,up:true}}return null}
function tryLadder(){const n=nearLadder();if(!n)return false;me.climb={b:n.b,up:n.up,t:0,dur:Math.max(.9,n.b.H/150)};me.vx=me.vy=0;return true}
function toggleCar(){
  if(lap){endLap();return}
  if(state!=='play'||me.downed||me.climb)return;
  if(crewAccept())return;
  {const q=msNear();if(q){if(!q.def)feed(q.c.name+' has no more work for you');else if(q.locked)feed(q.def.title+' needs level '+q.def.level);else startMission(q.def.id);return}}
  if(!me.car&&!me.heli&&!me.jet&&pitNear()&&(!pitState||pitState.done)){pitOpen();return}
  {const k=RACES.findIndex(r=>!me.car&&Math.hypot(r.board.x-me.x,r.board.y-me.y)<40);if(k>=0){raceStart(k);return}}
  if(me.inside){interact();return}
  if(me.heli){const h=me.heli,g=heliGround(h.x,h.y);if(h.z-g>14){feed('Land first. Hold Shift to descend');return}
    me.heli=null;const rb=g>2?roofAt(h.x,h.y):null;
    if(rb){me.roof=rb;me.x=clamp(h.x+30,rb.x+5,rb.x+rb.w-5);me.y=clamp(h.y,rb.y+5,rb.y+rb.h-5);me.z=rb.H+1.6}
    else{me.roof=null;me.x=h.x+Math.cos(h.a+1.57)*34;me.y=h.y+Math.sin(h.a+1.57)*34;me.z=groundZ(me.x,me.y);collide(me,me.x,me.y,8)}return}
  if(me.jet){const j=me.jet,g=heliGround(j.x,j.y);if(j.z-g>5||j.speed>40){feed('Land and come to a stop first');return}
    me.jet=null;me.x=j.x+Math.cos(j.a+1.57)*36;me.y=j.y+Math.sin(j.a+1.57)*36;me.z=groundZ(me.x,me.y);collide(me,me.x,me.y,8);return}
  {const j=me.car?null:nearJet();if(j&&!unlocked('jet'))feed(`Fighter jets need ${gateWhy('jet')}`);else if(j){me.jet=j;me.roof=null;me.climb=null;look.yaw=j.a;feed('Fighter jet: W throttle, mouse steers, Space climbs, Shift dives, click fires');return}}
  if(fuelNear()&&fuelState.u<1){fuelBuy();return}
  if(!me.car&&heli&&!heli.dead&&!heli.falling&&Math.hypot(heli.x-me.x,heli.y-me.y)<50&&Math.abs(heli.z-(me.z||0))<24){if(!unlocked('heli'))feed(`Attack helicopter needs ${gateWhy('heli')}`);else{me.heli=heli;me.roof=null;me.climb=null;return}}
  if(!me.car&&tryLadder())return;
  if(me.car){leaveCar(false);return}
  if(me.roof)return;
  if(propAct())return;
  if(nearDealer()){buyDrug();return}
  const c=nearestCar();if(!c){talkPed();return}
  if(c.kind==='parked'&&!c.keyed){miniOpen('hot',()=>{
    if(!cars.includes(c)||c.kind!=='parked'||c.burn){feed('That car is gone');return}
    c.keyed=1;c.kind='mine';me.car=c;me.roof=null;handsUp=false;feed(`Hotwired the ${ctOf(c).name}. Drive safe`)});return}
  if(c.kind==='traffic')crime(c.x,c.y,.3);
  if(c.kind==='traffic'){const p=spawnPed(c.x+Math.cos(c.a-1.57)*20,c.y+Math.sin(c.a-1.57)*20);p.flee=4;p.fx=c.x;p.fy=c.y;c.vx=Math.cos(c.a)*c.cur*.3;c.vy=Math.sin(c.a)*c.cur*.3;
    for(const q of cars)if(q.kind==='police'&&Math.hypot(q.x-me.x,q.y-me.y)<400){addHeat(.5);break}}
  if(c.kind==='police')addHeat(1);
  c.kind='mine';me.car=c;handsUp=false;
}
function leaveCar(force){
  const c=me.car;if(!c)return;
  const sp=Math.hypot(c.vx,c.vy);if(!force&&sp>120&&!c.burn)return; // a burning car always lets you bail out
  if(c.slot)propWrite(c);
  c.kind='parked';c.keyed=1;c.air=false;me.car=null;
  for(const s of[-1,1]){const x=c.x+Math.cos(c.a+s*1.57)*24,y=c.y+Math.sin(c.a+s*1.57)*24;if(!inBuilding(x,y)){me.x=x;me.y=y;break}}me.z=groundZ(me.x,me.y);
  me.vx=me.vy=0;
}

// ---------- gun shop ----------
function openShop(){try{document.exitPointerLock&&document.exitPointerLock()}catch(_){}mouse.down=false;state='shop';$('shop').hidden=false;renderShop();setTimeout(()=>$('shopClose').focus(),0)}
function closeShop(){if(state!=='shop')return;capAct=null;capMsg='';bjLeave();roLeave();tableK=1;state='play';$('shop').hidden=true;$('bj').hidden=true;document.querySelectorAll('.gm').forEach(e=>e.hidden=true);cv.focus&&cv.focus()}
function equip(id){if(owned[id]){weap=id;if(state==='shop')renderShop()}}
function cycleWeapon(){const list=WEAPONS.filter(w=>owned[w.id]);const i=list.findIndex(w=>w.id===weap);equip(list[(i+1)%list.length].id)}
function prevWeapon(){const list=WEAPONS.filter(w=>owned[w.id]);const i=list.findIndex(w=>w.id===weap);equip(list[(i-1+list.length)%list.length].id)}
function renderShop(){
  $('shopCash').textContent='$'+me.cash.toLocaleString('en-US');
  const L=$('shopList');L.replaceChildren();
  WEAPONS.forEach((w,i)=>{
    const row=document.createElement('div');row.className='gun'+(weap===w.id?' eq':'');
    const nm=document.createElement('div');nm.className='nm';nm.textContent=`${i+1} · ${w.name}`;
    const ds=document.createElement('div');ds.className='ds';
    ds.textContent=w.desc+(owned[w.id]&&w.id!=='pistol'?` Ammo: ${ammo[w.id]||0}.`:'');
    const acts=document.createElement('div');acts.className='acts';
    const btn=(label,cls,dis,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;if(cls)b.className=cls;b.disabled=dis;b.onclick=fn;acts.appendChild(b)};
    if(!owned[w.id]&&!unlocked(w.id))btn(`Unlocks at level ${UNLOCK[w.id]}`,'buy',true,null);
    else if(!owned[w.id])btn(`Buy $${w.price}`,'buy',me.cash<w.price,()=>{if(me.cash<w.price)return;me.cash-=w.price;owned[w.id]=true;ammo[w.id]=(ammo[w.id]||0)+w.ammoAmt;weap=w.id;jingle('buy');saveArsenal();renderShop()});
    else{
      btn(weap===w.id?'Equipped':'Equip','',weap===w.id,()=>equip(w.id));
      if(w.id!=='pistol')btn(`+${w.ammoAmt} ammo $${w.ammoPrice}`,'buy',me.cash<w.ammoPrice,()=>{if(me.cash<w.ammoPrice)return;me.cash-=w.ammoPrice;ammo[w.id]=(ammo[w.id]||0)+w.ammoAmt;jingle('buy');saveArsenal();renderShop()});
    }
    row.append(nm,acts,ds);L.appendChild(row);
  });
}
function saveArsenal(){try{localStorage.setItem('pr3d-arsenal',JSON.stringify({owned,ammo,weap,cash:me.cash,bonus10k:true,drugs,xp}));localStorage.setItem('pr3d-career',JSON.stringify(career))}catch(e){console.warn('Palmetto Run: could not save progress',e)}}
function loadArsenal(d){
  if(!d||typeof d!=='object')return;
  if(d.owned&&typeof d.owned==='object')for(const w of WEAPONS)if(d.owned[w.id]===true)owned[w.id]=true;
  if(d.ammo&&typeof d.ammo==='object')for(const w of WEAPONS)if(Number.isFinite(d.ammo[w.id]))ammo[w.id]=Math.max(0,Math.floor(d.ammo[w.id]));
  if(Number.isFinite(d.cash))me.cash=Math.max(0,Math.floor(d.cash));if(!d.bonus10k)me.cash=Math.max(me.cash,10000);
  if(d.drugs&&typeof d.drugs==='object')for(const k of DK)if(Number.isFinite(d.drugs[k]))drugs[k]=clamp(Math.floor(d.drugs[k]),0,3);
  if(Number.isFinite(d.xp))xp=clamp(Math.floor(d.xp),0,1e7);lv=lvOf(xp);
  if(typeof d.weap==='string'&&owned[d.weap])weap=d.weap;
}
$('shopClose').addEventListener('click',closeShop);

