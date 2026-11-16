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

What it leaves out is as deliberate as what it puts in: the gold dragon was
dropped from the hero, so its module, its illustration, the sculpt modules
`make-model.py` writes and the vendored copy of three.js are all still in the
repo and none of them are served. They were twenty of the twenty-five megabytes
the build used to weigh.

## Layout

| path | what it is |
| --- | --- |
| `index.html` | the hero page, and the artifact's own page |
| `dragon.html` | the gold dragon that swims behind the letters — three.js, carried in a frame |
| `play/index.html` | the game's shell: play, learn, and the chat |
| `play/learn.mjs` | the school — one idea a screen, from the 144 tiles to who pays |
| `play/practice.mjs` | the table: the wall, the deal, the turn, scoring |
| `play/gpt.mjs` | the chat panel |
| `play/style.css` | all of the game's layout and type |
| `play/tile-art/` | the tiles, drawn as SVG and rendered to webp |
| `dragon.glb` | the sculpt the dragon's mesh is deformed from |
| `make-model.py` | turns that sculpt into base64 modules — for the dropped gold dragon, not served |
| `vendor/three/` | three.js, vendored for the dropped gold dragon — not served |

## Tests

```sh
node test-scoring.mjs
node test-coach.mjs
```
