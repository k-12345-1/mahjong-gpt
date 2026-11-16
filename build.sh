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
# The dragon on the hero: a page of its own, carried in a frame. It carries its own sculpt
# inline as base64 and loads three from the CDN, so nothing else travels with it.
cp -f dragon.html preview/dragon.html
cp -f icon.png preview/icon.png
# The gold dragon was dropped from the hero (see the comment at the foot of index.html).
# Its sources stay in the repo; they are not served, and neither are the sculpt modules
# make-model.py writes, which only that dragon ever imported. Regenerate them with
#   python3 -I make-model.py dragon.glb
# Clear anything an older build left behind.
rm -rf preview/vendor
rm -f preview/gold-dragon-swim.mjs preview/gold-dragon.png preview/dragon-swim.mjs \
      preview/dragon-model.mjs preview/dragon-model-1.mjs preview/dragon-model-2.mjs
# the game is a page of its own, served beside the hero
rm -rf preview/play
cp -R play preview/play
# the illustrated dragon again, this time the copy the game never asks for
rm -f preview/play/dragon.png
echo "built preview/index.html ($(wc -c < preview/index.html) bytes) + dragon.webp + play/ ($(find preview/play -type f | wc -l | tr -d ' ') files), $(du -sh preview | cut -f1) in all"
