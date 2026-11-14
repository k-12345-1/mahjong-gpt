import { mountPractice } from './practice.mjs';
import { mountGpt, resetGpt } from './gpt.mjs';
import { mountLearn, learnStep, learnReset } from './learn.mjs';
import { clack, volume, setVolume } from './sound.mjs';
const app = document.querySelector('#app');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const motion = (target, frames, options) => {
  if (!reduce.matches && target) window.Motion?.animate(target, frames, options);
};
const lessons = [
  {title:'Meet the tiles', intro:'There are three numbered suits: bamboo, circles, and characters. Winds and dragons are honor tiles.', task:'Which of these is an honor tile?', row:['3b','7d','N','2c'], answer:[2], note:'North is a wind, so it belongs to the honor tiles.'},
  {title:'Build a chow', intro:'A chow is three consecutive numbers in the same suit.', task:'Pick the three tiles that form a chow.', row:['2b','3b','4d','4b','7d'], answer:[0,1,3], note:'2, 3, and 4 Bamboo form a run in the same suit.'},
  {title:'Build a pung', intro:'A pung is three identical tiles. Honor tiles can form pungs, too.', task:'Pick the three matching tiles.', row:['E','7d','E','2c','E'], answer:[0,2,4], note:'Three East winds make a pung.'},
  {title:'Find the pair', intro:'A standard winning shape has four sets and a pair. Scoring requirements depend on the table rules.', task:'Pick the two tiles that can serve as a pair.', row:['2b','7d','8b','7d','N'], answer:[1,3], note:'The two 7 Circles are identical, so they form a pair.'},
];
let lesson = 0, selected = [], feedback = '', completed = new Set();
const messages = [];
let attach = false;
let lastDiscard = '';
const honors = {N:['北','North'],E:['東','East'],S:['南','South'],W:['西','West'],R:['中','Red dragon']};
const chinese = '一二三四五六七八九';
function describe(code) {
  if (honors[code]) return honors[code][1];
  return code[0] + ' ' + ({b:'Bamboo',d:'Circles',c:'Characters'}[code[1]]);
}
function tile(code, i, active = false, mini = false) {
  const [n, suit] = code;
  const label = describe(code);
  const mark = honors[code]?.[0] ?? (suit === 'c' ? chinese[n-1] : n);
  const name = honors[code] ? (code === 'R' ? 'DRAGON' : 'WIND') : ({b:'BAM',d:'DOT',c:'萬'}[suit]);
  const classes = 'tile ' + ((suit==='c'||code==='R')?'red':suit==='d'?'blue':'') + (active?' active':'') + (mini?' mini':'');
  const pips = (suit === 'b' || suit === 'd') && !honors[code];
  const art = pips ? '<span class="pips '+suit+' pips-'+n+'" aria-hidden="true">'+'<i></i>'.repeat(Number(n))+'</span>' : '<span class="mark">'+mark+'</span>';
  const face = '<span class="tile-face">'+art+'<small>'+name+'</small></span>';
  return i === null ? '<span class="'+classes+'" role="img" aria-label="'+label+'">'+face+'</span>'
    : '<button class="'+classes+'" type="button" data-tile="'+i+'" aria-label="'+label+'" aria-pressed="'+active+'">'+face+'</button>';
}
function route() {
  const key = location.hash.slice(1);
  return ['play','instructions','gpt'].includes(key) ? key : 'play';
}
function banner(id) {
  const copy = {play:['01 / THE TABLE','PLAY','Take a seat. Practice a few turns and see what each discard changes.'],
    instructions:['02 / THE SCHOOL','INSTRUCTIONS','Learn Hong Kong mahjong one move at a time. Pick up the tiles and try it.'],
    gpt:['03 / THE COACH','GPT','Ask about a rule, a hand, or a move you want to understand.']};
  const [label,title,description] = copy[id];
  /* the same drawing the home page carries, and at a seventh of the weight: the PNG was
     2.3 MB for something shown 400px wide at .62 opacity, and it was fetched and decoded
     before the table could be painted */
  return '<section class="hero"><img src="../dragon.webp" alt="" width="1024" height="1536" decoding="async" fetchpriority="low"><div class="wrap"><span class="eyebrow">'+label+'</span><h1>'+title+'</h1><p>'+description+'</p></div></section>';
}
function shell(id, body) {
  app.dataset.section = id;
  app.innerHTML = banner(id) + '<div class="wrap content"><div class="columns">'+body+'</div></div>';
  document.querySelectorAll('nav a').forEach(link => {
    if (link.hash === '#'+id) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
}
function play() {
  shell('play','<div id="practice-game"></div>');
  mountPractice(document.querySelector('#practice-game'), name => { lastDiscard=name; });
}
/* Learn to play is the school: one lesson at a time, each ending in something to do. */
function blankScreen(id) {
  app.dataset.section = id;
  app.innerHTML = '';
  document.querySelectorAll('nav a').forEach(link => {
    if (link.hash === '#' + id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}
function instructions() {
  app.dataset.section = 'instructions';
  app.innerHTML = '<section class="learn"></section>';
  document.querySelectorAll('nav a').forEach(link => {
    if (link.hash === '#instructions') link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  mountLearn(app.querySelector('.learn'), paintLearnNav);
}
/* The coach has the screen to itself -- no hero, no columns -- so it reads as the red page
   you are talking to rather than a panel sitting on one. */
function gpt() {
  app.dataset.section = 'gpt';
  app.innerHTML = '<section class="gpt"></section>';
  document.querySelectorAll('nav a').forEach(link => {
    if (link.hash === '#gpt') link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  mountGpt(app.querySelector('.gpt'));
}
/* The bar carries only what the screen it is on can use. The rest close up, which is why
   the bar used to jump a third of its width when you stepped between screens. */
const BAR={
  play:['toggle-sound','open-settings','open-menu'],
  gpt:['reset-chat','open-menu'],
  instructions:['learn-prev','learn-next','reset-chat','open-menu'],
};
function paintBar(screen){
  const bar=document.querySelector('.top-bar');
  const keep=new Set(BAR[screen]||BAR.play);
  bar.querySelectorAll('.menu-button').forEach(b=>
    b.classList.toggle('shut',!keep.has(b.id)));
}

function render(enter=false) {
  const current=route();
  /* which screen we are on, written where the stylesheet can see it: :has() on a
     descendant's attribute did not recompute reliably when the section changed. */
  document.body.dataset.screen=current;
  paintBar(current);
  ({play,instructions,gpt})[current]();
  if (enter) {
    motion(app.querySelector('.hero img'), { x:['20vw','0vw'], y:[45,0], opacity:[0,.62] }, {duration:1.25,ease:'easeOut'});
  }
  if (enter) motion(app.querySelector('.content'),{opacity:[.1,1],y:[10,0]},{duration:.28});
}
app.addEventListener('click', e=>{
  const control=e.target.closest('button, [data-action]');
  if (!control) return;
  const {tile: index, action, lesson: target}=control.dataset;
  if (index!==undefined) {
    const i=Number(index);
    selected=selected.includes(i)?selected.filter(x=>x!==i):[...selected,i];feedback='';
    render(); const button=app.querySelector('[data-tile="'+i+'"]'); button?.focus();
    motion(button,{scale:[.94,1]},{duration:.18}); return;
  }
  if (target!==undefined||action==='next') {
    lesson=target!==undefined?Number(target):lesson+1; selected=[]; feedback=''; render(true); app.querySelector('[data-lesson="'+lesson+'"]').focus(); return;
  }
  if (action==='check') {
    const l=lessons[lesson];
    const correct=selected.length===l.answer.length&&l.answer.every(i=>selected.includes(i));
    feedback=correct?'Correct. '+l.note:'Try again. Read the prompt and compare the suit and number on each tile.';
    if(correct)completed.add(lesson);
    render(); motion(app.querySelector('.result'),{opacity:[0,1],y:[5,0]},{duration:.2}); return;
  }
});
app.addEventListener('change',e=>{if(e.target.id==='attach')attach=e.target.checked;});
/* No entrance animation when moving between sections from the menu: the content was
   fading up from a tenth of its opacity every time, which read as a flicker. */
addEventListener('hashchange',()=>{render();scrollTo(0,0);});
render(true);

/* The sound switch sits beside the menu in the same bar. The speaker keeps its body and
   swaps the wave for a cross, so the button never changes width. */
const soundBtn = document.querySelector('#toggle-sound');
/* Three steps, drawn the way a volume control is: the cross, then one arc, then two.
   Turning it down takes a line away each time and wraps back to full from off. */
const WAVE = 'M15.5 9.2a4 4 0 010 5.6', CROSS = 'M15.5 9.5l5 5m0-5l-5 5';
const LOUD = 'M18.4 6.8a8 8 0 010 10.4';
const SAYS = ['Sound off', 'Sound low', 'Sound full'];
function paintSound() {
  const v = volume();
  document.querySelector('#soundMark').setAttribute('d', v ? WAVE : CROSS);
  document.querySelector('#soundMark2').setAttribute('d', v > 1 ? LOUD : '');
  soundBtn.setAttribute('aria-pressed', String(v === 0));
  soundBtn.setAttribute('aria-label', SAYS[v] + ', tap to change');
}
soundBtn.onclick = () => {
  setVolume((volume() + 2) % 3);
  paintSound();
  /* whatever it has been turned to should say so, at that level */
  if (volume()) clack();
};
paintSound();

/* Settings is the match panel the play screen otherwise keeps off the table: difficulty,
   how many wins take the match, and Start new match -- which is the only way to play on
   once a match has been won. */
const settingsBtn = document.querySelector('#open-settings');
function setSettings(open) {
  document.body.classList.toggle('settings-open', open);
  settingsBtn.setAttribute('aria-expanded', String(open));
  /* the game reads this back off the DOM on every repaint, so it stays open underneath */
  const panel = document.querySelector('.practice-settings');
  if (panel) panel.open = open;
}
settingsBtn.onclick = () => setSettings(!document.body.classList.contains('settings-open'));
addEventListener('keydown', e => { if (e.key === 'Escape') setSettings(false); });
addEventListener('pointerdown', e => {
  if (!document.body.classList.contains('settings-open')) return;
  if (e.target.closest('.practice-match') || e.target.closest('#open-settings')) return;
  setSettings(false);
});
/* Starting a match is the last thing the panel is for, so the press closes it and
   leaves the table clear. Taken on the way down, before the game repaints the button
   out from under the click, and closing the panel does not stop the press landing. */
addEventListener('click', e => {
  if (e.target.closest('[data-practice="new-match"]')) setSettings(false);
}, true);

/* Start again, from the same bar as the sound and the menu, and on the school screen a
   step back and a step on beside it. */
/* looked up when it runs, because the first render happens before this line */
function paintLearnNav({ step, total, back: canBack }) {
  const back = document.querySelector('#learn-prev'), on = document.querySelector('#learn-next');
  if (!back || !on) return;
  back.disabled = !canBack;
  on.disabled = step >= total;
}
document.querySelector('#learn-prev').onclick = () => learnStep(-1);
document.querySelector('#learn-next').onclick = () => learnStep(1);
document.querySelector('#reset-chat').onclick = () => {
  if (route() === 'instructions') return learnReset();
  resetGpt();
  if (route() === 'gpt') gpt();
};

const menu = document.querySelector('#section-menu');
document.querySelector('#open-menu').onclick = () => {
  menu.showModal();
  motion(menu.querySelector('.menu-links'), {opacity:[0,1],y:[20,0]}, {duration:.3});
};
document.querySelector('#close-menu').onclick = () => menu.close();
menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => menu.close()));
