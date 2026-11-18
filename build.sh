#!/bin/sh
# Wrap the artifact fragment in a real document so it can be served locally.
# The published artifact supplies this skeleton itself.
set -e
cd "$(dirname "$0")"
rm -rf preview
mkdir preview
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0);padding-bottom:env(safe-area-inset-bottom,0)}'
  printf 'body{margin:0;font:14px system-ui}img{max-width:100%%}[hidden]{display:none!important}</style>\n'
  printf '</head>\n<body>\n'
  cat index.html
  printf '\n</body>\n</html>\n'
} > preview/index.html
cp -f dragon.webp icon.png preview/
# The dragon on the hero: a page of its own, carried in a frame. It carries its own sculpt
# inline as base64 and loads three from the CDN, so nothing else travels with it.
cp -f dragon.html preview/dragon.html
# the game is a page of its own, served beside the hero
cp -R play preview/play
# What the browser asks for is the rendered tile, never the drawing it came from, and never
# the illustrated dragon -- the game's banner uses dragon.webp beside the hero's. They stay
# in the repo as sources and off the wire.
rm -rf preview/play/tile-art/fronts preview/play/tile-art/shared
rm -f preview/play/dragon.png

# Four paths worth sharing: /home is the hero, /play the table, /learn-to-play the school,
# /mahjong-gpt the coach. The game's three screens are one shell served at three paths
# rather than three copies of it: the shell carries <base href="../play/">, which is that
# one directory from any of the three, so the stylesheet, the modules and the tile art are
# fetched once and shared across them.
for route in learn-to-play mahjong-gpt; do
  mkdir -p "preview/$route"
  cp -f play/index.html "preview/$route/index.html"
done
# the hero answers at /home as well as at the root, because the menu calls it Home
mkdir -p preview/home
sed 's|<meta charset="utf-8">|<meta charset="utf-8"><base href="../">|' preview/index.html > preview/home/index.html
echo "built preview/index.html ($(wc -c < preview/index.html) bytes) + dragon.webp + play/ ($(find preview/play -type f | wc -l | tr -d ' ') files) + home/ learn-to-play/ mahjong-gpt/, $(du -sh preview | cut -f1) in all"
