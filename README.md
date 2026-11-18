# Mahjong GPT

Hong Kong mahjong in a browser: a hero page, a school that teaches the game a
screen at a time, a practice table, and a chat panel that answers questions
about the hand in front of you.

No framework, no build step beyond a shell script — plain HTML, CSS and ES
modules. The dragon's page loads three.js from a CDN and carries its own sculpt
inline, so the served site is four files' worth of page and the tile art.

## Running it

```sh
./build.sh
python3 -m http.server 4180 --directory preview
```

Then open <http://localhost:4180>.

`build.sh` wraps `index.html` in a document skeleton (the page is published as
a Claude Artifact, which supplies that skeleton itself) and copies what the site
actually serves into `preview/`. That directory is build output and is not
committed.

It also writes the addresses the site is shared by: `/home` and `/play`,
`/learn-to-play` and `/mahjong-gpt`. The game's three screens are one shell
served at three paths rather than three copies of it -- `play/index.html`
carries `<base href="../play/">`, so whichever path it is served from, its
stylesheet, modules and tile art are the one set in `play/`.

What it leaves out is as deliberate as what it puts in: the browser is served
the rendered tiles, never the SVGs they were drawn from, and never the
illustrated dragon the game's banner replaced with `dragon.webp`. Both stay in
the repo as sources.

## Layout

| path | what it is |
| --- | --- |
| `index.html` | the hero page, and the artifact's own page |
| `dragon.html` | the gold dragon that swims behind the letters — three.js, carried in a frame |
| `play/index.html` | the game's shell, served at `/play`, `/learn-to-play` and `/mahjong-gpt` |
| `play/learn.mjs` | the school — one idea a screen, from the 144 tiles to who pays |
| `play/practice.mjs` | the table: the wall, the deal, the turn, scoring |
| `play/gpt.mjs` | the chat panel |
| `play/style.css` | all of the game's layout and type |
| `play/tile-art/` | the tiles: `fronts/` drawn as SVG, `rendered-fronts/` the webps actually served |
| `dragon.glb` | the sculpt `dragon.html` carries inline — the source, not served |

## Tests

```sh
node test-scoring.mjs
node test-coach.mjs
```
