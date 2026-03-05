import type { Platform } from '../engine/types';

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const INITIAL_PLATFORMS: Platform[] = [
  // --- Ground floor ---
  { id: 'ground', x: 0, y: 550, width: 800, height: 50, type: 'solid' },

  // --- Tier 1: Jump bars (reachable from ground with one jump) ---
  { id: 'jump-center', x: 360, y: 500, width: 80, height: 10, type: 'jump-bar' },
  { id: 'jump-l', x: 70, y: 500, width: 60, height: 10, type: 'jump-bar' },
  { id: 'jump-r', x: 670, y: 500, width: 60, height: 10, type: 'jump-bar' },

  // --- Tier 2: Mid platforms (reachable from jump bars) ---
  { id: 'mid-l', x: 90, y: 420, width: 110, height: 18, type: 'solid' },
  { id: 'mid-r', x: 600, y: 420, width: 110, height: 18, type: 'solid' },
  { id: 'center-float', x: 300, y: 440, width: 200, height: 18, type: 'solid' },

  // --- Tier 3: Jump bars to upper mid ---
  { id: 'jump-mid-l', x: 130, y: 350, width: 50, height: 10, type: 'jump-bar' },
  { id: 'jump-mid-r', x: 620, y: 350, width: 50, height: 10, type: 'jump-bar' },

  // --- Tier 4: Upper mid platforms ---
  { id: 'up-mid-l', x: 200, y: 260, width: 90, height: 18, type: 'solid' },
  { id: 'up-mid-r', x: 510, y: 260, width: 90, height: 18, type: 'solid' },
  { id: 'high-center', x: 355, y: 280, width: 90, height: 18, type: 'solid' },

  // --- Tier 5: Jump bars to sniper perches ---
  { id: 'jump-high-l', x: 110, y: 170, width: 45, height: 10, type: 'jump-bar' },
  { id: 'jump-high-r', x: 645, y: 170, width: 45, height: 10, type: 'jump-bar' },

  // --- Sniper perches (corners) ---
  { id: 'sniper-l', x: 25, y: 95, width: 85, height: 18, type: 'solid' },
  { id: 'sniper-r', x: 690, y: 95, width: 85, height: 18, type: 'solid' },

  // --- Pillars (narrow, for cover only) ---
  { id: 'pillar-l', x: 230, y: 470, width: 28, height: 80, type: 'solid' },
  { id: 'pillar-r', x: 542, y: 470, width: 28, height: 80, type: 'solid' },

  // --- Moving platform (mid-height, limited range) ---
  {
    id: 'moving-barrier',
    x: 360,
    y: 320,
    width: 80,
    height: 14,
    type: 'moving',
    baseX: 360,
    speed: 50,
    range: 120,
    dir: 1,
  },
];
