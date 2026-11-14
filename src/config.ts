// Every number worth arguing about lives here, so tuning never means hunting through rules.
export const CONFIG = {
  player: {
    maxHp: 24,
    ap: 6,
    startEnergy: 3,
    moveCost: 1,
    strike: { ap: 3, min: 2, max: 4, hit: 0.9 },
    // The shot spends energy, so fighting your way out makes the harvest matter more.
    shot: { ap: 3, energy: 1, range: 6, min: 3, max: 5, hit: 0.85, falloffFrom: 3, falloffPerTile: 0.1 },
  },
  energy: {
    quota: 12, // needed to make the trip back out
    skim: { ap: 3, gain: 1 },
    strip: { ap: 3, gain: 5, hostDamage: 10, alert: 25, maxResponders: 2 },
    patchMax: 3,
    patchRegenEvery: 8, // turns per unit regrown
    metabolismEvery: 5, // turns per unit burned
    starveDamage: 1,
  },
  host: { maxHealth: 100 },
  alert: {
    max: 100,
    decayPerTurn: 1,
    seenByNeutrophil: 2,
    seenByKupffer: 5,
    perKill: 5,
    // Reinforcements arrive through the portal vessels, scaled to how loud you have been.
    tiers: [
      { name: 'Calm', from: 0, spawnEvery: 0, spawnCount: 0 },
      { name: 'Suspicious', from: 25, spawnEvery: 6, spawnCount: 1 },
      { name: 'Alarmed', from: 50, spawnEvery: 5, spawnCount: 2 },
      { name: 'Cytokine surge', from: 75, spawnEvery: 4, spawnCount: 3 },
    ],
    maxEnemies: 12,
  },
  enemies: {
    neutrophil: { hp: 6, ap: 6, attackAp: 4, min: 1, max: 3, hit: 0.75, sight: 6 },
    kupffer: { hp: 14, ap: 3, attackAp: 3, min: 2, max: 4, hit: 0.75, sight: 5 },
  },
} as const;
