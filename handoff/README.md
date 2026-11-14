# MahjongGPT dragon handoff

Give this folder to Claude Code with the koi recording and the MahjongGPT screenshot.

## Instructions for Claude Code

Integrate the supplied upright red dragon into the existing MahjongGPT hero. Keep the existing red background, title, subtitle, menu and Play button. Replace the static dragon layer when the animated layer is active. Keep the static dragon as the reduced-motion fallback.

Search the project for the koi animation first. If its motion is available, reuse its path, timing, easing, entry and exit. The supplied portrait PNG has its head near the upper left and its tail at the bottom. Adjust the artwork orientation and mesh axes for those coordinates before swapping it into any horizontal koi rig.

If the koi source is unavailable, use the supplied Canvas module. It approximates the recording by swimming from the lower right across the title, then turning upward and exiting at the top. The head leads and a traveling wave bends the body toward the tail. The code draws on a transparent overlay. Adapt the selector and stacking order so the dragon can pass in front of the title while Menu and Play sit above it. Check narrow and wide screens, route changes, reduced motion and both controls.

## Module usage

Copy the PNG, CSS and module into the project. Import the stylesheet with the existing CSS pipeline.

```js
import { mountDragonSwim } from './dragon-swim.mjs';
import './dragon-swim.css';

const hero = document.querySelector('.mahjong-hero');
const dispose = mountDragonSwim(hero, { duration: 7, pause: 0.6 });
// Call dispose() when the hero unmounts.
```

In React, call mountDragonSwim inside an effect with the hero ref and return the cleanup function. Pass an explicit imageUrl if the project serves assets from its public directory.
