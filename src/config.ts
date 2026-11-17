// Every number worth arguing about lives here. Distances are in tiles, times in seconds.
export const CONFIG = {
  map: { size: 84, channels: 56, pull: 0.57, pools: 0.07, portalRing: 34, glucosePatches: 12, kupffer: 5, neutrophils: 8 },
  player: {
    maxHp: 40,
    speed: 4.2,
    radius: 0.28,
    vision: 7.5, // how far you can see; the obvious thing to raise with a power-up
    startEnergy: 8,
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
    quotaKeep: 4, // what the vein insists you keep for the road, on top of the fare
  },
  // The host is a person getting on with their day. Their body changes around you.
  host: {
    maxHealth: 100,
    secondsPerHour: 30, // a whole day and night passes in twelve minutes of play
    startHour: 11,
    // Hurt the host and they run a fever: each step down makes immune cells faster and burns your energy quicker.
    fever: { below: [80, 60, 40], speed: 0.1, burn: 0.25, degrees: [37, 37.9, 38.8, 39.7] },
    sleepHeals: 6, // seconds of sleep that give the host back one point of health
    meals: [7.5, 12.5, 19],
    // Habits. Coffee quickens the blood and makes the host jumpy; an evening drink dulls the immune system, makes the ship hard to hold straight, and leaves the liver with less to spare.
    dreams: 0.4, // how often a sleeping host takes fright, against a waking one
    coffee: { at: [8, 15], lasts: 3, push: 0.35, jumpy: 1 },
    drink: { at: [20.5], lasts: 3.5, immune: 0.2, sway: 0.9, liver: 1 }, // breakfast, lunch, dinner
    digestion: 3, // hours a meal keeps the gut busy
    fedGlucose: 1.5, // extra sugar in the blood at the height of digestion, as a share
    asleepFrom: 23, asleepUntil: 7,
    surge: { first: [50, 80], every: [80, 140], time: 22 }, // a fright: seconds until the first, between them, and how long one lasts
    bpm: { asleep: 48, awake: 62, stressed: 120 },
    // How hard the blood pushes on you: by where you are, then scaled by what the host is doing.
    current: { liver: 0.14, stomach: 0, lung: 1.05, vein: 0.3, artery: 0.5 },
    push: { asleep: { liver: 0.7, stomach: 1, lung: 0.95, vein: 0.7, artery: 0.7 }, awake: { liver: 1, stomach: 1, lung: 1, vein: 1, artery: 1 }, stressed: { liver: 1.6, stomach: 1, lung: 1.25, vein: 1.3, artery: 2.4 } },
    breath: { asleep: 9, awake: 6.5, stressed: 3.2 }, // seconds for one breath in and out
    driftAbove: 0.85, // past this the current drags you along even when you are holding still
    swirl: 0.9, // how far a hard current rolls from side to side
    drag: 7, // tiles per second of drag for each point of current above that
    slam: { damage: 1, every: 1, perFright: 6 }, // being thrown against a wall by it
    glucose: { asleep: 0.6, awake: 1, stressed: 4 }, // how fast sugar comes back: fasting overnight, flooding out of the liver in a fright
    nose: { asleep: 1.25, awake: 1, stressed: 1 }, // the immune system does its best work while the host sleeps
  },
  alert: {
    max: 100,
    decay: 0.6, // per second while nothing has your scent
    search: { start: 4, grow: 0.8, most: 14, cortisol: 0.5 }, // the hunt: tiles of radius at lost contact, growth per second, and the limit
    loseAfter: 4, // seconds off their noses before the search starts to give up
    shake: 5, // per second once it does
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
  items: {
    caches: 6, // upgrade choices scattered through the liver
    patches: 4,
    calms: 3, // interleukin-10 droplets
    calmDrop: 30, // alert removed by one
    patchHeal: 15,
    autoPatchBelow: 0.35, // a patch applies itself when life falls to this fraction
    maxPatches: 5,
    patchDrop: 0.2, // chance a dead neutrophil leaves one behind
    offer: 3, // upgrades to choose between at each cache
  },
  // Immune cells have no eyes. They taste the blood for you: your scent drifts downstream
  // toward the central vein, and you leave a trail of footprints that fades.
  scent: {
    reach: 8, // how far the plume carries, in cost units (one tile downstream costs `down`)
    down: 1, across: 1.7, up: 3.2,
    contact: 2.5, // within this much plume, a cell knows exactly where you are
    touch: 1.3, // or this close in tiles, whichever way the blood is running
    every: 0.2, // seconds between plume updates
    trailLife: 12, // seconds a footprint lasts
    stride: 0.9, // tiles between footprints
    sniff: 1.6, // how close a cell must pass to a footprint to pick up the trail
    maskPerLevel: 0.2, // each CD47 level shortens plume and trail by this share
  },
  // The stomach: a lake of acid with a rim of protective mucus, and glands full of rich cells around it.
  stomach: {
    rise: 20, // seconds for the acid to come up to strength once a meal starts
    warn: 1, // host hours of warning before a meal
    burn: 4.5, // hull lost per second in acid at the height of digestion
    resting: 0.2, // share of that when the stomach is empty
    mucusSpeed: 0.55, // mucus is safe and slow
    enemyBurn: 6, // immune cells dissolve in acid too
    neutrophils: 4,
    parietal: { gain: 8, hostDamage: 6 }, // acid-making cells: the richest in mitochondria in the body
    mucinPerLevel: 0.3,
  },
  // Adaptive immunity: every alarm you raise teaches the host a little more about you, and it does not forget.
  memory: {
    perAlert: 0.3, // learned from one map whose alert peaked at 100
    perKill: 0.015,
    most: 18, // antibodies adrift in a map when the host knows you completely
    tagTime: 9, // seconds one stays stuck to you
    tagScent: 1.7, // how much further your scent carries while tagged
    tagAlert: 4,
    reach: 0.55, drift: 0.7, pull: 3, homing: 0.9,
    tcells: [0.5, 0.85], // memory at which the first and second killer T cell join each map
    tcellSight: 1.3, // how close one must be to know you through the cloak: contact, not sight
  },
  // The mission: a tumor seeded through the liver, to be cut out a cell at a time.
  tumor: { cells: 9, goal: 20, gain: 3, heal: 2, alert: 6, time: 1.4 },
  // The gut flora trade for sugar. Prices are in energy.
  lung: { macrophages: 2 },
  // Boarding: climb inside a wounded neutrophil and wear it.
  board: { reach: 1.5, below: 0.5, time: 12, speed: 0.8 },
  // Cortisol: what a fright leaves in the blood. It tells the immune system to stand down.
  story: { sibling: { liver: 1, vessel: 0.4, energy: 6, hull: 5, wake: 3 }, gap: 6, kin: { most: 3, gift: 2 }, quota: 2, defy: 5, feeling: { cost: 2, heals: 4 }, sight: 1, scent: 0.85, echo: 0.5, warden: { sight: 6.5, from: [55, 80], yields: 0.5 } }, // siblings, seconds between thoughts, and what waking is worth
  flora: { cost: 4, aboard: 2, most: 4, lure: 8, lasts: 12, feast: 5, hostDamage: 2 }, // gut bacteria as stowaways and bait
  cortisol: { drops: 3, time: 14, slow: 0.6, nose: 0.6 },
  wait: { energy: 2, legHours: 0.5 }, // an hour's idling on the map costs this; a quiet leg takes this long
  levers: { serotonin: { cost: 4, hours: 2 }, ghrelin: { cost: 3 } }, // ways to nudge the host from inside
  market: { repair: { cost: 3, hull: 15 }, patch: { cost: 4 }, upgrade: { cost: 8, stock: 3 }, butyrate: { cost: 5, forget: 0.2 } },
  vessel: { chaseBoost: 1.22, cooldown: 0.75, net: { range: 4.5, slow: 0.4, time: 1.6, every: 5 } }, // patrols on the road are faster and busier than the ones at home in tissue
  cloak: { energy: 2, base: 3, perLevel: 2, cooldown: 10, confusion: 2.5 },
  enemies: {
    neutrophil: { hp: 8, speed: 3.2, chaseSpeed: 3.9, radius: 0.3, nose: 1, reach: 0.95, windup: 0.35, cooldown: 1.1, min: 1, max: 3, forget: 4 },
    // Adaptive immunity's assassin. Only turns up once the host knows you, and the CD47 cloak means nothing to it.
    warden: { hp: 12, speed: 2.4, chaseSpeed: 4, radius: 0.3, nose: 0, reach: 1, windup: 0.55, cooldown: 1.5, min: 3, max: 5, forget: 4 }, // one of your own, sent to bring you in: eyes, no nose
    tcell: { hp: 14, speed: 3, chaseSpeed: 4.5, radius: 0.3, nose: 1.7, reach: 1, windup: 0.6, cooldown: 1.6, min: 6, max: 9, forget: 7 },
    kupffer: { hp: 30, speed: 1.4, chaseSpeed: 2.3, radius: 0.42, nose: 1.25, reach: 1.25, windup: 0.5, cooldown: 1.5, min: 4, max: 7, forget: 3 },
  },
} as const;

export type Track = 'Tank' | 'Warrior' | 'Stealth' | 'Scout';
export interface Upgrade { name: string; track: Track; max: number; per: number; what: string; real: string }

// No classes: a build is whatever mix of these the player picks. Each is a real thing
// with one liberty taken, which is that you can carry it off and use it.
export const UPGRADES = {
  glycocalyx: { name: 'Glycocalyx plating', track: 'Tank', max: 3, per: 12, what: '+12 maximum hull, and repairs that much now.',
    real: 'The sugar coat that shields the lining of every blood vessel.' },
  clotting: { name: 'Clotting cascade', track: 'Tank', max: 3, per: 0.35, what: 'Slowly seals breaches in the hull over time.',
    real: 'The liver makes most of the proteins that clot blood.' },
  elastase: { name: 'Elastase edge', track: 'Warrior', max: 3, per: 2, what: '+2 strike damage.',
    real: 'The enzyme neutrophils use to cut through tissue.' },
  peroxidase: { name: 'Myeloperoxidase rounds', track: 'Warrior', max: 3, per: 3, what: '+3 shot damage.',
    real: 'The neutrophil enzyme that makes bleach on the spot.' },
  cd47: { name: 'CD47 cloak', track: 'Stealth', max: 3, per: 2, what: 'When an immune cell finds you, your scent vanishes for a few seconds and it loses you (2 energy). Each level lasts longer and shortens your scent and footprint trail by 20%.',
    real: "The 'do not eat me' signal healthy cells show to macrophages." },
  apoptosis: { name: 'Apoptosis mimic', track: 'Stealth', max: 3, per: 8, what: 'Stripping a cell raises far less alarm. At level 2, no responders come.',
    real: 'Cells that die by apoptosis are cleared quietly, with no inflammation.' },
  retinol: { name: 'Retinol reserve', track: 'Scout', max: 3, per: 1.5, what: '+1.5 tiles of sight.',
    real: "Vitamin A, the pigment of vision. Most of the body's supply is stored in the liver." },
  mucin: { name: 'Mucin coat', track: 'Tank', max: 3, per: 0.3, what: 'Acid burns your hull 30% less.',
    real: 'The slime that stops the stomach digesting itself.' },
  atp: { name: 'ATP surge', track: 'Scout', max: 3, per: 0.09, what: 'Move 9% faster.',
    real: 'The energy currency every cell runs on.' },
} as const satisfies Record<string, Upgrade>;
export type UpgradeId = keyof typeof UPGRADES;
