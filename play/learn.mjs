/* Learn to play -- the game taught a step at a time, with the real tiles.
   Everything sits in the middle of the screen and arrives rather than appears: the words
   rise, the tiles are dealt out one after another. Every lesson says one thing and then
   asks you to do it, because reading what a pung is and finding one in a rack are
   different pieces of knowledge. Four kinds of asking cover the whole game -- sort tiles
   into their kinds, tap them into order, pick a set out of a row, or answer a question
   about play. Nothing is a trick: a wrong answer says what to look at instead. */
import { faces, label, img } from './practice.mjs';

const FACE_SET = new Set(faces);
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* tiles written as [[bamboo-1 bamboo-2]] inside a lesson's text, dealt out in order */
let dealt = 0;
function tiles(list) {
  const set = list.trim().split(/[\s,]+/).filter(f => FACE_SET.has(f));
  if (!set.length) return '';
  /* A set -- a chow, a pung, a kong -- is laid down one tile at a time, left to right,
     the way it goes onto a table. A longer row is a whole hand written into the sentence
     and arrives at once, carrying on from whatever came before it in the same lesson. */
  const slow = set.length <= 4;
  const gap = slow ? .22 : .013;
  return '<span class="learn-tiles" role="img" aria-label="' + esc(set.map(label).join(', ')) + '">'
    + set.map((f, i) => img(f).replace('<img ', '<img style="--i:' + i + ';animation-delay:'
        + (.02 + (slow ? i : dealt++) * gap).toFixed(3) + 's" '))
      .join('') + '</span>';
}
const body = text => text.split(/\[\[([^\]]*)\]\]/).map((p, i) => (i % 2 ? tiles(p) : esc(p))).join('');

const KINDS = ['Characters', 'Dots', 'Bamboo', 'Dragons', 'Winds', 'Flowers'];
const WINDS = ['east', 'south', 'west', 'north'];
const kindOf = f =>
  f.startsWith('characters') ? 0 : f.startsWith('dots') ? 1 : f.startsWith('bamboo') ? 2
  : f.endsWith('dragon') ? 3 : WINDS.includes(f) ? 4 : 5;

/* A hand to sort, and three hands of thirteen to find sets in -- a rack as you would
   really be holding it, not a row of five with the answer already half given away. */
const SORT_HAND = ['characters-3', 'dots-7', 'flower-2', 'bamboo-5', 'east', 'characters-8',
  'red-dragon', 'dots-2', 'north', 'bamboo-9', 'green-dragon', 'season-4', 'characters-1'];

/* What a set is, checked by the rule rather than against one answer: any chow in the
   hand is a chow, and being told you found the wrong one would teach the opposite. */
const run = f => +f.split('-')[1];
const suit = f => f.split('-')[0];
const made = (rule, hand) => {
  if (rule === 'pung') return hand.length === 3 && hand.every(f => f === hand[0]);
  if (rule === 'kong') return hand.length === 4 && hand.every(f => f === hand[0]);
  if (rule === 'pair') return hand.length === 2 && hand[0] === hand[1];
  if (rule === 'bonus') return hand.length === 1 && kindOf(hand[0]) === 5;
  if (rule === 'chow') {
    if (hand.length !== 3 || kindOf(hand[0]) > 2) return false;
    if (!hand.every(f => suit(f) === suit(hand[0]))) return false;
    const n = hand.map(run).sort((a, b) => a - b);
    return n[1] === n[0] + 1 && n[2] === n[1] + 1;
  }
  return false;
};

const LESSONS = [
  {
    title: '',
    /* The suits are brought on one at a time: each arrives in the middle of the screen and
       steps aside for the next, so you meet them one by one instead of all at once. */
    stage: {
      line: 'A mahjong set is 144 tiles.',
      /* The three suits, then the three kinds of honour. The middle place in each row is
         taken last -- a kind on its way to the far side would otherwise pass straight
         over whatever was already sitting in the middle. So the order they are shown in
         is not the order they end up in: each row reads suit, suit, suit left to right
         once all three have landed. */
      groups: [
        { cap: 'Characters', tiles: ['characters-1', 'characters-5', 'characters-9'] },
        { cap: 'Bamboo', tiles: ['bamboo-1', 'bamboo-5', 'bamboo-9'] },
        { cap: 'Dots', tiles: ['dots-1', 'dots-5', 'dots-9'] },
        { cap: 'Dragons', tiles: ['red-dragon', 'green-dragon', 'white-dragon'] },
        { cap: 'Flowers', tiles: ['flower-1', 'flower-2', 'season-1', 'season-2'] },
        { cap: 'Winds', tiles: ['east', 'south', 'west', 'north'] },
      ],
    },
    say: '',
    task: {
      kind: 'sort',
      prompt: 'Drag each tile into its kind.',
      row: SORT_HAND,
      bins: KINDS,
      answer: SORT_HAND.map(kindOf),
      note: 'You got it! Tap to continue.',
      wrong: '萬 marks a character, circles are dots, sticks are bamboo. 中 發 and the blank are the dragons, 東 南 西 北 the winds.',
    },
  },
  {
    title: 'Here are the characters in numerical order.',
    intro: true,
    say: '[[characters-1 characters-2 characters-3 characters-4 characters-5 characters-6 characters-7 characters-8 characters-9]]',
    task: {
      kind: 'order',
      prompt: 'Tap these in order, one to nine.',
      row: ['characters-4', 'characters-9', 'characters-1', 'characters-7', 'characters-3',
            'characters-6', 'characters-2', 'characters-8', 'characters-5'],
      answer: [2, 6, 4, 0, 8, 5, 3, 7, 1],
      note: 'You got it! Tap to continue.',
    },
  },
  {
    title: 'Dots are counted by their circles.',
    intro: true,
    say: '[[dots-1 dots-2 dots-3 dots-4 dots-5 dots-6 dots-7 dots-8 dots-9]]',
    task: {
      kind: 'order',
      prompt: 'Tap the dots in order, one to nine.',
      row: ['dots-6', 'dots-2', 'dots-9', 'dots-4', 'dots-7', 'dots-1', 'dots-5', 'dots-3', 'dots-8'],
      answer: [5, 1, 7, 3, 6, 0, 4, 8, 2],
      note: 'You got it! Tap to continue.',
    },
  },
  {
    title: 'Bamboo is counted in sticks. The 1 is drawn as a bird.',
    intro: true,
    say: '[[bamboo-1 bamboo-2 bamboo-3 bamboo-4 bamboo-5 bamboo-6 bamboo-7 bamboo-8 bamboo-9]]',
    task: {
      kind: 'order',
      prompt: 'Tap the bamboo in order, one to nine.',
      row: ['bamboo-3', 'bamboo-8', 'bamboo-1', 'bamboo-5', 'bamboo-9', 'bamboo-2', 'bamboo-7', 'bamboo-4', 'bamboo-6'],
      answer: [2, 5, 0, 7, 3, 8, 6, 1, 4],
      note: 'You got it! Tap to continue.',
    },
  },
  {
    title: 'Chow',
    wide: true,
    intro: true,
    say: 'Three running numbers in the same suit.\n[[bamboo-2 bamboo-3 bamboo-4]]',
    task: {
      kind: 'pick', need: 3, rule: 'chow',
      prompt: 'Find a chow in this hand. Tap its three tiles.',
      row: ['bamboo-2', 'dots-6', 'characters-9', 'east', 'dots-5', 'white-dragon', 'bamboo-8',
            'characters-3', 'dots-7', 'east', 'characters-9', 'bamboo-4', 'dots-1'],
      note: 'Three running numbers in one suit.',
      wrong: 'This is incorrect. Try again.',
    },
  },
  {
    title: 'Runs',
    intro: true,
    steps: true,
    say: 'A run \u2014 a chow, or shung \u2014 is three tiles in a row in one suit. You can build one quietly in your hand and show it only when the hand is over.\nOr you can claim one. If the player on your left discards the tile you need, say so: the run goes down in front of you, face up, there and then.\nOnly that player\u2019s discard will do. You cannot reach across the table for a run, or cut in ahead of somebody else\u2019s turn. The one exception is the tile that wins the hand \u2014 that you may take from anyone.',
    /* Which runs are worth starting, shown rather than explained: the gap in the middle of
       a suit can be filled from either side, the one at the end from one side only. */
    cards: [
      { cap: 'Open at both ends', tiles: ['dots-4', 'dots-5'],
        note: 'A 3 or a 6 finishes it.' },
      { cap: 'Closed at the end', tiles: ['dots-8', 'dots-9'],
        note: 'Only a 7 will do.' },
    ],
    task: {
      kind: 'choice',
      prompt: 'You hold the 8 and 9 of dots. Which tile finishes the run?',
      options: ['The 7 of dots', 'The 10 of dots', 'The 7 of bamboo'],
      answer: 0,
      note: 'Only a 7, because a suit stops at 9. A run at either end can be filled from one side alone, which is what makes 1-2-3 and 7-8-9 harder to put together than the runs in the middle.',
      wrong: 'A run is three in a row in one suit, and the numbers stop at 9.',
    },
  },
  {
    title: 'Pung',
    wide: true,
    intro: true,
    say: 'Three of the same tile.\n[[red-dragon red-dragon red-dragon]]',
    task: {
      kind: 'pick', need: 3, rule: 'pung',
      prompt: 'Find a pung in this hand. Tap its three tiles.',
      row: ['dots-3', 'east', 'bamboo-7', 'east', 'characters-2', 'red-dragon', 'east',
            'bamboo-1', 'dots-8', 'characters-6', 'bamboo-4', 'dots-5', 'white-dragon'],
      note: 'Three East winds. Honours make no runs, so three of a kind is the only set they form.',
      wrong: 'Not three of a kind. A pung is the identical tile three times over.',
    },
  },
  {
    title: 'Kong',
    wide: true,
    intro: true,
    say: 'Four of the same tile.\n[[dots-5 dots-5 dots-5 dots-5]]',
    task: {
      kind: 'pick', need: 4, rule: 'kong',
      prompt: 'Find the kong in this hand. Tap its four tiles.',
      row: ['characters-8', 'dots-2', 'characters-8', 'bamboo-6', 'characters-8', 'green-dragon',
            'characters-8', 'dots-9', 'south', 'bamboo-3', 'dots-4', 'characters-1', 'bamboo-9'],
      note: 'All four of the 8 characters -- still one set, which is why it earns a replacement tile.',
      wrong: 'Not all four of one tile. A kong is the whole four, no mixture.',
    },
  },
  {
    title: 'Flowers',
    wide: true,
    intro: true,
    say: 'If you draw one, lay it face up in front of you and take a replacement from the dead wall.\n[[flower-1 flower-2 season-1 season-2]]',
    task: {
      kind: 'pick', need: 1, rule: 'bonus',
      prompt: 'One of these would be set aside at once. Tap it.',
      row: ['bamboo-2', 'season-3', 'dots-6', 'characters-4'],
      wrong: 'That one stays in your hand. Look for the one that belongs to no set at all.',
      note: '',
    },
  },
  {
    title: 'Mahjong',
    intro: true,
    wide: true,
    say: 'Mahjong is a set of 14 tiles with four sets and one pair.\n[[dots-2 dots-3 dots-4 bamboo-5 bamboo-5 bamboo-5 characters-6 characters-7 characters-8 west west west east east]]',
    task: {
      kind: 'pick', need: 2, rule: 'pair',
      prompt: 'This hand is one pair short. Tap the two tiles that make it.',
      row: ['bamboo-1', 'green-dragon', 'dots-4', 'green-dragon', 'characters-5'],
      wrong: 'A pair is two of the identical tile, not two of a kind.',
      note: 'Correct. Two green dragons is a pair. Tap to continue.',
    },
  },
  {
    title: 'Eyes',
    intro: true,
    wide: true,
    say: 'Four sets are not a hand on their own. You need a pair as well \u2014 two of the identical tile, called the eyes.\n[[green-dragon green-dragon]]\nThey stay in your hand to the end. You cannot call for a pair mid-hand the way you can call a pung, but the tile that completes your eyes and wins you the hand may come from any player at the table.',
    task: {
      kind: 'choice',
      prompt: 'You need one more tile for your pair, and it wins. The player opposite discards it. May you take it?',
      options: ['Yes \u2014 the winning tile can come from anyone', 'No \u2014 only the player on your left', 'Only if it also completes a set'],
      answer: 0,
      note: 'The tile that wins can be claimed from any seat. Mid-hand it would be different: a pair on its own is not something you can call for.',
      wrong: 'Think about which claims are open to the whole table, and which are not.',
    },
  },
  {
    title: 'Sitting down',
    intro: true,
    wide: true,
    steps: true,
    say: 'Everyone rolls, and the highest takes East. The others take South, West and North counterclockwise, and play runs the same way.\nEast deals the tiles and throws the first one, then South, then West, then North, and round again. East keeps the seat by winning the hand.\nThe round is named after a wind too \u2014 the first one is East\u2019s. Your own seat\u2019s wind is worth having: a pung of it scores a faan, and so does a pung of the wind the round is named for.',
    row: ['east', 'south', 'west', 'north'],
    task: {
      kind: 'choice',
      prompt: 'You are sitting South. Who plays immediately after you?',
      options: ['East', 'West', 'North'],
      answer: 1,
      note: 'Play runs East, South, West, North and round again, so after South comes West -- the player on your right.',
      wrong: 'Count round in the order of the seats: East, South, West, North.',
    },
  },
  {
    title: 'Breaking the wall',
    intro: true,
    steps: true,
    say: 'Each player builds a wall, two tiles high and eighteen long. The four are pushed together into a square.\nEast rolls. Counting round from East as one, that many seats along is the wall to open. Count the same number of stacks in from that wall\u2019s right-hand end: that is the break.\nDealing starts at the break and goes round in twos, until everyone holds twelve. East then takes two more and the others one each \u2014 so East begins with fourteen tiles and everyone else with thirteen.\nThe tiles just past the break are the dead wall. Replacements come from there.',
    task: {
      kind: 'choice',
      prompt: 'East rolls a 7. Counting counterclockwise with East as one, whose wall is opened?',
      options: ['East', 'South', 'West', 'North'],
      answer: 2,
      note: 'East 1, South 2, West 3, North 4, East 5, South 6, West 7 -- the seventh seat is West.',
      wrong: 'Count all the way round: East is 1, South 2, West 3, North 4, and then it begins again at East.',
    },
  },
  {
    title: 'Taking a turn',
    intro: true,
    steps: true,
    say: 'A turn is two things: take a tile, then put one down.\nTake it from the wall, or claim the tile just discarded if it finishes a set. Then discard one from your hand, face up in the middle.\nA chow can only be claimed by the player whose turn is next. A pung, a kong or a win can be claimed by anyone at the table.\nIf two people want the same tile, a win beats a pung or a kong, and those beat a chow.',
    task: {
      kind: 'choice',
      prompt: 'You are West. North discards the exact tile you need for a chow. May you take it?',
      options: ['Yes -- a chow can be claimed from anyone', 'No -- only East may chow that tile', 'Only if nobody else calls'],
      answer: 1,
      note: 'A chow can only be taken by the player whose turn is next, and after North comes East. Had you needed it for a pung, you could have claimed it from anybody.',
      wrong: 'Think about whose turn follows North, and which claims are open to the whole table.',
    },
  },
  {
    title: 'Value sets',
    intro: true,
    steps: true,
    say: 'Some sets are worth more than the place they fill. A pung or a kong of dragons is one \u2014 red, green or white, it pays a faan to whoever holds it.\nWinds pay only if they are yours: the wind you are sitting, or the wind the round is named for. Any other wind is three tiles and nothing more. A pung of East, held by East in the East round, scores for both.',
    cards: [
      { cap: 'Dragons', tiles: ['red-dragon', 'red-dragon', 'red-dragon'],
        note: 'A faan for anyone holding it.' },
      { cap: 'Your wind', tiles: ['east', 'east', 'east'],
        note: 'Your own seat, or the round.' },
    ],
    task: {
      kind: 'choice',
      prompt: 'You are sitting West in the East round. Which of these pungs is worth a faan?',
      options: ['Three green dragons', 'Three South winds', 'Three 9 of bamboo'],
      answer: 0,
      note: 'Dragons pay for anyone. South is neither your seat nor the round, so that pung is worth nothing extra \u2014 and a pung of nines is just a pung.',
      wrong: 'Dragons are always worth something. A wind has to be your own seat or the round.',
    },
  },
  {
    title: 'What a hand is worth',
    intro: true,
    say: 'Faan are added up. A hand scores every one it earns.',
    /* Three rungs, each with the shape that earns it -- the same showing as the six kinds
       at the start, because a list of scoring hands read as prose is a list nobody reads. */
    cards: [
      { cap: 'One faan', tiles: ['red-dragon', 'red-dragon', 'red-dragon'],
        note: 'A pung of dragons, of your own seat wind, or of the round\u2019s wind. Going out on your own draw. No flowers at all.' },
      { cap: 'Three faan', tiles: ['characters-3', 'characters-3', 'characters-3'],
        note: 'Every set a pung. Or one suit and nothing but honours beside it.' },
      { cap: 'Seven faan', tiles: ['dots-1', 'dots-2', 'dots-3'],
        note: 'One suit, with no honours at all \u2014 the whole hand in dots, bamboo or characters.' },
    ],
    task: {
      kind: 'choice',
      prompt: 'Your hand is four pungs and a pair. How many faan is that worth?',
      options: ['2 faan', '3 faan', '7 faan'],
      answer: 1,
      note: 'All pungs pays 3, which clears the usual minimum on its own. Four chows pays only 1, which is why a plain hand often cannot be declared at all.',
      wrong: 'Look back: the shapes that cover the whole hand pay more than the single sets.',
    },
  },
  {
    title: 'Who pays',
    intro: true,
    steps: true,
    say: 'Faan turn into points by doubling. One faan is 2 points, two is 4, three is 8, four is 16. After that it slows: five is 24, eight is 64, and ten is the ceiling.\nThen it matters how you finished.\nWon on someone else\u2019s discard: that player pays double, and the other two pay once.\nWon on a tile you drew yourself: all three pay double.',
    task: {
      kind: 'choice',
      prompt: 'You complete your hand on a tile you drew yourself. Who pays you?',
      options: ['Only the player who discarded last', 'All three, at double', 'All three, at the plain value'],
      answer: 1,
      note: 'That is why a self-draw is worth far more than the one extra faan it scores -- the whole table pays, and pays double.',
      wrong: 'Nobody discarded the winning tile, so think about who is left to pay.',
    },
  },
];

let root, step = 0, picked = [], placed = {}, held = -1, done = false, said = '', staged = false;
let landed = -1;   /* the tile just put in a bin -- the only one that gets dealt again */
let report = () => {};
let clock = [];

const stageHTML = st =>
  '<div class="stage">'
  + '<p class="stage-line">' + esc(st.line) + '</p>'
  + st.groups.map((g, i) =>
      '<div class="stage-group g' + i + '"><span class="stage-tiles">'
      + g.tiles.map(f => '<img class="photo-front" alt="" src="tile-art/rendered-fronts/' + f + '.webp">').join('')
      + '</span><b>' + esc(g.cap) + '</b></div>').join('')
  /* Once the six are out, the gap between the two rows is the one clear space on the
     stage, and that is where it says how to go on. */
  + '<p class="stage-go">Tap to continue.</p>'
  + '</div>';

/* each suit walks on, waits to be looked at, and steps out of the way of the next */
/* The six places are set as a distance out from the middle, and that distance knows
   nothing about how wide a kind is -- but the winds and the flowers are four tiles where
   a suit is three, and those two sit side by side in the bottom row. At the wrong window
   width they met. So once everything has landed the distance is measured rather than
   assumed: neighbours stand a group's own width apart, and where three of the widest will
   not fit across the stage they all come down a size until they do. */
function fitStage(el) {
  const g = [...el.querySelectorAll('.stage-group')];
  if (g.length < 6 || !el.clientWidth) return;
  const GAP = 34;   /* real air between neighbours, not a hairline */
  const w = g.map(n => n.offsetWidth);   /* untransformed */
  /* Each row is left, right, middle -- the places the six are sent to. A kind is as wide
     as the tiles in it, and the winds and the flowers are four where a suit is three, so
     one distance for all of them left one gap wider than the other. Each neighbour is
     placed off the middle one's own edge instead, which makes every gap the same. */
  const rows = [[0, 1, 2], [3, 4, 5]];
  /* The middle one stays in the middle, so the two rows line up down the screen. That
     makes the row as wide as twice its widest side, not as wide as its three kinds
     added up, and it is the side that has to fit the stage. */
  const park = Math.min(0.95, ...rows.map(([l, r, m]) =>
    (el.clientWidth - 2 * GAP) / Math.max(2 * w[l] + w[m], 2 * w[r] + w[m])));
  el.style.setProperty('--park', park.toFixed(3));
  const out = (a, b) => Math.round(park * (w[a] + w[b]) / 2 + GAP) + 'px';
  for (const [l, r, m] of rows) {
    g[l].style.setProperty('--px', '-' + out(l, m));
    g[r].style.setProperty('--px', out(r, m));
    g[m].style.setProperty('--px', '0px');
  }
}
function runStage() {
  const el = root.querySelector('.stage');
  if (!el) return;
  const refit = () => { if (el.isConnected && el.classList.contains('settled')) fitStage(el); };
  addEventListener('resize', refit);
  const at = (ms, cls) => clock.push(setTimeout(() => {
    el.classList.add(cls);
    if (cls === 'settled') fitStage(el);
  }, ms));
  /* A kind steps aside, and only when it is clear does the next one land: at 200ms the
     two crossed in the middle of the screen, which is the one thing this is meant to
     avoid. The move itself takes 1.05s, so 900ms leaves it all but arrived. */
  /* The line has the screen to itself: it is read, it goes, and only then is the first
     kind brought on -- so the tiles are never arriving over the top of it. */
  at(60, 'lit');
  at(1900, 'said');   /* the line has been read, and fades */
  at(2700, 'in0');    /* by now it is gone, so the tiles come into an empty screen */
  at(4100, 'park0'); at(5000, 'in1');
  at(6400, 'park1'); at(7300, 'in2');
  at(8700, 'park2'); at(9600, 'in3');
  at(11000, 'park3'); at(11900, 'in4');
  at(13300, 'park4'); at(14200, 'in5');
  at(15600, 'park5');
  at(16200, 'settled');   /* nothing more is coming, so the whole set opens out */
  /* and then it waits: nothing goes on to the sorting until the screen is tapped */
  root.addEventListener('click', () => {
    if (staged) return;
    clock.forEach(clearTimeout); clock = [];
    removeEventListener('resize', refit);
    staged = true; paint();
    report({ step, total: LESSONS.length, back: canBack() });   /* the tour is now behind you */
  }, { once: true });
}

/* A rung of scoring: the shape that earns it, named above and explained below. The six
   kinds at the start are read this way and this page was a paragraph of them. */
/* Tiles shown with their name under them, the way the six kinds are named on the tour.
   On the seats page what matters is which tile is which seat, and a wind tile does not
   say so unless you can already read the character. */
const namedHTML = list => '<div class="learn-named">' + list.map((f, i) =>
  '<span style="--i:' + i + '"><img class="photo-front" alt="" width="208" height="272"'
  + ' src="tile-art/rendered-fronts/' + f + '.webp"><b>' + esc(label(f)) + '</b></span>'
).join('') + '</div>';

const cardsHTML = cards => '<div class="learn-cards">' + cards.map(c =>
  '<div class="learn-card"><b>' + esc(c.cap) + '</b>'
  + '<span class="learn-tiles" role="img" aria-label="' + esc(c.tiles.map(label).join(', ')) + '">'
  + c.tiles.map(f => img(f)).join('') + '</span>'
  + '<small>' + esc(c.note) + '</small></div>').join('') + '</div>';

const tileButton = (face, i, state, extra = '') =>
  '<button type="button" class="learn-tile' + (state ? ' ' + state : '')
  + (extra === ' class-grab' ? ' grab' : '') + '" data-i="' + i + '"' + (extra === ' class-grab' ? '' : extra)
  + ' aria-pressed="' + (state === 'on' || state === 'held' ? 'true' : 'false')
  + '" aria-label="' + esc(label(face)) + '">' + img(face) + '</button>';

function control(t) {
  if (t.kind === 'choice') {
    return '<div class="learn-choices">' + t.options.map((o, i) =>
      '<button type="button" class="learn-choice' + (done && i === t.answer ? ' right' : '') + '" data-i="' + i + '">'
      + esc(o) + '</button>').join('') + '</div>';
  }
  if (t.kind === 'sort') {
    const loose = t.row.map((f, i) => placed[i] === undefined
      ? tileButton(f, i, held === i ? 'held' : '', ' class-grab') : '').join('');
    return '<div class="learn-tray">' + loose + '</div>'
      + '<div class="learn-bins">' + t.bins.map((b, bi) =>
        '<button type="button" class="learn-bin' + (held >= 0 ? ' open' : '') + '" data-bin="' + bi + '">'
        + '<span>' + esc(b) + '</span><span class="learn-bin-tiles">'
        + t.row.map((f, i) => placed[i] === bi
          ? '<img class="photo-front placed-tile' + (i === landed ? ' just' : '') + '" data-i="' + i
            + '" alt="" src="tile-art/rendered-fronts/' + f + '.webp">' : '').join('')
        + '</span></button>').join('') + '</div>';
  }
  return '<div class="learn-row' + (t.row.length > 9 ? ' hand' : '') + '">' + t.row.map((f, i) => {
    const at = picked.indexOf(i);
    return tileButton(f, i, at < 0 ? '' : (t.kind === 'order' ? 'num' : 'on'),
      at < 0 ? '' : ' data-order="' + (at + 1) + '"');
  }).join('') + '</div>';
}

/* The tiles you are working with and whatever the lesson has just said back. There is no
   Check: the answer is read the moment you have tapped enough tiles. Nor is there
   anything telling you to tap -- once a lesson is answered a tap anywhere goes on, and
   the white bar carries the arrow for anyone who looks for one. */
const playHTML = t => control(t)
  + (said ? '<p class="learn-note' + (done ? ' right' : '') + '">' + esc(said) + '</p>' : '');

/* The whole lesson, which is drawn once. Everything in it arrives -- which is why
   answering must not come through here: see repaint. */
/* A lesson with `intro` arrives the way the tour does: the line lands in the middle of
   the screen on one line, the suit is counted out under it a tile at a time, and only
   then does the question appear directly beneath the row it is about. */
function runIntro() {
  const el = root.querySelector('.learn-inner.intro');
  if (!el) return;
  const ref = el.querySelector('.learn-ref');
  const row = ref && ref.querySelector('.learn-tiles, .learn-named');
  /* The line is read on its own first, in the one place every lesson's first line is
     read: where "A mahjong set is 144 tiles." rested in the tour. That spot is the middle
     of the tour's own stage, so it is worked out from the same figures rather than from
     whatever this lesson happens to hold -- which also means the tiles below need not have
     loaded for the line to be put in the right place. Letting the lift go is what carries
     it up as the tiles arrive, so it rises out of their way instead of being written over. */
  const place = () => {
    if (!ref || el.classList.contains('shown')) return;
    const title = ref.querySelector('h2') || ref;
    /* It has to be put there, not moved there: with the transition live it would slide
       down into the middle and straight back out again. */
    ref.style.transition = 'none';
    el.style.setProperty('--lift', '0px');
    const seen = title.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
    const stage = Math.min(460, Math.max(230, innerHeight * 0.56));   /* the tour's own stage */
    /* Where the tour's line sat on this screen: the lesson holding it is as tall as the
       stage and its padding, and like every lesson it is centred in the body -- so the
       spot can be worked out from the body, whatever this lesson happens to be holding. */
    const body = (el.parentElement || el).getBoundingClientRect();
    const rest = body.top + (body.height - (pad + stage)) / 2 + pad + stage / 2;
    el.style.setProperty('--lift', Math.max(0, Math.round(rest - (seen.top + seen.height / 2))) + 'px');
    ref.getBoundingClientRect();
    ref.style.transition = '';
  };
  place();
  requestAnimationFrame(place);   /* again once the lesson has been laid out for real */
  const at = (ms, cls) => clock.push(setTimeout(() => el.classList.add(cls), ms));
  /* Three tiles are counted out in half the time nine take, so the question comes up when
     the row is finished rather than after the longest row it could have been. */
  const tiles = row ? row.querySelectorAll('img').length : 0;
  const step = tiles > 9 ? 110 : 170;   /* a whole hand is counted out quicker than a suit */
  at(60, 'lit');
  at(900, 'shown');    /* the tiles are counted out from here, one after another */
  at(900 + Math.max(0, tiles - 1) * step + 740, 'aside');   /* the last has landed, so the question joins it */
  root.addEventListener('click', () => {
    if (el.classList.contains('aside')) return;
    clock.forEach(clearTimeout); clock = [];
    el.classList.add('lit', 'shown', 'aside');
  }, { once: true });
}

function paint() {
  const l = LESSONS[step], t = l.task;
  dealt = 0;
  const playing = l.stage && !staged;
  const intro = !!l.intro && !playing;
  const head = (l.title ? '<h2>' + esc(l.title) + '</h2>' : '')
    /* A page that is four separate statements is four separate statements: read down a
       column, each on its own line, rather than as one centred block of prose. */
    + (l.say ? (l.steps
        ? '<div class="learn-say steps">'
          + l.say.split('\n').map(line => '<p>' + body(line) + '</p>').join('') + '</div>'
        : '<div class="learn-say' + (l.wide ? ' wide' : '') + '">' + body(l.say) + '</div>') : '')
    /* Tiles the page is about, shown as a row of their own rather than set into the
       sentences, where they broke the line wherever they happened to fall. */
    + (l.row ? namedHTML(l.row) : '')
    + (l.cards ? cardsHTML(l.cards) : '');
  root.innerHTML =
    '<div class="learn-body"><div class="learn-inner' + (playing ? ' learn-staging' : '')
    + (intro ? ' intro' : '') + '">'
    + (playing ? stageHTML(l.stage) : '')
    + (playing ? '' :
        (intro ? '<div class="learn-ref">' + head + '</div>' : head)
        + '<p class="learn-ask">' + esc(t.prompt) + '</p>'
        + '<div class="learn-play fresh">' + playHTML(t) + '</div>')
    + '</div></div>';
  if (playing) runStage();
  else if (intro) runIntro();
}

/* Answering redraws only the tiles and the note, and drops `fresh` so they stop being
   dealt out again: putting a tile in a bin should move that tile, not restage the lesson. */
function repaint() {
  const area = root.querySelector('.learn-play');
  if (!area) return paint();
  const t = LESSONS[step].task;
  area.classList.remove('fresh');
  area.innerHTML = playHTML(t);
}

function finish() {
  dealt = 0;
  root.innerHTML =
    '<div class="learn-body"><div class="learn-inner learn-end intro">'
    + '<div class="learn-ref"><h2>You\u2019re ready to play!</h2>'
    + '<div class="learn-say wide">' + /* a hand of mahjong: three runs, a pung and a pair \u2014 four sets and a pair */
      body('[[characters-1 characters-2 characters-3 dots-4 dots-5 dots-6 bamboo-7 bamboo-8 bamboo-9 red-dragon red-dragon red-dragon green-dragon green-dragon]]') + '</div></div>'
    + '<p class="learn-acts"><a class="learn-go" href="#play">Take a seat</a>'
    + '<button type="button" class="learn-back" data-learn="again">Start again</button></p>'
    + '</div></div>';
  runIntro();
}

function tap(i) {
  const t = LESSONS[step].task;
  if (done) return;
  if (t.kind === 'sort') {
    /* a tile already in a bin comes back to the tray; otherwise it is picked up */
    if (placed[i] !== undefined) { delete placed[i]; held = -1; landed = -1; said = ''; return repaint(); }
    held = held === i ? -1 : i; said = ''; return repaint();
  }
  if (t.kind === 'order') {
    /* only the next tile in the sequence is taken, so the order is taught rather than
       guessed at, and a wrong tap costs nothing but a nudge */
    if (i === t.answer[picked.length]) {
      picked.push(i); said = '';
      if (picked.length === t.answer.length) { done = true; said = t.note; }
    } else said = 'Not that one yet -- look for the next number up.';
    return repaint();
  }
  /* a set is read as soon as it is complete -- there is nothing to press afterwards */
  const at = picked.indexOf(i);
  if (at < 0) picked.push(i); else picked.splice(at, 1);
  said = '';
  if (picked.length === t.need) {
    if (made(t.rule, picked.map(j => t.row[j]))) { done = true; said = t.note; }
    else { said = t.wrong; picked = []; }
  }
  repaint();
}

/* out of a kind and back into the line it came from */
function unbin(i) {
  if (done || placed[i] === undefined) return;
  delete placed[i]; held = -1; landed = -1; said = ''; repaint();
}

function bin(bi) {
  const t = LESSONS[step].task;
  if (done || held < 0) return;
  placed[held] = bi; landed = held; held = -1; said = '';
  if (Object.keys(placed).length === t.row.length) {
    if (t.row.every((_, i) => placed[i] === t.answer[i])) { done = true; said = t.note; }
    else { said = t.wrong; placed = {}; landed = -1; }
  }
  repaint();
}

function choose(i) {
  const t = LESSONS[step].task;
  if (done) return;
  if (i === t.answer) { done = true; said = t.note; } else said = t.wrong;
  repaint();
}

/* `replay` is for the two ways in that mean to see the introduction: mounting the school
   and starting it again. Walking back into lesson one lands on its task, with the tour as
   the step behind it. */
function go(n, replay) {
  clock.forEach(clearTimeout); clock = [];
  step = n; picked = []; placed = {}; held = -1; landed = -1; done = false; said = '';
  staged = !replay || !LESSONS[n] || !LESSONS[n].stage;
  report({ step, total: LESSONS.length, back: canBack() });
  if (step >= LESSONS.length) finish(); else paint();
}

/* There is a step behind the first lesson: the introduction to the tiles, which has
   already played by the time its task is on screen. Going back replays it. */
const canBack = () => step > 0 || !!(LESSONS[step] && LESSONS[step].stage && staged);

export function learnStep(delta) {
  const l = LESSONS[step];
  if (delta < 0 && step === 0 && l && l.stage && staged) {
    clock.forEach(clearTimeout); clock = [];
    staged = false; done = false; said = ''; placed = {}; held = -1; landed = -1;
    paint();
    return report({ step, total: LESSONS.length, back: canBack() });
  }
  go(Math.max(0, Math.min(LESSONS.length, step + delta)));
}
export function learnReset() { go(0, true); }

/* Coming back to the school puts you where you left it. The screen is built again from
   nothing each time it is opened, and starting at nought meant a step out to the table
   and back cost the whole opening tour before you could carry on. Start again does what
   it says. */
export function mountLearn(el, onMove) {
  root = el;
  report = onMove || (() => {});
  go(step, step === 0);

  /* Dragging is done by hand rather than by the browser's own drag and drop, which does
     not exist on a touch screen: the tile is lifted as a copy that follows the pointer,
     and whatever is under it when you let go is where it lands. A press that does not
     move is left alone, so it still reads as a tap.
     A drop is followed by the browser's own click, which has to be ignored -- but only
     that one. Holding the flag until some later click ate the tap that goes on to the
     next lesson, so it is a moment in time, not a latch. */
  let drag = null, dropped = 0;
  const justDropped = () => Date.now() - dropped < 350;
  const binUnder = e => document.elementFromPoint(e.clientX, e.clientY)?.closest('.learn-bin');
  const trayUnder = e => document.elementFromPoint(e.clientX, e.clientY)?.closest('.learn-tray');
  const clearOver = () => root.querySelectorAll('.learn-bin.over').forEach(b => b.classList.remove('over'));
  const follow = e => {
    if (!drag) return;
    drag.dist = Math.max(drag.dist, Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0));
    drag.ghost.style.transform = 'translate(' + (e.clientX - drag.dx) + 'px,' + (e.clientY - drag.dy) + 'px)';
    const over = binUnder(e);
    clearOver();
    if (over) over.classList.add('over');
  };
  const drop = e => {
    if (!drag) return;
    const over = binUnder(e);
    drag.ghost.remove();
    drag.tile.classList.remove('lifting');
    const { i, dist } = drag;
    drag = null;
    clearOver();
    window.removeEventListener('pointermove', follow);
    window.removeEventListener('pointerup', drop);
    window.removeEventListener('pointercancel', drop);
    if (over) { dropped = Date.now(); held = i; bin(Number(over.dataset.bin)); }
    else if (trayUnder(e) && placed[i] !== undefined) { dropped = Date.now(); unbin(i); }
    else if (dist >= 6) { dropped = Date.now(); held = -1; repaint(); }
  };
  el.addEventListener('pointerdown', e => {
    /* loose in the line, or already in a kind -- both can be picked up and moved */
    const tile = e.target.closest('.learn-tile.grab') || e.target.closest('.placed-tile');
    const t = LESSONS[step] && LESSONS[step].task;
    if (!tile || done || !t || t.kind !== 'sort') return;
    const i = Number(tile.dataset.i);
    const art = tile.matches('.placed-tile') ? tile : tile.querySelector('img');
    const r = art.getBoundingClientRect();
    const ghost = art.cloneNode();
    ghost.className = 'learn-ghost';
    ghost.style.width = r.width + 'px';
    document.body.append(ghost);
    tile.classList.add('lifting');
    drag = { i, tile, ghost, dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, dist: 0 };
    follow(e);
    window.addEventListener('pointermove', follow);
    window.addEventListener('pointerup', drop);
    window.addEventListener('pointercancel', drop);
  });
  el.addEventListener('click', e => {
    if (justDropped()) { dropped = 0; return; }
    if (done) return go(step + 1);          /* answered -- tap anywhere for the next lesson */
    const back = e.target.closest('.placed-tile');
    if (back) return tap(Number(back.dataset.i));
    const tile = e.target.closest('.learn-tile');
    if (tile) return tap(Number(tile.dataset.i));
    const slot = e.target.closest('.learn-bin');
    if (slot) return bin(Number(slot.dataset.bin));
    const choice = e.target.closest('.learn-choice');
    if (choice) return choose(Number(choice.dataset.i));
    const b = e.target.closest('[data-learn]');
    if (!b) return;
    if (b.dataset.learn === 'again') return go(0, true);
  });
}
