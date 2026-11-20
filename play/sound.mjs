/* The sound of a tile going down, synthesised rather than sampled: nothing to ship, nothing
   to license, and the pitch can wander a little each time so a run of discards does not
   sound like one recording on a loop.
   A tile landing on a felted table is a short, bright knock -- a few milliseconds of strike
   noise for the edge of one hard thing meeting another, then the slab's own resonances
   dying away inside a tenth of a second. */
import { push } from './account.mjs';
/* A tile going down knocks, and a claim is called by name. What is still off is the
   three knocks that used to lay a claimed set down under the call: the call carries the
   moment on its own, and the knocks on top of it only made it busier. */
const MELD_SILENT = true;

/* How loud the table is, in three steps: 0 off, 1 soft, 2 full. The browser cannot see
   what the device's own volume is set to -- nothing on a page can -- so this is the
   game's own level, and the icon shows which of the three it is on. */
let ctx, noise, level = 2;
const loud = () => level / 2;

/* Remembered per browser, and only as a convenience: if the store is unavailable the
   sounds simply start on. */
try {
  const kept = localStorage.getItem('mahjong-volume');
  if (kept !== null) level = Math.max(0, Math.min(2, Number(kept) || 0));
  /* anyone who muted it before this had three steps keeps their silence */
  else if (localStorage.getItem('mahjong-muted') === '1') level = 0;
} catch { /* no store */ }

export function volume() { return level; }
export function setVolume(value) {
  level = Math.max(0, Math.min(2, Math.round(Number(value) || 0)));
  try { localStorage.setItem('mahjong-volume', String(level)); } catch { /* no store */ }
  push('mahjong-volume');
}

/* Browsers refuse to start audio before the page has been touched, so the context is made
   on the first sound and the early ones are simply dropped. A context can also be closed
   out from under the page -- the machine sleeping will do it -- and every call on a closed
   one throws, so a closed context is thrown away and built again. */
function ready() {
  try {
    if (ctx && ctx.state === 'closed') ctx = null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.1), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx.state === 'running' ? ctx : null;
  } catch {
    ctx = null;
    return null;
  }
}

export function clack(strength = 1) {
  if (!level) return;
  strength *= loud();
  const c = ready();
  if (!c) return;
  /* Nothing here is allowed to reach the game: this is called in the middle of a turn, and
     a throw would leave the hand stopped with the tile already on the table. */
  try { knock(c, strength); } catch { /* no sound this time */ }
}

/* A tile laid on a felted table: the strike is swallowed by the baize and the slab is
   left with almost no ring, so what is heard is a short soft knock rather than a click
   with a tail. The pitch wanders a few per cent each time, so a run of discards does
   not sound like one recording on a loop. */
function knock(c, strength) {
  const t = c.currentTime;
  const out = c.createGain();
  out.gain.value = 0.26 * strength;
  out.connect(c.destination);

  const strike = c.createBufferSource();
  strike.buffer = noise;
  const edge = c.createBiquadFilter();
  /* the felt takes the top off the strike rather than ringing a band of it */
  edge.type = 'lowpass';
  edge.frequency.value = 900 + (Math.random() - 0.5) * 240;
  edge.Q.value = 0.8;
  const hit = c.createGain();
  hit.gain.setValueAtTime(1, t);
  hit.gain.exponentialRampToValueAtTime(0.0008, t + 0.020);
  strike.connect(edge).connect(hit).connect(out);
  strike.start(t);
  strike.stop(t + 0.05);

  /* one low resonance, damped: a slab on cloth, not a slab on a board */
  for (const [freq, level, decay] of [[265, 0.62, 0.055]]) {
    const body = c.createOscillator();
    body.type = 'sine';
    body.frequency.value = freq * (0.94 + Math.random() * 0.12);
    const fade = c.createGain();
    fade.gain.setValueAtTime(level, t);
    fade.gain.exponentialRampToValueAtTime(0.0008, t + decay);
    body.connect(fade).connect(out);
    body.start(t);
    body.stop(t + decay + 0.02);
  }
}

/* The call is spoken, the way one is at a table. The voice is the browser's own, so there
   is nothing to ship and nothing to license; where a device has no speech it stays quiet.
   It follows the sound switch, and like the knocks it swallows its own failures -- this is
   called in the middle of a turn. */
/* The calls as they are made at a Hong Kong table. Said in Cantonese by a Chinese voice
   where the device has one, which is what stops it sounding like a screen reader; English
   is the fallback, and no voice at all is no sound. */
const CALLS = { Chow: '\u4e0a', Pung: '\u78b0', Kong: '\u69d3', Win: '\u9ebb\u96c0' };
let chosen = null, looked = false;
/* The voices a device ships are not labelled by gender, so the women's names are listed:
   Sinji speaks Cantonese, Tingting and Meijia Mandarin, and the rest are common on phones. */
const WOMEN = /sin-?ji|ting-?ting|mei-?jia|xiao|yun-?yun|hui-?hui|li-?mu|yue-?yue|female/i;
function voiceFor() {
  const all = window.speechSynthesis.getVoices() || [];
  if (!all.length) return null;          // the list arrives late on some devices
  looked = true;
  const chinese = all.filter(v => /^(zh|yue)/i.test(v.lang));
  const cantonese = chinese.filter(v => /^(zh[-_](HK|yue)|yue)/i.test(v.lang));
  return cantonese.find(v => WOMEN.test(v.name))
      || chinese.find(v => WOMEN.test(v.name))
      || cantonese[0] || chinese[0]
      || all.find(v => WOMEN.test(v.name))
      || null;
}

/* The list of voices arrives after the page does, so it is asked for at once and asked
   again when the browser says it has changed. Without this the first call of a session
   went out in English, because the Cantonese voice had not turned up yet. */
try {
  if (window.speechSynthesis) {
    chosen = voiceFor();
    window.speechSynthesis.addEventListener('voiceschanged', () => { chosen = voiceFor(); });
  }
} catch { /* no speech on this device */ }

export function say(word) {
  if (!level) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (!looked || !chosen) chosen = voiceFor();
    /* Still nothing, and the list has never arrived: wait for it rather than say this
       one call in the wrong language. A device with no voices never fires it and stays
       quiet, which is the right answer there too. */
    if (!looked) {
      synth.addEventListener('voiceschanged', () => say(word), { once: true });
      return;
    }
    const line = new SpeechSynthesisUtterance(chosen && CALLS[word] ? CALLS[word] : word === 'Win' ? 'Mahjong' : word);
    if (chosen) { line.voice = chosen; line.lang = chosen.lang; }
    /* slower and a little lower than the default, which is what the flat delivery is */
    line.rate = 0.82;
    line.pitch = 1.04;
    line.volume = 0.95 * loud();
    /* a second call interrupts the first rather than queueing behind it */
    synth.cancel();
    synth.speak(line);
  } catch { /* no voice this time */ }
}

/* Washing the tiles between hands: the same knock, many of them, loosely spaced, which is
   what a table full of tiles being pushed around actually sounds like. It stops itself, so
   nothing has to be cancelled if the wash is cut short. */
export function wash(ms = 5000) {
  if (!level) return;
  const until = Date.now() + ms;
  const again = () => {
    if (Date.now() >= until) return;
    clack(0.35 + Math.random() * 0.5);
    setTimeout(again, 40 + Math.random() * 110);
  };
  again();
}

/* A set going down is three tiles laid in quick succession, not one louder knock. */
export function meld() {
  if (MELD_SILENT) return;
  clack(1);
  setTimeout(() => clack(0.85), 55);
  setTimeout(() => clack(0.8), 110);
}
