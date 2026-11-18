#!/bin/sh
# The engine's own check. Pure Swift, no simulator: the four engine files plus the deal.
set -e
cd "$(dirname "$0")/.."
out=$(mktemp -d)
swiftc -O -o "$out/checks" \
  MahjongGPT/Engine/Tiles.swift \
  MahjongGPT/Engine/Hand.swift \
  MahjongGPT/Engine/Scoring.swift \
  MahjongGPT/Engine/Coach.swift \
  MahjongGPT/Engine/Deal.swift \
  Checks/main.swift
"$out/checks"
