/* Mahjong GPT -- the coach you can ask.
   It answers out of the book below, not out of a model: every reply is written here, so the
   screen works offline, costs nothing to ask, and cannot wander off mahjong. A question is
   matched against the entries by the words it uses; one that touches no mahjong word at all
   is a question about something else, and the coach says so rather than guessing.
   Every entry holds several answers. Ask again, or ask for another, and you get the next one
   with different tiles -- being shown the same three red dragons twice teaches nothing.
   Tiles are drawn in the table's own art: [[bamboo-1 bamboo-2 bamboo-3]] in an answer draws
   that run of tiles. */
import { faces, label, img, tableState } from './practice.mjs';

const FACE_SET = new Set(faces);
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* Hands by what they pay on the common Hong Kong table, for "show me a hand worth N faan".
   Several at most values, so asking twice shows a different way to get there. */
const HANDS = [
  { faan: 1, name: 'all chows, the common hand',
    tiles: '[[dots-2 dots-3 dots-4]] [[dots-6 dots-7 dots-8]] [[bamboo-3 bamboo-4 bamboo-5]] [[characters-5 characters-6 characters-7]] [[east east]]',
    note: 'Four runs and a pair, nothing else. It is what you fall back on when the tiles will not do anything special.' },
  { faan: 1, name: 'all chows across two suits',
    tiles: '[[bamboo-1 bamboo-2 bamboo-3]] [[bamboo-6 bamboo-7 bamboo-8]] [[characters-2 characters-3 characters-4]] [[characters-7 characters-8 characters-9]] [[dots-5 dots-5]]',
    note: 'Same value, fewer tiles wasted. Runs in two suits leave you more ways to finish than runs spread across three.' },
  { faan: 3, name: 'all pungs',
    tiles: '[[characters-3 characters-3 characters-3]] [[dots-7 dots-7 dots-7]] [[bamboo-9 bamboo-9 bamboo-9]] [[west west west]] [[dots-2 dots-2]]',
    note: 'Every set a triplet. Go for it when you pair up early and your suits are scattered.' },
  { faan: 3, name: 'half flush -- one suit plus honours',
    tiles: '[[bamboo-2 bamboo-3 bamboo-4]] [[bamboo-6 bamboo-7 bamboo-8]] [[bamboo-9 bamboo-9 bamboo-9]] [[north north north]] [[south south]]',
    note: 'Bamboo and honours only. The commonest three-faan hand, because you can drift into it rather than plan it.' },
  { faan: 4, name: 'half flush with a dragon pung',
    tiles: '[[characters-1 characters-2 characters-3]] [[characters-5 characters-6 characters-7]] [[characters-8 characters-8 characters-8]] [[green-dragon green-dragon green-dragon]] [[west west]]',
    note: 'One suit plus honours is 3, and the dragon pung adds 1. This is the everyday way to reach four.' },
  { faan: 5, name: 'small dragons',
    tiles: '[[red-dragon red-dragon red-dragon]] [[green-dragon green-dragon green-dragon]] [[white-dragon white-dragon]] [[dots-3 dots-4 dots-5]] [[bamboo-6 bamboo-7 bamboo-8]]',
    note: 'Two dragon pungs and the third dragon as the pair. Make the third one your eyes the moment you hold two of it.' },
  { faan: 7, name: 'full flush',
    tiles: '[[dots-1 dots-2 dots-3]] [[dots-3 dots-4 dots-5]] [[dots-6 dots-7 dots-8]] [[dots-9 dots-9 dots-9]] [[dots-5 dots-5]]',
    note: 'One suit and nothing else, honours included. Expensive to chase -- commit only when you are already most of the way there.' },
  { faan: 8, name: 'great dragons',
    tiles: '[[red-dragon red-dragon red-dragon]] [[green-dragon green-dragon green-dragon]] [[white-dragon white-dragon white-dragon]] [[bamboo-4 bamboo-5 bamboo-6]] [[characters-9 characters-9]]',
    note: 'All three dragon pungs. Once two are down the table knows, and the third dragon will never be discarded -- plan to draw it.' },
  { faan: 10, name: 'all honours',
    tiles: '[[east east east]] [[south south south]] [[red-dragon red-dragon red-dragon]] [[white-dragon white-dragon white-dragon]] [[north north]]',
    note: 'Winds and dragons only, no numbered tile anywhere. You will see it once in a long while.' },
  { faan: 10, name: 'small winds',
    tiles: '[[east east east]] [[south south south]] [[west west west]] [[north north]] [[dots-4 dots-5 dots-6]]',
    note: 'Three wind pungs and the fourth wind as the pair. Only twelve of the sixteen winds you need are ever in play for you.' },
  { faan: 13, name: 'thirteen orphans',
    tiles: '[[characters-1 characters-9 dots-1 dots-9 bamboo-1 bamboo-9]] [[east south west north]] [[red-dragon green-dragon white-dragon]]',
    note: 'One of each terminal and honour, plus a second copy of any one of them for the pair. A limit hand.' },
  { faan: 13, name: 'great winds',
    tiles: '[[east east east]] [[south south south]] [[west west west]] [[north north north]] [[dots-8 dots-8]]',
    note: 'All four wind pungs. The limit, and about as rare as the game gets.' },
];

const NOTHING = 'I only know mahjong. Ask me about the tiles, the rules, the scoring, or the hand you are holding.';
const VAGUE = 'That one I have not got a page for. Try me on chows, pungs and kongs, the scoring, what to discard, waits, defence, the winds and dragons, the flowers, or a hand worth a given number of faan.';

/* The book. `on` are the words that call an entry up; `say` holds its answers in order, and
   asking again moves to the next one. Specific entries sit above general ones. */
const BOOK = [
  { on: ['chow', 'chi', 'run', 'sequence', 'straight', 'consecutive'], say: [
    'A chow is three running numbers in one suit:\n[[bamboo-2 bamboo-3 bamboo-4]]\nYou can only claim a chow from the player on your left, and only for the tile that completes it. A pung beats a chow to the same discard.',
    'Another chow, in characters this time:\n[[characters-5 characters-6 characters-7]]\nThe shape worth holding before it is finished is the two in the middle -- 5 and 6 can be completed by a 4 or a 7, eight tiles in all. An edge like 8-9 only takes a 7, four tiles.',
    'And one at the top of the dots:\n[[dots-7 dots-8 dots-9]]\nChows are cheap -- four of them and a pair pays one faan -- but they are fast, and a fast cheap hand still wins the hand and stops everybody else.',
  ] },
  { on: ['pung', 'pong', 'triplet', 'three of a kind', 'three identical'], say: [
    'A pung is three identical tiles:\n[[red-dragon red-dragon red-dragon]]\nYou can claim one from any player’s discard, and claiming jumps the turn to you. A pung of dragons, of the round wind, or of your own seat wind is worth a faan each.',
    'A numbered pung, which pays nothing by itself:\n[[dots-7 dots-7 dots-7]]\nIts value is in what it builds towards -- all pungs, or a flush. Claiming one costs you the chows you might have made with those tiles, so take it with a plan.',
    'A wind pung:\n[[west west west]]\nWorth a faan only if West is your seat or the round wind; otherwise it is three tiles doing one set’s work. The upside is safety -- nobody else wants the fourth.',
    'A terminal pung, in bamboo:\n[[bamboo-9 bamboo-9 bamboo-9]]\nTerminals pair up more often than middle tiles, because fewer players keep them. Three nines is also a step towards all pungs, worth 3 faan.',
  ] },
  { on: ['kong', 'gong', 'four of a kind', 'four identical'], say: [
    'A kong is four identical tiles:\n[[dots-5 dots-5 dots-5 dots-5]]\nDeclare it and draw a replacement, because a kong still counts as only one set. Forget the replacement tile and your hand is one short.',
    'A concealed kong -- all four drawn by you:\n[[bamboo-1 bamboo-1 bamboo-1 bamboo-1]]\nLay it face down at the ends. It keeps the hand concealed and still earns the replacement draw.',
    'You can also rob a kong: if a player adds a fourth tile to a pung already on the table and that tile completes your hand, you may take it and win. It is the one time a tile nobody discarded can be claimed.',
  ] },
  { on: ['pair', 'eyes', 'eye'], say: [
    'The pair is the two matching tiles a hand is built around -- the eyes. Four sets and one pair makes fourteen tiles:\n[[south south]]\nAny tile can be the pair.',
    'Hold two candidate pairs through the middle of the hand:\n[[dots-3 dots-3]] [[characters-6 characters-6]]\nWhichever one turns into a pung first, the other stays as the eyes. Settling on your pair too early throws away that choice.',
  ] },
  { on: ['wait', 'waits', 'waiting', 'tenpai', 'one away', 'ready'], say: [
    'The best wait is two-sided -- two tiles in a row, completed at either end:\n[[bamboo-4 bamboo-5]]\nA 3 or a 6 finishes it: eight tiles. Steer towards this shape whenever you can choose.',
    'The poor waits are the narrow ones. An edge wait, 8-9 needing the 7:\n[[dots-8 dots-9]]\nA closed wait, 4 and 6 needing the 5:\n[[characters-4 characters-6]]\nEach is four tiles only. Trade either for a two-sided wait while the hand still allows it.',
    'A single wait sits on the pair:\n[[green-dragon green-dragon]]\nOnly two tiles left in the game, but they are tiles others throw away early. A single wait on an honour often beats a two-sided wait on a suit everybody is collecting.',
  ] },
  { on: ['defence', 'defense', 'safe', 'safe tile', 'fold', 'danger', 'dangerous'], say: [
    'Read the table before you throw. A player with three sets exposed is close, and the suit they have claimed is the suit they want. Tiles already in their own discards are safe against them -- nobody may win on a tile they threw themselves.',
    'When to fold: your hand needs two tiles, the wall is short, and somebody has three sets down. Stop building, discard honours and tiles already on the table, and let the hand go. A hand you cannot finish costs you nothing; feeding the winner costs you the whole hand.',
    'Terminals and honours are the safest early and the most dangerous late. Early nobody has settled; late a lone honour is often the exact pair somebody is sitting on.',
  ] },
  { on: ['thirteen orphans', 'orphans'], say: [
    'Thirteen orphans: one of every terminal and honour, with a second copy of any one of them as the pair.\n[[characters-1 characters-9 dots-1 dots-9 bamboo-1 bamboo-9]] [[east south west north]] [[red-dragon green-dragon white-dragon]]\nIt pays the limit, 13 faan. Chase it only from a near-perfect start, since it is worth nothing until finished.',
  ] },
  { on: ['flush', 'one suit', 'same suit', 'half flush', 'full flush', 'clean hand', 'mixed'], say: [
    'A half flush is one suit plus honours, worth 3:\n[[bamboo-1 bamboo-2 bamboo-3]] [[bamboo-5 bamboo-6 bamboo-7]] [[bamboo-8 bamboo-8 bamboo-8]] [[north north north]] [[green-dragon green-dragon]]\nIt is the hand you drift into: keep the suit you were dealt most of, and the honours you hold pairs of.',
    'A full flush is one suit and nothing else, worth 7:\n[[dots-1 dots-2 dots-3]] [[dots-4 dots-5 dots-6]] [[dots-6 dots-7 dots-8]] [[dots-9 dots-9 dots-9]] [[dots-2 dots-2]]\nDecide by your sixth or seventh turn. Past that, a flush abandoned halfway leaves a hand that cannot go out at all.',
    'The tell is unmissable: a player discarding honours while claiming one suit is on a flush. Stop feeding that suit, even at the cost of your own shape.',
  ] },
  { on: ['all pungs', 'all triplets', 'all pong'], say: [
    'All pungs -- every set a triplet, with a pair -- is worth 3 faan:\n[[characters-3 characters-3 characters-3]] [[dots-7 dots-7 dots-7]] [[bamboo-9 bamboo-9 bamboo-9]] [[west west west]] [[dots-2 dots-2]]\nIt is the natural hand when you pair up early: pairs you would otherwise break become the hand.',
    'Honours make it easier, since nobody else keeps them:\n[[east east east]] [[white-dragon white-dragon white-dragon]] [[dots-4 dots-4 dots-4]] [[bamboo-2 bamboo-2 bamboo-2]] [[characters-5 characters-5]]\nThe cost is speed -- a pung needs two more of a tile, where a chow has two ends.',
  ] },
  { on: ['dragon', 'dragons', 'red dragon', 'green dragon', 'white dragon'], say: [
    'Three dragons: red, green and white.\n[[red-dragon green-dragon white-dragon]]\nA pung of any of them is worth a faan. A lone dragon early is a fine discard -- a second one is worth keeping.',
    'Dragons scale. Two pungs and the third dragon as your pair is small dragons, 5 faan:\n[[red-dragon red-dragon red-dragon]] [[green-dragon green-dragon green-dragon]] [[white-dragon white-dragon]]\nAll three as pungs is great dragons, 8. Once you show two dragon pungs nobody will ever release the third, so expect to draw it.',
  ] },
  { on: ['prevailing', 'prevailing wind', 'round wind', 'seat wind', 'my wind'], say: [
    'Two winds pay you. Your seat wind is the one you are sitting as, and it changes as the deal passes round the table. The prevailing wind belongs to the round itself: it starts at East and moves on each time the deal has been all the way round. A pung of either is worth a faan -- so in an East round a pung of East is a faan to anybody, and two faan to whoever is sitting East.',
    'Everyone else\u2019s winds are worth nothing at all, which makes them the safest thing to throw early. Check before you do, though: a wind that was dead last hand may be your seat wind this one.',
  ] },
  { on: ['wind', 'winds', 'east wind'], say: [
    'Four winds, East South West North:\n[[east south west north]]\nTwo of them pay you: the round wind, and your own seat wind. A pung of either is a faan. Everyone else’s winds are worth nothing, which makes them safe early discards.',
    'The winds move. Your seat wind changes as the deal passes, and the round wind advances once the deal has been all the way round -- East round, then South. A wind that was dead last hand can be worth a faan this one, so check before you throw it.',
    'Three wind pungs with the fourth as the pair is small winds, 10 faan:\n[[east east east]] [[south south south]] [[west west west]] [[north north]]\nAll four as pungs is great winds, the limit at 13.',
  ] },
  { on: ['flower', 'season', 'bonus tile', 'flowers'], say: [
    'Flowers and seasons are bonus tiles, eight in all:\n[[flower-1 season-1]]\nDraw one and it is set aside at once and you draw a replacement, so it never sits in your hand. The one matching your seat is worth a faan.',
    'They are free faan and free draws, but they also tell the table something -- each flower you show is a replacement tile you took, so the players counting the wall know your hand has moved on.',
  ] },
  { on: ['who pays', 'pay', 'pays', 'paid', 'payment', 'payout', 'settle', 'settlement', 'stake'], say: [
    'Win on a discard and the player who threw it pays double the hand\u2019s value while the other two pay it once. Win on your own draw and all three pay double. That is why a self-draw is worth far more than the single faan it scores.',
    'The arithmetic: a 5 faan hand is 24 points. Won off a discard, the thrower pays 48 and the other two pay 24 each -- 96 to the winner. Self-drawn, a 4 faan hand is 16 points and every player pays 32, which is 96 again.',
    'Scores run on across hands, so a bad start is not a lost session. It also means a cheap hand that goes out has done two jobs: it pays you, and it ends the hand on the player quietly building something expensive.',
  ] },
  { on: ['terminal', 'terminals', 'honour', 'honours', 'honor', 'honors', 'one and nine'], say: [
    'Terminals are the ones and nines; honours are the winds and dragons.\n[[characters-1 characters-9 dots-1 dots-9 bamboo-1 bamboo-9]]\nTerminals make fewer runs than middle tiles -- a 9 only reaches down, a 5 reaches both ways -- so they go early and pair up easily.',
    'Honours are the winds and dragons, four of each:\n[[east south west north]] [[red-dragon green-dragon white-dragon]]\nThey make no runs at all, only pungs. A lone one is the safest early discard you have and among the most dangerous late.',
  ] },
  { on: ['cantonese', 'chinese', 'called in', 'name', 'names', 'pronounce'], say: [
    'The calls at a Hong Kong table are Cantonese: 上 for a chow, 碰 for a pung, 槓 for a kong, and 麻雀 when somebody is out. This app says them aloud if the sound is on.',
    'The suits are 萬 for characters, 筒 for dots and 索 for bamboo; the winds are 東 南 西 北 and the dragons 中 發 白. The compass in the middle of the table uses the wind characters.',
  ] },
  { on: ['points', 'point', 'convert', 'conversion', 'how much is'], say: [
    'Faan become points on a doubling scale, capped at eight: 1 faan is 2 points, 2 is 4, 3 is 8, 4 is 16, 5 is 24, 6 is 32, 7 is 48, 8 is 64. Every extra faan is worth roughly half as much again, so a 5 faan hand pays three times a 3 faan one.',
    'Then the points are paid out. Win on a discard and the thrower pays double while the other two pay once; win on your own draw and all three pay double. A 5 faan hand won off a discard is 48 from the thrower and 24 from each of the others.',
  ] },
  { on: ['faan', 'fan', 'score', 'scoring', 'worth', 'value'], say: [
    'Hong Kong counts faan. The ones you meet every hand: winning on your own draw 1, finishing with no flower or season 1, a pung of any dragon 1, a pung of the round wind 1, a pung of your own seat wind 1, and all chows 1.\nThen the shapes: all pungs 3, half flush 3, little dragons 5, pure flush 7, big dragons 8.\nMost tables ask three faan before you may go out, which is why a plain hand of four chows and a pair often cannot be declared at all.',
    'The limit hands, far less often: all honours 10, small winds 10, thirteen orphans 13, big winds 15, nine gates 15, eighteen arhats -- four kongs and a pair -- 18. Blessing of heaven, East winning off the very first draw, and blessing of earth, winning on East\u2019s first discard, pay 10 each.',
    'Faan become points on a doubling scale, capped at eight: 1 faan is 2 points, 2 is 4, 3 is 8, 4 is 16, 5 is 24, 6 is 32, 7 is 48, 8 is 64. One extra faan is worth roughly another half again, so a 5 faan hand is three times a 3 faan one.',
  ] },
  { on: ['minimum', 'how many faan to win', 'go out', 'sik wu', 'declare'], say: [
    'Most tables ask a minimum before you may go out -- three faan is the usual figure, and this app lets you set it. Below it the hand is complete but unplayable, so count before you commit: four chows and a plain pair often cannot be declared at all.',
    'If you are short of the minimum, the cheapest faan are the honours. A pung of the round wind, your seat wind or any dragon is one each, and a half flush lifts a plain hand by three on its own.',
  ] },
  { on: ['self draw', 'self-draw', 'tsumo', 'draw it myself'], say: [
    'Winning on a tile you drew yourself is a self-draw, worth an extra faan, and all three opponents pay rather than one. It is worth holding a hand one more turn when the tile you need is one nobody will ever discard.',
  ] },
  { on: ['concealed', 'closed hand', 'open hand', 'expose', 'exposed'], say: [
    'Every set you claim goes face up, and a hand with nothing claimed stays concealed. Concealed is worth more on most tables and tells the others nothing. The moment you claim, your sets are public and good players stop feeding you that suit.',
    'Claim when the set you take finishes a shape you were going to need anyway, or when it lifts you over the minimum faan. Claiming for its own sake trades information and value for one turn of speed.',
  ] },
  { on: ['discard', 'throw', 'which tile', 'what should i', 'shanten', 'efficiency'], say: [
    'Discard by what a tile can still become. Lone honours go first -- a wind that is nobody’s and has no pair is dead weight. Then terminals with no neighbours. Keep tiles that sit beside each other:\n[[bamboo-4 bamboo-5]]\nThey have more ways to finish than a tile standing alone.',
    'In the middle of the hand, count what each tile is doing. A tile in no pair and no run is doing nothing, however pretty. Two tiles that overlap -- 3-4 and 4-5 in one suit -- are often one tile too many; drop the end that duplicates.',
    'Late in the hand it flips. Stop asking what helps you and start asking what helps them: watch what has been claimed, and stop feeding the suit somebody is collecting. A turn spent on a safe discard is cheaper than paying a whole hand.',
  ] },
  { on: ['win', 'winning', 'declare mahjong', 'going out', 'complete', 'winning hand'], say: [
    'A winning hand is four sets and a pair -- fourteen tiles. A set is a chow, a pung or a kong.\n[[dots-2 dots-3 dots-4]] [[dots-6 dots-7 dots-8]] [[bamboo-3 bamboo-4 bamboo-5]] [[west west west]] [[east east]]\nYou win on the tile that completes it, drawn or claimed, and must call it before the next tile is thrown.',
    'Another shape, with two triplets:\n[[characters-2 characters-3 characters-4]] [[characters-7 characters-7 characters-7]] [[bamboo-5 bamboo-5 bamboo-5]] [[dots-6 dots-7 dots-8]] [[red-dragon red-dragon]]\nThe dragon pair counts nothing, but a third red dragon would have made it a pung and a faan.',
    'Thirteen orphans is the one hand that breaks the four-sets-and-a-pair rule. Everything else, however it scores, is that same shape underneath.',
  ] },
  { on: ['tile', 'tiles', 'suit', 'suits', 'how many tiles', 'bamboo', 'dots', 'circles', 'characters'], say: [
    'A Hong Kong set is 144 tiles. Three suits run one to nine, four of each: characters, dots and bamboo.\n[[characters-1 dots-5 bamboo-9]]\nThen the honours, four of each: four winds and three dragons.\n[[east south west north]] [[red-dragon green-dragon white-dragon]]\nAnd eight bonus tiles, the flowers and seasons.',
    'Terminals are the ones and nines:\n[[characters-1 characters-9 dots-1 dots-9 bamboo-1 bamboo-9]]\nThey make fewer runs than middle tiles -- a 9 only reaches down, a 5 reaches both ways -- which is why they are discarded early and why they pair up so easily.',
    'Thirteen tiles are dealt to each player and fourteen to the dealer, who throws first. From then on everyone draws one and discards one, so a hand is thirteen tiles waiting for a fourteenth.',
  ] },
  { on: ['dealer', 'deal', 'east deals', 'rotate', 'who starts', 'first discard',
         'discards first', 'who discards', 'seat', 'seating'], say: [
    'The dealer is East and throws the first tile. When the hand ends the deal passes on, so every seat takes East in turn and the winds move round the table with it.',
    'Being East is worth playing for: the dealer draws first, which over a long match is a real edge, and the dealer’s seat wind is East -- a pung of East is a faan on top.',
  ] },
  { on: ['claim', 'call', 'interrupt', 'priority', 'who gets', 'pass'], say: [
    'A discard can be claimed. A win beats everything; a pung or kong beats a chow; a chow can only be taken by the player on the discarder’s right. Claiming jumps the turn to you and the players in between lose their go.',
    'Passing is a move too. Claiming a set you did not need opens your hand, tells the table what you are building and skips the draws of the players between -- which sometimes helps the one player you least want helped.',
  ] },
  { on: ['etiquette', 'rude', 'manners', 'custom'], say: [
    'Call your sets out loud and clearly, and do not reach for a discard you have not called. Keep your hand upright and still, discard into the middle rather than onto a pile, and leave the last discard visible until the next one lands.',
    'Do not show your hand, do not count another player’s tiles aloud, and do not take back a discard once your fingers have left it. A tile on the table is played.',
  ] },
  { on: ['strategy', 'tip', 'tips', 'better', 'improve', 'beginner', 'advice', 'good'], say: [
    'Three things carry a beginner further than anything clever.\nOne, keep the hand flexible for the first half-dozen turns -- tiles with neighbours, not lone honours.\nTwo, settle on a shape by the middle of the hand and stop collecting everything.\nThree, read the discards. What a player throws says what they are not collecting; what they claim says what they are.',
    'Speed beats value more often than beginners expect. A one-faan hand that goes out ends the hand, takes the payment and denies the player quietly building a flush. Reach for the big hand when the tiles offer it, not because it is worth more.',
    'Count your hand in sets, not tiles. Ask how many tiles away from four sets and a pair you are, and let that number drive every discard. It falls by one at a time, and anything that does not lower it is the tile to throw.',
  ] },
  { on: ['limit', 'limit hand', 'nine gates', 'all kongs', 'big hand', 'rare', 'special hand',
         'special hands', 'arhats', 'blessing'], say: [
    'The special hands, with what they pay: all honours 10, small winds -- three wind pungs and the fourth as the pair -- 10, thirteen orphans 13, big winds 15, nine gates 15, and eighteen arhats, four kongs and a pair, 18. Blessing of heaven and blessing of earth are 10 each.',
    'Nine gates is the prettiest of them: 1-1-1-2-3-4-5-6-7-8-9-9-9 in one suit, concealed, waiting on any tile of that suit at all.\n[[dots-1 dots-1 dots-1 dots-2 dots-3 dots-4 dots-5 dots-6 dots-7 dots-8 dots-9 dots-9 dots-9]]\nYou will probably never hold it. Chase a special hand only from a start that is already most of the way there -- it is worth nothing until it is finished.',
    'The two blessings are luck rather than skill: blessing of heaven is East completing the hand on the very first draw, before anybody has discarded, and blessing of earth is another seat winning on East\u2019s opening discard. Ten faan each, and neither is something you can play for.',
  ] },
  { on: ['how to play', 'how do you play', 'how do i start', 'start a game', 'start the game',
         'play', 'game', 'rules', 'rule', 'basics', 'start', 'begin', 'turn', 'turns',
         'player', 'players', 'people', 'four players', 'overview', 'set up', 'setup',
         'shuffle', 'deal the tiles', 'tiles dealt', 'dealt', 'dealing', 'how are the tiles'], say: [
    'Four players and 144 tiles. Everyone rolls the dice, and the highest total takes East and deals. The other three take South, West and North going counterclockwise round the table, and play runs the same way -- so the turn passes to the player on your right. The round has a wind of its own as well, starting at East, which counts for scoring later.\nThen the tiles are washed face down and each player builds a wall two tiles high and eighteen stacks long. The four walls are pushed together into a square.',
    'Breaking the square: East rolls again and counts that many seats counterclockwise, starting at East as one, to settle whose wall is opened. A second roll says where in it -- count that many stacks in from the right-hand end of that wall and lift it apart there.\nDeal from the break, in blocks of two stacks at a time: East first, then counterclockwise, until everyone holds twelve. East then takes two more and the others one each, so East has fourteen tiles and everybody else thirteen. The tiles just past the break are set aside as the dead wall, which is where every replacement comes from.',
    'East is holding the extra tile, so East throws the first one and play moves counterclockwise from there. After that a turn is two things: draw a tile from the live wall, then discard one face up in the middle.\nDraw a flower or a season and it does not stay in your hand -- lay it face up in front of you and take a replacement from the dead wall. A kong works the same way: show it, then take a replacement, because four tiles still only make one set.',
    'Any discard can be claimed. Anyone may take one for a pung, a kong or to win; only the player whose turn is next may take one for a chow. Say what you are making, lay the set face up, and discard -- play then carries on counterclockwise from you, and anyone skipped simply loses that go.\nA hand ends when somebody completes four sets and a pair, with enough faan to declare it, or when the live wall runs out with nobody home, which is a washout: no score, and the hand is dealt again.',
    'You are trying to reach four sets and a pair, fourteen tiles:\n[[dots-2 dots-3 dots-4]] [[bamboo-5 bamboo-5 bamboo-5]] [[characters-6 characters-7 characters-8]] [[west west west]] [[east east]]\nA set is a chow, a pung or a kong. The catch in Hong Kong is that completing it is not enough on its own -- the hand has to be worth the table minimum in faan, usually three, before you may declare it.',
  ] },
  { on: ['dice', 'die', 'roll', 'rolling', 'rolled'], say: [
    'The dice are thrown twice before a hand. First all four players roll, and the highest total takes East, deals, and throws the first tile. Then East rolls again to break the wall: count that many seats counterclockwise from East as one to pick whose wall is opened, and a further roll counts the stacks in from that wall\u2019s right-hand end to find the exact break.',
    'Dice decide only where the tiles come from, never what you are dealt, so the two rolls are a ritual rather than a turn -- but the first one matters: being East means dealing, drawing first, and a faan for a pung of your own seat wind.',
  ] },
  { on: ['wall', 'walls', 'break the wall', 'breaking', 'dead wall', 'live wall', 'draw', 'tiles left', 'empty', 'washout'], say: [
    'Each player builds a wall two tiles high and eighteen stacks long, and the four are pushed into a square. The dice say where to break it; tiles are drawn from that opening onwards, in order, right round the square.',
    'The dead wall is the short run of tiles kept back just past the break. Nothing is drawn from it in the ordinary way -- it is there for replacements, when you show a flower or a season, or when you declare a kong.',
    'Count the live wall. When it runs out with nobody home the hand is a washout: nothing is scored and it is dealt again. With a dozen tiles left, a hand still needing two of them is not going to arrive, and the safe discard is worth more than the long shot.',
  ] },
  { on: ['round', 'rounds', 'how many hands', 'how long', 'match', 'session'], say: [
    'A full game is four wind rounds -- East, South, West, North. The deal passes on after each hand, and when it has gone all the way round the table the prevailing wind moves on to the next one. That is a long sitting, so casual games usually agree a number of hands or a finishing time instead. Here you set how many wins take the match.',
    'The prevailing wind is worth knowing because it pays: a pung of the round\u2019s wind is a faan, exactly like a pung of your own seat wind. In an East round, East tiles are worth a faan to everyone, and two to the player sitting East.',
  ] },
  { on: ['variant', 'variants', 'american', 'japanese', 'riichi', 'taiwanese', 'charleston', 'three player'], say: [
    'This table plays Hong Kong old style: thirteen tiles, four sets and a pair, scored in faan with a minimum to go out. Japanese riichi adds the riichi declaration, dora and its own scoring table. American mahjong plays fixed hands off a card that changes each year, and passes tiles in a Charleston before play. Taiwanese deals sixteen tiles and asks for five sets. The tiles are much the same; what counts and what pays is not.',
  ] },
  { on: ['app', 'this app', 'in this app', 'coach', 'settings', 'difficulty', 'how do i play here'], say: [
    'At the table here you drag a tile into the middle to discard it, or tap it twice. The gear sets difficulty and how many wins take the match. The deal passes after every hand, so your seat wind changes as you play.',
  ] },
];

/* Words that make a question a mahjong question at all. Anything with none of them in it is
   not one, and is turned down rather than answered. */
const VOCAB = new Set([...BOOK.flatMap(e => e.on), 'mahjong', 'majong', 'mah-jong', 'majiang',
  'hand', 'hands', 'honor', 'honors', 'meld', 'melds', 'rack', 'terminal', 'terminals', 'pungs', 'chows', 'kongs', 'tile']);

const ASK_HAND = /\b(\d{1,2})\s*(faan|fan|point|points)\b|\bworth\s*(\d{1,2})\b/i;
const AGAIN = /\b(more|another|other|others|different|else|again|next|new)\b/;

/* What has been shown already, so the same answer is not served twice running. */
const shown = new Map();
let lastKey = null;

function nextOf(key, list) {
  const n = shown.get(key) ?? 0;
  shown.set(key, n + 1);
  return list[n % list.length];
}

function handAnswer(want) {
  const exact = HANDS.filter(h => h.faan === want);
  const pool = exact.length ? exact
    : [HANDS.reduce((best, h) => Math.abs(h.faan - want) < Math.abs(best.faan - want) ? h : best)];
  const h = nextOf('faan-' + want, pool);
  const opener = h.faan === want
    ? 'A hand worth ' + want + ' faan: ' + h.name + '.'
    : 'Nothing lands on exactly ' + want + ' faan on the common table. The nearest is ' + h.faan + ' faan: ' + h.name + '.';
  return opener + '\n' + h.tiles + '\n' + h.note;
}

function lookup(question) {
  /* "Hong Kong" is the place the rules come from, not a call -- without this a question
     about the weather there reads as a question about kongs. */
  const q = ' ' + question.toLowerCase()
    .replace(/hong\s*kong/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  const faan = question.match(ASK_HAND);
  /* "a hand worth 3 faan" wants tiles; "how many points is 3 faan" wants the table */
  if (faan && /\b(hand|hands|show|see|example|look|shape)\b/.test(q)) {
    lastKey = null;
    return handAnswer(Number(faan[1] || faan[3]));
  }

  /* whole words only, with a plural forgiven: "winds" is the winds, "win" is winning */
  const said = new Set(q.trim().split(' ').flatMap(w => [w, w.replace(/s$/, '')]));
  let best = null, bestScore = 0;
  for (const entry of BOOK) {
    let score = 0;
    for (const term of entry.on) {
      /* The longer the word that matched, the more it says about the question: "wall" beats
         the "run" in "when the wall runs out", and a whole phrase beats any single word. */
      const hit = term.includes(' ') ? q.includes(' ' + term + ' ') : said.has(term);
      if (hit) score = Math.max(score, term.includes(' ') ? 10 + term.length : term.length);
    }
    if (score > bestScore) { bestScore = score; best = entry; }
  }
  /* "show me another" on its own carries no subject -- it means the one we were just on */
  if (!best && AGAIN.test(q) && lastKey) best = BOOK[lastKey];
  if (best) {
    const key = BOOK.indexOf(best);
    lastKey = key;
    return nextOf(key, best.say);
  }
  lastKey = null;
  return [...said].some(w => VOCAB.has(w)) ? VAGUE : null;
}

function tiles(list) {
  const set = list.trim().split(/[\s,]+/).filter(face => FACE_SET.has(face));
  if (!set.length) return '';
  return '<span class="gpt-tiles" role="img" aria-label="' + esc(set.map(label).join(', ')) + '">'
    + set.map(face => img(face)).join('') + '</span>';
}

function body(text) {
  return text.split(/\[\[([^\]]*)\]\]/).map((part, i) => (i % 2 ? tiles(part) : esc(part))).join('');
}

/* The empty box does the suggesting: it cycles through the things worth asking, so the
   screen stays bare and still tells you what it can answer. */
const PROMPTS = [
  'What is a chow?',
  'Show me a hand worth 3 faan',
  'What should I discard?',
  'How does the scoring work?',
  'When should I call pung?',
  'What is a good wait?',
  'How do I play defence?',
  'What are the flowers for?',
  'How does the deal pass round?',
  'Show me a hand worth 7 faan',
];

const thread = [];
let root, log, form, field, busy = false, reveal, rotate;

function say(role, html, cls = '') {
  const line = document.createElement('div');
  line.className = 'gpt-line ' + role + (cls ? ' ' + cls : '');
  line.innerHTML = html;
  log.append(line);
  log.scrollTop = log.scrollHeight;
  return line;
}

/* The answer is written out a few characters at a time -- the coach talking, rather than a
   page appearing. Nothing waits on it: the whole text is already here. */
function type(node, text) {
  clearInterval(reveal);
  let at = 0;
  const step = Math.max(2, Math.round(text.length / 90));
  reveal = setInterval(() => {
    at += step;
    node.innerHTML = body(text.slice(0, at).replace(/\[\[[^\]]*$/, ''));
    log.scrollTop = log.scrollHeight;
    if (at >= text.length) { clearInterval(reveal); node.innerHTML = body(text); log.scrollTop = log.scrollHeight; }
  }, 16);
}

/* ---- the coach that thinks ---------------------------------------------------------
   Asked for once and remembered. Null everywhere the page is served without it -- on a
   plain web server, or to a viewer who says no -- and then the book below answers
   instead, which is the whole reason the book is still here. */
let sampler, asked;
function coach() {
  if (!asked) asked = window.claude && window.claude.use
    ? window.claude.use('sample').then(s => (sampler = s)).catch(() => null)
    : Promise.resolve(null);
  return asked;
}

/* Memoryless: the rules, the table, the app's own page on the subject and the question,
   every time. The page goes in so the coach and the rest of the app cannot contradict
   each other on a point of rules. */
function brief(question, page) {
  const state = tableState();
  const parts = [
    'You are the coach inside Mahjong GPT, a Hong Kong mahjong app. Hong Kong old style: '
    + 'thirteen tiles, four sets and a pair, scored in faan, with a minimum to go out.',
    'Answer the question that was actually asked, in two or three short sentences of plain '
    + 'English. No lists, no headings, no markdown, no greeting. If you do not know, say so '
    + 'plainly -- never answer a neighbouring question instead.',
    'To show tiles, name them inside double square brackets: [[dots-5 dots-6]], '
    + '[[red-dragon]], [[east]]. Suited tiles are characters-1 to characters-9, dots-1 to '
    + 'dots-9, bamboo-1 to bamboo-9. Honours are east, south, west, north, red-dragon, '
    + 'green-dragon, white-dragon. Show tiles only where seeing them helps.',
  ];
  parts.push(state
    ? 'The table in front of the player right now:\n' + JSON.stringify(state, null, 1)
    : 'No hand is in play, so this is a question about the rules, not about a hand.');
  if (page) parts.push("The app's own page on this subject. Where it covers the question, "
    + 'agree with it:\n' + page);
  parts.push('Question: ' + question);
  return parts.join('\n\n');
}

async function send(question) {
  const q = question.trim();
  if (!q || busy) return;
  busy = true;
  field.value = '';
  thread.push({ role: 'you', text: q });
  say('you', esc(q));

  const answer = say('coach', '<span class="gpt-wait" role="status" aria-label="Thinking"></span>');
  const found = lookup(q);

  const model = await coach();
  if (model) {
    try {
      let out = '';
      const reply = await model(brief(q, found), {
        modelTier: 'quick',
        /* text is the whole answer so far, not the latest piece, so it is assigned */
        onText: ({ text }) => {
          out = text;
          answer.className = 'gpt-line coach';
          answer.innerHTML = body(text);
          log.scrollTop = log.scrollHeight;
        },
      });
      const said = (reply && reply.text) || out;
      if (said) {
        answer.className = 'gpt-line coach';
        answer.innerHTML = body(said);
        thread.push({ role: 'coach', text: said });
        busy = false; field.focus(); log.scrollTop = log.scrollHeight;
        return;
      }
    } catch { /* the book answers instead */ }
  }

  /* No coach on this view, so the book answers. Every page is called up by words that
     belong to it alone, which makes the match good when the question is about one of the
     thirty-five things it knows and a near miss when it is not -- hence the notice at the
     top of the panel, which says where these answers come from. */
  const text = found ?? NOTHING;
  setTimeout(() => {
    answer.className = 'gpt-line coach' + (found ? '' : ' off');
    if (found) type(answer, text); else answer.textContent = text;
    thread.push({ role: 'coach', text, off: !found });
    busy = false;
    field.focus();
    log.scrollTop = log.scrollHeight;
  }, 260);
}

/* Start again: the thread goes, and so does the memory of which answers have been shown,
   so a fresh chat reads the way the first one did. */
export function resetGpt() {
  thread.length = 0;
  shown.clear();
  lastKey = null;
}

export function mountGpt(el) {
  root = el;
  root.innerHTML =
    '<div class="gpt-log" aria-live="polite"></div>'
    + '<form class="gpt-ask"><input type="text" name="q" autocomplete="off" placeholder="Ask about a rule, a hand, or a discard" aria-label="Ask the coach">'
    + '<button type="submit" aria-label="Ask">Ask</button></form>';
  log = root.querySelector('.gpt-log');
  form = root.querySelector('.gpt-ask');
  field = form.querySelector('input');
  /* Resolved by the time the first question is asked -- and where there is no coach to
     resolve, the panel says so once rather than letting the rule pages pass themselves
     off as answers to questions they were not written for. */
  coach().then(model => {
    if (model || !log || !log.isConnected || thread.length) return;
    say('coach', esc('The coach that reads your hand is not available in this view. '
      + 'What I have here are the rule pages: chows, pungs and kongs, the scoring, waits, '
      + 'defence, the winds and dragons, the flowers, and a hand worth a given number of faan.'),
      'off');
  });
  for (const m of thread) {
    if (m.role === 'you') say('you', esc(m.text));
    else say('coach', m.off ? esc(m.text) : body(m.text), m.off ? 'off' : '');
  }
  clearInterval(rotate);
  let at = Math.floor(Math.random() * PROMPTS.length);
  field.placeholder = PROMPTS[at];
  rotate = setInterval(() => {
    if (field.value || !field.isConnected) return;
    at = (at + 1) % PROMPTS.length;
    field.placeholder = PROMPTS[at];
  }, 3800);
  /* Tab on an empty box takes the question it is offering. With something typed it is a
     Tab again, so the keyboard still gets you out of the field. */
  field.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || e.shiftKey || field.value || !field.placeholder) return;
    e.preventDefault();
    field.value = field.placeholder;
    field.setSelectionRange(field.value.length, field.value.length);
  });
  const askBtn = form.querySelector('button');
  form.addEventListener('submit', e => {
    e.preventDefault();
    e.stopPropagation();
    /* the button answers the keyboard the way it answers a click */
    askBtn.classList.add('pressed');
    setTimeout(() => askBtn.classList.remove('pressed'), 220);
    send(field.value);
  });
  field.focus();
}
