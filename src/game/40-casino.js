// ---------- blackjack ----------
const SUITS=['♠','♥','♦','♣'],RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const BJMIN=10,BJMAX=5000,BJCUT=234,BJN={hit:'Hit',stand:'Stand',double:'Double',split:'Split',surr:'Surrender'};
let tableK=1;
// Basic strategy: dealer stands on all 17s, double on any two cards, split up to 3 times, late surrender.
// Columns are dealer upcards 2..A. H hit, S stand, D double else hit, d double else stand, R surrender else hit, P split.
const BJHARD={9:'HDDDDHHHHH',10:'DDDDDDDDHH',11:'DDDDDDDDDD',12:'HHSSSHHHHH',13:'SSSSSHHHHH',14:'SSSSSHHHHH',15:'SSSSSHHHRH',16:'SSSSSHHRRR'};
const BJSOFT={2:'HHHDDHHHHH',3:'HHHDDHHHHH',4:'HHDDDHHHHH',5:'HHDDDHHHHH',6:'HDDDDHHHHH',7:'dDDDDSSHHH',8:'SSSSSSSSSS',9:'SSSSSSSSSS'};
const BJPAIR={11:'PPPPPPPPPP',10:'SSSSSSSSSS',9:'PPPPPSPPSS',8:'PPPPPPPPPP',7:'PPPPPPHHHH',6:'PPPPPHHHHH',4:'HHHPPHHHHH',3:'PPPPPPHHHH',2:'PPPPPPHHHH'};
const PIPS={2:[[50,20],[50,80]],3:[[50,20],[50,50],[50,80]],4:[[30,20],[70,20],[30,80],[70,80]],5:[[30,20],[70,20],[50,50],[30,80],[70,80]],6:[[30,20],[70,20],[30,50],[70,50],[30,80],[70,80]],7:[[30,20],[70,20],[50,35],[30,50],[70,50],[30,80],[70,80]],8:[[30,20],[70,20],[50,35],[30,50],[70,50],[50,65],[30,80],[70,80]],9:[[30,17],[70,17],[30,39],[70,39],[50,50],[30,61],[70,61],[30,83],[70,83]],10:[[30,17],[70,17],[50,28],[30,39],[70,39],[30,61],[70,61],[50,72],[30,83],[70,83]]};
const money=v=>'$'+Math.round(v).toLocaleString('en-US');
const wait=ms=>new Promise(r=>setTimeout(r,reduced?0:ms));
function countUp(el,a,b,ms,fmt){return new Promise(res=>{const t0=performance.now(),f=t=>{const k=reduced?1:Math.min(1,(t-t0)/ms);el.textContent=(fmt||money)(a+(b-a)*(1-(1-k)**3));if(k<1)requestAnimationFrame(f);else res()};requestAnimationFrame(f)})}
// chips and chip stacks; fly() slides an element from rect a to rect b
function chipEl(v,i){const c=document.createElement('i');c.className='cx c'+v;if(i!=null)c.style.bottom=i*4+'px';return c}
function chipStack(a){const s=document.createElement('div');s.className='stk';let i=0;for(const v of[1000,500,100,50,10])while(a>=v&&i<12){s.appendChild(chipEl(v,i++));a-=v}return s}
function fly(el,a,b,ms,delay){return el.animate([{transform:'translate(0,0)'},{transform:`translate(${b.left-a.left}px,${b.top-a.top}px)`}],{duration:ms,delay:delay||0,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'})}
// shoe and hand maths. Cards are {r, su}. Shared by the table and bjSim.
function bjNewShoe(){const c=[];for(let k=0;k<6;k++)for(const su of SUITS)for(const r of RANKS)c.push({r,su});for(let i=c.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[c[i],c[j]]=[c[j],c[i]]}return{c,used:0}}
const bjTake=sh=>{if(!sh.c.length){sh.c=bjNewShoe().c;sh.used=0}return sh.used++,sh.c.pop()}; // a shoe never runs dry mid hand
const bjPip=c=>c.r==='A'?11:'JQK'.includes(c.r)?10:+c.r;
function bjVal(cs){let v=0,a=0;for(const c of cs){v+=bjPip(c);if(c.r==='A')a++}while(v>21&&a){v-=10;a--}return v}
const bjHard=cs=>cs.reduce((s,c)=>s+(c.r==='A'?1:bjPip(c)),0);
const bjNat=cs=>cs.length===2&&bjVal(cs)===21;
const bjUp=c=>c.r==='A'?9:bjPip(c)===10?8:bjPip(c)-2;
// action for hand h against upcard index ui: hit, stand, double, split or surr
function bjStrat(h,ui,r){const cs=h.c;if(bjVal(cs)>=21)return'stand';const two=cs.length===2,hard=bjHard(cs);let t;
  if(two&&cs[0].r===cs[1].r&&r.h.length<4)t=(BJPAIR[bjPip(cs[0])]||'')[ui];
  if(!t){const soft=hard+10<21&&hard>=3&&cs.some(c=>c.r==='A');t=soft?BJSOFT[hard-1][ui]:hard>=17?'S':hard<=8?'H':BJHARD[hard][ui]}
  return{H:'hit',S:'stand',D:two?'double':'hit',d:two?'double':'stand',R:two&&r.h.length===1?'surr':'hit',P:'split'}[t]}
// a round: r.h hands {c, bet, sp, done, surr, win, res}, r.i active hand, r.d dealer cards, r.ins insurance, r.stake money in, r.back money out
function bjNewRound(bet,draw){const h={c:[],bet,sp:0,done:0,surr:0,win:0,res:''};const r={h:[h],i:0,d:[],ins:0,stake:bet,back:0};h.c.push(draw());r.d.push(draw());h.c.push(draw());r.d.push(draw());return r}
const bjChk=h=>{if(bjVal(h.c)>=21)h.done=1};
function bjHit(r,draw){const h=r.h[r.i];h.c.push(draw());bjChk(h)}
function bjDbl(r,draw){const h=r.h[r.i];r.stake+=h.bet;h.bet*=2;h.c.push(draw());h.done=1}
function bjSplit(r,draw){const h=r.h[r.i],ace=h.c[0].r==='A',n={c:[h.c.pop()],bet:h.bet,sp:1,done:0,surr:0,win:0,res:''};
  h.sp=1;r.h.splice(r.i+1,0,n);r.stake+=h.bet;h.c.push(draw());n.c.push(draw());if(ace)h.done=n.done=1;bjChk(h);bjChk(n)}
function bjSurr(r){const h=r.h[r.i];h.surr=1;h.done=1}
function bjStand(r){r.h[r.i].done=1}
function bjNext(r){for(;r.i<r.h.length;r.i++)if(!r.h[r.i].done)return true;return false}
function bjDealer(r,draw){if(r.h.length===1&&bjNat(r.h[0].c)||!r.h.some(h=>!h.surr&&bjVal(h.c)<=21))return;while(bjVal(r.d)<17)r.d.push(draw())}
// sets h.win and h.res for each hand, adds insurance, returns total money back
function bjPay(r){const dv=bjVal(r.d),dn=bjNat(r.d),one=r.h.length===1;let back=dn?r.ins*3:0;
  for(const h of r.h){const pv=bjVal(h.c),pn=one&&bjNat(h.c),b=h.bet;let k,t;
    if(h.surr){k=.5;t='Surrender'}
    else if(pv>21){k=0;t='Bust'}
    else if(pn&&dn){k=1;t='Push'}
    else if(pn){k=2.5;t='Blackjack'}
    else if(dn){k=0;t='Dealer blackjack'}
    else if(dv>21||pv>dv){k=2;t='Win'}
    else if(pv===dv){k=1;t='Push'}
    else{k=0;t='Lose'}
    h.win=k*b;h.res=t;back+=h.win}
  r.back=back;return back}
// bjSim(n): n hands of basic strategy, no animation. Returns the player's return (money back / money staked).
function bjSim(n){let sh=bjNewShoe(),st=0,bk=0;const draw=()=>bjTake(sh);
  for(let k=0;k<n;k++){if(sh.used>=BJCUT)sh=bjNewShoe();const r=bjNewRound(BJMIN,draw);
    if(!(r.h.length===1&&bjNat(r.h[0].c))&&!bjNat(r.d))
      while(bjNext(r)){const a=bjStrat(r.h[r.i],bjUp(r.d[0]),r);
        if(a==='hit')bjHit(r,draw);else if(a==='stand')bjStand(r);else if(a==='double')bjDbl(r,draw);else if(a==='split')bjSplit(r,draw);else bjSurr(r)}
    bjDealer(r,draw);st+=r.stake;bk+=bjPay(r)}
  return bk/st}
// table state. ph: bet, ins (insurance offer), play, reveal, done
const bj={sh:bjNewShoe(),r:null,ph:'bet',bet:0,last:0,msg:'Place your bet.',busy:0,open:0,hint:0,counting:0,n:0,gen:0,seen:new WeakSet()};
function bjDraw(){noise(.05,6000,.08);const c=bjTake(bj.sh);c.n=++bj.n;return c}
function bjFaceHTML(c){const tl=`<i class=ix>${c.r}<b>${c.su}</b></i>`,br=`<i class="ix bt">${c.r}<b>${c.su}</b></i>`;
  if('JQK'.includes(c.r))return tl+br+`<em class=fc>${c.r}</em><em class=fs>${c.su}</em>`;
  if(c.r==='A')return tl+br+`<em class=pa>${c.su}</em>`;
  return tl+br+PIPS[bjPip(c)].map(([x,y])=>`<em class="p${y>50?' u':''}" style="left:${x}%;top:${y}%">${c.su}</em>`).join('')}
function bjCard(c,down){const e=document.createElement('div');e.className='pc';const red=c.su==='♥'||c.su==='♦';
  e.innerHTML=`<div class="pi${down?' fd':''}"><div class="face${red?' red':''}">${bjFaceHTML(c)}</div><div class="bk"></div></div>`;return e}
function bjShow(c,down){const e=bjCard(c,down);if(!bj.seen.has(c)){bj.seen.add(c);e.dataset.new=c.n||0}return e}
// new cards fly from the shoe, in the order they were drawn
function bjFlyIn(){const s=$('bjShoe').getBoundingClientRect(),sx=s.left+s.width/2,sy=s.top+s.height/2;
  const nw=[...$('bj').querySelectorAll('[data-new]')].sort((a,b)=>a.dataset.new-b.dataset.new);
  nw.forEach((el,i)=>{el.removeAttribute('data-new');const r=el.getBoundingClientRect(),dx=sx-(r.left+r.width/2),dy=sy-(r.top+r.height/2);
    el.animate([{transform:`translate(${dx}px,${dy}px) rotate(-10deg) scale(.8)`,opacity:0},{transform:'none',opacity:1}],{duration:480,delay:reduced?0:i*180,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'})})}
function bjHandEl(h,i,n){const b=document.createElement('div');b.className='bjHand'+(h&&bj.ph==='play'&&bj.r.i===i?' act':'');
  const hd=document.createElement('div');hd.className='hand n'+(n>=4?4:n);if(h)h.c.forEach(c=>hd.appendChild(bjShow(c,false)));
  const tot=document.createElement('b');tot.className='bjTot';if(h&&h.c.length){const v=bjVal(h.c);tot.textContent=v>21?'Bust':v}
  const sp=document.createElement('div');sp.className='bjSpot';sp.dataset.t=h?'':'Bet here';const amt=h?h.bet:bj.bet;if(amt)sp.appendChild(chipStack(amt));
  const rs=document.createElement('div');rs.className='bjRes';
  if(h&&h.res){const net=h.win-h.bet;rs.textContent=h.res+(net>0?' +'+money(net):net<0?' -'+money(-net):'');if(net)rs.classList.add(net>0?'win':'lose')}
  if(h)b.append(hd);b.append(tot,sp,rs);return b}
function bjRender(){
  if(bjSh){tRender();return}if(tStrip)tStrip.hidden=true;if(tagSolo!==null){tagText().textContent=tagSolo;tagSolo=null}
  const ph=bj.ph,r=ph==='bet'?null:bj.r,hide=!bj.open&&(ph==='play'||ph==='ins'||ph==='reveal');
  if(!bj.counting)$('bjCash').textContent=money(me.cash);
  $('bjLim').textContent=`${money(BJMIN)} to ${money(BJMAX*tableK)}`;$('bjT').textContent=tableK>1?'High-limit blackjack':'Blackjack';
  $('bjLeft').textContent=bj.sh.used>=BJCUT?'Cut card out, reshuffle next hand':`${BJCUT-bj.sh.used} cards to the cut`;
  $('bjShoe').classList.toggle('cut',bj.sh.used>=BJCUT);
  const D=$('bjD');D.replaceChildren();if(r)r.d.forEach((c,i)=>D.appendChild(bjShow(c,hide&&i===1)));
  $('bjDv').textContent=!r?'':hide?String(bjVal([r.d[0]])):String(bjVal(r.d));
  const P=$('bjP');P.replaceChildren();if(!r)P.appendChild(bjHandEl(null,0,0));else r.h.forEach((h,i)=>P.appendChild(bjHandEl(h,i,r.h.length)));
  bjFlyIn();
  const act=ph==='play'&&!bj.busy?r.h[r.i]:null,hintA=bj.hint&&act?bjStrat(act,bjUp(r.d[0]),r):'';
  $('bjHint').textContent=hintA?`Basic strategy: ${BJN[hintA]}`:'';
  $('bjHintT').textContent=bj.hint?'Hints on':'Hints off';
  $('bjMsg').textContent=bj.msg;
  const Bt=$('bjBtns');Bt.replaceChildren();const cash=me.cash;
  const btn=(t,fn,dis,cls,a)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.disabled=!!dis||!!bj.busy;if(cls)b.className=cls;if(a){b.dataset.a=a;if(a===hintA)b.classList.add('hint')}b.onclick=()=>fn(b);Bt.appendChild(b);return b};
  if(ph==='bet'){for(const v of[10,50,100,500])btn('+$'+v,b=>bjChip(v,b),bj.bet+v>Math.min(BJMAX*tableK,cash),'chip');btn('Clear',()=>{bj.bet=0;bjRender()},!bj.bet);btn(`Deal ${money(bj.bet)}`,bjDeal,bj.bet<BJMIN||bj.bet>cash||bj.bet>BJMAX*tableK,'go')}
  else if(ph==='ins'){const a=Math.floor(r.h[0].bet/2);btn(`Insurance ${money(a)}`,()=>bjIns(1),a>cash,'chip');btn('No insurance',()=>bjIns(0))}
  else if(ph==='play'){const h=r.h[r.i],ok=h.c.length===2,pr=cash>=h.bet;
    btn('Hit',()=>bjAct('hit'),false,'go','hit');btn('Stand',()=>bjAct('stand'),false,'','stand');
    btn('Double',()=>bjAct('double'),!ok||!pr,'','double');
    btn('Split',()=>bjAct('split'),!(ok&&h.c[0].r===h.c[1].r&&r.h.length<4&&pr),'','split');
    btn('Surrender',()=>bjAct('surr'),!(ok&&r.h.length===1&&!h.sp),'','surr')}
  else if(ph==='done'){btn(`Same bet ${money(bj.last)}`,()=>{bj.ph='bet';bj.bet=bj.last;bjDeal()},bj.last<BJMIN||bj.last>cash||bj.last>BJMAX*tableK,'go');
    btn('Change bet',()=>{bj.ph='bet';bj.bet=0;bj.r=null;bj.open=0;bj.msg='Place your bet.';bjRender()})}
}
function bjChip(v,b){if(bj.ph!=='bet')return;const f=b.getBoundingClientRect();bj.bet+=v;bjRender();
  const s=$('bjP').querySelector('.bjSpot');if(!s)return;const t=s.getBoundingClientRect(),el=chipEl(v);
  el.style.cssText=`position:fixed;z-index:9;left:${f.left}px;top:${f.top}px`;document.body.append(el);fly(el,f,t,320).onfinish=()=>el.remove();noise(.04,6000,.06)}
async function bjDeal(){
  if(bj.ph!=='bet'||bj.busy||bj.bet<BJMIN||bj.bet>BJMAX*tableK||bj.bet>me.cash)return;
  if(bj.sh.used>=BJCUT)bj.sh=bjNewShoe();
  const g=bj.gen;
  bj.busy=1;me.cash-=bj.bet;saveArsenal(); // the wager is real from the moment the cards come out
  bj.last=bj.bet;bj.open=0;bj.r=bjNewRound(bj.bet,bjDraw);bj.ph='play';bj.msg='';
  if(bj.r.d[0].r==='A'){bj.ph='ins';bj.msg='Dealer shows an ace. Insurance pays 2 to 1.'}
  bjRender();await wait(700);if(bj.gen!==g)return;bj.busy=0;
  if(bj.ph==='ins'){bjRender();return}
  if(bj.ph!=='play')return;
  if(bjNat(bj.r.d)||bjNat(bj.r.h[0].c))await bjSettle();else bjRender()}
async function bjIns(take){if(bj.ph!=='ins')return;const r=bj.r,a=Math.floor(r.h[0].bet/2);
  if(take&&a<=me.cash){me.cash-=a;r.ins=a;r.stake+=a}
  bj.ph='play';bj.msg=r.ins?'Insurance bought.':'No insurance.';
  if(bjNat(r.d)||bjNat(r.h[0].c)){await bjSettle();return}
  bjRender()}
async function bjAct(a){if(bj.ph!=='play'||bj.busy)return;const r=bj.r,s0=r.stake,g=bj.gen;
  if(a==='hit')bjHit(r,bjDraw);else if(a==='stand')bjStand(r);else if(a==='double')bjDbl(r,bjDraw);else if(a==='split')bjSplit(r,bjDraw);else bjSurr(r);
  me.cash-=r.stake-s0;if(r.stake!==s0)saveArsenal();noise(.05,6000,.07);bj.busy=1;bjRender();await wait(320);if(bj.gen!==g)return;bj.busy=0;
  if(bj.ph!=='play')return;
  if(bjNext(r))bjRender();else await bjSettle()}
// the dealer turns the hole card, draws, then pays out
async function bjSettle(){if(bj.ph==='reveal'||bj.ph==='done')return;const r=bj.r,g=bj.gen;bj.ph='reveal';bj.busy=1;bjRender();
  await wait(300);if(bj.gen!==g)return;bj.open=1;$('bjD').querySelector('.pi.fd')?.classList.remove('fd');
  await wait(500);if(bj.gen!==g)return;bjDealer(r,bjDraw);bjRender();await wait(650);if(bj.gen!==g)return;
  const back=bjPay(r),net=back-r.stake;me.cash+=back;bj.ph='done';bj.busy=1;bj.counting=1;
  bjRender();bjFlights(r);
  bj.msg=r.h.map(h=>h.res).join(' · ')+(net>0?' +'+money(net):net<0?' -'+money(-net):'');
  if(net>0){jingle(net>=500?'level':'pass');if(net>=500)feed(`Big win at blackjack: +${money(net)}`)}else tone('triangle',180,.35,.1);
  await countUp($('bjCash'),me.cash-back,me.cash,800);
  bj.counting=0;bj.busy=0;bj.bet=bj.last;saveArsenal();bjRender()}
// payout chips slide from the rack to winners, losing bets slide back to the rack
function bjFlights(r){const rk=$('bjRack').getBoundingClientRect(),sp=$('bj').querySelectorAll('.bjSpot');
  r.h.forEach((h,i)=>{const st=sp[i]&&sp[i].querySelector('.stk');if(!st)return;
    if(h.win>h.bet){const p=chipStack(h.win-h.bet);p.style.cssText='position:fixed;z-index:9';p.style.left=rk.left+'px';p.style.top=rk.top+'px';document.body.append(p);fly(p,rk,st.getBoundingClientRect(),700,i*120).onfinish=()=>p.remove()}
    else if(h.win===0){fly(st,st.getBoundingClientRect(),rk,650,150);st.animate([{opacity:1},{opacity:0}],{duration:650,delay:150,fill:'forwards'})}})}
// closing the table mid-hand stands every hand and pays out at once
function bjLeave(){if(bjSh)return tLeave();if(bj.ph!=='play'&&bj.ph!=='ins')return;const r=bj.r;for(const h of r.h)h.done=1;bj.open=1;bjDealer(r,bjDraw);me.cash+=bjPay(r);bj.ph='done';bj.busy=0;bj.counting=0;bj.bet=bj.last;saveArsenal()}
function openBJ(k=1){tableK=k;try{document.exitPointerLock&&document.exitPointerLock()}catch(_){}mouse.down=false;state='shop';bj.gen++;tKey='';
  bjSh=k===1&&tOn();if(bjSh){bj.ph='bet';bj.busy=0;bj.counting=0;tSitDown(false)}
  else if(bj.ph==='bet')bj.msg='Place your bet.'; // no shared-table chatter left on the solo felt
  if(bj.ph==='bet')bj.bet=Math.min(bj.bet,BJMAX*k,me.cash);$('bj').hidden=false;bjRender()}
$('bjClose').addEventListener('click',()=>closeShop());
$('bjHintT').addEventListener('click',()=>{bj.hint=bj.hint?0:1;bjRender()});
if(DBG)Object.defineProperties(DBG,{bj:{get:()=>bj}});

// ---------- shared blackjack table ----------
// The casino blackjack table (not high-limit) seats 4 players in the room. A seated player publishes seat = "i|bet|act|seq":
// act is w (ready to deal), h (hit), s (stand), d (double), or empty. seq counts requests, so a request is acted on once.
// The table host is the lowest peer id among the seated. The host deals from its shoe and publishes tb, the round: the dealer
// cards, and each seat's cards, bet, done flag and last seq it acted on. Each player pays its own hand from tb, so money
// moves only on its owner's client. A seat is held for TGRACE seconds after its player stops showing it (leave, walk away, downed).
// Shared play has no split, surrender or insurance, and the dealer does not peek. The solo table keeps all of them.
const TSEATS=4,TGRACE=5,TCODE={'♠':'S','♥':'H','♦':'D','♣':'C'},TSUIT={S:'♠',H:'♥',D:'♦',C:'♣'};
const tPeers=new Map(); // remote peer -> {j, bet, act, seq, t}
let tableSeats=[null,null,null,null]; // the seats held by remote players: {peer, j, bet, act, seq}
let tSit={j:-1,bet:0,act:'',seq:0,paid:0,rid:'',leaving:0}; // my seat. paid is what I have in the round now, rid its round id
let tagSolo=null; // the table rules line, kept while the shared table shows its own rules
const tagText=()=>document.querySelector('.bjtag').firstChild;
let tSeq=0,tShoe=null,tRound=null,tRemote=null,tRemoteT=0,tTimer=0,tRT=0,bjSh=false,tStrip=null,seatBot=null,tKey='';
const tSeen=new Map(); // host: last seq dealt per peer, so a ready request deals once
const tFakePub={};
const tEnc=c=>(c.r==='10'?'T':c.r)+TCODE[c.su];
const tDec=s=>{const m=typeof s==='string'&&/^([AT2-9JQK])([SHDC])$/.exec(s);return m?{r:m[1]==='T'?'10':m[1],su:TSUIT[m[2]]}:null};
const tCards=(s,n)=>typeof s==='string'?s.split(',').slice(0,n).map(tDec).filter(Boolean):[];
const tOn=()=>!!room&&myPeer!=null;
const tMe=()=>String(myPeer);
function tHostPeer(){let lo=tSit.j>=0?tMe():null;for(const p of tPeers.keys())if(lo===null||p<lo)lo=p;return lo}
const tHostMe=()=>tSit.j>=0&&tHostPeer()===tMe();
const tCur=()=>tHostMe()?tRound:(tRemote&&time-tRemoteT<=TGRACE?tRemote:null);
// the host of a live round must keep publishing it, even when it has no bet of its own
const tMustHost=()=>tHostMe()&&!!tRound&&tRound.p===0;
const tMine=tb=>{const h=tb&&tSit.j>=0?tb.s[tSit.j]:null;return h&&h.o===tMe()?h:null};
// the dealer's hole card stays on the host until the reveal, so no client can peek at it in presence
const tbPub=()=>({i:tRound.i,p:tRound.p,d:(tRound.p===0?tRound.d.slice(0,1):tRound.d).map(tEnc).join(','),s:tRound.s.map(h=>h&&{o:h.o,c:h.c.map(tEnc).join(','),b:h.b,x:h.x,q:h.q})});
function tbParse(t){
  if(!t||typeof t!=='object'||typeof t.i!=='string'||!Array.isArray(t.s)||t.s.length!==TSEATS)return null;
  return{i:t.i.slice(0,24),p:t.p===1?1:0,t:0,d:tCards(t.d,12),s:t.s.map(h=>h&&typeof h==='object'&&typeof h.o==='string'?{o:h.o.slice(0,40),c:tCards(h.c,12),b:clamp(Math.floor(num(h.b)),0,BJMAX*2),x:h.x?1:0,q:Math.floor(num(h.q,-1))}:null)};
}
// presence in: a seat claim (a downed player stops refreshing, so the seat lapses after TGRACE) and the host's round
function tIn(peer,seat,tb,downed){
  peer=String(peer);
  const q=typeof seat==='string'?seat.split('|'):[];
  if(q.length===4&&!downed){const j=+q[0],bet=+q[1],seq=+q[3];
    if(Number.isInteger(j)&&j>=0&&j<TSEATS&&Number.isFinite(bet)&&Number.isInteger(seq)&&seq>=0)tPeers.set(peer,{j,bet:clamp(Math.floor(bet),0,BJMAX),act:/^[whsd]$/.test(q[2])?q[2]:'',seq,t:time})}
  if(peer===tHostPeer()){ // only the elected host's round counts
    if(tb){if(tPeers.has(peer)){tRemote=tbParse(tb);tRemoteT=time}}
    else if(tRemote&&!tSit.paid){tRemote=null;tRemoteT=0} // round over and settled: back to betting at once
  }
}
function tSeatsNow(){const a=[null,null,null,null];for(const p of [...tPeers.keys()].sort()){const e=tPeers.get(p);if(!a[e.j])a[e.j]={peer:p,j:e.j,bet:e.bet,act:e.act,seq:e.seq}}return a}
function tSitDown(quiet){
  if(tSit.j>=0){tSit.leaving=0;return true}
  const j=tSeatsNow().indexOf(null);
  if(j<0){if(!quiet)feed('The table is full. You can watch, and sit when a seat frees');return false}
  tSit={...tSit,j,leaving:0};return true}
const tSitClear=()=>{tSit={...tSit,j:-1,bet:0,act:'',paid:0,rid:'',leaving:0}};
// my requests. Each one gets a new seq; the host acts on it once.
function tPlace(){if(tSit.j<0||tSit.act||tSit.paid||bj.bet<BJMIN||bj.bet>BJMAX||bj.bet>me.cash)return;
  tSit.bet=bj.bet;tSit.act='w';tSit.seq=++tSeq;bj.msg='Waiting for the deal.';pubT=1;tRender()}
function tAct(a){const tb=tCur(),h=tMine(tb);if(!h||!tb||tb.p!==0||h.x||tSit.act)return;
  if(a==='d'&&(h.c.length!==2||me.cash<h.b))return;
  tSit.act=a;tSit.seq=++tSeq;pubT=1;tRender()}
// walking away: a bet not yet dealt comes back at once. A dealt hand stands, and the seat stays until the round pays.
function tLeave(){bjSh=false;if(tSit.j<0)return;if(tSit.paid||tMustHost())tSit.leaving=1;else tSitClear()}
function tTake(){if(!tShoe||!tShoe.c.length)tShoe=bjNewShoe();return bjTake(tShoe)}
function tDeal(rd){
  if(!tShoe||tShoe.used>=BJCUT)tShoe=bjNewShoe();
  tRound={i:Math.random().toString(36).slice(2,10),p:0,t:0,d:[],s:[null,null,null,null]};
  for(const e of rd)if(!tRound.s[e.j]){tRound.s[e.j]={o:e.peer,c:[],b:e.bet,x:0,q:e.seq};tSeen.set(e.peer,e.seq)}
  for(let k=0;k<2;k++){for(const h of tRound.s)if(h)h.c.push(tTake());tRound.d.push(tTake())}
  for(const h of tRound.s)if(h&&bjNat(h.c))h.x=1;
}
// host only: deal once every seat is ready (or after 10 s), act on requests, then the dealer plays and the round ends
function tHostStep(dt){
  const L=[];for(const[p,e]of tPeers)L.push({peer:p,j:e.j,bet:e.bet,act:e.act,seq:e.seq});
  L.push({peer:tMe(),j:tSit.j,bet:tSit.bet,act:tSit.act,seq:tSit.seq});
  if(!tRound){
    const rd=L.filter(e=>e.act==='w'&&e.bet>=BJMIN&&e.seq>(tSeen.get(e.peer)??-1));
    if(!rd.length){tTimer=0;return}
    if((tTimer+=dt)<10&&rd.length<L.length)return;
    tTimer=0;tDeal(rd);return;
  }
  if(tRound.p===1){if(time-tRound.t>4)tRound=null;return}
  for(let j=0;j<TSEATS;j++){const h=tRound.s[j];if(!h||h.x)continue;
    const e=L.find(v=>v.j===j&&v.peer===h.o);
    if(!e){h.x=1;continue}
    if(e.seq<=h.q||e.act===''||e.act==='w'){h.lt=(h.lt||0)+dt;if(h.lt>20)h.x=1;continue} // a player who never acts stands after 20 s
    h.q=e.seq;h.lt=0;
    if(e.act==='s')h.x=1;
    else if(e.act==='h'){h.c.push(tTake());if(bjVal(h.c)>=21)h.x=1}
    else if(e.act==='d'&&h.c.length===2){h.b*=2;h.c.push(tTake());h.x=1}
  }
  if(tRound.s.every(h=>!h||h.x)){bjDealer({h:tRound.s.filter(Boolean).map(h=>({c:h.c,surr:0})),d:tRound.d},tTake);tRound.p=1;tRound.t=time}
}
// every client: seat conflicts, the host step, my bet and payout from tb, and the seat lapse
function tFrame(dt){
  for(const[p,e]of tPeers)if(time-e.t>TGRACE)tPeers.delete(p);
  if(tOn()){
    if(tSit.j>=0&&!tSit.paid)for(const[p,e]of tPeers)if(e.j===tSit.j&&p<tMe()){tSit.j=-1;tSit.act='';break}
    if(bjSh&&tSit.j<0&&!tSit.leaving)tSitDown(true);
  }
  tableSeats=tSeatsNow();
  if(!tOn())return;
  if(tHostMe())tHostStep(dt);
  const tb=tCur(),h=tMine(tb);
  if(tSit.act==='w'&&h&&h.q>=tSit.seq){tSit.act='';me.cash-=h.b;saveArsenal();tSit.paid=h.b;tSit.rid=tb.i}
  else if(tSit.act&&h&&h.q>=tSit.seq)tSit.act='';
  if(tSit.paid){
    if(!tb||tb.i!==tSit.rid||!h){me.cash+=tSit.paid;bj.msg='The round was cut short. Your bet came back.';feed(bj.msg);tSit.paid=0;tSit.rid='';tSit.act='';if(tSit.leaving&&!tMustHost())tSitClear()}
    else{
      if(h.b>tSit.paid){const dlt=h.b-tSit.paid;if(dlt>=me.cash){me.cash=0;feed('The double took the last of your cash')}else me.cash-=dlt;tSit.paid=h.b}
      if(tSit.leaving&&!tSit.act&&!h.x&&tb.p===0){tSit.seq=++tSeq;tSit.act='s';pubT=1}
      if(tb.p===1){
        const r={h:[{c:h.c,bet:h.b,surr:0,win:0,res:''}],d:tb.d,ins:0},back=bjPay(r),net=back-tSit.paid;
        me.cash+=back;bj.msg=r.h[0].res+(net>0?' +'+money(net):net<0?' -'+money(-net):'');
        if(net>0)jingle('pass');else tone('triangle',180,.35,.1);
        saveArsenal();tSit.paid=0;tSit.rid='';if(tSit.leaving)tSitClear();
      }
    }
  }
  if(tSit.leaving&&!tSit.paid&&!tMustHost())tSitClear();
  if(bjSh&&!$('bj').hidden&&(tRT-=dt)<=0){tRT=.1;tRender()}
}
function tStripEl(){if(!tStrip){tStrip=document.createElement('div');tStrip.style.cssText='display:flex;flex-wrap:wrap;gap:4px 14px;justify-content:center;font-size:13px;margin:4px 0';$('bjP').before(tStrip)}tStrip.hidden=false;return tStrip}
// the shared table view: dealer, my hand, the seat strip, and the buttons for my turn
function tRender(){
  const tb=tCur(),h=tMine(tb),busy=!!tb&&tb.p===0,cash=me.cash;
  // rebuild only when something visible changed: the old code tore the whole table down 10 times a second
  const key=[tagSolo!==null?1:0,tb?tb.i+'|'+tb.p:'',h?h.c.map(c=>c.r+c.su).join(',')+'|'+h.x+'|'+h.b:'-',tSit.j,tSit.act,tSit.paid,tSit.leaving,Math.round(cash),bj.bet,bj.msg,bj.hint,
    tableSeats.map(e=>e?e.peer+','+e.bet+','+e.act+','+e.seq:'-').join(';')].join('~');
  if(key===tKey)return;tKey=key;
  if(tagSolo===null){tagSolo=tagText().textContent;tagText().textContent='Dealer stands on 17. Blackjack pays 3 to 2. No insurance, split or surrender at a shared table. Cash '}
  $('bjCash').textContent=money(cash);$('bjLim').textContent=`${money(BJMIN)} to ${money(BJMAX)}`;
  $('bjLeft').textContent=`${tableSeats.filter(Boolean).length+(tSit.j>=0?1:0)} of ${TSEATS} seated`;
  const D=$('bjD');D.replaceChildren();if(tb)tb.d.forEach((c,i)=>D.appendChild(bjCard(c,busy&&i===1)));
  $('bjDv').textContent=!tb?'':busy?String(bjVal([tb.d[0]])):String(bjVal(tb.d));
  const P=$('bjP');P.replaceChildren();
  if(h){const b=document.createElement('div');b.className='bjHand';const hd=document.createElement('div');hd.className='hand n'+Math.min(4,h.c.length);
    h.c.forEach(c=>hd.appendChild(bjCard(c,false)));const t=document.createElement('b');t.className='bjTot';const v=bjVal(h.c);t.textContent=v>21?'Bust':v;
    const sp=document.createElement('div');sp.className='bjSpot';sp.appendChild(chipStack(h.b));const rs=document.createElement('div');rs.className='bjRes';
    if(tb.p===1){const r={h:[{c:h.c,bet:h.b,surr:0,win:0,res:''}],d:tb.d,ins:0};bjPay(r);rs.textContent=r.h[0].res}
    b.append(hd,t,sp,rs);P.appendChild(b)}
  else if(tSit.j>=0){const sp=document.createElement('div');sp.className='bjSpot';sp.dataset.t='Bet here';if(bj.bet)sp.appendChild(chipStack(bj.bet));P.appendChild(sp)}
  const strip=tStripEl();strip.replaceChildren();
  for(let j=0;j<TSEATS;j++){const e=j===tSit.j?{mine:1,bet:tSit.bet}:tableSeats[j],c=document.createElement('span');
    const who=e?(e.mine?myName+' (you)':((remotes.get(e.peer)||{}).name||'Player')):'Empty seat';
    const cs=tb&&tb.s[j]?tb.s[j].c.map(x=>x.r+x.su).join(' '):'';
    c.textContent=`${j+1}: ${who}${e&&e.bet?' · '+money(e.bet):''}${cs?' · '+cs:''}`;strip.appendChild(c)}
  const Bt=$('bjBtns');Bt.replaceChildren();
  const btn=(t,fn,dis,cls)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.disabled=!!dis;if(cls)b.className=cls;b.onclick=()=>fn(b);Bt.appendChild(b)};
  let msg=bj.msg;const can=!!h&&!h.x&&busy&&!tSit.act&&!tSit.leaving;
  if(tSit.j<0)msg=tableSeats.every(Boolean)?'Every seat is taken. You can watch.':'Sitting down.';
  else if(tSit.act==='w')msg='Waiting for the deal.';
  else if(tSit.paid){msg=can?'Your move.':'Waiting for the other players.';
    if(can){btn('Hit',()=>tAct('h'),false,'go');btn('Stand',()=>tAct('s'));btn('Double',()=>tAct('d'),h.c.length!==2||cash<h.b)}}
  else if(!h){for(const v of[10,50,100,500])btn('+$'+v,b=>bjChip(v,b),bj.bet+v>Math.min(BJMAX,cash),'chip');
    btn('Clear',()=>{bj.bet=0;tRender()},!bj.bet);btn(`Deal ${money(bj.bet)}`,tPlace,bj.bet<BJMIN||bj.bet>cash||busy,'go')}
  $('bjMsg').textContent=msg;$('bjHint').textContent='';$('bjHintT').textContent=bj.hint?'Hints on':'Hints off';
}
// test hook (DBG): a fake remote player (default 'aaa') in seat 0 with a bet of 100, ready to deal. Its presence is seatBot.presence.
// What this player publishes lands in fakePub.
if(DBG)DBG.seatTest=(peer='aaa',seat='0|100|w|1')=>{
  seatBot={peer,kind:'viewer',presence:{n:'Tester',c:'#3dd68c',pv:PV,v:0,x:0,y:0,seat:seat||null}};
  room={presence:p=>{Object.assign(tFakePub,p);return Promise.resolve()},peers:()=>{seatBot.presence.x=me.x+20;seatBot.presence.y=me.y;return[{peer:'me',sameTab:true},seatBot]}};
  syncRoom(0);tFrame(0);return seatBot};
if(DBG)Object.defineProperties(DBG,{seats:{get:()=>tableSeats},tRound:{get:()=>tRound},tSit:{get:()=>tSit},seatBot:{get:()=>seatBot},fakePub:{get:()=>tFakePub},
  tDbg:{get:()=>({myPeer,host:tHostPeer(),hostMe:tHostMe(),timer:+tTimer.toFixed(2),peers:[...tPeers].map(([p,e])=>p+':'+e.j+':'+e.act+':'+e.bet+':'+e.seq),seen:[...tSeen]})}});

// ---------- VIP booth ----------
function startLap(){if(lap)return;if(me.cash<100){feed('A private dance costs $100');return}me.cash-=100;lap={t:0,dur:20};state='cut';me.vx=me.vy=0;me.x=club.ox+386;me.y=club.oy+305;me.a=-Math.PI/2;mouse.down=false;
  try{document.exitPointerLock&&document.exitPointerLock()}catch(_){}feed('Sit back and enjoy the show. Esc to leave early');noise(.2,4000,.12)}
function endLap(){if(!lap)return;lap=null;state='play';me.y=club.oy+262;me.hp=Math.min(BAL.playerHp,me.hp+15);feed('Worth every dollar. +15 health')}

// ---------- modals ----------
function openModal(id){if(wheelOpen)closeWheel(false);if(quickOpen)closeQuick();try{document.exitPointerLock&&document.exitPointerLock()}catch(_){}mouse.down=false;state='shop';$(id).hidden=false}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeShop()));
function mkBtn(parent,label,fn,cls,dis){const b=document.createElement('button');b.type='button';b.className='b'+(cls?' '+cls:'');b.textContent=label;b.disabled=!!dis;b.addEventListener('click',fn);parent.appendChild(b);return b}
function casinoAct(p){if(p.act==='roulette'){tableK=1;openModal('roul');renderRoul();return true}
  if(p.act==='wheel'){openLucky();return true}
  if(p.act==='rocket'){openRocket();return true}
  if(p.act==='poker'){openTCP();return true}
  if(p.act==='horse'){openHorses();return true}
  if(p.act==='hlbj'){if(hlGate())openBJ(10);return true}
  if(p.act==='hlro'){if(hlGate()){tableK=10;openModal('roul');renderRoul()}return true}
  if(p.act==='slots'){tableK=1;openModal('slots');casinoOpenSlots();return true}
  if(p.act==='slots7'){tableK=1;openModal('slots7');s7.skip=false;s7UI();slStart();$('s7Act').querySelector('.go')?.focus();return true}return false}

// ---------- roulette ----------
const RO_ORDER=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const REDS=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const RO_MAX=10000,RO_CHIPS=[10,50,100,500,1000],RR=(a,b)=>Array.from({length:Math.max(0,b-a+1)},(_,i)=>a+i),md=x=>((x%TAU)+TAU)%TAU;
// bet keys: n<num> straight, s<a>-<b> split, t<a> street, q<a> corner, l<a> six line, d1-d3 dozens, c1-c3 columns, red black odd even low high
const ROCV={};
function roCov(k){let c=ROCV[k];if(!c){const a=+k.slice(1),all=RR(1,36),o={red:[...REDS],black:all.filter(n=>!REDS.has(n)),odd:all.filter(n=>n%2),even:all.filter(n=>n%2===0),low:RR(1,18),high:RR(19,36)};
  c=o[k]||({n:[a],s:k.slice(1).split('-').map(Number),t:RR(a,a+2),q:[a,a+1,a+3,a+4],l:RR(a,a+5),d:RR((a-1)*12+1,a*12),c:all.filter(n=>n%3===a%3)})[k[0]];ROCV[k]=c}return c}
const roHit=(k,n)=>roCov(k).includes(n),roMult=k=>36/roCov(k).length;
// money back (stake included) for bets {key: amount} on winning number n. Used by the table and by rouletteRTP.
function roPay(bets,n){let w=0;for(const k in bets)if(roHit(k,n))w+=bets[k]*roMult(k);return w}
// board in cell units: 13 columns (zero, then 12 number columns) by 3 rows. Each inside bet has an anchor point.
const RX=n=>Math.ceil(n/3)+.5,RY=n=>n%3===1?2.5:n%3===2?1.5:.5;
const RO_ANC={n0:[.5,1.5],'s0-1':[1,2.5],'s0-2':[1,1.5],'s0-3':[1,.5]};
for(let n=1;n<=36;n++)RO_ANC['n'+n]=[RX(n),RY(n)];
for(let n=1;n<=33;n++)RO_ANC[`s${n}-${n+3}`]=[Math.ceil(n/3)+1,RY(n)];
for(let n=1;n<=35;n++)if(n%3)RO_ANC[`s${n}-${n+1}`]=[RX(n),(RY(n)+RY(n+1))/2];
for(let a=1;a<=32;a++)if(a%3)RO_ANC['q'+a]=[Math.ceil(a/3)+1,(RY(a)+RY(a+1))/2];
for(let c=1;c<=12;c++)RO_ANC['t'+(3*c-2)]=[c+.5,3];
for(let c=1;c<=11;c++)RO_ANC['l'+(3*c-2)]=[c+1,3];
const RO_OUT=['red','black','odd','even','low','high','d1','d2','d3','c1','c2','c3'],RO_KEYS=[...Object.keys(RO_ANC),...RO_OUT];
// nearest anchor to a point in cell units, within 0.9 cells
function roNear(x,y){let best,bd=.9;for(const k in RO_ANC){const d=Math.hypot(RO_ANC[k][0]-x,RO_ANC[k][1]-y);if(d<bd){bd=d;best=k}}return best}
function roPick(e){const p=$('rNums').getBoundingClientRect();return roNear((e.clientX-p.left)/p.width*13,(e.clientY-p.top)/p.height*3)}
// wheel: drawn once, then rotated each frame with the ball on top
const RWH=document.createElement('canvas');RWH.width=RWH.height=400;
{const g=RWH.getContext('2d'),seg=TAU/37;g.translate(200,200);
 g.fillStyle='#4a2e18';g.beginPath();g.arc(0,0,199,0,TAU);g.fill();
 g.fillStyle='#c9a24a';g.beginPath();g.arc(0,0,192,0,TAU);g.fill();
 for(let i=0;i<37;i++){const n=RO_ORDER[i],a0=-Math.PI/2+i*seg-seg/2;g.fillStyle=n===0?'#1f8a4c':REDS.has(n)?'#b3202f':'#16121f';
   g.beginPath();g.arc(0,0,186,a0,a0+seg);g.arc(0,0,130,a0+seg,a0,true);g.closePath();g.fill();
   g.strokeStyle='#e9d28a';g.lineWidth=1.5;g.beginPath();g.moveTo(Math.cos(a0)*130,Math.sin(a0)*130);g.lineTo(Math.cos(a0)*186,Math.sin(a0)*186);g.stroke();
   g.save();g.rotate(a0+seg/2+Math.PI/2);g.fillStyle='#fff';g.font='700 19px sans-serif';g.textAlign='center';g.fillText(String(n),0,-160);g.restore()}
 const cone=g.createRadialGradient(0,0,10,0,0,118);cone.addColorStop(0,'#5b3d22');cone.addColorStop(1,'#1d140c');
 g.fillStyle=cone;g.beginPath();g.arc(0,0,118,0,TAU);g.fill();
 const hub=g.createRadialGradient(-6,-6,2,0,0,24);hub.addColorStop(0,'#fff3b8');hub.addColorStop(1,'#c58d1b');
 g.fillStyle=hub;g.beginPath();g.arc(0,0,24,0,TAU);g.fill()}
// ball radius over t (0..1): rides the rim, drops into the pocket ring with bounces, settles
function roR(t){if(t<.55)return 182;if(t<.8){const s=(t-.55)/.25;return 146+36*(1-s)**2+5*Math.abs(Math.sin(3*Math.PI*s))*(1-s)}const s=(t-.8)/.2;return 146+3*Math.abs(Math.sin(4*Math.PI*s))*(1-s)}
const ro={chip:10,bets:{},lastBets:null,spinning:false,sw:0,a:0,b:null,r:182,hist:[],ob:{},msg:'Pick a chip, then tap the table to bet.'};
function roDraw(){const g=$('rwheel').getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,400,400);
  g.translate(200,200);g.rotate(ro.a);g.drawImage(RWH,-200,-200);g.rotate(-ro.a);
  if(ro.b!=null){const x=Math.cos(ro.b)*ro.r,y=Math.sin(ro.b)*ro.r;
    g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.arc(x+2,y+4,9,0,TAU);g.fill();
    const gr=g.createRadialGradient(x-3,y-3,1,x,y,9);gr.addColorStop(0,'#ffffff');gr.addColorStop(1,'#b9b4c9');
    g.fillStyle=gr;g.beginPath();g.arc(x,y,8,0,TAU);g.fill()}}
// board DOM is built once. Number cells are divs (not buttons) so clicks use the pointer position.
const RO_CELL={};
{const N=$('rNums');RO_CELL[0]=$('rZero');
 for(let n=1;n<=36;n++){const b=document.createElement('div');b.className='cell '+(REDS.has(n)?'r':'k');b.textContent=n;
   b.style.gridColumn=String(Math.ceil(n/3)+1);b.style.gridRow=String(n%3===0?1:n%3===2?2:3);RO_CELL[n]=b;N.appendChild(b)}
 N.addEventListener('click',e=>{const k=roPick(e);if(k)roBet(k)});
 N.addEventListener('contextmenu',e=>{e.preventDefault();const k=roPick(e);if(k)roPull(k)});
 N.addEventListener('pointermove',e=>{const k=roPick(e),h=$('rHov');h.hidden=!k;if(k){h.style.left=RO_ANC[k][0]/13*100+'%';h.style.top=RO_ANC[k][1]/3*100+'%'}});
 N.addEventListener('pointerleave',()=>{$('rHov').hidden=true});
 const outBtn=(parent,k,l,cls)=>{const b=document.createElement('button');b.type='button';b.className='ob '+(cls||'');b.textContent=l;b.onclick=()=>roBet(k);b.oncontextmenu=e=>{e.preventDefault();roPull(k)};parent.appendChild(b);ro.ob[k]=b};
 for(const[k,l,c]of[['red','Red','r'],['black','Black','k'],['odd','Odd',''],['even','Even',''],['low','1–18',''],['high','19–36','']])outBtn($('rOut'),k,l,c);
 for(const[k,l]of[['d1','1st 12'],['d2','2nd 12'],['d3','3rd 12']])outBtn($('rDoz'),k,l);
 for(const[k,l]of[['c3','2:1'],['c2','2:1'],['c1','2:1']])outBtn($('rCols'),k,l)}
const roTotal=()=>Object.values(ro.bets).reduce((a,b)=>a+b,0);
function roBet(k){if(ro.spinning||ro.sw)return;if(me.cash<ro.chip){ro.msg='Not enough cash for that chip.';renderRoul();return}
  if(roTotal()+ro.chip>RO_MAX*tableK){ro.msg=`Table limit is ${money(RO_MAX*tableK)} a spin.`;renderRoul();return}
  me.cash-=ro.chip;ro.bets[k]=(ro.bets[k]||0)+ro.chip;noise(.04,6000,.06);ro.msg='';renderRoul()}
// right-click takes the selected chip value back from a spot
function roPull(k){if(ro.spinning||ro.sw||!ro.bets[k])return;const a=Math.min(ro.chip,ro.bets[k]);ro.bets[k]-=a;me.cash+=a;if(!ro.bets[k])delete ro.bets[k];noise(.03,4000,.05);renderRoul()}
function roClear(){if(ro.spinning||ro.sw)return;for(const k in ro.bets)me.cash+=ro.bets[k];ro.bets={};renderRoul()}
function roRebet(){if(!ro.lastBets||ro.spinning||ro.sw)return;roClear();const tot=Object.values(ro.lastBets).reduce((a,b)=>a+b,0);
  if(tot>RO_MAX*tableK){ro.msg=`Table limit is ${money(RO_MAX*tableK)} a spin.`;renderRoul();return}
  if(tot>me.cash){ro.msg='Not enough cash to repeat.';renderRoul();return}me.cash-=tot;ro.bets={...ro.lastBets};renderRoul()}
// leaving the table takes any staged chips back: they were only ever in memory
function roLeave(){if(ro.spinning||ro.sw)return;const tot=roTotal();if(!tot)return;for(const k in ro.bets)me.cash+=ro.bets[k];ro.bets={};feed(`Your roulette bets came back (${money(tot)})`)}
function roDouble(){if(ro.spinning||ro.sw)return;const tot=roTotal();if(!tot)return;if(tot*2>RO_MAX*tableK){ro.msg=`Table limit is ${money(RO_MAX*tableK)} a spin.`;renderRoul();return}if(tot>me.cash){ro.msg='Not enough cash to double.';renderRoul();return}me.cash-=tot;for(const k in ro.bets)ro.bets[k]*=2;renderRoul()}
function roSpin(){if(ro.spinning)return;if(!roTotal()){ro.msg='Place a bet first.';renderRoul();return}
  if(roTotal()>RO_MAX*tableK){ro.msg=`Table limit is ${money(RO_MAX*tableK)} a spin.`;renderRoul();return}
  ro.spinning=true;ro.lastBets={...ro.bets};ro.msg='No more bets...';renderRoul();noise(1.4,900,.08);
  // decide the pocket first, then animate the wheel and ball to end with that pocket under the marker at the top
  const n=Math.floor(rand()*37),i=RO_ORDER.indexOf(n),w0=ro.a,dW=TAU*3+md(-i*TAU/37-w0),b0=-Math.PI/2+(rand()-.5)*.6*TAU/37,dB=TAU*6,T=reduced?1200:5000,t0=performance.now();
  const f=now=>{const t=Math.min(1,(now-t0)/T),e=1-(1-t)**3;ro.a=w0+dW*e;ro.b=b0+dB*(1-e);ro.r=roR(t);roDraw();if(t<1)requestAnimationFrame(f);else roDone(n)};
  requestAnimationFrame(f)}
function roDone(n){
  const tot=roTotal(),pay=roPay(ro.bets,n),net=pay-tot;
  ro.hist.unshift(n);if(ro.hist.length>100)ro.hist.length=100;
  ro.sw=1;const cell=RO_CELL[n];cell.classList.add('hit');
  // losing chips slide into the dealer's rake, winning chips glow
  const rk=$('rRake').getBoundingClientRect();
  for(const el of $('rBoard').querySelectorAll('.stk[data-k]')){
    if(roHit(el.dataset.k,n))el.classList.add('won');
    else{fly(el,el.getBoundingClientRect(),rk,650,250);el.animate([{opacity:1},{opacity:0}],{duration:650,delay:250,fill:'forwards'})}}
  const before=me.cash;me.cash+=pay;saveArsenal();
  if(net>0){jingle(net>=5000?'level':'pass');if(net>=5000)feed(`Roulette win: +${money(net)}`)}
  countUp($('rCash'),before,me.cash,900,v=>'Cash '+money(v));
  ro.msg=`${n} ${n===0?'green':REDS.has(n)?'red':'black'}. `+(net>0?`You win ${money(net)}!`:net===0?'You break even.':`You lose ${money(-net)}.`);
  $('rMsg').textContent=ro.msg;
  setTimeout(()=>{cell.classList.remove('hit');ro.bets={};ro.spinning=false;ro.sw=0;renderRoul()},1300)}
// chip stacks for the current bets: inside bets on their anchor, outside bets on their button
function roChips(){const ov=$('rOvl');ov.replaceChildren();
  for(const k in ro.ob)ro.ob[k].querySelectorAll('.stk').forEach(s=>s.remove());
  for(let n=0;n<=36;n++)RO_CELL[n].classList.toggle('on',!!ro.bets[cellK(n)]);
  for(const k in ro.bets){const st=chipStack(ro.bets[k]);st.dataset.k=k;
    if(RO_ANC[k]){const[a,b]=RO_ANC[k];st.style.left=`calc(${a/13*100}% - 13px)`;st.style.top=`calc(${b/3*100}% - 13px)`;ov.appendChild(st)}
    else{st.classList.add('ob');ro.ob[k].appendChild(st)}}
  for(const k of RO_OUT)ro.ob[k].classList.toggle('on',!!ro.bets[k])}
const cellK=n=>n===0?'n0':'n'+n;
function renderRoul(){
  const tot=roTotal();
  $('rMsg').textContent=ro.msg;
  if(!ro.sw){$('rCash').textContent=`Cash ${money(me.cash)}  Limit ${money(RO_MAX*tableK)}`;roChips()}
  $('rLim').textContent=`Table: ${money(10)} to ${money(RO_MAX*tableK)} a spin`;
  const H=$('rHist');H.replaceChildren();
  for(const n of ro.hist.slice(0,15)){const e=document.createElement('span');e.className='rh '+(n===0?'g':REDS.has(n)?'r':'k');e.textContent=n;H.appendChild(e)}
  const cnt=Array(37).fill(0);for(const n of ro.hist)cnt[n]++;
  const ord=[...Array(37).keys()].sort((a,b)=>cnt[b]-cnt[a]||a-b);
  $('rHot').textContent=ro.hist.length<10?'Hot and cold numbers show after 10 spins.':`Hot ${ord.slice(0,5).join(' · ')}   Cold ${ord.slice(-5).reverse().join(' · ')}`;
  const C=$('rChips');C.replaceChildren();
  for(const v of RO_CHIPS){const b=document.createElement('button');b.type='button';b.className=`cb c${v}${ro.chip===v?' on':''}`;b.textContent=v>=1000?'1K':'$'+v;b.onclick=()=>{ro.chip=v;renderRoul()};C.appendChild(b)}
  const A=$('rAct');A.replaceChildren();
  mkBtn(A,ro.spinning?'Spinning...':`Spin $${tot}`,roSpin,'go',ro.spinning||ro.sw||!tot);
  mkBtn(A,'Repeat last bet',roRebet,'',ro.spinning||ro.sw||!ro.lastBets);
  mkBtn(A,'Double',roDouble,'',ro.spinning||ro.sw||!tot);
  mkBtn(A,'Clear bets',roClear,'',ro.spinning||ro.sw||!tot)}
// rouletteRTP(n): random legal bets (1 to 4 spots, random chip each), returns money back / money staked
function roRandBets(){const b={},k=1+Math.floor(rand()*4);for(let j=0;j<k;j++){const key=RO_KEYS[Math.floor(rand()*RO_KEYS.length)];b[key]=(b[key]||0)+RO_CHIPS[Math.floor(rand()*RO_CHIPS.length)]}return b}
function rouletteRTP(n){let st=0,bk=0;for(let i=0;i<n;i++){const b=roRandBets();for(const k in b)st+=b[k];bk+=roPay(b,Math.floor(rand()*37))}return bk/st}
roDraw();renderRoul();
if(DBG)Object.defineProperties(DBG,{bjSim:{get:()=>bjSim},rouletteRTP:{get:()=>rouletteRTP},openBJ:{get:()=>openBJ}});
if(DBG)Object.defineProperties(DBG,{ro:{get:()=>ro}});

// ---------- Candy Cascade slots ----------
// Rules: 8 or more of one candy pays and tumbles away. 4 or more lollipops start 10 free spins, 3 or more in free spins add 5.
// candyRun() plays one view and returns every step. The animation replays those steps and slotRTP() counts the same results.
const CANDY=[{k:'banana',w:22,p:[.075,.18,.45],c:'#ffd83d'},{k:'grape',w:20,p:[.12,.24,.75],c:'#9b4dff'},{k:'melon',w:17,p:[.15,.3,1.2],c:'#ff4f6e'},{k:'apple',w:14,p:[.225,.45,1.8],c:'#ff3b3b'},{k:'sweet',w:11,p:[.375,.75,3],c:'#ff8fd6'},{k:'gem',w:8,p:[.75,1.8,6],c:'#49d8ff'},{k:'heart',w:5,p:[1.5,3.75,9],c:'#ff2d70'}];
const SCAT=7,BOMB=8,BOMBM=[2,2,3,3,4,5,6,6,7,8,12],SCATPAY=[3,5,20],SL_TRIG=4,SL_FREE=10,SL_RETRIG=3,SL_ADD=5;
const sl={el:$('slots'),bet:10,grid:[],feat:false,free:0,ftot:0,busy:false,msg:'Pick a bet and spin.',wv:0,shown:0,base:0,mult:0,flash:0,pt:[],coins:[],fly:[],sh:0,big:null,ban:null,click:null,skip:false,wq:[]};
const slCol=s=>s<7?CANDY[s].c:s===SCAT?'#ff8fd6':'#ffd23a';
function slSym(fs){const r=rand();if(r<.032)return{s:SCAT};if(fs&&r<.064)return{s:BOMB,m:BOMBM[(rand()*11)|0]};let t=rand()*97;for(let i=0;i<7;i++){t-=CANDY[i].w;if(t<=0)return{s:i}}return{s:0}}
// 8 or more of one candy anywhere pays. Pay is in bet multiples.
function candyHits(g){const by=[[],[],[],[],[],[],[]];for(const col of g)for(const c of col)if(c.s<7)by[c.s].push(c);
  const cells=[];let pay=0;for(let i=0;i<7;i++){const n=by[i].length;if(n>=8){pay+=CANDY[i].p[n>=12?2:n>=10?1:0];cells.push(...by[i])}}return{cells,pay}}
// One view. buy: put 4 lollipops on the first view (feature buy). Bombs multiply the cluster wins of the view they land in.
function candyRun(fs,buy){
  const g=[];for(let x=0;x<6;x++){const c=[];for(let y=0;y<5;y++)c.push(slSym(fs));g.push(c)}
  if(buy)for(let k=0;k<4;){const x=(rand()*6)|0,y=(rand()*5)|0;if(g[x][y].s!==SCAT){g[x][y]={s:SCAT};k++}}
  const init=g.map(c=>c.slice()),scat=init.flat().filter(c=>c.s===SCAT).length,steps=[];let base=0;
  for(let guard=0;guard<25;guard++){const h=candyHits(g);if(!h.cells.length)break;
    const hit=new Set(h.cells);
    for(let x=0;x<6;x++){const keep=g[x].filter(c=>!hit.has(c));while(keep.length<5)keep.unshift(slSym(fs));g[x]=keep}
    steps.push({hit:h.cells,pay:h.pay,after:g.map(c=>c.slice())});base+=h.pay}
  const bombs=g.flat().filter(c=>c.s===BOMB),mul=bombs.reduce((a,c)=>a+c.m,0),sp=scat>=SL_TRIG?SCATPAY[Math.min(scat,6)-SL_TRIG]:0;
  return{init,steps,bombs,base,mul:bombs.length?mul:1,sp,scat,total:base*(bombs.length?mul:1)+sp}}
// Free spins for a feature that starts now (buy: first view has the forced lollipops). Same rules as slView().
// Free-spin retrigger rule, shared by slFeat (sim) and slSpin (live). A view adds SL_ADD spins when it lands SL_RETRIG or more lollipops. A bought feature's first view never adds.
const slAdd=(r,first)=>!first&&r.scat>=SL_RETRIG?SL_ADD:0;
function slFeat(buy){let w=0,f=SL_FREE,first=buy;while(f>0){const q=candyRun(true,first);w+=q.total;f+=slAdd(q,first);first=false;f--}return w}
// Plays n spins with the same math and no animation, on a fixed seed so the numbers repeat. 'candy' is a base spin, 'candyBuy' is one feature bought (cost 45 bets), 'neon7' is one spin.
function slotRTP(m,n){
  if(!['candy','candyBuy','neon7'].includes(m))throw new Error('slotRTP: unknown machine '+m);
  let won=0,hit=0,feat=0;const keep=rand;rand=seeded(12345);
  try{for(let i=0;i<n;i++){let w;
    if(m==='neon7')w=n7Eval(n7Spin().a);
    else if(m==='candy'){const r=candyRun(false,false);w=r.total;if(r.scat>=SL_TRIG){feat++;w+=slFeat(false)}}
    else w=slFeat(true);
    won+=w;if(w>0)hit++}}
  finally{rand=keep}
  const cost=m==='candyBuy'?45:1;return{rtp:+(won/(n*cost)).toFixed(4),hitRate:+(hit/n).toFixed(4),featureRate:+(feat/n).toFixed(5)}}

// Timing. reduced motion shortens every wait and tween to a quick fade.
const slT=ms=>reduced?Math.min(ms,80):ms;
const T0=()=>AC?AC.currentTime:0;
const slWait=(m,ms)=>new Promise(r=>{if(m.skip)return r();m.wq.push([performance.now()+ms,r])});
// Closing the modal ends every wait and prompt at once, so the rest of the feature plays out and pays.
function slFlush(m){m.skip=true;const q=m.wq;m.wq=[];q.forEach(w=>w[1]());if(m.click){const f=m.click;m.click=null;f()}}
function slAsk(m,t,s,b){if(m.skip)return Promise.resolve();const o=$('slOv');o.querySelector('.t').textContent=t;o.querySelector('.s').textContent=s;o.querySelector('button').textContent=b;o.hidden=false;return new Promise(r=>{m.click=()=>{o.hidden=true;r()}})}
$('slOv').querySelector('button').onclick=()=>{const f=sl.click;sl.click=null;f&&f()};
let slRaf=0,slLast=0;
function slStart(){if(!slRaf)slRaf=requestAnimationFrame(slLoop)}
// One loop for both machines. It runs only while a slot modal is open.
function slLoop(now){slRaf=0;const dt=slLast?Math.min(.05,(now-slLast)/1000):0;slLast=now;let any=false;
  for(const m of [sl,s7]){if(m.el.hidden){if(!m.skip)slFlush(m);continue}any=true;m.skip=false;m.wq=m.wq.filter(w=>{if(w[0]>now)return true;w[1]();return false})}
  if(!sl.el.hidden)slDraw(sl,now,dt);
  if(!s7.el.hidden)s7Draw(now,dt);
  if(any)slRaf=requestAnimationFrame(slLoop);else slLast=0}
// Canvas sized to its CSS box. Drawing happens in 640-wide logical units.
function slFit(cv,W,H){const s=(cv.clientWidth||W)*(devicePixelRatio||1)/W,pw=Math.round(W*s),ph=Math.round(H*s);
  if(cv.width!==pw||cv.height!==ph){cv.width=pw;cv.height=ph}const g=cv.getContext('2d');g.setTransform(pw/W,0,0,pw/W,0,0);return g}
const slCellXY=(x,y)=>[29+x*98+46,104+y*64+30];
const slBounce=p=>{const n=7.5625,d=2.75;return p<1/d?n*p*p:p<2/d?n*(p-=1.5/d)*p+.75:p<2.5/d?n*(p-=2.25/d)*p+.9375:n*(p-=2.625/d)*p+.984375};
// Row position of a cell at time now. Cells move from fr to tr with cubic-out (e 0), bounce (e 1) or cubic-in (e 2).
function slPos(c,now){if(c.t0===undefined)return c.tr;const p=Math.min(1,Math.max(0,(now-c.t0)/c.dur)),e=c.e===2?p*p*p:c.e===1?slBounce(p):1-Math.pow(1-p,3);return c.fr+(c.tr-c.fr)*e}
function slPosOf(m,c){const t=performance.now();for(let x=0;x<6;x++){const y=m.grid[x].indexOf(c);if(y>=0)return slCellXY(x,slPos(c,t))}return[320,250]}
// Old cells drop out of the bottom, column by column. Returns ms until the last one is gone.
function slDropOut(m){const now=performance.now();let end=now;m.grid.forEach((col,x)=>col.forEach(c=>{c.fr=c.tr;c.tr=6;c.t0=now+x*slT(60);c.dur=slT(220);c.e=2;c.h=0;c.ant=0;end=Math.max(end,c.t0+c.dur)}));return end-now}
// Tweens grid G into place. Kept cells slide from their old row. New cells fall from above. ant: after 3 lollipops land, the rest slow down and glow.
function slFall(m,G,ant){const now=performance.now(),kept=new Set(m.grid.flat());let sc=0,t=0,hot=false,end=now;
  for(let x=0;x<6;x++){const col=G[x],k=col.filter(c=>!kept.has(c)).length,slow=ant&&sc>=3,dur=slT(slow?900:380);
    if(slow&&!hot){hot=true;tone('sawtooth',160,1.2,.06,T0()+t/1000,null,820)}
    col.forEach((c,y)=>{const old=kept.has(c);c.fr=old?c.tr:y-k;c.tr=y;c.t0=now+t;c.dur=dur;c.e=old?0:1;c.ant=slow?1:0});
    tone('square',1300+x*110,.05,.05,T0()+(t+dur)/1000);
    sc+=col.filter(c=>c.s===SCAT).length;
    end=Math.max(end,now+t+dur);t+=slow?300:70}
  m.grid=G;return end-now}
function slBurst(m,x,y,col,n){for(let i=0;i<n;i++){const a=rand()*TAU,s=rr(140,460);m.pt.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-180,l:0,max:slT(rr(450,900))/1000,c:col})}}
// Symbol art: vector shapes drawn once per size into offscreen canvases. Units are about -1.3 to 1.3 around the centre.
const SPR={};
function slSpr(k,S){S=Math.round(S/8)*8;const key=k+'|'+S;if(SPR[key])return SPR[key];const c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');g.setTransform(S/2.6,0,0,S/2.6,S/2,S/2);ART[k](g);return SPR[key]=c}
function slBody(g,path,stops,y0,y1){const S=g.canvas.width;g.save();g.shadowColor='rgba(40,0,30,.5)';g.shadowBlur=S*.05;g.shadowOffsetY=S*.035;path(g);const f=g.createLinearGradient(0,y0,0,y1);stops.forEach((c,i)=>f.addColorStop(i/(stops.length-1),c));g.fillStyle=f;g.fill();g.restore();
  g.save();path(g);g.clip();const h=g.createRadialGradient(-.3,-.42,0,-.3,-.42,.95);h.addColorStop(0,'rgba(255,255,255,.9)');h.addColorStop(.45,'rgba(255,255,255,.15)');h.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=h;g.fillRect(-1.5,-1.5,3,3);g.restore();
  path(g);g.lineWidth=.07;g.strokeStyle='rgba(255,255,255,.85)';g.stroke()}
const ART={
0:g=>{slBody(g,c=>{c.beginPath();c.moveTo(-.85,-.4);c.quadraticCurveTo(0,1.05,.85,-.55);c.quadraticCurveTo(.05,.45,-.85,-.4);c.closePath()},['#fffbd0','#ffd83d','#c98a00'],-.4,1);
  g.fillStyle='#5b3b00';for(const[x,y]of[[-.85,-.4],[.85,-.55]]){g.beginPath();g.arc(x,y,.09,0,TAU);g.fill()}},
1:g=>{const pts=[[0,-.6],[-.27,-.28],[.27,-.28],[-.54,.02],[0,.02],[.54,.02],[-.27,.32],[.27,.32]];
  g.strokeStyle='#5ac44a';g.lineWidth=.08;g.beginPath();g.moveTo(0,-.78);g.lineTo(.08,-1.05);g.stroke();
  g.fillStyle='#4fd36b';g.beginPath();g.ellipse(.36,-.92,.26,.12,-.5,0,TAU);g.fill();
  for(const[x,y]of pts){const f=g.createRadialGradient(x-.08,y-.09,.02,x,y,.26);f.addColorStop(0,'#eedcff');f.addColorStop(.35,'#9b4dff');f.addColorStop(1,'#2a0a5e');g.save();g.shadowColor='rgba(40,0,30,.5)';g.shadowBlur=g.canvas.width*.03;g.fillStyle=f;g.beginPath();g.arc(x,y,.24,0,TAU);g.fill();g.restore();
    g.fillStyle='rgba(255,255,255,.9)';g.beginPath();g.arc(x-.08,y-.09,.05,0,TAU);g.fill()}},
2:g=>{slBody(g,c=>{c.beginPath();c.arc(0,-.2,.95,0,Math.PI);c.closePath()},['#86f08a','#1f9d46','#0b5a2a'],-.2,.8);
  g.beginPath();g.arc(0,-.2,.8,0,Math.PI);g.closePath();const f=g.createLinearGradient(0,-.2,0,.6);f.addColorStop(0,'#ffd0d8');f.addColorStop(.25,'#ff5f7a');f.addColorStop(1,'#d8123f');g.fillStyle=f;g.fill();
  g.fillStyle='#2b0a12';for(const[x,y]of[[-.42,.12],[0,.2],[.42,.12],[-.22,.4],[.22,.4],[0,.56]]){g.beginPath();g.ellipse(x,y,.045,.085,0,0,TAU);g.fill()}},
3:g=>{const ap=c=>{c.beginPath();c.moveTo(0,-.42);c.bezierCurveTo(.22,-.68,.8,-.66,.8,.02);c.bezierCurveTo(.8,.62,.38,.92,0,.74);c.bezierCurveTo(-.38,.92,-.8,.62,-.8,.02);c.bezierCurveTo(-.8,-.66,-.22,-.68,0,-.42);c.closePath()};
  g.strokeStyle='#6b4423';g.lineWidth=.09;g.beginPath();g.moveTo(0,-.42);g.quadraticCurveTo(.02,-.7,.14,-.86);g.stroke();
  slBody(g,ap,['#ff9a9a','#e3132d','#7d0016'],-.7,.9);
  g.fillStyle='#4fd36b';g.beginPath();g.ellipse(.3,-.72,.26,.12,-.45,0,TAU);g.fill()},
4:g=>{const wr=s=>c=>{c.beginPath();c.moveTo(s*.4,-.14);c.lineTo(s*.98,-.46);c.lineTo(s*.98,.46);c.lineTo(s*.4,.14);c.closePath()};
  slBody(g,wr(-1),['#c9f8ff','#3bc8e8','#1b6fa0'],-.5,.5);slBody(g,wr(1),['#c9f8ff','#3bc8e8','#1b6fa0'],-.5,.5);
  slBody(g,c=>{c.beginPath();c.arc(0,0,.46,0,TAU)},['#fff3a6','#ff8fd6','#c4137a'],-.46,.46);
  g.strokeStyle='rgba(255,255,255,.8)';g.lineWidth=.07;g.beginPath();g.arc(0,0,.25,.4,4.4);g.stroke()},
5:g=>{const gm=c=>{c.beginPath();c.moveTo(-.75,-.25);c.lineTo(-.42,-.7);c.lineTo(.42,-.7);c.lineTo(.75,-.25);c.lineTo(0,.8);c.closePath()};
  slBody(g,gm,['#f2feff','#49d8ff','#1d5cff'],-.7,.8);
  g.strokeStyle='rgba(255,255,255,.6)';g.lineWidth=.035;g.beginPath();g.moveTo(-.75,-.25);g.lineTo(.75,-.25);g.moveTo(-.42,-.7);g.lineTo(-.2,-.25);g.moveTo(.42,-.7);g.lineTo(.2,-.25);g.moveTo(-.2,-.25);g.lineTo(0,.8);g.moveTo(.2,-.25);g.lineTo(0,.8);g.stroke();
  g.fillStyle='#fff';g.beginPath();g.arc(.5,-.5,.07,0,TAU);g.fill()},
6:g=>{slBody(g,c=>{c.beginPath();c.moveTo(0,.8);c.bezierCurveTo(-1.1,.05,-.72,-.92,0,-.36);c.bezierCurveTo(.72,-.92,1.1,.05,0,.8);c.closePath()},['#ffc2d6','#ff2d70','#8c0030'],-.9,.8)},
7:g=>{g.fillStyle='#f4eeff';g.fillRect(-.07,.5,.14,.8);
  slBody(g,c=>{c.beginPath();c.arc(0,-.05,.72,0,TAU)},['#ffffff','#ff7ad9','#b0107a'],-.8,.7);
  const cols=['#ffe14d','#3ee6ff','#ff4fa8','#8cff6a'];g.lineCap='round';g.lineWidth=.1;
  for(let i=0;i<40;i++){const a=i*.45,a2=(i+1)*.45,r=.05+i*.0135,r2=.05+(i+1)*.0135;g.strokeStyle=cols[i%4];g.beginPath();g.moveTo(Math.cos(a)*r,-.05+Math.sin(a)*r);g.lineTo(Math.cos(a2)*r2,-.05+Math.sin(a2)*r2);g.stroke()}},
8:g=>{g.strokeStyle='#c9a36b';g.lineWidth=.08;g.beginPath();g.moveTo(.3,-.5);g.quadraticCurveTo(.5,-.9,.78,-.92);g.stroke();
  slBody(g,c=>{c.beginPath();c.arc(-.05,.1,.66,0,TAU)},['#8a8aa0','#24242f','#050508'],-.5,.8);
  g.save();g.shadowColor='#ffb020';g.shadowBlur=g.canvas.width*.08;g.fillStyle='#ffd23a';g.beginPath();g.arc(.78,-.92,.13,0,TAU);g.fill();g.restore()},
n0:g=>{g.strokeStyle='#3dd68c';g.lineWidth=.09;g.beginPath();g.moveTo(-.42,.36);g.quadraticCurveTo(-.2,-.25,.18,-.78);g.moveTo(.42,.18);g.quadraticCurveTo(.25,-.2,.18,-.78);g.stroke();
  g.fillStyle='#3dd68c';g.beginPath();g.ellipse(.55,-.66,.32,.14,-.5,0,TAU);g.fill();
  slBody(g,c=>{c.beginPath();c.arc(-.42,.45,.36,0,TAU)},['#ffb3bf','#ff1f4b','#7a0019'],.1,.81);
  slBody(g,c=>{c.beginPath();c.arc(.42,.27,.36,0,TAU)},['#ffb3bf','#ff1f4b','#7a0019'],0,.72)},
n1:g=>{g.fillStyle='#3dd68c';g.beginPath();g.ellipse(.58,-.55,.3,.13,-.6,0,TAU);g.fill();
  slBody(g,c=>{c.beginPath();c.ellipse(0,0,.9,.66,0,0,TAU)},['#fffbc2','#ffe02e','#c99a00'],-.66,.66)},
n2:g=>{slBody(g,c=>{c.beginPath();c.roundRect(-.95,-.5,1.9,1,.18)},['#3a2f58','#16101f','#07050c'],-.5,.5);
  g.fillStyle='#ffd84a';g.font='900 .5px "Arial Black",Impact,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('BAR',0,.04)},
n3:g=>{for(const y of[-.52,.12]){slBody(g,c=>{c.beginPath();c.roundRect(-.95,y,1.9,.4,.1)},['#3a2f58','#16101f'],y,y+.4);
    g.fillStyle='#ffd84a';g.font='900 .3px "Arial Black",Impact,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('BAR',0,y+.2)}},
n4:g=>{slBody(g,c=>{c.beginPath();c.moveTo(-.78,.42);c.bezierCurveTo(-.8,-.1,-.62,-.78,0,-.78);c.bezierCurveTo(.62,-.78,.8,-.1,.78,.42);c.lineTo(.98,.6);c.lineTo(-.98,.6);c.closePath()},['#fff5b0','#ffc83a','#9a6200'],-.78,.6);
  slBody(g,c=>{c.beginPath();c.arc(0,.78,.17,0,TAU)},['#fff5b0','#ffb020'],.6,.95)},
n5:g=>{g.font='900 2.5px "Arial Black",Impact,sans-serif';g.textAlign='center';g.textBaseline='middle';g.shadowColor='rgba(255,46,77,.9)';g.shadowBlur=g.canvas.width*.05;g.lineWidth=.16;g.strokeStyle='#fff';g.strokeText('7',0,.1);g.fillStyle='#ff2e4d';g.fillText('7',0,.1)},
n6:g=>{g.font='900 2.5px "Arial Black",Impact,sans-serif';g.textAlign='center';g.textBaseline='middle';g.shadowColor='#ff3ea5';g.shadowBlur=g.canvas.width*.14;g.fillStyle='#ff4fd8';g.fillText('7',0,.1);g.shadowBlur=0;g.lineWidth=.06;g.strokeStyle='#fff';g.strokeText('7',0,.1)}};
function slDraw(m,now,dt){
  const g=slFit($('slc'),640,440),k=g.canvas.width/640,S=Math.round(74*k),FF='Bungee,Impact,sans-serif',BF='"Chakra Petch",system-ui,sans-serif';
  m.sh*=Math.exp(-dt*6);m.shown+=(m.wv-m.shown)*Math.min(1,dt*9);
  const jx=m.sh>.01?(rand()-.5)*m.sh*14:0,jy=m.sh>.01?(rand()-.5)*m.sh*14:0;
  g.save();g.translate(jx,jy);
  const bg=g.createLinearGradient(0,0,0,440);bg.addColorStop(0,'#3a0f52');bg.addColorStop(1,'#0c0426');g.fillStyle=bg;g.fillRect(-20,-20,680,480);
  const rg=g.createRadialGradient(320,30,10,320,30,380);rg.addColorStop(0,'rgba(255,62,165,.4)');rg.addColorStop(1,'rgba(255,62,165,0)');g.fillStyle=rg;g.fillRect(-20,-20,680,480);
  g.beginPath();g.roundRect(24,96,592,330,14);g.fillStyle='rgba(8,4,24,.6)';g.fill();g.lineWidth=2;g.strokeStyle='rgba(255,143,200,.7)';g.stroke();
  g.save();g.beginPath();g.roundRect(24,96,592,330,14);g.clip();
  m.grid.forEach((col,x)=>col.forEach(c=>{if(c.dead)return;const[cx,cy]=slCellXY(x,slPos(c,now)),age=c.h?(now-c.h)/400:9,hot=age<1;
    if(hot){g.globalAlpha=1-age*.5;g.drawImage(glow(slCol(c.s)),cx-58,cy-58,116,116)}
    if(c.ant){g.globalAlpha=.45+.35*Math.sin(now/110);g.drawImage(glow('#ff3ea5'),cx-62,cy-62,124,124)}
    g.globalAlpha=1;const sc=hot?1+.14*Math.sin(Math.PI*age):1;
    g.save();g.translate(cx,cy);g.scale(sc,sc);if(c.s===BOMB)g.drawImage(glow('#ff9a2e'),-44,-44,88,88);g.drawImage(slSpr(c.s,S),-37,-37,74,74);
    if(c.s===BOMB){g.fillStyle='#fff';g.font='900 15px '+FF;g.textAlign='center';g.textBaseline='middle';g.fillText('x'+c.m,0,2)}
    g.restore()}));
  g.restore();
  // flying bombs go to the multiplier pill on a quadratic curve
  m.fly=m.fly.filter(f=>now-f.t0<f.dur);
  for(const f of m.fly){const q=(now-f.t0)/f.dur,e=q*q*(3-2*q),mx=(f.x0+f.x1)/2,my=Math.min(f.y0,f.y1)-130;
    const x=(1-e)*(1-e)*f.x0+2*(1-e)*e*mx+e*e*f.x1,y=(1-e)*(1-e)*f.y0+2*(1-e)*e*my+e*e*f.y1;
    g.save();g.translate(x,y);g.scale(.6,.6);g.drawImage(slSpr(BOMB,S),-37,-37,74,74);g.restore()}
  // particles: sparks in the symbol colour
  for(const p of m.pt){p.l+=dt;p.vy+=900*dt;p.x+=p.vx*dt;p.y+=p.vy*dt}
  m.pt=m.pt.filter(p=>p.l<p.max);
  g.save();g.globalCompositeOperation='lighter';g.lineCap='round';
  for(const p of m.pt){const a=1-p.l/p.max;g.globalAlpha=a;g.strokeStyle=p.c;g.lineWidth=3*a+1;g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x-p.vx*.04,p.y-p.vy*.04);g.stroke()}
  g.restore();g.globalAlpha=1;
  // HUD: bet and feature left, win counter centre, multiplier pill right
  g.textAlign='left';g.textBaseline='alphabetic';g.fillStyle='#f3ecff';g.font='700 15px '+BF;g.fillText('BET $'+m.bet.toLocaleString('en-US'),34,38);
  if(m.feat){g.fillStyle='#ff8fc8';g.font='700 15px '+BF;g.fillText('FREE SPINS '+Math.max(0,m.free),34,62);g.fillStyle='#ffd1ea';g.font='600 13px '+BF;g.fillText('Feature $'+m.ftot.toLocaleString('en-US'),34,82)}
  const fl=m.flash?Math.max(0,1-(now-m.flash)/450):0;
  g.textAlign='center';g.fillStyle='#c7b8e6';g.font='700 12px '+BF;g.fillText('WIN',320,24);
  g.save();g.shadowColor=fl>0?'#fff3a6':'#ff3ea5';g.shadowBlur=16+24*fl;g.fillStyle='#ffe066';g.font='40px '+FF;g.fillText('$'+Math.round(m.shown).toLocaleString('en-US'),320,70);g.restore();
  g.save();g.translate(566,52);g.scale(1+.22*fl,1+.22*fl);g.beginPath();g.roundRect(-56,-22,112,44,22);g.fillStyle=fl>0?'#fff3a6':'#ffd84a';g.fill();g.fillStyle='#2a0530';g.font='24px '+FF;g.textBaseline='middle';g.fillText('x'+(m.mult||1),0,2);g.restore();
  // big win: veil, tier word counting up, coins
  if(m.big){const B=m.big,a=Math.min(1,(now-B.t0)/160),s0=Math.min(1,(now-B.t0)/420),sc=1+2.70158*Math.pow(s0-1,3)+1.70158*Math.pow(s0-1,2);
    g.save();g.beginPath();g.roundRect(24,96,592,330,14);g.clip();
    g.fillStyle=`rgba(6,2,16,${.74*a})`;g.fillRect(24,96,592,330);
    for(const c of m.coins){c.vy+=760*dt;c.y+=c.vy*dt;c.a+=c.w*dt;if(c.y>440){c.y=-20;c.vy=rr(60,160)}g.save();g.translate(c.x,c.y);g.scale(Math.abs(Math.cos(c.a))*.85+.15,1);g.beginPath();g.arc(0,0,9,0,TAU);g.fillStyle='#ffd23a';g.fill();g.lineWidth=2;g.strokeStyle='#9a6200';g.stroke();g.restore()}
    g.save();g.translate(320,196);g.scale(Math.max(.01,sc),Math.max(.01,sc));g.textBaseline='middle';g.font='58px '+FF;g.lineWidth=10;g.lineJoin='round';g.strokeStyle='#2a0530';g.strokeText(B.tier,0,0);g.shadowColor=B.col;g.shadowBlur=26;g.fillStyle=B.col;g.fillText(B.tier,0,0);g.restore();
    g.save();g.textAlign='center';g.textBaseline='middle';g.font='44px '+FF;g.shadowColor='#ff3ea5';g.shadowBlur=18;g.fillStyle='#fff';g.fillText('$'+Math.round(B.amt*Math.min(1,(now-B.t0)/2400)).toLocaleString('en-US'),320,262);g.restore();
    g.restore()}
  // retrigger banner
  if(m.ban){const q=(now-m.ban.t0)/m.ban.dur;if(q<1){g.save();g.globalAlpha=Math.min(1,q*5,(1-q)*3);g.textAlign='center';g.textBaseline='middle';g.font='34px '+FF;g.shadowColor='#7bf7ff';g.shadowBlur=20;g.fillStyle='#7bf7ff';g.fillText(m.ban.text,320,160);g.restore()}}
  g.restore()}
// One view: old grid out, new grid in, cascades, bombs, pay. Returns the view result.
async function slView(m,buy){
  const r=candyRun(m.feat,buy),b=m.bet;
  m.msg=m.feat?'Free spin!':'Spinning...';renderSlots();
  if(m.grid.length){const end=slDropOut(m);await slWait(m,end);m.grid=[]}
  m.wv=0;m.base=0;m.mult=0;
  await slWait(m,slFall(m,r.init,true));
  for(const st of r.steps){
    const t=performance.now();st.hit.forEach(c=>{c.h=t});
    tone('triangle',mf(79),.3,.07,T0());tone('triangle',mf(83),.3,.06,T0()+.06);
    await slWait(m,slT(420));
    for(const c of st.hit){const[x,y]=slPosOf(m,c);slBurst(m,x,y,slCol(c.s),reduced?4:16);c.dead=1}
    m.base+=st.pay*b;m.wv=m.base*(m.mult||1);
    await slWait(m,slFall(m,st.after,false)+40)}
  if(r.base>0)for(const c of r.bombs){const[x0,y0]=slPosOf(m,c);m.fly.push({x0,y0,x1:320,y1:52,t0:performance.now(),dur:slT(380)});
    await slWait(m,slT(380));
    c.dead=1;m.mult+=c.m;m.flash=performance.now();m.wv=m.base*m.mult;tone('square',mf(72+(c.m>9?12:0)),.12,.08,T0());
    await slWait(m,slT(80))}
  if(r.sp){const t=performance.now();m.grid.flat().forEach(c=>{if(c.s===SCAT)c.h=t});await slWait(m,slT(480))}
  const pay=Math.round(r.total*b);me.cash+=pay;if(m.feat)m.ftot+=pay;m.wv=pay;
  m.msg=(pay?'Win $'+pay.toLocaleString('en-US')+'!':'No win.')+(m.feat?' Free spins: '+m.free:'');renderSlots();saveArsenal();
  if(r.total>=20){const tier=r.total>=100?'EPIC WIN':r.total>=50?'MEGA WIN':'BIG WIN',col=r.total>=100?'#7bf7ff':r.total>=50?'#ff8fc8':'#ffd84a';
    m.big={t0:performance.now(),amt:pay,tier,col};m.coins=Array.from({length:40},()=>({x:rr(40,600),y:rr(-460,-10),vy:rr(80,200),a:rand()*6,w:rr(3,9)}));m.sh=reduced?0:.8;
    if(pay>=b*50)feed(`Big slots win: +$${pay.toLocaleString('en-US')}`);
    jingle('pass');await slWait(m,slT(3000));m.big=null;m.coins=[]}
  return r}
// A spin press: base spin, feature buy, or the automatic free spins that follow a trigger.
async function slSpin(buy){
  const m=sl;if(m.busy)return;
  if(buy){if(me.cash<m.bet*45){m.msg='Not enough cash for the feature.';renderSlots();return}me.cash-=m.bet*45;saveArsenal();m.feat=true;m.free=SL_FREE;m.ftot=0}
  else if(!m.feat){if(me.cash<m.bet){m.msg='Not enough cash.';renderSlots();return}me.cash-=m.bet;saveArsenal()}
  m.busy=true;renderSlots();
  for(let first=buy;;first=false){
    if(m.feat)m.free--;
    const r=await slView(m,first);
    if(!m.feat){if(r.scat<SL_TRIG)break;m.feat=true;m.free=SL_FREE;m.ftot=0;await slAsk(m,'FREE SPINS: '+SL_FREE,r.scat+' lollipops landed. The free spins play out on their own.','Start');continue}
    const add=slAdd(r,first);if(add){m.free+=add;m.ban={t0:performance.now(),text:'+'+add+' FREE SPINS',dur:slT(1600)};await slWait(m,slT(1600))}
    if(m.free<=0){m.feat=false;m.msg='Feature paid $'+m.ftot.toLocaleString('en-US')+'.';renderSlots();await slAsk(m,'FEATURE OVER','Free spins won $'+m.ftot.toLocaleString('en-US'),'Collect');break}
    await slWait(m,slT(400))}
  m.busy=false;renderSlots()}
function renderSlots(){
  const m=sl;$('sMsg').textContent=`${m.msg}  Cash $${me.cash.toLocaleString('en-US')}`;
  const A=$('sAct');A.replaceChildren();
  for(const v of[10,50,100,500,1000])mkBtn(A,'$'+v,()=>{if(!m.busy&&!m.feat){m.bet=v;renderSlots()}},'chip'+(m.bet===v?' on':''),m.busy||m.feat);
  mkBtn(A,m.feat?`Free spins: ${m.free} left`:`Spin $${m.bet}`,()=>slSpin(false),'go',m.busy||(!m.feat&&me.cash<m.bet));
  mkBtn(A,`Buy feature $${(m.bet*45).toLocaleString('en-US')}`,()=>slSpin(true),'',m.busy||m.feat||me.cash<m.bet*45)}
function casinoOpenSlots(){sl.skip=false;if(!sl.grid.length)slFall(sl,Array.from({length:6},()=>Array.from({length:5},()=>slSym(false))),false);renderSlots();slStart();$('sAct').querySelector('.go')?.focus()}
// Space or Enter spins the open machine. The busy guard stops double spins. Escape still closes through closeShop().
addEventListener('keydown',e=>{if(e.repeat||(e.code!=='Space'&&e.code!=='Enter'))return;
  if(!sl.el.hidden){e.preventDefault();slSpin(false)}else if(!s7.el.hidden){e.preventDefault();s7Spin()}});
if(DBG)Object.defineProperties(DBG,{slotRTP:{get:()=>slotRTP},sl:{get:()=>sl},s7:{get:()=>s7},casino:{get:()=>casino}});

// ---------- casino games ----------
// High-limit room in the VIP area. Players need $100,000 in cash (or VIP, once a later ticket adds it).
const HL_MIN=100000;
function hlGate(){if(me.cash>=HL_MIN||me.vip)return true;feed(`High-limit tables need ${fmtCash(HL_MIN)} in cash`);return false}
const fmtCash=n=>'$'+Math.round(n).toLocaleString('en-US');
// Lucky Wheel. Each segment is [label, kind, value, weight]; weights sum to 100. The jackpot has weight 1.
const LW=[['$500','c',500,14],['RP 100','r',100,11],['$1,000','c',1000,11],['Chips $2,000','h',2000,7],['$500','c',500,14],['RP 250','r',250,7],['$2,500','c',2500,6],['Mystery','m',0,5],['$1,000','c',1000,8],['$5,000','c',5000,3],['RP 500','r',500,3],['Chips $5,000','h',5000,2],['$1,000','c',1000,2],['$500','c',500,1],['RP 100','r',100,1],['Mystery','m',0,1],['$2,500','c',2500,1],['Chips $2,000','h',2000,1],['$50,000','c',50000,1],['JACKPOT $250,000','j',250000,1]];
const LWC={c:'#1f7a48',r:'#2b6fd6',h:'#c2306e',m:'#6a3bb8',j:'#ffc94a'};
const lwDay=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
let lwLast='';
// Reads the saved spin day again, so a spin made in another tab counts here too.
function lwRead(){try{const v=localStorage.getItem('pr3d-wheel');lwLast=typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:''}catch(e){}}
lwRead();
// Picks a segment index by weight. Pure: no payout here.
function spinWheel(){const tot=LW.reduce((a,s)=>a+s[3],0);let r=rand()*tot;for(let i=0;i<LW.length;i++){r-=LW[i][3];if(r<0)return i}return LW.length-1}
// Average cash per spin over n seeded spins. Cash, chips and the jackpot count. RP and mystery do not.
function wheelValue(n){const keep=rand;rand=seeded(6604);let s=0;try{for(let i=0;i<n;i++){const[,k,v]=LW[spinWheel()];if(k==='c'||k==='h'||k==='j')s+=v}}finally{rand=keep}return s/n}
// RP is paid through gainXP, which only runs in play. The modal sets state to shop, so switch it for the call.
function casinoRP(n,why){const s=state;state='play';try{gainXP(n,why)}finally{state=s}}
const lwC=$('lwc'),lwG=lwC.getContext('2d'),LWR=180,LWX=210;
let lwS={a:0,from:0,to:0,t0:0,dur:0,spin:false,tick:-1,kick:0,raf:0};
function lwDraw(){const g=lwG,seg=TAU/LW.length;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,420,420);g.translate(LWX,LWX);
  g.fillStyle='#2a1038';g.beginPath();g.arc(0,0,LWR+14,0,TAU);g.fill();
  g.save();g.rotate(lwS.a);
  for(let i=0;i<LW.length;i++){const s0=i*seg-Math.PI/2,[l,k]=LW[i];g.fillStyle=LWC[k];g.beginPath();g.moveTo(0,0);g.arc(0,0,LWR,s0,s0+seg);g.closePath();g.fill();
}
  for(let i=0;i<LW.length;i++){const a=i*seg-Math.PI/2;g.fillStyle='#fff3c4';g.beginPath();g.arc(Math.cos(a)*LWR,Math.sin(a)*LWR,3.5,0,TAU);g.fill()}
  g.restore();
  // labels sit outside the spin transform, each turned to its on-screen angle, so none reads upside down
  for(let i=0;i<LW.length;i++){const m=i*seg-Math.PI/2+seg/2+lwS.a,flip=Math.cos(m)<0,[l,k]=LW[i];g.save();g.rotate(flip?m+Math.PI:m);g.fillStyle=k==='j'?'#2a0a14':'#fff';g.font='700 16px "Chakra Petch",sans-serif';g.textAlign=flip?'left':'right';g.textBaseline='middle';g.fillText(l.replace('JACKPOT $250,000','JACKPOT'),flip?-(LWR-12):LWR-12,0);g.restore()}
  g.strokeStyle='#ffc94a';g.lineWidth=6;g.beginPath();g.arc(0,0,LWR+4,0,TAU);g.stroke();
  g.fillStyle='#ffc94a';g.beginPath();g.arc(0,0,22,0,TAU);g.fill();g.fillStyle='#2a1038';g.beginPath();g.arc(0,0,8,0,TAU);g.fill();
  g.save();g.translate(0,-LWR-12);g.rotate(lwS.kick*.35);g.fillStyle='#fff';g.beginPath();g.moveTo(-14,-16);g.lineTo(14,-16);g.lineTo(0,10);g.closePath();g.fill();g.restore()}
function lwBtn(){const b=$('lwGo');const done=lwLast===lwDay();b.textContent=lwS.spin?'Spinning...':done?'Back tomorrow':'Spin (free today)';b.disabled=lwS.spin||done}
function lwMsg(t){$('lwMsg').textContent=t}
function lwLoop(){lwS.raf=0;const now=performance.now();
  if(lwS.spin){const t=Math.min(1,(now-lwS.t0)/lwS.dur);lwS.a=lwS.from+(lwS.to-lwS.from)*(1-Math.pow(1-t,4));if(t>=1)lwS.spin=false}
  const idx=Math.floor((((-lwS.a)%TAU)+TAU)%TAU/(TAU/LW.length));
  if(idx!==lwS.tick){if(lwS.tick>=0)tone('square',1500,.03,.05);lwS.tick=idx;lwS.kick=1}
  lwS.kick*=.86;lwDraw();
  if(lwS.spin||lwS.kick>.01)lwS.raf=requestAnimationFrame(lwLoop);else{lwBtn()}}
function lwSpin(){if(lwS.spin)return;lwRead();if(lwLast===lwDay()){lwMsg('You already spun today. Come back tomorrow.');lwBtn();return}
  // Pay once, before the wheel turns, and mark the day so a reload cannot spin again.
  const i=spinWheel(),[l,k,v]=LW[i];let mAm=0;lwLast=lwDay();try{localStorage.setItem('pr3d-wheel',lwLast)}catch(e){}
  if(k==='r')casinoRP(v,'Lucky Wheel');else if(k==='m'){for(const w of WEAPONS)if(owned[w.id]&&w.ammoAmt){ammo[w.id]=(ammo[w.id]||0)+w.ammoAmt;mAm++}}else me.cash+=v;
  saveArsenal();
  const seg=TAU/LW.length,base=((-(i+.5)*seg-lwS.a)%TAU+TAU)%TAU,jit=(rand()-.5)*seg*.6;
  lwS.from=lwS.a;lwS.to=lwS.a+6*TAU+base+jit;lwS.t0=performance.now();lwS.dur=5200;lwS.spin=true;lwS.tick=-1;
  lwMsg('Good luck...');lwBtn();if(!lwS.raf)lwS.raf=requestAnimationFrame(lwLoop);
  setTimeout(()=>{if(k==='j'){showBig('JACKPOT','#ffc94a','+'+fmtCash(v),3);jingle('level')}else if(k!=='m')jingle('pass');
    const won=k==='r'?`${v} RP`:k==='m'?(mAm?`ammo for ${mAm} gun${mAm>1?'s':''}`:'no ammo, since you own no gun that takes it'):fmtCash(v)+(k==='h'?' in chips':'');lwMsg(`Won ${won}`);feed(`Lucky Wheel: won ${won}`);if(k==='j')noise(.5,6000,.3)},5300)}
function openLucky(){lwRead();openModal('lwheel');lwMsg(lwLast===lwDay()?'Your free spin for today is gone. Come back tomorrow.':'One free spin every real day. Good luck.');lwBtn();lwDraw();$('lwGo').focus();
  // the free spin unlocks at midnight even if the wheel is left open
  if(openLucky.t)clearTimeout(openLucky.t);
  openLucky.t=setTimeout(function tick(){openLucky.t=0;if($('lwheel').hidden)return;lwRead();lwBtn();openLucky.t=setTimeout(tick,60000)},60000)}
$('lwGo').addEventListener('click',lwSpin);

// ---------- Rocket (crash game) ----------
// Launches run on a shared clock. Each 45 s slot opens with 8 s of betting, then the rocket flies.
// The host (the lowest peer id among players with the modal open, or this client alone) picks the crash point
// and publishes it as rk only once the flight starts, so nobody can bet on a known result.
// Bets and cash-outs stay local. A flight that would pass the slot end is cut off there (above about 2000x).
const RKG={slot:45000,win:8000,k:.2,amt:100,hist:[],hostId:-1,hostCp:0,soloId:-1,soloCp:0,bet:null,fly:null,last:'',open:false,raf:0,lt:0,cam:{x:8,y:2},parts:[],boomId:-1,histId:-1};
const rkS=now=>{const id=Math.floor(now/RKG.slot);return{id,start:id*RKG.slot+RKG.win}};
const rkMult=t=>Math.floor(Math.exp(RKG.k*Math.max(0,t))*100+1e-9)/100;
// Crash point = 0.96/(1-u) floored to two decimals, minimum 1.00 (4 percent house edge).
function rocketCP(){return Math.max(1,Math.floor(.96/(1-rand())*100)/100)}
// Cash out at 2x every round. Seeded so the result repeats.
function rocketRTP(n){const keep=rand;rand=seeded(4711);let won=0;try{for(let i=0;i<n;i++)if(rocketCP()>=2)won+=2}finally{rand=keep}return won/n}
// Other players' rk: null when their modal is closed, otherwise {id,start,cp}. id 0 means open with no flight yet.
function rkParse(v){if(!Array.isArray(v))return null;const id=Math.floor(num(v[0])),st=num(v[1]),cp=num(v[2]);
  if(id<=0||!(cp>=1)||cp>1e6||st!==id*RKG.slot+RKG.win)return{id:0,start:0,cp:0};return{id,start:st,cp}}
function rkAmHost(){return amHost(r=>r.rk)} // host among the players with the modal open, built on the shared election
// The flight for a slot: a host's published flight wins, otherwise this client's own (if it is the host).
function rkFlight(id,start){
  if(RKG.soloId===id)return{id,start,cp:RKG.soloCp,mine:false};
  for(const r of remotes.values())if(r.rk&&r.rk.id===id)return{id,start:r.rk.start,cp:r.rk.cp,mine:false};
  if(!rkAmHost()){
    // Stall guard: no host flight 3 s after the start, so this client runs the round alone. Never published.
    if(Date.now()<start+3000)return null;
    RKG.soloId=id;RKG.soloCp=rocketCP();return{id,start,cp:RKG.soloCp,mine:false}}
  if(RKG.hostId!==id){RKG.hostId=id;RKG.hostCp=rocketCP()}
  return{id,start,cp:RKG.hostCp,mine:true}}
// Presence field. Only the host publishes a flight, and only once it has started.
function rkMine(){if(!RKG.open)return null;const now=Date.now(),s=rkS(now),f=rkFlight(s.id,s.start);return f&&f.mine&&now>=s.start?[s.id,s.start,f.cp]:[0,0,0]}
// Pays the bet's cash-out at the current multiplier. Only while flying, and never after the crash.
function rkOut(now){const b=RKG.bet,fl=RKG.fly;if(!b||b.cashed||!fl||fl.id!==b.id)return;const t=(now-fl.start)/1000;if(t<0)return;
  const end=Math.min(Math.log(fl.cp)/RKG.k,(RKG.slot-RKG.win)/1000);if(t>=end)return;
  const m=rkMult(t),pay=Math.floor(Math.round(b.amt*m*100)/100);b.cashed=m;me.cash+=pay;saveArsenal();RKG.last=`Cashed out at ${m.toFixed(2)}x: +${fmtCash(pay-b.amt)}`}
function rkPlace(){const now=Date.now(),s=rkS(now),amt=RKG.amt;if(now>=s.start){RKG.last='Bets are closed. Wait for the next launch.';return}
  if(RKG.bet){RKG.last='You already have a bet on this launch.';return}
  if(me.cash<amt){RKG.last='Not enough cash for that bet.';return}
  me.cash-=amt;RKG.bet={id:s.id,amt,cashed:0};saveArsenal();RKG.last=`Bet ${fmtCash(amt)} placed. Cash out before it crashes.`}
function rkSettle(now){const b=RKG.bet,s=rkS(now),f=rkFlight(s.id,s.start);if(f)RKG.fly=f;const fl=RKG.fly;
  if(b&&b.id<s.id){if(!b.cashed)RKG.last=`Crashed. Lost ${fmtCash(b.amt)}.`;RKG.bet=null}
  if(!fl||fl.id!==s.id||now<fl.start)return null;
  const tc=Math.log(fl.cp)/RKG.k,end=Math.min(tc,(RKG.slot-RKG.win)/1000),t=(now-fl.start)/1000,crashed=t>=end,cm=tc>end?rkMult(end):fl.cp;
  if(crashed&&RKG.histId!==fl.id){RKG.histId=fl.id;RKG.hist.unshift(cm);if(RKG.hist.length>10)RKG.hist.length=10;RKG.histDirty=true;
    if(b&&b.id===fl.id&&!b.cashed){RKG.last=`Crashed at ${cm.toFixed(2)}x. Lost ${fmtCash(b.amt)}.`;RKG.bet=null}}
  return{cm,crashed,t:Math.min(t,end)}}
const rkC=$('rkc'),rkG=rkC.getContext('2d'),RKW=640,RKH=360;
function rkDraw(now,dt,st){const g=rkG,fl=RKG.fly&&RKG.fly.id===rkS(now).id&&now>=RKG.fly.start?RKG.fly:null,cam=RKG.cam;
  const t=st?st.t:0,cm=st?(st.crashed?st.cm:rkMult(t)):1;
  cam.x+=(Math.max(8,t*1.15)-cam.x)*Math.min(1,dt*3);cam.y+=(Math.max(2,cm*1.15)-cam.y)*Math.min(1,dt*3);
  const X=v=>56+v/cam.x*(RKW-80),Y=m=>RKH-34-(m-1)/(cam.y-1)*(RKH-64);
  g.setTransform(1,0,0,1,0,0);const bg=g.createLinearGradient(0,0,0,RKH);bg.addColorStop(0,'#0c0a1f');bg.addColorStop(1,'#2a1040');g.fillStyle=bg;g.fillRect(0,0,RKW,RKH);
  g.strokeStyle='rgba(255,255,255,.08)';g.lineWidth=1;g.font='600 12px "Chakra Petch",sans-serif';g.fillStyle='rgba(230,220,255,.6)';g.textAlign='left';g.textBaseline='middle';
  for(let i=1;i<=5;i++){const m=1+(cam.y-1)*i/5;g.beginPath();g.moveTo(56,Y(m));g.lineTo(RKW-24,Y(m));g.stroke();g.fillText(m.toFixed(2)+'x',8,Y(m))}
  const sx=Math.max(1,Math.ceil(cam.x/8));for(let s=0;s<=cam.x;s+=sx){g.beginPath();g.moveTo(X(s),24);g.lineTo(X(s),RKH-34);g.stroke();g.fillText(s+'s',X(s)-6,RKH-14)}
  let hx=70,hy=RKH-60,ang=-Math.PI/4;
  if(fl){const n=Math.max(2,Math.ceil(t*30));g.beginPath();for(let i=0;i<=n;i++){const tt=t*i/n,px=X(tt),py=Y(rkMult(tt));i?g.lineTo(px,py):g.moveTo(px,py)}
    const ln=g.createLinearGradient(56,0,RKW,0);ln.addColorStop(0,'#29e6d6');ln.addColorStop(1,st.crashed?'#ff4b4b':'#ff3ea5');
    g.lineWidth=5;g.strokeStyle=ln;g.shadowColor=st.crashed?'#ff4b4b':'#ff3ea5';g.shadowBlur=18;g.stroke();g.shadowBlur=0;
    g.lineTo(X(t),RKH-34);g.lineTo(56,RKH-34);g.closePath();g.fillStyle='rgba(255,62,165,.12)';g.fill();
    hx=X(t);hy=Y(cm);ang=Math.atan2(Y(rkMult(Math.max(0,t-.1)))-hy,hx-X(Math.max(0,t-.1)));if(!(Math.abs(ang)<=Math.PI))ang=-Math.PI/4}
  if(fl&&!st.crashed&&Math.random()<.9)RKG.parts.push({x:hx,y:hy,vx:-Math.cos(ang)*(50+Math.random()*60)+(Math.random()-.5)*30,vy:-Math.sin(ang)*(50+Math.random()*60)+(Math.random()-.5)*30,l:1});
  if(fl&&st.crashed&&RKG.boomId!==fl.id){RKG.boomId=fl.id;for(let i=0;i<46;i++){const a=Math.random()*TAU,v=60+Math.random()*180;RKG.parts.push({x:hx,y:hy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:1,c:Math.random()<.5?'#ff4b4b':'#ffc94a'})}}
  for(const p of RKG.parts){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;p.l-=dt*1.4}
  RKG.parts=RKG.parts.filter(p=>p.l>0).slice(-200);
  g.save();for(const p of RKG.parts){g.globalAlpha=Math.max(0,p.l);g.fillStyle=p.c||'#ffc94a';g.beginPath();g.arc(p.x,p.y,2.5+p.l*2,0,TAU);g.fill()}g.restore();
  g.save();g.translate(hx,hy);g.rotate(ang);g.scale(4.2,4.2);
  if(fl&&!st.crashed){const L=20+Math.random()*12,fg=g.createLinearGradient(-14,0,-14-L,0);fg.addColorStop(0,'#fff3b8');fg.addColorStop(.35,'#ffc94a');fg.addColorStop(1,'rgba(255,62,165,0)');g.fillStyle=fg;g.beginPath();g.moveTo(-12,-7);g.quadraticCurveTo(-14-L*.6,-5,-14-L,0);g.quadraticCurveTo(-14-L*.6,5,-12,7);g.closePath();g.fill()}
  g.fillStyle=fl&&st.crashed?'#6a6470':'#f3ecff';g.beginPath();g.moveTo(20,0);g.quadraticCurveTo(4,-9,-14,-8);g.lineTo(-14,8);g.quadraticCurveTo(4,9,20,0);g.fill();
  g.fillStyle='#ff3ea5';g.beginPath();g.moveTo(-8,-8);g.lineTo(-18,-16);g.lineTo(-14,-4);g.fill();g.beginPath();g.moveTo(-8,8);g.lineTo(-18,16);g.lineTo(-14,4);g.fill();
  g.fillStyle='#29e6d6';g.beginPath();g.arc(4,0,3.5,0,TAU);g.fill();g.restore();
  const big=fl?(st.crashed?`CRASHED ${cm.toFixed(2)}x`:`${cm.toFixed(2)}x`):RKG.open&&now<rkS(now).start?`LAUNCH IN ${((rkS(now).start-now)/1000).toFixed(1)}s`:'WAITING';
  g.font='700 44px Bungee,Impact,sans-serif';g.textAlign='right';g.textBaseline='top';g.fillStyle=st&&st.crashed?'#ff4b4b':fl?'#f3ecff':'#ffc94a';g.shadowColor=g.fillStyle;g.shadowBlur=16;g.fillText(big,RKW-20,14);g.shadowBlur=0}
function rkUI(now){const s=rkS(now),bet=RKG.bet,inWin=now<s.start,fl=RKG.fly&&RKG.fly.id===s.id&&now>=RKG.fly.start,b=$('rkBet'),o=$('rkOut');
  const msg=RKG.last||(inWin?'Bets are open.':'Launch in progress.');if($('rkMsg').textContent!==msg)$('rkMsg').textContent=msg;
  b.textContent=bet?'Bet placed':`Bet ${fmtCash(RKG.amt)}`;b.disabled=!inWin||!!bet||me.cash<RKG.amt;
  const live=bet&&!bet.cashed&&fl;o.textContent=live?`Cash out ${fmtCash(Math.floor(Math.round(bet.amt*rkMult((now-RKG.fly.start)/1000)*100)/100))}`:'Cash out';o.disabled=!live;
  for(const c of document.querySelectorAll('#rkChips button'))c.classList.toggle('on',c.dataset.v===String(RKG.amt));
  if(RKG.histDirty){RKG.histDirty=false;const H=$('rkHist');H.replaceChildren();for(const v of RKG.hist){const e=document.createElement('span');e.className='rkh';e.style.background=v<2?'#5a1a2a':'#1a5a3a';e.textContent=v.toFixed(2)+'x';H.appendChild(e)}}}
function rkLoop(){RKG.raf=0;const now=Date.now();
  if($('lrocket').hidden){if(RKG.open){RKG.open=false;const b=RKG.bet,fl=RKG.fly;if(b&&!b.cashed&&fl&&fl.id===b.id&&now>=fl.start)rkOut(now);else if(b&&!b.cashed&&now<rkS(now).start){me.cash+=b.amt;RKG.bet=null;saveArsenal()}}return}
  RKG.open=true;const dt=Math.min(.05,(now-(RKG.lt||now))/1000);RKG.lt=now;
  const st=rkSettle(now);rkDraw(now,dt,st);rkUI(now);RKG.raf=requestAnimationFrame(rkLoop)}
function openRocket(){openModal('lrocket');RKG.open=true;RKG.lt=0;rkUI(Date.now());if(!RKG.raf)RKG.raf=requestAnimationFrame(rkLoop);$('rkBet').focus()}
for(const v of[10,50,100,500,1000]){const b=document.createElement('button');b.type='button';b.className='b chip';b.dataset.v=String(v);b.textContent='$'+v;b.addEventListener('click',()=>{RKG.amt=v});$('rkChips').appendChild(b)}
$('rkBet').addEventListener('click',rkPlace);
$('rkOut').addEventListener('click',()=>rkOut(Date.now()));

// ---------- Three Card Poker ----------
// Ante and optional Pair Plus against the dealer. The dealer qualifies with Queen high. Ante bonus pays on a played
// straight or better, whatever the dealer holds. Pair Plus pays on your hand alone, even after a fold.
const TCP_RK=['2','3','4','5','6','7','8','9','10','J','Q','K','A'],TCP_SU=['♠','♥','♦','♣'];
const TCP_NAME={6:'Straight flush',5:'Three of a kind',4:'Straight',3:'Flush',2:'Pair',1:'High card'};
const TCP_PP={6:40,5:30,4:6,3:3,2:1},TCP_AB={6:5,5:4,4:1};
const tcp={ante:10,pp:0,p:[],d:[],phase:'bet',msg:'Place your ante.'};
function tcpDeck(){const d=[];for(const su of TCP_SU)for(let r=0;r<13;r++)d.push([r+2,su]);for(let i=d.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[d[i],d[j]]=[d[j],d[i]]}return d}
// cat: 6 straight flush, 5 trips, 4 straight, 3 flush, 2 pair, 1 high card. ks: ranks to compare, best first. Ace is low only in A-2-3.
function tcpEval(h){const v=h.map(c=>c[0]).sort((a,b)=>b-a),fl=h[0][1]===h[1][1]&&h[1][1]===h[2][1];
  let st=v[0]-v[1]===1&&v[1]-v[2]===1,sh=v[0];if(!st&&v[0]===14&&v[1]===3&&v[2]===2){st=true;sh=3}
  if(st&&fl)return{cat:6,ks:[sh]};if(v[0]===v[2])return{cat:5,ks:[v[0]]};if(st)return{cat:4,ks:[sh]};if(fl)return{cat:3,ks:v};
  if(v[0]===v[1])return{cat:2,ks:[v[0],v[2]]};if(v[1]===v[2])return{cat:2,ks:[v[1],v[0]]};return{cat:1,ks:v}}
function tcpCmp(a,b){if(a.cat!==b.cat)return a.cat-b.cat;for(let i=0;i<a.ks.length;i++)if(a.ks[i]!==b.ks[i])return a.ks[i]-b.ks[i];return 0}
// Strategy for the RTP check: play on a pair or better, or on high card Q-6-4 or better.
const tcpPlays=e=>e.cat>1||tcpCmp(e,{cat:1,ks:[12,6,4]})>=0;
// Returns what comes back to the player for ante and play (ret), and for Pair Plus (ppRet). Both include the stakes.
function tcpPay(p,d,play,ante,pp){const pe=tcpEval(p),de=tcpEval(d),ppRet=pp&&TCP_PP[pe.cat]?pp*(TCP_PP[pe.cat]+1):0;let ret=0;
  if(play){const dq=de.cat>1||de.ks[0]>=12,c=tcpCmp(pe,de);
    if(!dq)ret=ante*3;else if(c>0)ret=ante*4;else if(c===0)ret=ante*2;
    ret+=ante*(TCP_AB[pe.cat]||0)}
  return{ret,ppRet,total:ret+ppRet,pe,de}}
// RTP of ante and play with the strategy above. Pair Plus is left out. Seeded so the result repeats.
function pokerRTP(n){const keep=rand;rand=seeded(9021);let ret=0,wag=0;try{for(let i=0;i<n;i++){const d=tcpDeck(),p=[d[0],d[2],d[4]],de=[d[1],d[3],d[5]],play=tcpPlays(tcpEval(p));ret+=tcpPay(p,de,play,1,0).ret;wag+=play?2:1}}finally{rand=keep}return ret/wag}
function tcpCard(c,down,fly){const e=document.createElement('div');e.className='tcpc';const i=document.createElement('div');i.className='tcpi'+(down?' down':'');
  const f=document.createElement('div');f.className='tcpf'+(c[1]==='♥'||c[1]==='♦'?' red':'');const a=document.createElement('span');a.textContent=TCP_RK[c[0]-2];const b=document.createElement('span');b.className='tcps';b.textContent=c[1];f.append(a,b);
  const k=document.createElement('div');k.className='tcpb';i.append(f,k);e.appendChild(i);
  if(fly){e.classList.add('fly');setTimeout(()=>requestAnimationFrame(()=>e.classList.remove('fly')),fly)}return e}
function tcpCash(){return fmtCash(me.cash)}
function tcpRender(){
  $('tcpCash').textContent=tcpCash();$('tcpMsg').textContent=tcp.msg;
  const done=tcp.phase==='done',show=tcp.phase!=='bet';
  $('tcpDv').textContent=show&&tcp.d.length?(done?' '+TCP_NAME[tcpEval(tcp.d).cat]:' ?'):'';
  $('tcpPv').textContent=tcp.p.length?' '+TCP_NAME[tcpEval(tcp.p).cat]:'';
  const cards=(arr,down,fly)=>arr.map((c,i)=>tcpCard(c,down(i),fly?fly+i*160:0));
  $('tcpD').replaceChildren(...cards(tcp.d,i=>!done,0));$('tcpP').replaceChildren(...cards(tcp.p,()=>false,0));
  for(const[id,v,arr]of[['tcpAnte',tcp.ante,[10,50,100,500]],['tcpPP',tcp.pp,[0,10,25,50]]]){const R=$(id);R.replaceChildren();
    for(const x of arr){const b=document.createElement('button');b.type='button';b.className='cb c'+x+(x===v?' on':'');b.textContent=x?'$'+x:'Off';b.disabled=tcp.phase!=='bet';b.addEventListener('click',()=>{if(id==='tcpAnte')tcp.ante=x;else tcp.pp=x;tcpRender()});R.appendChild(b)}}
  const A=$('tcpAct');A.replaceChildren();
  const btn=(t,fn,dis,cls)=>{const b=document.createElement('button');b.type='button';b.className='b'+(cls?' '+cls:'');b.textContent=t;b.disabled=!!dis;b.addEventListener('click',fn);A.appendChild(b)};
  if(tcp.phase==='bet')btn(`Deal ($${tcp.ante+tcp.pp})`,tcpDeal,tcp.ante<=0||me.cash<tcp.ante+tcp.pp,'go');
  else if(tcp.phase==='decide'){btn(`Play (+$${tcp.ante})`,()=>tcpResolve(true),me.cash<tcp.ante,'go');btn('Fold',()=>tcpResolve(false),false)}
  else btn('Deal again',()=>{tcp.phase='bet';tcp.p=[];tcp.d=[];tcp.msg='Place your bets.';tcpRender()},false,'go'); // always reachable, even when the last bet broke the bank
}
function tcpDeal(){if(tcp.phase!=='bet')return;const cost=tcp.ante+tcp.pp;
  if(tcp.ante<=0||me.cash<cost){tcp.msg='Not enough cash for that ante.';tcpRender();return}
  me.cash-=cost;saveArsenal();const dk=tcpDeck();tcp.p=[dk[0],dk[2],dk[4]];tcp.d=[dk[1],dk[3],dk[5]];tcp.phase='decide';
  tcp.msg='Play for one more ante, or fold.';noise(.12,5000,.08);tcpRender();
  $('tcpP').replaceChildren(...tcp.p.map((c,i)=>tcpCard(c,false,i*160)));$('tcpD').replaceChildren(...tcp.d.map((c,i)=>tcpCard(c,true,i*160)))}
function tcpResolve(play){if(tcp.phase!=='decide')return;if(play&&me.cash<tcp.ante){tcp.msg='Not enough cash to play. Fold or leave.';tcpRender();return}
  if(play){me.cash-=tcp.ante;saveArsenal()}
  const r=tcpPay(tcp.p,tcp.d,play,tcp.ante,tcp.pp);me.cash+=r.total;saveArsenal();tcp.phase='done';
  const wag=tcp.ante+tcp.pp+(play?tcp.ante:0),net=r.total-wag,dq=r.de.cat>1||r.de.ks[0]>=12;
  let m=!play?'You folded. Ante lost.':!dq?'Dealer does not qualify. Ante and play returned.':tcpCmp(r.pe,r.de)>0?'You beat the dealer.':tcpCmp(r.pe,r.de)===0?'Push.':'Dealer wins.';
  if(play&&dq&&tcpCmp(r.pe,r.de)<0)m='Dealer wins.';
  if(r.ppRet)m+=` Pair Plus: ${TCP_NAME[r.pe.cat]} pays ${fmtCash(r.ppRet-tcp.pp)}.`;
  if(play&&(TCP_AB[r.pe.cat]||0))m+=` Ante bonus ${fmtCash(tcp.ante*TCP_AB[r.pe.cat])}.`;
  tcp.msg=`${m} ${net>0?'+':net<0?'-':''}${fmtCash(Math.abs(net))}`;
  if(net>0){jingle('pass');if(net>=5000)feed(`Three Card Poker: +${fmtCash(net)}`)}else noise(.2,400,.06);
  tcpRender();const win=tcpCmp(r.pe,r.de)>0||r.ppRet>0;$('tcpP').querySelectorAll('.tcpc').forEach(e=>e.classList.toggle('win',win))}
function openTCP(){openModal('tcp');tcpRender()}

// ---------- Horse racing ----------
// Six horses, a 20 s race. Each race draws its odds from the horse weights: a win pays 0.9 / p, so every
// horse returns 90 percent on average. The finish order is drawn with the same probabilities (Plackett-Luce),
// and place pays when the horse finishes top two at 0.9 / P(top two). The race is decided at the start.
const HR_NAMES=['Lucky Strike','Neon Comet','Palm Thunder','Midnight Miss','Gold Rush','Sunset Bolt'],HR_COL=['#ff3ea5','#29e6d6','#ffc94a','#7b6bff','#3dd68c','#ff6b3d'],HR_BASE=[5,4,3,2,1.5,1];
const HRS={p:[],D:[],Dp:[],sel:0,amt:50,bets:[],run:false,order:[],T:[],t0:0,last:'',board:[]};
const hrC=$('hrc'),hrG=hrC.getContext('2d'),HRW=640,HRH=360,HRX0=134,HRX1=588;
// Draws a finish order with the given win probabilities (each pick removes the horse from the pool).
function horsePick(p){const q=p.slice(),out=[];for(let k=0;k<p.length;k++){const tot=q.reduce((a,b)=>a+b,0);let x=rand()*tot,i=0;while(i<q.length-1&&(q[i]===0||x>=q[i])){x-=q[i];i++}out.push(i);q[i]=0}return out}
function hrProbs(w){const s=w.reduce((a,b)=>a+b,0);return w.map(x=>x/s)}
function hrOdds(p){const D=p.map(x=>0.9/x),Dp=p.map((x,i)=>{let p2=x;for(let j=0;j<p.length;j++)if(j!==i)p2+=p[j]*x/(1-p[j]);return 0.9/p2});return{D,Dp}}
function hrCard(){HRS.p=hrProbs(HR_BASE.map(b=>b*(.8+.4*rand())));const o=hrOdds(HRS.p);HRS.D=o.D;HRS.Dp=o.Dp}
// Win (k 'w') or place (k 'p') bet on the horse picked in the list.
function hrBet(k){if(HRS.run){HRS.last='Bets close when the race starts.';hrRender();return}
  if(me.cash<HRS.amt){HRS.last='Not enough cash for that bet.';hrRender();return}
  me.cash-=HRS.amt;saveArsenal();HRS.bets.push({k,h:HRS.sel,amt:HRS.amt});HRS.last=`${k==='w'?'Win':'Place'} bet ${fmtCash(HRS.amt)} on ${HR_NAMES[HRS.sel]}.`;hrRender()}
function hrClear(){if(HRS.run)return;for(const b of HRS.bets)me.cash+=b.amt;HRS.bets=[];saveArsenal();HRS.last='Bets returned.';hrRender()}
function hrStart(){if(HRS.run)return;if(!HRS.bets.length){HRS.last='Place a bet first. Pick a horse, then win or place.';hrRender();return}
  HRS.order=horsePick(HRS.p);HRS.run=true;for(let k=0;k<6;k++)HRS.T[HRS.order[k]]=17.2+k*.55+(rand()-.5)*.12;
  HRS.t0=performance.now();HRS.last='And they are off.';noise(.3,800,.1);hrRender();setTimeout(hrSettle,20800)}
// Pays every bet once, then clears them and draws the next card. Runs on a timer, so closing the modal does not stop it.
function hrSettle(){const o=HRS.order,win=o[0],top=o.slice(0,2);let pay=0,stake=0;
  for(const b of HRS.bets){stake+=b.amt;const hit=b.k==='w'?b.h===win:top.includes(b.h);if(hit)pay+=Math.floor(Math.round(b.amt*(b.k==='w'?HRS.D[b.h]:HRS.Dp[b.h])*100)/100)}
  me.cash+=pay;saveArsenal();HRS.run=false;HRS.board.unshift(o.slice(0,3));if(HRS.board.length>5)HRS.board.length=5;
  const net=pay-stake;HRS.last=`${HR_NAMES[win]} wins. ${!stake?'No bets this race.':net>0?'You win '+fmtCash(net)+'.':net<0?'You lose '+fmtCash(-net)+'.':'Break even.'}`;
  HRS.bets=[];if(net>0)jingle('pass');hrCard();hrRender()}
// Position along the track, 0 at the gate and 1 at the line. A small wave makes the horses swap places mid-race.
function hrPos(i,t){const x=t/HRS.T[i];if(x>=1)return 1;const n=Math.sin(t*(1.1+i*.23)+i*1.7)*.05*x*(1-x)*4;return Math.max(0,Math.min(1,x+n))}
// Side view, facing the finish. Legs run a gallop cycle while moving. The jockey wears the horse's colour.
const HR_COAT=['#8a4a22','#4a2a18','#c9c1b0','#6b3a1e','#a0703c','#2a1a12'];
function hrHorse(g,x,y,c,n,ph,moving){const k=moving?1:0,bob=k*Math.abs(Math.sin(ph*2))*1.6,coat=HR_COAT[(n-1)%6],dark='#1a1008',L=20;
  const leg=(hx,p,col)=>{const a=k*Math.sin(p)*.7,fx=hx+Math.sin(a)*L*.8,fy=-20+Math.cos(a)*L;g.strokeStyle=col;g.lineWidth=3.2;g.beginPath();g.moveTo(hx,-20);g.lineTo(fx,fy);g.stroke();g.fillStyle=dark;g.fillRect(fx-2.5,-2.2,5,2.2)};
  g.save();g.translate(x,y-bob);g.scale(.72,.72);g.lineCap='round';g.lineJoin='round';
  leg(-14,ph+Math.PI+.5,'#2a1a10');leg(8,ph+.5,'#2a1a10');
  g.strokeStyle=dark;g.lineWidth=3;g.beginPath();g.moveTo(-18,-30);g.quadraticCurveTo(-36,-30+k*Math.sin(ph)*3,-32,-12);g.stroke();
  g.fillStyle=coat;g.strokeStyle=dark;g.lineWidth=1.2;
  g.beginPath();g.ellipse(-1,-28,19,8.5,-.08,0,TAU);g.fill();g.stroke();
  g.beginPath();g.moveTo(8,-34);g.lineTo(22,-50);g.lineTo(30,-46);g.lineTo(18,-25);g.closePath();g.fill();g.stroke();
  g.beginPath();g.ellipse(31,-44,7.5,4.6,-.7,0,TAU);g.fill();g.stroke();
  g.beginPath();g.moveTo(22,-49);g.lineTo(23.5,-57);g.lineTo(27,-50);g.closePath();g.fill();g.stroke();
  g.strokeStyle=dark;g.lineWidth=2.6;g.beginPath();g.moveTo(10,-35);g.lineTo(22,-50);g.stroke();
  g.fillStyle='#fff';g.beginPath();g.arc(28,-46,1.1,0,TAU);g.fill();
  leg(-12,ph+2.4,coat);leg(4,ph,coat);
  g.fillStyle=c;g.beginPath();g.moveTo(-7,-34);g.lineTo(6,-34);g.lineTo(6,-25);g.lineTo(-7,-25);g.closePath();g.fill();
  g.fillStyle='#fff';g.font='700 7px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(String(n),-0.5,-29.5);
  g.fillStyle=c;g.beginPath();g.moveTo(-5,-38);g.lineTo(2,-46);g.lineTo(9,-43);g.lineTo(0,-34);g.closePath();g.fill();
  g.strokeStyle=c;g.lineWidth=2.6;g.beginPath();g.moveTo(6,-43);g.lineTo(16,-37);g.stroke();
  g.strokeStyle='#f3ecff';g.lineWidth=2.4;g.beginPath();g.moveTo(-3,-35);g.lineTo(3,-24);g.stroke();
  g.fillStyle='#e0b48f';g.beginPath();g.arc(10,-49,3.6,0,TAU);g.fill();
  g.fillStyle=c;g.beginPath();g.arc(10,-49.5,4,Math.PI,0);g.fill();
  g.restore()}
function hrDraw(now){const g=hrG,run=HRS.run,t=run?(now-HRS.t0)/1000:0;g.setTransform(1,0,0,1,0,0);
  const sky=g.createLinearGradient(0,0,0,70);sky.addColorStop(0,'#0b0a16');sky.addColorStop(1,'#241a14');g.fillStyle=sky;g.fillRect(0,0,HRW,70);
  g.fillStyle='rgba(255,201,74,.85)';for(let i=0;i<9;i++){g.fillRect(40+i*66,18,40,4)}
  g.fillStyle='#2d5a2a';g.fillRect(0,70,HRW,8);
  const L0=HRS.run||HRS.order.length?HRS.order:null;
  const lane=(HRH-88)/6;
  g.fillStyle='#6a4426';g.fillRect(0,78,HRW,HRH-78);
  for(let k=0;k<6;k++){g.fillStyle=k%2?'rgba(0,0,0,.12)':'rgba(255,255,255,.04)';g.fillRect(0,78+k*lane,HRW,lane)}
  g.strokeStyle='rgba(255,255,255,.45)';g.lineWidth=1.5;g.setLineDash([10,8]);for(let k=0;k<=6;k++){g.beginPath();g.moveTo(0,78+k*lane);g.lineTo(HRW,78+k*lane);g.stroke()}g.setLineDash([]);
  g.fillStyle='#e8e0d0';g.fillRect(HRX0-10,78,4,HRH-78);
  for(let i=0;i<8;i++){g.fillStyle=i%2?'#111':'#f3ecff';g.fillRect(HRX1+4,78+i*(HRH-78)/8,10,(HRH-78)/8)}
  for(let i=0;i<6;i++){const y=78+lane*(i+.5),x=HRX0+(run||L0?hrPos(i,t):0)*(HRX1-HRX0);hrHorse(g,x,y+12,HR_COL[i],i+1,t*(6+i*.3)+i,run&&x<HRX1)}
  g.textAlign='left';g.textBaseline='middle';g.font='700 13px "Chakra Petch",sans-serif';
  for(let i=0;i<6;i++){g.fillStyle='rgba(255,255,255,.9)';g.fillText(`${i+1}  ${HR_NAMES[i]}`,8,78+lane*(i+.5))}
  g.fillStyle='#ffc94a';g.textAlign='right';g.font='700 16px "Chakra Petch",sans-serif';g.fillText(run?`${Math.min(20,t).toFixed(1)} s`:'Ready',HRW-10,HRH-10)}
function hrRender(){
  $('hrCash').textContent=fmtCash(me.cash);$('hrMsg').textContent=HRS.last;
  const O=$('hrOdds');O.replaceChildren();
  HR_NAMES.forEach((n,i)=>{const b=document.createElement('button');b.type='button';if(i===HRS.sel)b.className='on';b.disabled=HRS.run;
    const a=document.createElement('span');a.textContent=`${i+1}. ${n}`;const sm=document.createElement('small');sm.textContent=`win ${HRS.D[i]?HRS.D[i].toFixed(2):'-'}x · place ${HRS.Dp[i]?HRS.Dp[i].toFixed(2):'-'}x`;
    b.append(a,sm);b.addEventListener('click',()=>{HRS.sel=i;hrRender()});O.appendChild(b)});
  const C=$('hrChips');C.replaceChildren();for(const v of[10,50,100,500]){const b=document.createElement('button');b.type='button';b.className='b chip'+(HRS.amt===v?' on':'');b.textContent='$'+v;b.addEventListener('click',()=>{HRS.amt=v;hrRender()});C.appendChild(b)}
  const A=$('hrAct');A.replaceChildren();
  const btn=(t,fn,dis,cls)=>{const b=document.createElement('button');b.type='button';b.className='b'+(cls?' '+cls:'');b.textContent=t;b.disabled=!!dis;b.addEventListener('click',fn);A.appendChild(b)};
  btn(`Win $${HRS.amt}`,()=>hrBet('w'),HRS.run||me.cash<HRS.amt,'go');btn(`Place $${HRS.amt}`,()=>hrBet('p'),HRS.run||me.cash<HRS.amt);
  btn(HRS.run?'Racing...':'Run the race',hrStart,HRS.run||!HRS.bets.length,'go');btn('Clear bets',hrClear,HRS.run||!HRS.bets.length);
  const Bd=$('hrBoard');Bd.replaceChildren();for(const r of HRS.board){const e=document.createElement('span');e.textContent=r.map(i=>HR_NAMES[i]).join(' · ');Bd.appendChild(e)}
}
let hrRaf=0;
function hrLoop(){hrRaf=0;if($('horses').hidden)return;hrDraw(performance.now());hrRaf=requestAnimationFrame(hrLoop)}
function openHorses(){openModal('horses');if(!HRS.p.length)hrCard();hrRender();hrDraw(performance.now());if(!hrRaf)hrRaf=requestAnimationFrame(hrLoop)}
// Test helpers: the same draw and payout rules with a seeded rand. Win and place each return about 0.9.
function horseRTP(n){const keep=rand;rand=seeded(3307);let ret=0;try{const p=hrProbs(HR_BASE),D=hrOdds(p).D;for(let i=0;i<n;i++){const h=i%6;if(horsePick(p)[0]===h)ret+=D[h]}}finally{rand=keep}return ret/n}
function horsePlaceRTP(n){const keep=rand;rand=seeded(3308);let ret=0;try{const p=hrProbs(HR_BASE),Dp=hrOdds(p).Dp;for(let i=0;i<n;i++){const h=i%6;if(horsePick(p).slice(0,2).includes(h))ret+=Dp[h]}}finally{rand=keep}return ret/n}
if(DBG)Object.defineProperties(DBG,{enterInt:{get:()=>enterInt},spinWheel:{get:()=>spinWheel},wheelValue:{get:()=>wheelValue},rocketRTP:{get:()=>rocketRTP},pokerRTP:{get:()=>pokerRTP},horseRTP:{get:()=>horseRTP},horsePlaceRTP:{get:()=>horsePlaceRTP},rkS:{get:()=>rkS},drawCalls:{get:()=>renderer.info.render.calls}});

// ---------- Neon 7s ----------
// One line, three reels. Cherries pay anywhere on the line, three of a kind pays on the line. Strips hold 20 stops each.
const N7NAME=['Cherry','Lemon','Bar','Double bar','Bell','7','Neon 7'];
const N7STRIP=(()=>{const a=[0,1,2,3,4,1,0,2,5,1,3,0,4,2,6,1,3,4,2,5];return[a,a.slice().reverse(),a.slice(7).concat(a.slice(0,7))]})();
const N7CH=[0,1,3,10],N7TRI=[0,5,10,20,30,100,150];
function n7Eval(a){const k=a.filter(s=>s===0).length;if(k)return N7CH[k];return a[0]===a[1]&&a[1]===a[2]?N7TRI[a[0]]:0}
function n7Spin(){const si=[0,1,2].map(()=>(rand()*20)|0);return{si,a:si.map((s,r)=>N7STRIP[r][s])}}
const s7={el:$('slots7'),bet:25,busy:false,msg:'Pick a bet and pull.',reels:[0,1,2].map(()=>({p:0,v:0,s:'idle'})),wv:0,shown:0,line:0,skip:false,wq:[]};
// Stop i moves forward from its position: eased travel, then a small nudge back and forth.
function s7Stop(r,si){const d0=((si-r.p)%20+20)%20,d=d0<1.5?d0+20:d0;r.s='tween';r.p0=r.p;r.d=d;r.t0=performance.now();r.dur=slT(420+d*30)}
function s7Step(now,dt){for(const r of s7.reels){
  if(r.s==='spin'){r.v=Math.min(24,r.v+dt*70);r.p+=r.v*dt}
  else if(r.s==='tween'){const q=Math.min(1,(now-r.t0)/r.dur);r.p=r.p0+r.d*(1-Math.pow(1-q,3));if(q>=1){r.s='bump';r.t0=now}}
  else if(r.s==='bump'){const b=Math.min(1,(now-r.t0)/slT(220));r.p=r.p0+r.d-.12*Math.sin(Math.PI*b);if(b>=1){r.s='idle';r.p=r.p0+r.d}}
  r.p=((r.p%20)+20)%20}}
async function s7Spin(){const m=s7;if(m.busy)return;if(me.cash<m.bet){m.msg='Not enough cash.';s7UI();return}
  me.cash-=m.bet;saveArsenal();m.busy=true;m.wv=0;m.line=0;m.msg='Good luck.';s7UI();
  const n=n7Spin(),w=n7Eval(n.a)*m.bet;
  m.reels.forEach(r=>{r.s='spin';r.v=0});sfx(.5,'bandpass',900,.04);
  for(let i=0;i<3;i++){await slWait(m,slT(i?380:900));s7Stop(m.reels[i],n.si[i]);sfx(.05,'bandpass',1500,.12)}
  await slWait(m,m.reels[2].dur+240);
  if(w>0){me.cash+=w;m.wv=w;m.line=performance.now();if(w>=m.bet*20)jingle('pass');else tone('triangle',mf(84),.25,.09)}
  const k=n.a.filter(s=>s===0).length;
  m.msg=w?(k?`${k} cherr${k>1?'ies':'y'} pay $${w.toLocaleString('en-US')}`:`Three ${N7NAME[n.a[0]]} pay $${w.toLocaleString('en-US')}`):'No win.';
  m.busy=false;saveArsenal();s7UI()}
function s7UI(){const m=s7;$('s7Msg').textContent=`${m.msg}  Cash $${me.cash.toLocaleString('en-US')}`;const A=$('s7Act');A.replaceChildren();
  for(const v of[25,100,250,1000,2500])mkBtn(A,'$'+v.toLocaleString('en-US'),()=>{if(!m.busy){m.bet=v;s7UI()}},'chip'+(m.bet===v?' on':''),m.busy);
  mkBtn(A,m.busy?'Spinning...':`Pull $${m.bet.toLocaleString('en-US')}`,s7Spin,'go',m.busy||me.cash<m.bet)}
function s7Draw(now,dt){
  const g=slFit($('s7c'),640,380),k=g.canvas.width/640,S=Math.round(96*k),FF='Bungee,Impact,sans-serif';
  s7Step(now,dt);s7.shown+=(s7.wv-s7.shown)*Math.min(1,dt*9);
  const bg=g.createLinearGradient(0,0,0,380);bg.addColorStop(0,'#24093a');bg.addColorStop(1,'#07030f');g.fillStyle=bg;g.fillRect(0,0,640,380);
  g.fillStyle='#050208';g.strokeStyle='#ffd84a';g.lineWidth=3;g.shadowColor='#ffd84a';g.shadowBlur=18;g.beginPath();g.roundRect(70,22,500,276,16);g.fill();g.stroke();g.shadowBlur=0;
  const lit=s7.line&&now-s7.line<1600;
  s7.reels.forEach((r,i)=>{const x=75+i*170,sp=r.s==='spin'?r.v:0;
    g.save();g.beginPath();g.rect(x,26,150,268);g.clip();
    g.fillStyle='#120a1e';g.fillRect(x,26,150,268);
    for(let j=-3;j<=3;j++){const q=Math.floor(r.p)+j,y=160-(q-r.p)*86,sy=N7STRIP[i][((q%20)+20)%20],mid=j===0,pulse=mid&&lit?1+.07*Math.sin(now/90):1;
      const spr=slSpr('n'+sy,S);
      if(sp>8){g.globalAlpha=.22;g.drawImage(spr,x+75-48,y-48-Math.min(24,sp*1.1),96,96);g.drawImage(spr,x+75-48,y-48+Math.min(24,sp*1.1),96,96);g.globalAlpha=1}
      g.save();g.translate(x+75,y);g.scale(pulse,pulse);g.drawImage(spr,-48,-48,96,96);g.restore()}
    const f1=g.createLinearGradient(0,26,0,96);f1.addColorStop(0,'rgba(5,2,8,1)');f1.addColorStop(1,'rgba(5,2,8,0)');g.fillStyle=f1;g.fillRect(x,26,150,70);
    const f2=g.createLinearGradient(0,240,0,294);f2.addColorStop(0,'rgba(5,2,8,0)');f2.addColorStop(1,'rgba(5,2,8,1)');g.fillStyle=f2;g.fillRect(x,240,150,54);
    g.restore()});
  // payline
  g.save();g.strokeStyle=lit?'#fff3a6':'rgba(255,216,74,.35)';g.lineWidth=lit?4:2;g.shadowColor='#ffd84a';g.shadowBlur=lit?22:6;
  g.beginPath();g.moveTo(54,160);g.lineTo(586,160);g.stroke();g.restore();
  g.fillStyle='#ffd84a';g.beginPath();g.moveTo(44,150);g.lineTo(60,160);g.lineTo(44,170);g.fill();g.beginPath();g.moveTo(596,150);g.lineTo(580,160);g.lineTo(596,170);g.fill();
  // counter
  g.textBaseline='middle';g.textAlign='left';g.fillStyle='#f3ecff';g.font='700 16px "Chakra Petch",system-ui,sans-serif';g.fillText('BET $'+s7.bet.toLocaleString('en-US'),40,340);
  g.textAlign='right';g.fillText('LINE 1',600,340);
  g.textAlign='center';g.save();g.shadowColor='#ff3ea5';g.shadowBlur=16;g.fillStyle='#ffe066';g.font='38px '+FF;g.fillText('$'+Math.round(s7.shown).toLocaleString('en-US'),320,340);g.restore()}

