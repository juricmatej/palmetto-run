// ---------- jobs ----------
function jobCol(){return!job?'#ffc94a':job.col||(job.phase==='pickup'?'#ffc94a':'#ff3ea5')}
function endJob(){if(job&&job.car)job.car.mark=false}
function jobDone(reward,msg){endJob();me.cash+=reward;showBig('MISSION PASSED','#ffc94a',`+$${reward}`,2);jingle('pass');job={phase:'wait',t:4,msg:msg||'Nice work. Check your phone for the next job.'};gainXP(60+reward*.08,'Mission');saveArsenal()}
function jobFail(msg){endJob();jingle('fail');showBig('MISSION FAILED','#ff4b4b',msg,1.8);job={phase:'wait',t:4,msg:'Check your phone for the next job.'}}
const jobPos=()=>me.jet||me.heli||me.car||me;
function newJob(force){
  if(mission)return;
  const kinds=['courier','hit','steal','race','wrecker','wanted','turf'],k=force||kinds[Math.floor(rand()*kinds.length)];
  if(k==='hit'){const c=laneSpawn('traffic',700,1400);if(c){c.color='#d23c5a';c.mark=true;job={type:k,phase:'go',car:c,x:c.x,y:c.y,title:'Hit job',text:'Destroy the marked red car.',col:'#ff4b4b',reward:1500,t:120,timed:true};return}}
  if(k==='steal'){const[sp]=parkSpot(700,1600);if(sp){const c=mkCar(sp[0],sp[1],sp[2],'parked','#e8c547','sports');c.color='#e8c547';c.mark=true;cars.push(c);job={type:k,phase:'go',car:c,x:c.x,y:c.y,title:'Grand theft',text:'Steal the gold sports car.',col:'#ffc94a',reward:2000};return}}
  if(k==='race'){let ci=clamp(Math.round((A.x-60)/B),0,N),cj=clamp(Math.round((A.y-60)/B),0,N),px=A.x,py=A.y,len=0;const pts=[];
    for(let n=0;n<6;n++){for(let tr=0;tr<12;tr++){const di=Math.floor(rand()*5)-2,dj=Math.floor(rand()*5)-2,ni=ci+di,nj=cj+dj;if((di||dj)&&ni>=0&&nj>=0&&ni<=N&&nj<=N){ci=ni;cj=nj;break}}const q=[ci*B+60,cj*B+60];len+=Math.hypot(q[0]-px,q[1]-py);px=q[0];py=q[1];pts.push(q)}
    job={type:k,phase:'go',pts,i:0,x:pts[0][0],y:pts[0][1],title:'Checkpoint rush',text:'Checkpoint 1 of 6. Any vehicle works.',col:'#29e6d6',reward:1200,t:Math.round(14+len/190),timed:true};return}
  if(k==='wrecker'){job={type:k,phase:'go',n:0,goal:5,x:A.x,y:A.y,noMarker:true,title:'Demolition',text:'Destroy vehicles: 0 of 5.',col:'#ff6b3d',reward:1300,t:80,timed:true};return}
  if(k==='wanted'&&!me.inside&&RULES.cops){heat=Math.max(heat,3);coolT=0;job={type:k,phase:'go',x:A.x,y:A.y,noMarker:true,title:'Heat run',text:'You have 3 stars. Lose the cops.',col:'#4aa3ff',reward:1000,t:150,timed:true};return} // no cops on the street, no heat run
  if(k==='turf'){const kg=rand()<.5,hq=kg?KINGSHQ:GANGHQ;job={type:k,phase:'go',n:0,goal:6,gname:kg?'Kings':'Vipers',x:hq.x,y:hq.y,title:'Turf war',text:kg?'Take out 6 Low Palms Kings in the hood.':'Take out 6 Rustwater Vipers at the docks.',col:kg?'#9a5ad8':'#3dd68c',reward:1800,t:180,timed:true};return}
  const[x,y]=pointAway(500,1200);job={type:'courier',phase:'pickup',x,y,title:'Courier · pickup',text:'Grab the package at the gold marker.',col:'#ffc94a'};
}
function jobStep(dt){
  missionStep(dt);if(mission)return; // story missions run instead of random jobs
  if(!job){newJob('courier');return}
  if(job.phase==='wait'){job.t-=dt;return}
  const Pp=jobPos(),d=Math.hypot(job.x-Pp.x,job.y-Pp.y);
  if(job.timed){job.t-=dt;if(job.t<=0){jobFail(job.type==='wanted'?'The cops are still on you':'Out of time');return}}
  switch(job.type||'courier'){
    case'courier':
      if(job.phase==='pickup'&&d<38){const[x,y]=pointAway(900,1800),dist=Math.hypot(x-Pp.x,y-Pp.y);Object.assign(job,{phase:'drop',x,y,t:Math.round(dist/165+14),timed:true,reward:Math.round(150+dist*.12),title:'Courier · deliver',text:'Drop it at the pink marker.',col:'#ff3ea5'});noise(.15,5000,.15)}
      else if(job.phase==='drop'&&d<38)jobDone(job.reward);break;
    case'hit':if(!cars.includes(job.car)){jobFail('The target got away');break}job.x=job.car.x;job.y=job.car.y;if(job.car.kind==='dead')jobDone(job.reward);break;
    case'steal':{const c=job.car;if(!cars.includes(c)||c.kind==='dead'||c.burn){jobFail('The car got wrecked');break}
      if(job.phase==='go'){job.x=c.x;job.y=c.y;if(me.car===c)Object.assign(job,{phase:'drop',x:GARAGE.x,y:GARAGE.y,text:'Deliver it to the Rustwater Docks garage in one piece.',col:'#ff3ea5'})}
      else if(me.car===c&&d<45)jobDone(Math.round(job.reward*(.4+.6*clamp(c.hp/ctOf(c).hp,0,1))),'Clean delivery');break}
    case'race':if(d<45){job.i++;noise(.12,6000,.15);if(job.i>=job.pts.length){jobDone(job.reward);break}job.x=job.pts[job.i][0];job.y=job.pts[job.i][1];job.text=`Checkpoint ${job.i+1} of ${job.pts.length}. Any vehicle works.`}break;
    case'wrecker':job.text=`Destroy vehicles: ${job.n} of ${job.goal}.`;if(job.n>=job.goal)jobDone(job.reward);break;
    case'turf':job.text=job.gname==='Kings'?`Take out Low Palms Kings in the hood: ${job.n} of ${job.goal}.`:`Take out Vipers at the docks: ${job.n} of ${job.goal}.`;if(d<320)job.noMarker=true;if(job.n>=job.goal)jobDone(job.reward,job.gname==='Kings'?'The Kings will remember that':'The Vipers will remember that');break;
    case'wanted':job.text=`Lose the cops. ${Math.ceil(heat)} star${Math.ceil(heat)===1?'':'s'} left.`;if(heat<=0)jobDone(job.reward);break;
  }
}

// ---------- missions ----------
// Story missions: typed steps from three contacts, one at a time in `mission`. Random jobs pause while one runs.
// Places used by the missions. MS_ROUTE is the grey sedan's drive along the road grid from downtown to the casino.
const MS_REPO={x:2849,y:715},MS_BUY={x:3700,y:1380},MS_VAN={x:567,y:1560},MS_TRUCK={x:1380,y:2260},MS_HOME={x:2040,y:1889};
const MS_ROUTE=[[1380,1820],[1380,1380],[940,1380],[940,2260],[1380,2260],[1380,3140],[1820,3140],[1820,2260],[2260,2260],[2260,1380],[2700,1380],[2700,940],[2040,940]];
const MISSIONS=[
  {id:'repo',contact:'rosa',title:'Repo Man',level:2,reward:2500,xp:300,col:'#ff3ea5',intro:'Rosa has a car to take back in Palm Heights.',
    steps:[
      {type:'talk',who:'Rosa',text:'A deadbeat in Palm Heights stopped paying for his sports car. Bring it back. His two friends are watching it, so be quick and be armed.'},
      {type:'steal',guards:2,spawn:{type:'sports',color:'#17161c',x:MS_REPO.x,y:MS_REPO.y,a:0},text:'Steal the black sports car. Two armed guards are watching it.'},
      {type:'lose',stars:2,text:'Lose the cops. Two stars.'},
      {type:'goto',veh:true,x:GARAGE.x,y:GARAGE.y,r:60,text:'Drive it to the docks garage.'},
      {type:'talk',who:'Rosa',text:'New plates, new paint. Take it to my buyer at the airport fence. He pays by condition, so do not scratch it.'},
      {type:'deliver',veh:true,scaleByHp:true,x:MS_BUY.x,y:MS_BUY.y,r:70,text:'Deliver the car to the buyer at the airport fence. He pays by condition.'},
    ]},
  {id:'accountant',contact:'vic',title:'The Accountant',level:4,reward:4000,xp:450,col:'#ffc94a',intro:'Vic wants the casino books back tonight.',
    steps:[
      {type:'talk',who:'Vic',text:'One of the casino accountants is skimming the books. He drives a grey sedan downtown. Follow him, but keep your distance.'},
      {type:'follow',t:60,spd:165,spawn:{type:'sedan',color:'#9d97ad',x:1820,y:1820,a:Math.PI},route:MS_ROUTE,text:'Follow the grey sedan from downtown. Stay 60 to 380 units back.'},
      {type:'kill',n:3,at:'car',text:'He stopped at the casino. Take out his three bodyguards.'},
      {type:'collect',car:true,text:'Grab the ledger from the sedan.'},
      {type:'lose',stars:2,text:'Lose the cops. Two stars.'},
      {type:'goto',x:MS_HOME.x,y:MS_HOME.y,r:70,text:'Get back to the safehouse.'},
    ]},
  {id:'armored',contact:'vic',title:'Armored Car',level:7,reward:8000,xp:700,col:'#ffc94a',intro:'Vic has a line on an armored truck moving cash.',
    steps:[
      {type:'talk',who:'Vic',text:'An armored truck is moving cash across the city tonight. Hit its escorts first, then crack the truck open. Bullets bounce off it, bring something loud.'},
      {type:'goto',truck:true,r:110,text:'Get to the armored truck. It is the gold square on the map.'},
      {type:'destroy',cruisers:2,text:'Destroy the two escort cruisers.'},
      {type:'destroy',doors:true,text:'Blast the truck below 50 percent. Sticky bombs work best.'},
      {type:'collect',n:3,spread:60,text:'Collect the three cash bags.'},
      {type:'lose',stars:3,text:'Lose the cops. Three stars.'},
      {type:'deliver',x:MS_HOME.x,y:MS_HOME.y,r:70,text:'Deliver the cash to the safehouse.'},
    ]},
  {id:'dock',contact:'dex',title:'Dock War',level:5,reward:5000,xp:550,col:'#9a5ad8',intro:'Dex needs a Kings van out of the docks.',
    steps:[
      {type:'talk',who:'Dex',text:'Vipers are leaning on one of our vans down at the docks. Hold them off, then bring the van to Low Palms in one piece.'},
      {type:'goto',spawn:{type:'van',color:'#7b3fb8',x:MS_VAN.x,y:MS_VAN.y,a:Math.PI/2},r:120,text:'Get to the docks. The Kings van is the marker.'},
      {type:'defend',t:90,hp:300,text:'Defend the Kings van for 90 seconds. Vipers come in waves.'},
      {type:'steal',lost:'The van is wrecked',text:'The van is clear. Get in and take it.'},
      {type:'deliver',veh:true,minHp:.3,x:KINGSHQ.x,y:KINGSHQ.y,r:90,text:'Deliver the van to Low Palms. Below 30 percent and the Kings lose it.'},
    ]},
  // Choice steps wait for U or I. The picked branch's steps are spliced in after the choice (see the keydown below).
  {id:'tail',contact:'vic',title:'The Councillor',level:8,reward:9000,xp:800,col:'#ffc94a',intro:'Vic wants a councillor followed to a meet and photographed.',
    steps:[
      {type:'talk',who:'Vic',text:'A councillor sends his driver to meet a buyer after dark. Follow the driver, get the meet on camera, and do not get burned.'},
      {type:'follow',t:60,spd:165,spawn:{type:'sedan',color:'#2d4a6e',x:1820,y:1820,a:Math.PI},route:MS_ROUTE,text:'Follow the blue sedan. Stay 60 to 380 units back.'},
      {type:'photo',r:20,t:3,text:'Get within 20 units of the car and hold still for 3 seconds.'},
      {type:'hide',t:20,text:'Get 60 units clear and stay out of sight for 20 seconds.'},
      {type:'choice',text:'Sell the photos to the press (U) or blackmail the councillor (I).',opts:[
        {k:'KeyU',label:'Sell the photos to the press',mul:1,steps:[{type:'deliver',x:MS_HOME.x,y:MS_HOME.y,r:70,text:'Drop the photos at the safehouse.'}]},
        {k:'KeyI',label:'Blackmail the councillor',mul:2.2,steps:[{type:'lose',stars:3,text:'The councillor sends his men after you. Lose the cops. Three stars.'}]}]},
    ]},
  {id:'double',contact:'rosa',title:'Double Cross',level:1,reward:6000,xp:600,col:'#ff3ea5',intro:'Rosa has a package at the docks and a second buyer in mind.',
    steps:[
      {type:'talk',who:'Rosa',text:'Pick up the package at the docks. Dex pays more than my buyer, so think before you deliver.'},
      {type:'goto',x:MS_VAN.x,y:MS_VAN.y,r:50,text:'Pick up the package at the docks.'},
      {type:'lose',stars:2,text:'Dex has a runner on your tail. Lose him. Two stars.'},
      {type:'choice',text:'Deliver it to the buyer (U) or sell it to Dex (I).',opts:[
        {k:'KeyU',label:'Deliver it to the buyer',mul:1,steps:[{type:'deliver',x:MS_BUY.x,y:MS_BUY.y,r:70,text:'Deliver the package to the buyer at the airport fence.'}]},
        {k:'KeyI',label:'Sell it to Dex',mul:1.8,steps:[{type:'lose',stars:3,text:'Rosa sends her people after you. Lose the cops. Three stars.'},{type:'deliver',x:3230,y:2352,r:70,text:'Sell the package to Dex at the docks.'}]}]},
    ]},
  {id:'sweep',contact:'dex',title:'Clean Sweep',level:6,reward:7000,xp:650,col:'#9a5ad8',intro:'Dex has three stops to clear before sunrise.',
    steps:[
      {type:'goto',x:1380,y:2260,r:50,text:'Stop one is on the grid by the trucks. Go in.'},
      {type:'choice',text:'Pay the doorman to let you in quietly (U) or go in loud (I).',opts:[
        {k:'KeyU',label:'Pay the doorman',mul:.7,steps:[]},
        {k:'KeyI',label:'Go in loud',mul:1.4,steps:[{type:'kill',n:3,text:'Shoot your way past the three guards at the door.'}]}]},
      {type:'goto',x:2260,y:2260,r:50,text:'Stop two. Keep moving.'},
      {type:'goto',x:2700,y:940,r:50,text:'Stop three, the last one. Get there.'},
      {type:'kill',n:4,text:'It is an ambush. Survive it and kill the four Vipers.'},
    ]},
  {id:'bank',contact:'vic',title:'Bank van pickup',level:3,reward:6000,xp:600,col:'#ffc94a',crew:true,intro:'Vic needs three spots held at once while the bank van is pulled. A crew of two or more.',
    steps:[
      {type:'talk',who:'Vic',text:'The bank van rolls at dawn. Put one of your crew on each marked spot and hold it for 4 seconds, all three inside one minute. Everyone in the crew takes the job from me.'},
      {type:'crew',text:'Hold the three marked spots within one minute. The beacon shows the nearest open one.'},
    ]},
];
// Contacts stand at fixed spots. `list` is the missions this contact hands out in order.
const MCON=[
  {id:'vic',name:'Vic',short:'V',col:'#ffc94a',x:2104,y:1893,fa:Math.PI/2,list:['accountant','armored','tail','bank']},
  {id:'rosa',name:'Rosa',short:'R',col:'#ff3ea5',x:636,y:1453,fa:-Math.PI/2,list:['repo','double']},
  {id:'dex',name:'Dex',short:'D',col:'#9a5ad8',x:3230,y:2352,fa:Math.PI/2,list:['dock','sweep']},
];
const msById=id=>MISSIONS.find(m=>m.id===id);
let mission=null,msRetry=null,msDeath=null,msGrp=null,msCyl=null,msRing=null;
const msDone={};
try{const a=JSON.parse(localStorage.getItem('pr3d-missions')||'[]');if(Array.isArray(a))for(const id of a)if(msById(id))msDone[id]=true}catch(_){}
function msSave(){try{localStorage.setItem('pr3d-missions',JSON.stringify(MISSIONS.filter(m=>msDone[m.id]).map(m=>m.id)))}catch(_){}}
const msStep=()=>mission?mission.def.steps[mission.i]:null;
function msCar(s){const c=mkCar(s.x,s.y,s.a||0,'parked',s.color||'#e8e4f0',s.type);c.mark=true;c.ms=true;cars.push(c);return c}
function msGuards(n,x,y,spread){const s=spread||40,a=[];for(let i=0;i<n;i++){const px=x+rr(-s,s),py=y+rr(-s,s);
  const p={x:px,y:py,vx:0,vy:0,a:rand()*TAU,spd:0,flee:0,fx:0,fy:0,down:0,skin:PEDCOL[Math.floor(rand()*5)],shirt:'#5a2a8a',ci:0,dir:1,ph:rand()*TAU,gang:true,gname:'Vipers',hx:px,hy:py,cd:rr(.4,1),aggro:true,yelled:true,msG:true};peds.push(p);a.push(p)}return a}
// Every object the mission owns carries its own flag (ms, msG) so cleanup never touches world traffic.
function msClear(){
  if(msGrp)msGrp.visible=false;
  for(let i=cars.length-1;i>=0;i--){const c=cars[i];if(!c.ms)continue;c.ms=false;c.mark=false;if(c!==me.car&&c.kind!=='dead'&&!c.personal&&!c.slot)cars.splice(i,1)} // a personal car is never deleted by a mission
  for(let i=peds.length-1;i>=0;i--)if(peds[i].msG)peds.splice(i,1);
  for(let i=pickups.length-1;i>=0;i--)if(pickups[i].ms)pickups.splice(i,1);
}
function msBeacon(col,x,y){
  if(!msGrp){msCyl=new THREE.Mesh(new THREE.CylinderGeometry(15,15,160,24,1,true),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.26,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));msCyl.position.y=80;
    msRing=new THREE.Mesh(new THREE.RingGeometry(15,19,32),new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide}));msRing.rotation.x=-Math.PI/2;msRing.position.y=1.8;
    msGrp=new THREE.Group();msGrp.add(msCyl,msRing);scene.add(msGrp)}
  msGrp.visible=true;msCyl.material.color.set(col);msRing.material.color.set(col);msCyl.material.opacity=.2+Math.sin(time*4)*.06;
  msGrp.position.set(x,groundZ(x,y),y)}
function msWhere(){
  const st=msStep();if(!st)return null;
  if(st.type==='goto'||st.type==='deliver')return mission.ax===null?null:[mission.ax,mission.ay];
  if(st.type==='steal'||st.type==='follow'||st.type==='kill'||st.type==='defend'||st.type==='destroy')return mission.car?[mission.car.x,mission.car.y]:null;
  if(st.type==='collect'){const p=mission.pk.find(p=>pickups.includes(p));return p?[p.x,p.y]:null}
  if(st.type==='crew')return crewWhere();
  return null}
function msBegin(){
  const st=msStep();if(!st)return;
  mission.t=st.time||0;mission.tt=st.type==='talk'?(st.talk||3):(st.t||0);
  if(st.type==='crew'){crewRd=null;crewHold=[0,0,0]}
  mission.n=0;mission.msg='';mission.nearT=0;mission.pk=[];mission.g=0;
  mission.ax=st.x===undefined?null:st.x;mission.ay=st.y===undefined?null:st.y;
  if(st.spawn){mission.car=msCar(st.spawn);if(st.type==='goto'){mission.ax=mission.car.x;mission.ay=mission.car.y}}
  if(st.type==='follow'&&mission.car){mission.car.hold=4;mission.car.wp=0}
  if(st.type==='goto'&&st.truck){const t=cars.find(c=>c.type==='armored'&&c.kind!=='dead'&&!c.burn&&c.hp>ctOf(c).hp*.5&&!c.ms&&!c.personal&&!c.slot)||msCar({type:'armored',x:MS_TRUCK.x,y:MS_TRUCK.y,a:0});
    t.mark=true;t.ms=true;mission.car=t;mission.ax=t.x;mission.ay=t.y;feed('The armored truck is marked on your map')}
  if(st.type==='steal'&&mission.car)mission.car.mark=true;
  if(st.type==='defend'&&mission.car){const v=mission.car;v.mark=true;if(st.hp){v.hp=st.hp;v.msMax=st.hp}mission.ax=v.x;mission.ay=v.y} // the van has to stay where it is parked
  if(st.type==='destroy'&&st.cruisers&&mission.car){const t=mission.car;mission.cruisers=[];
    for(const dx of[-46,46]){const c=mkCar(t.x+dx,t.y,t.a,'parked','#e9e9f2','police');c.mark=true;c.ms=true;cars.push(c);mission.cruisers.push(c)}}
  if(st.type==='kill'){const a=st.at==='car'&&mission.car?mission.car:A;mission.guards=msGuards(st.n||3,a.x,a.y,45)}
  if(st.type==='collect'){const s=st.spread||16,x=mission.car?mission.car.x:(mission.ax||A.x),y=mission.car?mission.car.y:(mission.ay||A.y);
    for(let i=0;i<(st.n||1);i++){const p={x:x+rr(-s,s),y:y+rr(-s,s),amt:0,t:900,ms:true};pickups.push(p);mission.pk.push(p)}}
  if(st.type==='lose'&&heat<=0){heat=st.stars||2;coolT=0}
}
// One handler per step type. Return 'next', 'fail:<reason>' or nothing.
const MSH={
  talk(st,dt){if((mission.tt-=dt)<=0)return'next'},
  goto(st,dt){
    const c=mission.car;
    if(st.veh){if(!c||!cars.includes(c)||c.kind==='dead'||c.burn)return'fail:The ride got wrecked';
      if(me.car!==c){mission.msg='Bring the mission car';return}}
    const px=me.car?me.car.x:A.x,py=me.car?me.car.y:A.y,d=Math.hypot(mission.ax-px,mission.ay-py);
    if(d<(st.r||50)){if(st.inVehicle&&!me.car){mission.msg='Get in a car first';return}return'next'}
    mission.msg=Math.round(d/10)+' m to go'},
  steal(st,dt){
    const c=mission.car;if(!c||!cars.includes(c)||c.kind==='dead'||c.burn)return'fail:'+(st.lost||'The car got wrecked');
    if(st.guards&&!mission.g&&Math.hypot(c.x-A.x,c.y-A.y)<650){mission.g=1;mission.guards=msGuards(st.guards,c.x,c.y,50)}
    if(me.car===c)return'next';mission.msg='Get in the car'},
  follow(st,dt){
    const c=mission.car;if(!c||!cars.includes(c)||c.kind==='dead'||c.burn)return'fail:You lost them';
    if(c.hold>0)c.hold-=dt;
    else if(c.wp<st.route.length){const tx=st.route[c.wp][0],ty=st.route[c.wp][1],dx=tx-c.x,dy=ty-c.y,mv=(st.spd||165)*dt;
      if(Math.hypot(dx,dy)<=mv+4)c.wp++;else{const a=Math.atan2(dy,dx);c.a=a;c.x+=Math.cos(a)*mv;c.y+=Math.sin(a)*mv;carWalls(c)}}
    const d=Math.hypot(c.x-A.x,c.y-A.y);
    if(d<60){mission.nearT+=dt;if(mission.nearT>3)return'fail:You were spotted'}else mission.nearT=0;
    if(d>450)return'fail:You lost them';
    mission.msg=Math.round(d/10)+' m behind';
    if((mission.tt-=dt)<=0||c.wp>=st.route.length)return'next'},
  kill(st){
    const left=(mission.guards||[]).filter(p=>!p.down&&peds.includes(p)).length;
    if(!left)return'next';mission.msg='Bodyguards left: '+left},
  defend(st,dt){
    const v=mission.car,max=v&&(v.msMax||ctOf(v).hp);
    if(!v||!cars.includes(v)||v.kind==='dead'||v.burn)return'fail:The Kings van was destroyed';
    if(Math.hypot(v.x-A.x,v.y-A.y)>420||Math.hypot(v.x-(mission.ax??v.x),v.y-(mission.ay??v.y))>160)return'fail:You left the van alone';
    mission.msg=`Van ${Math.max(0,Math.round(v.hp/max*100))} percent · ${Math.max(0,Math.ceil(mission.tt))}s`;
    if((mission.tt-=dt)<=0)return'next';
    const near=(mission.guards||[]).filter(p=>!p.down&&peds.includes(p)&&Math.hypot(p.x-v.x,p.y-v.y)<340).length;
    if(near&&rand()<dt*1.1*near){damageCar(v,6,false);parts.push({x:v.x+rr(-24,24),y:v.y+rr(-24,24),vx:0,vy:0,life:.06,max:.06,col:'#ffe9a8',k:'flash',sz:10})}
    if(st.t-mission.tt>(mission.n+1)*(st.wave||15)){mission.n++;feed('Vipers are moving in');mission.guards=(mission.guards||[]).concat(msGuards(2+Math.min(3,mission.n),Math.max(446,v.x-rr(60,180)),v.y+rr(-140,140),40))}},
  collect(st){
    const left=mission.pk.filter(p=>pickups.includes(p)).length;
    if(!left)return'next';mission.msg=`Collected ${mission.pk.length-left} of ${mission.pk.length}`},
  destroy(st){
    const t=mission.car;
    if(st.cruisers){const left=(mission.cruisers||[]).filter(c=>cars.includes(c)&&c.kind!=='dead'&&!c.burn).length;
      if(!left)return'next';mission.msg='Escorts left: '+left}
    else{const max=t?ctOf(t).hp:1;if(t&&(t.kind==='dead'||t.hp<=max*.5))return'next';mission.msg='Truck at '+Math.round(Math.max(0,t?t.hp/max:0)*100)+' percent'}},
  lose(st){if(!RULES.cops)return'next';mission.msg=Math.max(0,Math.ceil(heat))+' star'+(Math.ceil(heat)===1?'':'s')+' left';if(heat<=0)return'next'},
  crew:crewStep,
  choice(st){if(mission.pick)return'next'},
  photo(st,dt){
    const c=mission.car;if(!c||!cars.includes(c)||c.kind==='dead'||c.burn)return'fail:The car is gone';
    const d=Math.hypot(c.x-A.x,c.y-A.y);
    if(d>st.r){mission.tt=st.t;mission.msg=Math.round(d/10)+' m, get within '+st.r;return}
    if((mission.tt-=dt)<=0)return'next';mission.msg='Hold still'},
  hide(st,dt){
    const c=mission.car;if(!c||!cars.includes(c)||c.kind==='dead'||c.burn)return'fail:You lost them';
    if(Math.hypot(c.x-A.x,c.y-A.y)<60){mission.nearT+=dt;if(mission.nearT>3)return'fail:You were spotted'}else mission.nearT=0;
    if((mission.tt-=dt)<=0)return'next';mission.msg=Math.ceil(mission.tt)+' s to go'},
  deliver(st){
    const c=mission.car;
    if(st.veh){if(!c||!cars.includes(c))return'fail:The ride is gone';
      if(c.kind==='dead'||c.burn)return'fail:It fell apart on the way';
      const max=c.msMax||ctOf(c).hp;if(st.minHp&&c.hp<max*st.minHp)return'fail:It is too beaten up. The deal is off'}
    const px=st.veh?c.x:(me.car?me.car.x:A.x),py=st.veh?c.y:(me.car?me.car.y:A.y),d=Math.hypot(mission.ax-px,mission.ay-py);
    if(d<(st.r||60)&&(!st.veh||Math.hypot(A.x-c.x,A.y-c.y)<120)){if(st.scaleByHp)mission.scale=clamp(c.hp/(c.msMax||ctOf(c).hp),0,1);return'next'}
    mission.msg=Math.round(d/10)+' m to go'},
};
function msPed(q){const p=spawnPed(q.x,q.y);p.kind='chat';p.fa=q.fa;p.ph=rand()*TAU;p.contact=q.id;p.shirt=q.col;p.bark=null;p.stopT=0;return p}
function msSeed(){
  for(const q of MCON){q.ped=msPed(q);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:canvasTex(128,128,g=>{g.fillStyle='#0b0814';g.beginPath();g.arc(64,64,56,0,TAU);g.fill();g.strokeStyle=q.col;g.lineWidth=10;g.stroke();
      g.fillStyle=q.col;g.font='86px Bungee, Impact, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(q.short,64,70)}),depthTest:false,transparent:true}));
    s.scale.set(26,26,1);s.renderOrder=10;s.position.set(q.x,36,q.y);scene.add(s);
    const r=new THREE.Mesh(new THREE.RingGeometry(12,16,32),new THREE.MeshBasicMaterial({color:q.col,side:THREE.DoubleSide}));r.rotation.x=-Math.PI/2;r.position.set(q.x,1.6,q.y);scene.add(r);shopRings.push(r)}}
function msNextMission(c){if(msRetry&&c.list.includes(msRetry))return msById(msRetry);return MISSIONS.find(m=>m.contact===c.id&&!msDone[m.id]&&(!m.crew||crewOn()))||null}
function msNear(){
  if(mission||me.car||me.heli||me.jet||me.inside||me.roof||state!=='play')return null;
  for(const c of MCON)if(Math.hypot(c.x-A.x,c.y-A.y)<44){const def=msNextMission(c);return{c,def,retry:!!(def&&msRetry===def.id),locked:!!(def&&lv<def.level)}}
  return null}
function startMission(id,force){
  const def=msById(id);
  if(!def||mission||state!=='play')return;
  if(def.crew&&!crewOn()){feed(`${def.title} needs a crew of two`);return}
  if(!force&&lv<def.level){feed(`${def.title} needs level ${def.level}`);return}
  msClear();endJob();job=null;hideBig();
  mission={def:{...def,steps:def.steps.slice()},i:0,t:0,tt:0,n:0,msg:'',pk:[],log:[]};msRetry=null;msDeath=null;
  msBegin();
  showBig('MISSION STARTED','#29e6d6',`${def.title} · Level ${def.level}`,1.8);
  feed('New mission: '+def.title+'. '+def.intro)}
function msPass(){
  if(!mission)return;
  const def=mission.def,sc=mission.scale,base=Math.round(def.reward*(mission.mul||1)*(sc===undefined?1:(.4+.6*clamp(sc,0,1)))),pay=base; // every crew member who finishes is paid in full on their own client
  msClear();me.cash+=pay;gainXP(def.xp,'Mission');
  msDone[def.id]=true;msSave();mission=null;msRetry=null;jingle('pass');
  showBig('MISSION PASSED','#ffc94a',`${def.title} · +$${pay.toLocaleString('en-US')}`,3);saveArsenal()}
function msFail(reason){
  if(!mission)return;
  msRetry=mission.def.id;msClear();mission=null;jingle('fail');
  showBig('MISSION FAILED','#ff4b4b',reason,3.5);
  feed('Mission failed: '+reason+' Retry at the contact')}
function msDie(word){
  if(!mission)return;
  msRetry=mission.def.id;msDeath=(word==='BUSTED'?'The cops busted you.':'You died.')+' Retry at the contact.';
  msClear();mission=null;jingle('fail')}
function skipTalk(){if(mission&&msStep().type==='talk')mission.tt=0}
function missionStep(dt){
  for(const q of MCON){if(!q.ped||!peds.includes(q.ped)){if(Math.hypot(q.x-A.x,q.y-A.y)<1500)q.ped=msPed(q)}
    else if(!q.ped.down&&!q.ped.flee&&Math.hypot(q.ped.x-q.x,q.ped.y-q.y)>60){q.ped.x=q.x;q.ped.y=q.y;q.ped.vx=q.ped.vy=0}}
  if(state!=='play'||!mission){if(msGrp)msGrp.visible=false;return}
  const st=msStep(),def=mission.def;
  if(mission.t>0){mission.t-=dt;if(mission.t<=0){msFail('Out of time');return}}
  const r=MSH[st.type]?MSH[st.type](st,dt):null;
  if(r==='next'){mission.log.push(st.type==='choice'?'Chose: '+mission.pick:st.text);mission.i++;if(mission.i>=def.steps.length){msPass();return}msBegin()}
  else if(r&&r.slice(0,5)==='fail:'){msFail(r.slice(5));return}
  const w=msWhere();
  if(w&&!me.inside)msBeacon(def.col,w[0],w[1]);else if(msGrp)msGrp.visible=false}
if(DBG)Object.defineProperties(DBG,{mission:{get:()=>mission&&{id:mission.def.id,i:mission.i}},startMission:{get:()=>startMission},MISSIONS:{get:()=>MISSIONS.map(m=>m.id)}});
if(DBG)Object.defineProperties(DBG,{skipTalk:{get:()=>skipTalk}});
// U and I pick a branch at a choice step. The picked steps go in right after the choice.
addEventListener('keydown',e=>{
  const st=mission&&msStep();
  if(!st||st.type!=='choice'||mission.pick||e.repeat||capAct||state!=='play'||phoneOpen||wheelOpen||quickOpen||chatOpen)return;
  const o=st.opts.find(o=>o.k===e.code);if(!o)return;
  mission.pick=o.label;mission.mul=o.mul;mission.def.steps.splice(mission.i+1,0,...o.steps)});
if(DBG)Object.defineProperties(DBG,{msDev:{get:()=>MISSIONS.filter(m=>m.steps.length>=4&&m.steps.some(s=>s.type==='choice')).map(m=>m.id)}});

// ---------- movement ----------
// stamina, jump, roof drops, hands up and horn
let stam=1,stamOut=false,stamIdle=0,handsUp=false,surrT=0,driftA=0,driftG=7,jvz=0,peak=0;
const floorH=()=>{const r=me.roof||roofAt(me.x,me.y);return Math.max(groundZ(me.x,me.y),r?r.H+1.6:0)};
const inAir=()=>jvz>0||me.z>floorH()+.01;
function jump(){if(state!=='play'||me.car||me.inside||me.climb||me.heli||me.jet||handsUp||me.downed||inAir())return;jvz=230;stam=Math.max(0,stam-.12)}
function stamStep(sprint,dt){
  if(sprint){stam=Math.max(0,stam-dt/(6*gymMul()));stamIdle=0}
  else{stamIdle+=dt;if(stamIdle>.8)stam=Math.min(1,stam+dt/4*coffeeMul())}
  if(stam<=0)stamOut=true;
  if(stamOut&&stam>=.25)stamOut=false;
}
function footStep(dt){
  if(!inAir()||(jvz===0&&me.z-floorH()<=4)){jvz=0;peak=me.z=floorH();return} // a slope of up to 4 is walked, a ledge is a fall
  peak=Math.max(peak,me.z);
  jvz-=700*RULES.grav*dt;me.z+=jvz*dt;
  const f=floorH();
  if(jvz<=0&&me.z<=f){const fall=peak-f;me.z=f;jvz=0;peak=f;me.roof=roofAt(me.x,me.y);if(fall>40)hurtMe((fall-40)*.9)}
}
function handsStep(dt){
  const cop=heat>0&&Math.ceil(heat)<=2&&cars.some(c=>c.kind==='police'&&Math.hypot(c.x-me.x,c.y-me.y)<220);
  if(!handsUp||!cop){surrT=0;return}
  if((surrT+=dt)>1.5){handsUp=false;surrT=0;feed('You gave yourself up');die('BUSTED',.05)}
}
function honk(){
  if(state!=='play')return;
  if(me.car){const c=me.car;hornSnd();
    for(const p of peds){if(p.down)continue;const dx=p.x-c.x,dy=p.y-c.y;if(Math.hypot(dx,dy)<200&&Math.abs(wrap(Math.atan2(dy,dx)-c.a))<.5){p.flee=1.2;p.fx=c.x;p.fy=c.y}}}
  else if(!me.heli&&!me.jet)handsUp=!handsUp;
}
// downed crawl and revive: the bleedout timer ticks while down, and holding the interact action next to a
// downed player for 3 s fills the client-side revive timer and publishes rv (see the multiplayer section).
me.downed=false;me.downT=0;
let revProg=0,revPeer=null,revDone=false,revNow=null,revPct=-1,spectateIdx=0,specR=null,touchRev=false;
function downedStep(dt){if(!me.downed||state!=='play')return;me.downT-=dt;if(me.downT<=0)bleedout()}
function reviveCand(){if(state!=='play'||me.downed||me.car||me.heli||me.jet)return null;let best=null,bd=14;
  for(const[peer,r]of remotes)if(r.downed&&!r.dead){const d=Math.hypot(r.x-me.x,r.y-me.y);if(d<bd){bd=d;best={peer,r}}}
  return best}
function revStep(dt){
  const c=revNow=reviveCand();
  if(!c||!(held('interact')||touchRev)){revProg=0;revPeer=null;revDone=false;return}
  if(revPeer!==c.peer){revPeer=c.peer;revProg=0;revDone=false}
  if(revDone)return; // one revive per hold, even while the victim's dn 1 is still in flight
  revProg+=dt;
  if(revProg>=3){revDone=true;lastRv=[c.peer,(revSeq=(revSeq+1)%1e6)];pubT=1;feed(`You revived ${c.r.name}`);gainXP(25,'Revive')}
}
function specPick(){
  let n=0;for(const r of remotes.values())if(!r.dead)n++;
  if(!n){specR=null;return}
  let i=((spectateIdx%n)+n)%n;
  for(const r of remotes.values())if(!r.dead&&i--===0){specR=r;return}
}
function spectateNext(){spectateIdx=(spectateIdx+1)%1e6;specPick()}
function debugDown(){if(state==='play')goDown();return true}
function debugBleedout(){if(me.downed)bleedout();return state}
if(DBG)Object.defineProperties(DBG,{stam:{get:()=>stam},handsUp:{get:()=>handsUp},driftA:{get:()=>driftA}});
if(DBG)Object.defineProperties(DBG,{downed:{get:()=>me.downed},downT:{get:()=>me.downT},setDown:{get:()=>debugDown},forceBleedout:{get:()=>debugBleedout},applyRevive:{get:()=>applyRevive},spectate:{get:()=>spectateIdx}});

// ---------- traffic lights ----------
// Four phases, shared worldwide, 15s cycle: 0 = axis A green (6s), 1 = axis A yellow (1.5s),
// 2 = axis B green (6s), 3 = axis B yellow (1.5s). Crossing roads alternate; the cross axis stays red.
// tlPaint is set by the 3D scene once the instanced lamps exist; it repaints all instances in one pass per phase change.
const TLD=[6,1.5,6,1.5];let tlT=0,tlP=-1,tlPaint=null;
function trafficStep(dt){
  if(!tlPaint)return;
  tlT+=dt;
  const c=TLD[0]+TLD[1]+TLD[2]+TLD[3],t=tlT%c,ph=t<TLD[0]?0:t<TLD[0]+TLD[1]?1:t<TLD[0]+TLD[1]+TLD[2]?2:3;
  if(ph!==tlP){tlP=ph;tlPaint(ph)}
}
if(DBG)Object.defineProperties(DBG,{tlP:{get:()=>tlP}});

