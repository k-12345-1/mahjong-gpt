import { mountPractice } from './practice.mjs';
import { mountGpt, resetGpt } from './gpt.mjs';
import { mountLearn, learnStep, learnReset } from './learn.mjs';
import { clack, volume, setVolume } from './sound.mjs';
const app = document.querySelector('#app');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const motion = (target, frames, options) => {
  if (!reduce.matches && target) window.Motion?.animate(target, frames, options);
};
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
  mountPractice(document.querySelector('#practice-game'));
}
/* Learn to play is the school: one lesson at a time, each ending in something to do. */
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
