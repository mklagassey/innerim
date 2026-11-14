// Every number worth arguing about lives here. Distances are in tiles, times in seconds.
export const CONFIG = {
  map: { size: 84, channels: 56, pull: 0.57, pools: 0.07, portalRing: 34, glucosePatches: 12, kupffer: 5, neutrophils: 8 },
  player: {
    maxHp: 40,
    speed: 4.2,
    radius: 0.28,
    vision: 7.5, // how far you can see; the obvious thing to raise with a power-up
    startEnergy: 3,
    strike: { cooldown: 0.45, reach: 1.25, arc: 0.2, min: 3, max: 5 }, // arc: cosine of the half-angle
    // The shot spends energy, so fighting your way out eats into the harvest.
    shot: { cooldown: 0.35, energy: 1, speed: 14, range: 9, min: 4, max: 6, radius: 0.45 },
  },
  energy: {
    quota: 20, // needed to ride the vein back out
    skim: { time: 1.1, gain: 1 },
    strip: { time: 0.9, gain: 5, hostDamage: 10, alert: 25, maxResponders: 2, reach: 1.35 },
    patchMax: 3,
    patchRegen: 22,
    metabolism: 14, // seconds per unit burned
    starveDamage: 1,
  },
  host: { maxHealth: 100 },
  alert: {
    max: 100,
    decay: 0.6, // per second while nothing can see you
    seenByNeutrophil: 1.2, // per second
    seenByKupffer: 3.5,
    perKill: 5,
    tiers: [
      { name: 'Calm', from: 0, spawnEvery: 0, spawnCount: 0 },
      { name: 'Suspicious', from: 25, spawnEvery: 13, spawnCount: 1 },
      { name: 'Alarmed', from: 50, spawnEvery: 10, spawnCount: 2 },
      { name: 'Cytokine surge', from: 75, spawnEvery: 7, spawnCount: 3 },
    ],
    maxEnemies: 16,
  },
  enemies: {
    neutrophil: { hp: 8, speed: 3.2, chaseSpeed: 3.9, radius: 0.3, sight: 6, reach: 0.95, windup: 0.35, cooldown: 1.1, min: 1, max: 3, forget: 4 },
    kupffer: { hp: 30, speed: 1.4, chaseSpeed: 2.3, radius: 0.42, sight: 5, reach: 1.25, windup: 0.5, cooldown: 1.5, min: 4, max: 7, forget: 3 },
  },
} as const;
