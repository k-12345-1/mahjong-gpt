#!/bin/sh
# Wrap the artifact fragment in a real document so it can be served locally.
# The published artifact supplies this skeleton itself.
set -e
cd "$(dirname "$0")"
mkdir -p preview
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0);padding-bottom:env(safe-area-inset-bottom,0)}'
  printf 'body{margin:0;font:14px system-ui}img{max-width:100%%}[hidden]{display:none!important}</style>\n'
  printf '</head>\n<body>\n'
  cat index.html
  printf '\n</body>\n</html>\n'
} > preview/index.html
cp -f dragon.webp preview/dragon.webp
# the dragon on the hero: a page of its own, carried in a frame
cp -f dragon.html preview/dragon.html
# the three.js dragon: its module, the sculpt it deforms, and three itself
# the sculpt travels as base64 script, because a published artifact serves no .glb
python3 -I make-model.py dragon.glb > /dev/null
cp -f gold-dragon-swim.mjs gold-dragon.png preview/
cp -f dragon-swim.mjs dragon-model.mjs dragon-model-1.mjs dragon-model-2.mjs preview/
rm -rf preview/vendor; cp -R vendor preview/vendor
cp -f icon.png preview/icon.png
# the game is a page of its own, served beside the hero
rm -rf preview/play
cp -R play preview/play
echo "built preview/index.html ($(wc -c < preview/index.html) bytes) + dragon.webp + play/ ($(find play -type f | wc -l | tr -d ' ') files)"
