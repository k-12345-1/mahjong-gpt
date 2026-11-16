import { discardChoices, faanCeiling, fanDirections, handDistance, recommend } from './coach.mjs';
import { clack, meld, say } from './sound.mjs';
import { endCurtain } from './curtain.mjs';
import { washTiles } from './shuffle.mjs';
/* While the table is counting the hands out, the way on is not offered yet: the
   controls would sit over the count asking to be pressed before it has been read. */
let counting=false;
const winds = ['East','South','West','North'];
const windMarks = ['東','南','西','北'];
const suits = ['characters','dots','bamboo'];
const honors = ['east','south','west','north','red-dragon','green-dragon','white-dragon'];
export const faces = [...suits.flatMap(s => Array.from({length:9},(_,i)=>s+'-'+(i+1))), ...honors,
  ...['flower','season'].flatMap(s=>Array.from({length:4},(_,i)=>s+'-'+(i+1)))];
export const label = face => face.replace(/^(characters|dots|bamboo)-(\d)$/, '$2 $1').replaceAll('-', ' ');
/* decoding=async: a board is 50-odd of these, and decoding them on the main thread is
   what kept the table off the screen for the first half second of a new screen */
/* Every tile is drawn at 208x272, and saying so means a row of them takes its right
   height before a single one has loaded: without it the page is laid out around tiles of
   no size at all, and anything measured against that layout -- a line placed in the
   middle of the screen, say -- is measured against the wrong thing. */
export const img = (face,back=false) => '<img class="'+(back?'photo-back':'photo-front')+'" draggable="false" decoding="async" width="208" height="272" alt="" src="tile-art/'+(back?'back.webp':'rendered-fronts/'+face+'.webp')+'">';
export function winning(tiles, melds=0) {
  const counts = Array(34).fill(0);
  for (const tile of tiles) {
    if (tile >= 34) return false;
    counts[tile]++;
  }
  if (tiles.length !== (4-melds)*3+2) return false;
  function sets() {
    const i=counts.findIndex(n=>n>0);
    if(i<0)return true;
    if(counts[i]>=3){counts[i]-=3;const ok=sets();counts[i]+=3;if(ok)return true;}
    if(i<27&&i%9<7&&counts[i+1]&&counts[i+2]){
      counts[i]--;counts[i+1]--;counts[i+2]--;const ok=sets();counts[i]++;counts[i+1]++;counts[i+2]++;return ok;
    }
    return false;
  }
  for(let i=0;i<34;i++)if(counts[i]>=2){
    counts[i]-=2;const ok=sets();counts[i]+=2;if(ok)return true;
  }
  return false;
}
function score(hand,i) {
  const n=hand[i];
  let value=0;
  for(let j=0;j<hand.length;j++){
    if(i===j)continue;
    const other=hand[j];
    if(n===other)value+=5;
    else if(n<27&&Math.floor(n/9)===Math.floor(other/9)){
      if(Math.abs(n-other)===1)value+=3;
      if(Math.abs(n-other)===2)value+=1;
    }
  }
  return value;
}
const suggestion = hand => hand.reduce((best,_,i)=>score(hand,i)<score(hand,best)?i:best,0);
/* The deal passes on after every hand. A seat's wind is its distance from the dealer,
   so the dealer is always East and every seat takes East in turn. */
let dealer=0;
const windOf=p=>(p-dealer+4)%4;
let wall,hands,bonuses,melds,rivers,seat,phase,choice,offer,timer,note,coach,root,onDiscard,canSelfDraw,claimNotice,analysisCache,newTileIndex,lastDiscard;
const levels={
  beginner:{label:'Beginner',think:1000,review:2000},
  intermediate:{label:'Intermediate',think:700,review:1400},
  advanced:{label:'Advanced',think:480,review:700},
};
/* A match is the four winds: East, South, West and North, each a round of its own.
   The deal passes a seat every hand unless the dealer wins and keeps it, so a round
   is four hands or more and a match sixteen or more. */
const ROUNDS=4;
let match={level:'beginner',minFaan:3,round:0,dealt:0,nextDealer:1,
  wins:[0,0,0,0],score:[0,0,0,0],winner:null};
let settings={level:match.level,minFaan:match.minFaan};
const blankMatch=()=>({...settings,round:0,dealt:0,nextDealer:1,
  wins:[0,0,0,0],score:[0,0,0,0],winner:null});
/* What a hand has to be worth to be declared. A beginner table takes a chicken hand,
   which is a hand with nothing in it at all, so its minimum is none. */
const minFaan=()=>match.level==='beginner'?0:match.minFaan;
const seatName=p=>p===0?'You':winds[windOf(p)];
const standings=()=>match.score.map((f,p)=>seatName(p)+' '+f).join(' · ');
/* Where the deal and the round stand once a hand is over. East keeps the deal by
   winning it; otherwise the deal passes, and a round ends when it has been all the
   way round the table. Four rounds -- East, South, West, North -- are a match. */
export function nextDeal({dealer,round,dealt,winner}){
  const keeps=winner===dealer;
  let nextRound=round,nextDealt=dealt;
  if(!keeps&&++nextDealt>=4){nextDealt=0;nextRound++;}
  return {dealer:keeps?dealer:(dealer+1)%4,round:nextRound,dealt:nextDealt,over:nextRound>=ROUNDS};
}
let handDecisions=[], completedHands=[];
let coachOpen=false;
function draw(p){
  while(wall.length){
    const n=wall.pop();
    if(n>=34)bonuses[p].push(n);
    else {hands[p].push(n);return true;}
  }
  return false;
}
/* ---- the table, kept across a reload ------------------------------------------------
   Saved at the one moment a hand can be picked up again exactly as it was left: your own
   turn, nothing in the air, no claim waiting on an answer and no timer half run. That is
   also the moment anyone actually walks away from it. Anywhere else the save is marked
   as between hands, and coming back keeps the standings and deals a fresh one. */
const KEPT='mahjong-table-v1';
function keep(handOver){
  try{localStorage.setItem(KEPT,JSON.stringify({v:1,handOver:!!handOver,
    wall,hands,bonuses,melds,rivers,dealer,match,note,coach,
    completedHands,handDecisions,newTileIndex,canSelfDraw}));}
  catch{/* no store, and a table is not worth failing over */}
}
function restore(){
  let kept;
  try{kept=JSON.parse(localStorage.getItem(KEPT)||'null');}catch{return false;}
  if(!kept||kept.v!==1||!Array.isArray(kept.wall)||!Array.isArray(kept.hands))return false;
  match=kept.match;dealer=kept.dealer;completedHands=kept.completedHands||[];
  if(kept.handOver){reset();return true;}
  ({wall,hands,bonuses,melds,rivers,note,coach,handDecisions,newTileIndex,canSelfDraw}=kept);
  choice=-1;offer=null;claimNotice='';counting=false;coachOpen=false;analysisCache=undefined;
  seat=0;phase='player';
  paint();
  return true;
}

function reset(){
  clearTimeout(timer);
  counting=false;
  handDecisions=[];
  coachOpen=false;
  wall=faces.flatMap((_,i)=>Array(i<34?4:1).fill(i));
  for(let i=wall.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[wall[i],wall[j]]=[wall[j],wall[i]];}
  hands=Array.from({length:4},()=>[]);bonuses=Array.from({length:4},()=>[]);
  melds=Array.from({length:4},()=>[]);rivers=Array.from({length:4},()=>[]);
  for(let i=0;i<13;i++)for(let p=0;p<4;p++)draw(p);
  choice=-1;offer=null;coach=match.level==='beginner';claimNotice='';
  draw(dealer);
  if(dealer===0)sortPlayer();else hands[0].sort((a,b)=>a-b);
  newTileIndex=-1;lastDiscard=null;
  analysisCache=undefined;
  onDiscard?.('');
  note=dealer===0?'Select a tile to discard. The coach can help you compare options.'
    :winds[windOf(dealer)]+' deals and opens the hand.';
  /* The dealer plays the first tile, whoever it is this hand. */
  playTurn(dealer,true);
}
function sortPlayer(){
  const n=hands[0].pop();hands[0].sort((a,b)=>a-b);hands[0].push(n);
}
/* What each hand was worth when the music stopped. The winner is graded on the faan their
   hand actually pays; everyone else on the same scoring features, plus how near they were
   to going out -- which is the honest way to rank four hands when only one of them is
   finished. The round wind is East, as it is on the first round of a sitting. */
/* The faan table follows the modern Hong Kong "new chapter" list: every pattern below
   is scored at the value that list gives it, a hand is capped at the ten-faan limit,
   and the patterns that contain other patterns are counted once, not twice. */
const LIMIT=10;
/* One reading of a closed hand as four sets and a pair, pungs preferred over chows so
   that a hand which can be read as all pungs is. Null when the tiles do not make a
   hand, which is how every pattern that needs complete sets stays out of the count. */
function partition(c,needPair){
  const i=c.findIndex(n=>n>0);
  if(i<0)return needPair?null:[];
  if(c[i]>=3){c[i]-=3;const r=partition(c,needPair);c[i]+=3;if(r)return [{kind:'pung',tile:i},...r];}
  if(i<27&&i%9<7&&c[i+1]&&c[i+2]){c[i]--;c[i+1]--;c[i+2]--;const r=partition(c,needPair);c[i]++;c[i+1]++;c[i+2]++;if(r)return [{kind:'chow',tile:i},...r];}
  if(needPair&&c[i]>=2){c[i]-=2;const r=partition(c,false);c[i]+=2;if(r)return [{kind:'pair',tile:i},...r];}
  return null;
}
const ORPHANS=[0,8,9,17,18,26,27,28,29,30,31,32,33];
/* The count itself takes no part of the table with it: everything it needs is in the
   hand it is given, which is what makes it checkable on its own. */
export function faanFor({concealed:held,exposed,bonuses:flowers,seatWind,roundWind=0,won,selfDraw}){
  const concealed=held.filter(t=>t<34);
  const tiles=[...concealed,...exposed.flat()].filter(t=>t<34);
  const counts=Array(34).fill(0);
  for(const t of tiles)counts[t]++;
  /* The tiles as they are laid out in the seat -- concealed hand first, then the melds
     and bonuses beside it -- so each faan can point at the tiles that earned it. */
  const shown=[...held,...exposed.flat(),...flowers];
  const where=t=>{const out=[];shown.forEach((v,i)=>{if(v===t)out.push(i);});return out;};
  const whereAny=list=>{const out=[];shown.forEach((v,i)=>{if(list.indexOf(v)>=0)out.push(i);});return out;};
  const everything=shown.map((v,i)=>v<34?i:-1).filter(i=>i>=0);
  let faan=0;const had=[],wins=[];
  const add=(tag,why,n,at)=>{faan+=n;had.push(tag);wins.push({why,faan:n,at:at||[]});};
  const done=()=>({faan:Math.min(faan,LIMIT),had,wins});

  /* Thirteen orphans is its own hand and its own limit: nothing else is counted on it. */
  if(won&&tiles.length===14&&ORPHANS.every(t=>counts[t]>=1)&&tiles.every(t=>ORPHANS.indexOf(t)>=0)){
    add('thirteen orphans','The thirteen orphans',13,everything);
    return done();
  }

  const kindOf=m=>m.every(t=>t===m[0])?(m.length>=4?'kong':'pung'):'chow';
  const open=exposed.map(m=>({kind:kindOf(m),tile:m[0]}));
  const closed=Array(34).fill(0);for(const t of concealed)closed[t]++;
  const rest=partition(closed,true);
  const sets=rest?[...open,...rest.filter(s=>s.kind!=='pair')]:null;
  const allPungs=!!sets&&sets.length===4&&sets.every(s=>s.kind!=='chow');
  const allChows=!!sets&&sets.length===4&&sets.every(s=>s.kind==='chow');

  /* All kongs is a limit hand on its own. */
  if(sets&&sets.filter(s=>s.kind==='kong').length===4){
    add('all kongs','Four kongs',13,everything);
    return done();
  }

  const dragonPungs=[31,32,33].filter(d=>counts[d]>=3);
  const dragonPair=[31,32,33].filter(d=>counts[d]===2);
  if(dragonPungs.length===3)add('great three dragons','All three dragons, in pungs',8,whereAny(dragonPungs));
  else if(dragonPungs.length===2&&dragonPair.length===1)
    add('small three dragons','Two dragon pungs and a pair of the third',5,whereAny([...dragonPungs,...dragonPair]));
  else for(const d of dragonPungs)add('dragon pung','Pung of '+label(faces[d]),1,where(d));

  const windPungs=[27,28,29,30].filter(w=>counts[w]>=3);
  const windPair=[27,28,29,30].filter(w=>counts[w]===2);
  const mine=27+seatWind;
  if(windPungs.length===4)add('great four winds','All four winds, in pungs',13,whereAny(windPungs));
  else if(windPungs.length===3&&windPair.length===1)
    add('small four winds','Three wind pungs and a pair of the fourth',6,whereAny([...windPungs,...windPair]));
  else{
    /* The round is East. A pung of East held by East counts twice, once as the seat
       wind and once as the round wind, which is the one place the two stack. */
    if(counts[mine]>=3)add('seat wind','Pung of your own seat wind',1,where(mine));
    const prevailing=27+roundWind;
    if(counts[prevailing]>=3)add('round wind','Pung of the round wind',1,where(prevailing));
  }

  const suits=[0,1,2].filter(su=>tiles.some(t=>t<27&&Math.floor(t/9)===su));
  const honours=tiles.some(t=>t>=27);
  const terminals=tiles.length&&tiles.every(t=>t>=27||t%9===0||t%9===8);
  if(!suits.length&&tiles.length)add('all honours','Honours all the way through',10,everything);
  else if(terminals&&allPungs&&!honours)add('pure terminals','Ones and nines, nothing else',10,everything);
  else if(terminals&&allPungs)add('mixed terminals','Ones, nines and honours only',4,everything);
  else{
    if(suits.length===1&&!honours)add('full flush','One suit and nothing else',7,everything);
    else if(suits.length===1)add('half flush','One suit plus honours',3,everything);
    if(allPungs&&!exposed.length)add('all concealed pungs','Four pungs, not one of them opened',8,everything);
    else if(allPungs)add('all pungs','Every set a pung',3,everything);
  }

  if(won){
    /* All concealed pungs already says the hand was never opened. */
    if(!exposed.length&&had.indexOf('all concealed pungs')<0)
      add('concealed','Won without opening a set',1,[]);
    if(selfDraw)add('self-draw','Won on a tile drawn yourself',1,[]);
    if(!flowers.length)add('no flowers','Finished with no flowers',1,[]);
    else{
      /* A full set of flowers is scored instead of, not as well as, the seat flower
         that sits inside it. */
      const full=[];
      for(const base of [34,38])if([0,1,2,3].every(i=>flowers.indexOf(base+i)>=0)){
        full.push(base);
        add('a full set','All four '+(base===34?'flowers':'seasons'),2,whereAny([base,base+1,base+2,base+3]));
      }
      for(const base of [34,38]){
        if(full.indexOf(base)>=0)continue;
        const own=base+seatWind;
        if(flowers.indexOf(own)>=0)add('own flower','Your own '+label(faces[own]),1,where(own));
      }
    }
    if(allChows)add('all chows','Every set a run',1,everything);
    if(!faan)add('a plain hand','A plain hand, four sets and a pair',1,everything);
  }
  if(faan>LIMIT)had.push('over the limit');
  return done();
}

function grade(p,winner){
  const won=p===winner;
  const r=faanFor({concealed:hands[p],exposed:melds[p],bonuses:bonuses[p],
    seatWind:windOf(p),roundWind:match.round,won,selfDraw:canSelfDraw&&seat===winner});
  const away=handDistance(hands[p].filter(t=>t<34),melds[p].length);
  return {p,won,name:p===0?'You':winds[windOf(p)],mark:windMarks[windOf(p)],faan:r.faan,away,wins:r.wins,
    note:won?(r.had.join(', ')||'a plain hand'):(away<=0?'':away+' tile'+(away===1?'':'s')+' away'),
    score:won?r.faan+' faan':(r.faan?r.faan+' faan held':'—')};
}
/* A finished shape is not always a win: away from a beginner table a hand has to be
   worth the table's minimum before it can be declared. */
function winsWith(p,tiles,selfDraw){
  if(!winning(tiles,melds[p].length))return false;
  const need=minFaan();
  if(!need)return true;
  return faanFor({concealed:tiles,exposed:melds[p],bonuses:bonuses[p],
    seatWind:windOf(p),roundWind:match.round,won:true,selfDraw}).faan>=need;
}

/* How long the tiles are pushed around between hands. */
const WASH_MS=5000;
/* And how long a seat takes over its own turn: the pause between a bot drawing and the
   tile it puts down, which is the pace the table plays at. A preference rather than a
   rule, so it sits beside the match settings but outside them: changing it does not start
   a new match, and it keeps from hand to hand. */
const TURN_CHOICES=[[1000,'1 second'],[3000,'3 seconds'],[5000,'5 seconds'],[7000,'7 seconds'],[10000,'10 seconds']];
let turnMs=TURN_CHOICES[0][0];
let washing=false;

function gradeAll(winner){
  const rows=[0,1,2,3].map(p=>grade(p,winner));
  rows.sort((a,b)=>(a.p===winner?-1:b.p===winner?1:0)||b.faan-a.faan||a.away-b.away);
  return rows;
}
function finish(message,winner){
  if(phase==='ended')return;
  const rows=gradeAll(winner===undefined?-1:winner);
  if(winner!==undefined){
    match.wins[winner]++;
    match.score[winner]+=(rows.find(r=>r.p===winner)||{faan:0}).faan;
  }
  completedHands.push({winner,decisions:handDecisions.slice()});
  /* East keeps the deal by winning it. Otherwise it passes, and once it has been all
     the way round the table the prevailing wind moves on. After North, that is the
     match: the most faan over the four rounds takes it. */
  const next=nextDeal({dealer,round:match.round,dealt:match.dealt,winner});
  match.nextDealer=next.dealer;match.round=next.round;match.dealt=next.dealt;
  message+=' '+standings()+'.';
  if(next.over){
    const best=Math.max(...match.score);
    match.winner=match.score.indexOf(best);
    message+=' '+(match.winner===0?'You take':winds[windOf(match.winner)]+' takes')
      +' the match on '+best+' faan.';
  }
  /* The review is there to be asked for, not shown: it used to open over the table the
     moment a hand ended, which hid everything the table does to close it out. */
  phase='ended';note=message;counting=true;paint();
  if(winner!==undefined)say('Win');
  /* the hand is spent, but the standings it fed into are not */
  keep(true);
  /* the table turns itself over and each hand shows what it was worth */
  const counted=()=>{counting=false;paint();};
  try{endCurtain(root,rows).then(counted,err=>{console.error('curtain failed',err);counted();});}
  catch(err){console.error('curtain failed',err);counting=false;}
}

function opponentDiscard(p){
  const hand=hands[p];
  if(match.level==='advanced'){
    const visible=[...rivers.flat(),...melds.flat(2)];
    /* the strong seats play to the table's minimum, not to shape alone -- otherwise they
       chase hands they could not declare if they finished them */
    return hand.indexOf(recommend(hand,melds[p].length,visible,
      {melds:melds[p],seatWind:27+windOf(p),roundWind:27+match.round,minFaan:minFaan()}).tile);
  }
  if(match.level==='beginner'){
    const options=hand.map((_,i)=>i).sort((a,b)=>score(hand,a)-score(hand,b)).slice(0,3);
    return options[Math.floor(Math.random()*options.length)];
  }
  return suggestion(hand);
}
function playTurn(p, drawn){
  seat=p;choice=-1;offer=null;canSelfDraw=drawn;
  phase=p===0?'player':'bot';
  if(p===0)newTileIndex=drawn?hands[0].length-1:-1;
  paint();
  if(p===0)keep(false);
  if(p!==0)timer=setTimeout(()=>{
    /* One seat's turn is one link in a chain of timers: if it throws, nothing schedules the
       next one and the hand stops where it stands with no way back. Whatever went wrong,
       the seat still plays a tile. */
    try{
      if(drawn&&winsWith(p,hands[p],true)){finish(winds[windOf(p)]+' wins by self-draw.',p);return;}
      discard(p,opponentDiscard(p));
    }catch(err){
      console.error('turn failed, playing on',err);
      try{discard(p,0);}catch(again){console.error('could not discard either',again);takeTurn((p+1)%4);}
    }
  },turnMs);
}
/* Every repaint is a sign of life. If the table has not moved for eight seconds while it
   is nobody's turn to act, a timer was lost somewhere and the hand would sit there for
   good -- so the next seat is sent on. Our own turn waits as long as it likes. */
let beats=0,lastBeat=-1,quiet=0;
setInterval(()=>{
  if(phase!=='bot'&&phase!=='review'){quiet=0;lastBeat=beats;return;}
  if(beats!==lastBeat){lastBeat=beats;quiet=0;return;}
  /* ...but it has to outwait the pace the table is set to, or a slow seat looks like a
     lost timer and gets sent on before it has played */
  if(++quiet<Math.max(4,Math.ceil((turnMs+4000)/2000)))return;
  quiet=0;
  console.warn('the table stopped moving; sending the turn on');
  try{clearTimeout(timer);takeTurn((seat+1)%4);}catch(err){console.error(err);}
},2000);
function takeTurn(p){
  if(!draw(p)){finish('The wall is empty. This hand ends in a draw.');return;}
  playTurn(p,true);
}
/* ---- the table, in words -----------------------------------------------------------
   So the coach can be asked about the hand in front of you and not only about mahjong in
   general. Names, not tile numbers: this is read by something that reads English. Null
   while no hand is in play, which is the signal to answer about the rules instead. */
export function tableState(){
  if(!hands||!hands[0]||!hands[0].length)return null;
  const name=t=>label(faces[t]);
  const meldsOf=p=>melds[p].map(m=>m.map(name).join(' ')).join(' / ')||'nothing down';
  return {
    yourHand:hands[0].filter(t=>t<34).map(name),
    yourSetsFaceUp:meldsOf(0),
    yourFlowers:bonuses[0].map(name).join(', ')||'none',
    yourSeatWind:winds[windOf(0)],
    roundWind:winds[match.round],
    minimumToGoOut:minFaan()?minFaan()+' faan':'none, a chicken hand pays',
    tilesLeftInWall:wall.filter(t=>t<34).length,
    whoseTurn:phase==='player'?'yours':'not yours',
    discardsSoFar:rivers.map((r,p)=>seatName(p)+': '+(r.map(name).join(', ')||'nothing yet')),
    opponentSetsFaceUp:[1,2,3].map(p=>seatName(p)+': '+meldsOf(p)),
  };
}

export function claimOptions(hand, meldCount, n, next, replacementAvailable, worthIt){
  const options=[];
  if(winning([...hand,n],meldCount)&&(!worthIt||worthIt([...hand,n])))options.push({name:'Win',priority:3});
  if(meldCount>=4)return options;
  const matching=hand.filter(x=>x===n).length;
  if(matching>=3&&replacementAvailable)options.push({name:'Kong',use:[n,n,n],priority:2});
  if(matching>=2)options.push({name:'Pung',use:[n,n],priority:2});
  if(next&&n<27)for(let start=n-2;start<=n;start++){
    const run=[start,start+1,start+2];
    const use=run.filter(x=>x!==n);
    if(start>=0&&run.every(x=>Math.floor(x/9)===Math.floor(n/9))&&use.every(x=>hand.includes(x)))
      options.push({name:'Chow '+run.map(x=>x%9+1).join('–'),use,priority:1});
  }
  /* A chow is called a chow. The run is only on the button when there is more than one
     to choose between, and it never goes into what is said or announced. */
  const chows=options.filter(o=>callOf(o)==='Chow');
  if(chows.length===1)chows[0].name='Chow';
  return options;
}
/* what a claim is called, with any run stripped off the end */
export const callOf=o=>o.name.startsWith('Chow')?'Chow':o.name;
const RIVER_PLACES = 4;
const tileName = tile => label(faces[tile]);
const distanceText = distance => distance===0?'one tile from a complete hand':
  distance===-1?'a complete hand':distance+' steps from ready';
function playerChoices(){
  const visible=[...rivers.flat(),...melds.flat(2)];
  const key=JSON.stringify([hands[0],melds[0].length,visible,minFaan()]);
  if(analysisCache?.key!==key){
    const choices=discardChoices(hands[0],melds[0].length,visible);
    /* The hand is read once and the table and the coach panel are both shown that one
       reading, so the ring on a tile and the sentence in the panel cannot disagree. */
    analysisCache={key,choices,pick:recommend(hands[0],melds[0].length,visible,
      {choices,melds:melds[0],seatWind:27+windOf(0),roundWind:27+match.round,minFaan:minFaan()})};
  }
  return analysisCache.choices;
}
const coachPick=()=>{playerChoices();return analysisCache.pick;};
/* What to do with the tile being offered: a set is worth taking when it leaves the hand
   nearer ready than it is now, and a kong neither helps nor hurts the shape. */
function claimAdvice(){
  const current=handDistance(hands[0],melds[0].length);
  const need=minFaan();
  const seat={seatWind:27+windOf(0),roundWind:27+match.round};
  /* What the hand could still be worth once the call is face up. A set put down cannot be
     picked up again, so a call that puts the minimum out of reach is not a call at all,
     whatever it does for the shape. */
  const ceilingAfter=o=>{
    if(!o.use)return Infinity;
    const rest=hands[0].slice();
    for(const tile of o.use)rest.splice(rest.indexOf(tile),1);
    return faanCeiling(rest,[...melds[0],[...o.use,offer.n].sort((a,b)=>a-b)],seat);
  };
  /* A pung of a dragon, or of your own seat or the round wind, buys a faan outright and
     cannot be made as a run later. It is worth taking even where it does nothing for the
     shape, which is the opposite of how a chow is worth taking. */
  const pays=new Set([31,32,33,27+windOf(0),27+match.round]);
  const read=offer.options.map(o=>({o,after:o.name==='Win'?-2:o.name==='Kong'?current:claimDistance(o),
      ceiling:o.name==='Win'?Infinity:ceilingAfter(o),
      value:o.name==='Pung'&&pays.has(offer.n)?1:0}))
    .filter(x=>x.after!==null&&x.after!==undefined);
  const legal=read.filter(x=>!need||x.ceiling>=need);
  const best=legal.sort((a,b)=>b.value-a.value||a.after-b.after)[0];
  if(best&&best.o.name==='Win')return {take:best.o,why:'the hand is there, so take it'};
  if(best&&best.value)return {take:best.o,why:'a pung of '+tileName(offer.n)+' is a faan in itself, and it cannot be made as a run later'};
  if(best&&best.after<current)return {take:best.o,why:'it leaves you '+distanceText(best.after)};
  if(need&&!legal.length&&read.length)
    return {take:null,why:'every call here would put '+need+' faan out of reach, and a hand that cannot be declared is not worth opening'};
  return {take:null,why:'no call here brings you nearer ready, and passing keeps your hand concealed'};
}
function reviewContent(){
  const scope=match.winner===null?completedHands.slice(-1):completedHands;
  const decisions=scope.flatMap(hand=>hand.decisions);
  const strong=decisions.filter(x=>x.kind==='strong');
  const improve=decisions.filter(x=>x.kind==='improve');
  const calls=decisions.filter(x=>x.kind==='call');
  const list=items=>'<ul>'+items.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
  const wins=scope.filter(h=>h.winner===0).length;
  const positives=[];
  if(wins)positives.push('You won '+wins+(wins===1?' hand.':' hands.'));
  if(strong.length)positives.push(strong.length+' discard'+(strong.length===1?' tied':'s tied')+' the best option for hand shape and unseen improving copies. '+strong[0].text);
  const efficientCall=calls.find(x=>x.efficient);
  if(efficientCall)positives.push(efficientCall.text);
  const next=improve.slice().sort((a,b)=>b.cost-a.cost).slice(0,3).map(x=>x.text);
  if(improve.length)next.push('Before discarding, compare hand distance first, then how many unseen tiles improve each option.');
  if(calls.some(x=>!x.efficient))next.push('Before calling, check what it does to your hand shape and how you plan to earn fan with an open hand.');
  const scopeText=match.winner===null?'This hand':'Across '+scope.length+' completed hands';
  return '<p><strong>'+note+'</strong></p><p>'+scopeText+' · '+decisions.length+' decisions reviewed</p>'+
    '<h3>What went well</h3>'+list(positives.length?positives:['No clear strengths to highlight from the decisions recorded.'])+
    '<h3>What to work on</h3>'+list(next.length?next:['No lower-ranked discards stood out. In the next hand, practice identifying a path to 3 fan early.'])+
    (decisions.length?'<details><summary>Review every discard and call</summary><ol>'+decisions.map(x=>'<li>'+x.text+'</li>').join('')+'</ol></details>':'');
}
function claimDistance(opt){
  if(!opt.use||opt.name==='Kong')return null;
  const hand=hands[0], rest=hand.slice();
  for(const tile of opt.use)rest.splice(rest.indexOf(tile),1);
  return Math.min(...rest.map((_,i)=>handDistance(rest.filter((_,j)=>i!==j),melds[0].length+1)));
}
/* The coach speaks in the line under the table and nowhere else: the reading that used to
   open over the board has gone. What is left of the panel is the review of a finished
   hand, which is asked for by name. */
function discard(p,i){
  const hand=hands[p], n=hand[i];
  if(p===0){
    onDiscard?.(label(faces[n]));
    const options=playerChoices();
    const best=coachPick(), played=options.find(x=>x.tile===n);
    note='You discarded '+tileName(n)+', leaving '+played.copies+' unseen improving copies.';
    if(played.distance>best.distance)note+=' Discarding '+tileName(best.tile)+' instead would leave you '+distanceText(best.distance)+'.';
    else if(played.copies<best.copies)note+=' '+tileName(best.tile)+' kept the same hand distance with '+best.copies+' improving copies.';
    else note+=' That ties the strongest discard by hand distance and improving copies.';
    const distanceCost=played.distance-best.distance;
    const copyCost=best.copies-played.copies;
    handDecisions.push({
      kind:distanceCost>0||copyCost>0?'improve':'strong',
      cost:distanceCost*150+copyCost,
      text:note,
    });
  }
  hand.splice(i,1);rivers[p].push(n);clack();
  if(p===0)newTileIndex=-1;
  lastDiscard={p,n,index:rivers[p].length-1};
  claimNotice='';
  resolveDiscard(p,n);
}
function resolveDiscard(p,n,proceed=false){
  const next=(p+1)%4;
  const candidates=[1,2,3].flatMap(distance=>{
    const player=(p+distance)%4;
    return claimOptions(hands[player],melds[player].length,n,distance===1,wall.some(x=>x<34),
      tiles=>winsWith(player,tiles,false))
      .map(option=>({...option,player,distance}));
  });
  const bot=candidates.filter(x=>x.player!==0).sort((a,b)=>b.priority-a.priority||a.distance-b.distance)[0];
  const options=candidates.filter(x=>x.player===0&&(!bot||x.priority>bot.priority||
    (x.priority===bot.priority&&x.distance<bot.distance)));
  if(!proceed&&options.length){
    offer={p,n,options,bot};phase='offer';choice=-1;paint();return;
  }
  if(p!==0&&!proceed){
    phase='review';paint();
    const delay=levels[match.level].review;
    timer=setTimeout(()=>{
      try{resolveDiscard(p,n,true);}
      catch(err){console.error('claim check failed, playing on',err);takeTurn(next);}
    },delay);
    return;
  }
  if(bot)resolveClaim(p,n,bot);
  else takeTurn(next);
}
function resolveClaim(p,n,opt){
  const player=opt.player;
  const who=player===0?'You':winds[windOf(player)];
  rivers[p].pop();
  lastDiscard=null;
  if(opt.name==='Win'){
    hands[player].push(n);
    finish(who+(player===0?' win on ':' wins on ')+label(faces[n])+'.',player);return;
  }
  for(const tile of opt.use)hands[player].splice(hands[player].indexOf(tile),1);
  melds[player].push([...opt.use,n].sort((a,b)=>a-b));
  /* the call is sounded and spoken, whoever made it */
  meld();say(callOf(opt));
  claimNotice=who+' called '+callOf(opt)+' on '+label(faces[n])+'.';
  if(opt.name==='Kong')takeTurn(player);
  else playTurn(player,false);
}
function claim(i){
  const {p,n,options}=offer;
  const opt=options[i];
  const after=claimDistance(opt);
  const before=handDistance(hands[0],melds[0].length);
  const impact=after===null?'':after<before?' It moved you closer to ready.':after===before?' It kept the same distance to ready.':' It left you farther from ready.';
  handDecisions.push({kind:'call',efficient:opt.name==='Win'||(after!==null&&after<before),text:'Called '+callOf(opt)+' on '+tileName(n)+'.'+impact});
  resolveClaim(p,n,opt);
}
function row(list){return list.map(n=>img(faces[n])).join('');}
function seatHTML(p){
  /* Melds and flowers are two different things and take two lines. Run together they
     made one line long enough to reach the next seat, which is what pushed tiles off
     the edge of the felt and out of sight. */
  const open=melds[p].flat();
  /* The tile the coach would throw is marked on the tile itself, so the advice is read
     where the decision is made instead of behind a button. */
  const pickIndex=p===0&&coach&&phase==='player'?hands[0].indexOf(coachPick()?.tile):-1;
  const hand=p===0?hands[0].map((n,i)=>'<button type="button" data-practice="tile" class="'+(i===newTileIndex?'newly-drawn ':'')+(i===pickIndex?'coach-pick':'')+'" draggable="'+(phase==='player')+'" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Delete" data-i="'+i+'" aria-label="'+label(faces[n])+(i===newTileIndex?', newly drawn':'')+'" aria-pressed="'+(i===choice)+'" '+(phase!=='player'?'disabled':'')+'>'+img(faces[n])+'</button>').join(''):hands[p].map(n=>phase==='ended'?img(faces[n]):img('',true)).join('');
  return '<div class="practice-seat p'+p+'" role="group" aria-label="'+winds[windOf(p)]+(p===0?' player hand':' concealed opponent hand')+'"><div class="practice-hand">'+hand+'</div><div class="practice-exposed">'+row(open)+'</div>'+
    '<div class="practice-exposed practice-bonus">'+row(bonuses[p])+'</div></div>';
}
/* One line under the table, and the whole of what the coach says: there is no panel to
   open any more. It is there only while the coach is on -- when it is not your move there
   is nothing to advise, though the line stays put so the controls below it do not jump. */
function coachTip(){
  if(!coach||counting||phase==='ended')return '';
  const mark='<p class="practice-tip"><span class="practice-tip-mark">Coach</span>'
    +'<span class="practice-tip-say">';
  if(phase==='offer'){
    const {take,why}=claimAdvice();
    return mark+(take?'<b>Take the '+callOf(take).toLowerCase()+'</b>':'<b>Pass</b>')
      +' \u2014 '+why+'</span></p>';
  }
  /* While the table plays on there is nothing to advise -- but the line stays, because a
     row that came and went every turn would shift the controls under it each time. */
  if(phase!=='player')return mark+'Watching the table.</span></p>';
  const pick=coachPick();
  if(!pick)return '';
  /* If you have already picked a different tile up, the line says what that one costs
     rather than repeating itself. */
  const mine=choice>=0?playerChoices().find(x=>x.tile===hands[0][choice]):null;
  /* Where the two are the same distance from ready, the distance says nothing: what
     separates them is how many tiles are left that would improve each. */
  const against=mine&&mine.tile!==pick.tile
    ?' <i>'+tileName(mine.tile)+(mine.distance>pick.distance
        ?' would leave you '+distanceText(mine.distance)+'.'
        :' is the same distance, on '+mine.copies+' improving tiles against '+pick.copies+'.')+'</i>'
    :'';
  return mark+'<b>Discard '+tileName(pick.tile)+'</b> \u2014 '+pick.why+'.'+against
    +'</span></p>';
}
function matchPanel(){
  const faanOptions=[0,1,2,3,5];
  /* The settings are the settings: no score line, no disclosure to open, no paragraph
     explaining the levels. Three choices and the button that starts a match. */
  return '<div class="practice-match"><div class="practice-match-settings">'+
    '<label>Difficulty <select data-match="level">'+
    Object.entries(levels).map(([id,level])=>'<option value="'+id+'" '+(settings.level===id?'selected':'')+'>'+level.label+'</option>').join('')+
    '</select></label>'+
    '<label>Faan minimum <select data-match="minFaan"'+(settings.level==='beginner'?' disabled':'')+'>'+
    faanOptions.map(n=>'<option value="'+n+'" '+(settings.minFaan===n?'selected':'')+'>'+n+'</option>').join('')+
    '</select></label>'+
    '<label>Between turns <select data-match="turn">'+
    TURN_CHOICES.map(([ms,label])=>'<option value="'+ms+'" '+(turnMs===ms?'selected':'')+'>'+label+'</option>').join('')+
    '</select></label>'+
    '<label class="practice-switch"><span>Play with coach</span>'+
    '<input type="checkbox" data-match="coach" '+(coach?'checked':'')+'></label>'+
    '<p class="muted practice-match-note">'+(settings.level==='beginner'
      ?'A beginner table takes a chicken hand, so any four sets and a pair can be declared.'
      :'A hand has to be worth the minimum before it can be declared.')
      +' A match is four rounds, East through North, and the deal passes each hand unless East wins it.</p>'+
    '<button class="btn" data-practice="new-match">Start new match</button>'+
  '</div></div>'
}
function paint(){
  if(!root?.isConnected)return;
  const status=phase==='ended'?note:phase==='offer'?'Claim '+label(faces[offer.n])+' or pass':phase==='player'?(newTileIndex>=0?'You drew '+tileName(hands[0][newTileIndex])+' · Your discard':'Your discard'):'Opponent’s turn';
  const priorRivers = [...root.querySelectorAll('.practice-river')].map(river => ({
    count: river.childElementCount, top: river.scrollTop,
  }));
  root.innerHTML='<div class="practice-layout"><section>'+matchPanel()+'<div class="practice-board" aria-label="Overhead mahjong table">'+hands.map((_,p)=>seatHTML(p)).join('')+
    '<div class="practice-center">'+rivers.map((list,p)=>{
      /* A seat shows four discards at a time, in four fixed places. The fifth takes the
         place of the oldest, the sixth the place of the one after it, and so on, so a pile
         never outgrows its corner of the table. */
      const places=Array(RIVER_PLACES).fill(null);
      list.forEach((n,i)=>{places[i%RIVER_PLACES]={n,i};});
      /* the place your next discard would take, marked so a drag can point at it */
      const nextPlace=p===0?list.length%RIVER_PLACES:-1;
      return '<div class="practice-river r'+p+'" aria-label="'+winds[windOf(p)]+' discards">'+
        places.map((place,slot)=>'<span class="discard-slot'+
          (slot===nextPlace?' next-place':'')+
          (place&&lastDiscard?.p===p&&lastDiscard.index===place.i?' latest-discard':'')+'">'+
          (place?img(faces[place.n]):'')+'</span>').join('')+'</div>';
    }).join('')+'</div>'+
    /* the compass sits in the middle of the felt, each wind at its own seat: yours at the
       near edge, and the seat whose turn it is lit */
    '<div class="practice-compass" aria-hidden="true">'+
      windMarks.map((_,p)=>'<span class="w'+p+(seat===p?' turn':'')+'">'+windMarks[windOf(p)]+'</span>').join('')+
      /* the rose at the middle of the plate, as the indicator on a table has */
      /* an eight point rose: long points to the winds, short ones between */
      '<svg class="practice-rose" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><circle cx="24" cy="24" r="14.4"/><circle cx="24" cy="24" r="12.6"/><path d="M32.91 15.09L29.58 23.51L24.49 18.42Z M32.91 32.91L24.49 29.58L29.58 24.49Z M15.09 32.91L18.42 24.49L23.51 29.58Z M15.09 15.09L23.51 18.42L18.42 23.51Z"/><path d="M24.00 2.50L28.03 20.11L19.97 20.11Z M45.50 24.00L27.89 28.03L27.89 19.97Z M24.00 45.50L19.97 27.89L28.03 27.89Z M2.50 24.00L20.11 19.97L20.11 28.03Z"/><circle cx="24" cy="24" r="4.3" fill="none"/></svg>'+

    '</div></div>'+coachTip()+
    '<div class="actions practice-actions"><span class="practice-status" aria-live="polite">'+(claimNotice?claimNotice+' ':lastDiscard&&lastDiscard.p!==0?winds[windOf(lastDiscard.p)]+' discarded '+tileName(lastDiscard.n)+'. ':'')+status+' · '+winds[match.round]+' round · '+wall.length+' in wall</span>'+(phase==='offer'?offer.options.map((o,i)=>'<button class="btn" data-practice="claim" data-i="'+i+'">'+o.name+'</button>').join('')+'<button class="btn ghost" data-practice="pass">Pass</button>':'')+
    (phase==='player'&&canSelfDraw&&winsWith(0,hands[0],true)?'<button class="btn" data-practice="win">Win</button>':'')+
    /* A hand that has ended always offers the way on. Wins to match defaults to one, so the
       first win -- anyone's -- takes the match, and the only control that started another
       used to be the one off the screen: the table just sat there looking stopped. */
    (phase==='ended'&&!counting?(match.winner===null
      ?'<button class="btn" data-practice="reset">Next hand</button>'
      :'<button class="btn" data-practice="new-match">Start new match</button>'):'')+
    /* no standing coach button: the bar is empty unless the hand asks something of you */
    (phase==='ended'&&!counting?'<button class="btn ghost" data-practice="open-coach">Review</button>':'')+'</div></section>'+
    '<dialog class="practice-coach" aria-labelledby="practice-coach-title"><button class="coach-close" type="button" data-practice="close-coach" aria-label="Close coach" autofocus>×</button><span class="eyebrow">Table coach</span><h2 id="practice-coach-title">'+(match.winner===null?'Hand review':'Match review')+'</h2>'+(coachOpen?reviewContent():'')+'<p class="muted">Practice rules · The coach measures standard hand shape and suggests fan paths. The practice table accepts shape-only wins. Improving copies count unseen tiles, including tiles opponents may hold.</p></dialog></div>';
  beats++;
  const dialog=root.querySelector('.practice-coach');
  if(coachOpen&&dialog){
    dialog.addEventListener('cancel',event=>{
      event.preventDefault();
      closeCoach();
    });
    dialog.showModal();
  }

  root.querySelectorAll('.practice-river').forEach((river,p)=>{
    const prior=priorRivers[p];
    if(prior)river.scrollTop=river.childElementCount>prior.count?river.scrollHeight:prior.top;
  });
}
function closeCoach(){
  coachOpen=false;
  root.querySelector('.practice-coach')?.close();
  root.querySelector('[data-practice="open-coach"]')?.focus();
}
function moveTile(from,to){
  const hand=hands[0];
  if(phase!=='player'||!Number.isInteger(from)||!Number.isInteger(to)||
    from<0||to<0||from>=hand.length||to>=hand.length||from===to)return;
  if(newTileIndex===from)newTileIndex=to;
  else if(from<newTileIndex&&to>=newTileIndex)newTileIndex--;
  else if(from>newTileIndex&&to<=newTileIndex&&newTileIndex>=0)newTileIndex++;
  const [tile]=hand.splice(from,1);
  hand.splice(to,0,tile);
  choice=to;
  paint();
  root.querySelector('[data-practice="tile"][data-i="'+to+'"]')?.focus();
}

export function mountPractice(el, onPlayerDiscard){
  root=el;
  onDiscard=onPlayerDiscard;
  if(!wall&&!restore())reset();
  const tileButton = target => target.closest('[data-practice="tile"]');
  let dragIndex = -1;
  let dropTarget, dropClass, dragged, ghost;
  function clearTarget(){
    if(dropTarget)dropTarget.classList.remove(dropClass);
    dropTarget=undefined;
  }
  const discardArea = target => target.closest('.practice-river.r0');
  el.ondragstart=e=>{
    const tile=tileButton(e.target);
    if(phase!=='player'||!tile||!e.dataTransfer)return;
    dragIndex=Number(tile.dataset.i);
    dragged=tile;
    /* The browser's own drag picture is a snapshot of the element, and snapshots leave
       outlines out -- so the tile that travels with the cursor is built here instead, with
       the gold drawn as a border, which a snapshot does keep. */
    const face=tile.querySelector('img');
    if(face&&e.dataTransfer.setDragImage){
      const box=face.getBoundingClientRect();
      ghost=document.createElement('div');
      ghost.className='drag-ghost';
      const copy=face.cloneNode(true);
      copy.style.width=box.width+'px';copy.style.height=box.height+'px';
      ghost.append(copy);
      document.body.append(ghost);
      e.dataTransfer.setDragImage(ghost,box.width/2+4,box.height/2+4);
    }
    /* a frame late: the snapshot is taken as this handler returns, and the tile has to be
       in the line for it */
    requestAnimationFrame(()=>{
      if(dragged===tile)tile.classList.add('dragging');
      if(ghost){ghost.remove();ghost=null;}
    });
    el.classList.add('dragging-hand-tile');
    e.dataTransfer.effectAllowed='move';
    e.dataTransfer.setData('text/plain',String(dragIndex));
  };
  function insertionAfter(tile,x){
    const box=tile.getBoundingClientRect();
    return x>=box.left+box.width/2;
  }
  el.ondragover=e=>{
    const target=tileButton(e.target) ?? discardArea(e.target);
    if(phase!=='player'||dragIndex<0||!target||!e.dataTransfer){clearTarget();return;}
    e.preventDefault();
    e.dataTransfer.dropEffect='move';
    const marker=tileButton(e.target)
      ?(insertionAfter(target,e.clientX)?'insert-after':'insert-before')
      :'tile-drop-target';
    if(target!==dropTarget||marker!==dropClass){
      clearTarget();dropTarget=target;dropClass=marker;target.classList.add(marker);
    }
  };
  function endDrag(){
    dragIndex=-1;
    clearTarget();
    if(ghost){ghost.remove();ghost=null;}
    if(dragged)dragged.classList.remove('dragging');
    dragged=undefined;
    el.classList.remove('dragging-hand-tile');
  }
  el.ondrop=e=>{
    const tile=tileButton(e.target);
    const river=discardArea(e.target);
    const from=dragIndex;
    endDrag();
    if(phase!=='player'||from<0||from>=hands[0].length||(!tile&&!river))return;
    e.preventDefault();
    if(river)discard(0,from);
    else{
      const insertion=Number(tile.dataset.i)+Number(insertionAfter(tile,e.clientX));
      moveTile(from,insertion-Number(from<insertion));
    }
  };
  el.ondragend=endDrag;
  el.onkeydown=e=>{
    const tile=tileButton(e.target);
    if(tile&&phase==='player'&&e.key==='Delete'){
      e.preventDefault();
      discard(0,Number(tile.dataset.i));
      return;
    }
    if(!tile||!e.altKey||!['ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();
    const i=Number(tile.dataset.i);
    moveTile(i,i+(e.key==='ArrowLeft'?-1:1));
  };
  el.onchange=e=>{
    const control=e.target;
    /* The minimum is repainted with the level, because a beginner table does not
       hold a hand to one and the control says so by going quiet. */
    if(control.dataset.match==='level'&&Object.hasOwn(levels,control.value)){settings.level=control.value;paint();}
    if(control.dataset.match==='minFaan'&&[0,1,2,3,5].includes(Number(control.value)))settings.minFaan=Number(control.value);
    if(control.dataset.match==='turn'&&TURN_CHOICES.some(([ms])=>ms===Number(control.value)))turnMs=Number(control.value);
    if(control.dataset.match==='coach'){coach=control.checked;paint();}
  };
  el.onclick=e=>{
    const b=e.target.closest('[data-practice]');if(!b)return;
    const i=Number(b.dataset.i);
    switch(b.dataset.practice){
      case 'tile': if(phase==='player'){if(i===choice){discard(0,i);break;}choice=i;paint();root.querySelector('[data-practice="tile"][data-i="'+i+'"]')?.focus();}break;
      case 'claim': if(phase==='offer')claim(i);break;
      case 'pass': if(phase==='offer'){const {p,bot,n}=offer;handDecisions.push({kind:'pass',text:'Passed on '+tileName(n)+' without opening another set.'});if(bot)resolveClaim(p,n,bot);else takeTurn((p+1)%4);}break;
      case 'win': if(phase==='player'&&canSelfDraw&&winsWith(0,hands[0],true))finish('You win by self-draw.',0);break;
      case 'open-coach': coachOpen=true;paint();break;
      case 'close-coach': closeCoach();break;
      /* The tiles are washed first, the way they are at a table, and the hand is dealt
         when that is done. The press is taken once: a second one lands on nothing. */
      case 'reset':
        if(phase==='ended'&&match.winner===null&&!washing){
          endDrag();washing=true;
          const deal=()=>{washing=false;dealer=match.nextDealer;reset();paint();};
          washTiles(root&&root.querySelector('.practice-board'),WASH_MS).then(deal,deal);
        }
        break;
      case 'new-match': endDrag();washing=false;completedHands=[];match=blankMatch();dealer=0;reset();paint();break;
    }
  };
  paint();
}
