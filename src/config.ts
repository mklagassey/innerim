// Every number worth arguing about lives here. Distances are in tiles, times in seconds.
/** How hard the host's immune system works. Multipliers only: balance is done on Typical. */
export const DIFFICULTY = {
  suppressed: { name: 'Suppressed', what: 'Her immune system is running low. It is easier to slip past, and slower to learn you.', damage: 0.6, hp: 0.8, spawns: 0.7, healing: 1.3, energy: 12, detection: 0.8, autoPatch: true },
  typical: { name: 'Typical', what: 'A healthy 58-year-old\'s defences, doing their job.', damage: 1, hp: 1, spawns: 1, healing: 1, energy: 8, detection: 1, autoPatch: true },
  vigilant: { name: 'Vigilant', what: 'Her immune system is quick, thorough and unforgiving. Patches are applied by hand.', damage: 1.4, hp: 1.25, spawns: 1.3, healing: 0.7, energy: 6, detection: 1.15, autoPatch: false },
} as const;
export type Difficulty = keyof typeof DIFFICULTY;
/** Something ordinary that happens to the host and lasts a whole trip. Real physiology only; the words are the creative director's (docs/host-events.md). */
export const EVENTS = {
  cold: { name: 'A cold', icon: '\u2744\uFE0E', neutrophils: -3, antibodies: 1.5, fever: 1,
    brief: 'Fewer neutrophils in the liver, more antibodies, and a mild fever.',
    world: 'A cold has been going round the office, and now she has it. Her immune system is busy in her nose and throat. Antibodies are up, and so is her temperature.',
    lines: ['Tissues, tea, and a sore throat. Her neutrophils have been pulled toward her airways.', 'She is running warm. Every immune cell here is a little faster for it.', 'A sneeze shakes the whole vessel. Antibodies drift thicker in the current.'] },
  ibuprofen: { name: 'Ibuprofen', icon: '\u2695\uFE0E', feverCap: 1, calm: 1.5, sleep: 0.8,
    brief: 'Fever stays low and the alarm fades faster, but sleep mends her less.',
    world: 'She took two ibuprofen with breakfast. Prostaglandins are blocked: less fever and less inflammation, and the alarm fades faster. Her sleep will mend a little less tonight.',
    lines: ['The ibuprofen is working. The inflammatory signals are faint and slow to spread.', 'Whatever ache she took it for has dulled. The immune alarm dulls with it.'] },
  run: { name: 'A run', icon: '\u2661\uFE0E', glucose: 0.6, frights: 0.5,
    brief: 'Arteries run fast, sugar comes back slowly, and frights are rare.',
    world: 'She has laced up her trainers for the first time in weeks. Blood is pouring toward her muscles, the arteries run fast, and her muscles are burning the sugar in her blood.',
    lines: ['Her feet are hitting the pavement. You can feel each stride in the current.', 'Her muscles are taking the sugar. There is less of it left for you.', 'She has found a rhythm. Her heart is fast but steady. Nothing frightens her much at this pace.'] },
  lunch: { name: 'Skipped lunch', icon: '\u2205\uFE0E', meal: 12.5, glucose: 0.7,
    brief: 'No lunch: stomach acid stays low and sugar is thin until dinner.',
    world: 'A meeting ran over, and lunch is not happening today. The stomach will stay quiet and the blood sugar will stay low until dinner.',
    lines: ['It is past one. No lunch is coming. Glucose is thin in the blood.', 'Her stomach growls, empty. The acid stays low.', 'She is getting by on coffee and willpower. The liver is releasing its own stores to keep her going.'] },
  night: { name: 'A bad night', icon: '\u263D\uFE0E', awake: 3, frights: 1.5,
    brief: 'She sleeps three hours less, and frights come more often.',
    world: 'She barely slept. The dog was restless, then she was. Her cortisol is up, she will sleep less tonight, and small things will startle her.',
    lines: ['She is tired in the way that makes everything too loud. Her heart jumps at little things.', 'It is three in the morning and she is staring at the ceiling. The night\'s repair work will be short.', 'She is yawning at her desk. Stress hormones are holding her together.'] },
} as const;
export type HostEvent = keyof typeof EVENTS;
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
    strip: { time: 0.9, gain: 8, hostDamage: 8, alert: 18, maxResponders: 2, reach: 1.35 },
    patchMax: 3,
    patchRegen: 22,
    metabolism: 14, // seconds per unit burned
    starveDamage: 1,
    clotPause: 6, // seconds after any damage before clotting starts to seal again
    quotaKeep: 4, // what the vein insists you keep for the road, on top of the fare
  },
  // The host is a person getting on with their day. Their body changes around you.
  host: {
    maxHealth: 100,
    secondsPerHour: 30, // a whole day and night passes in twelve minutes of play
    startHour: 11,
    // Hurt the host and they run a fever: each step down makes immune cells faster and burns your energy quicker.
    fever: { below: [80, 60, 40], speed: 0.1, burn: 0.25, degrees: [37, 37.9, 38.8, 39.7] },
    sleepHeals: 15, // seconds of sleep that give the host back one point of health
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
    caches: 4, // upgrade choices scattered through the liver
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
    contact: 1.5, // within this much plume, a cell knows exactly where you are
    hold: 0.35, // a chasing cell needs at least this strong a trace to stay locked on
    lock: 1.2, // seconds of continuous contact before a cell that has found you commits to the chase
    silent: { speed: 0.5, plume: 0.5 }, // running silent: the motor idles, so less is shed and nothing is stirred
    printAcross: 0.5, printUpstream: 0.25, // how long a print lasts when laid across the current, or against it
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
    perAlert: 0.15, // learned from one map whose alert peaked at 100
    perKill: 0.005,
    quiet: 25, // a map whose alert never passed this teaches the host nothing
    most: 18, // antibodies adrift in a map when the host knows you completely
    tagTime: 9, // seconds one stays stuck to you
    tagScent: 1.7, // how much further your scent carries while tagged
    tagAlert: 4,
    reach: 0.55, drift: 0.7, pull: 3, homing: 0.9,
    tcells: [0.5, 0.85], // memory at which the first and second killer T cell join each map
    tcellSight: 1.3, // how close one must be to know you through the cloak: contact, not sight
  },
  // The space of Disse: the gap between a liver cell and the sinusoid wall. Small enough for you, too small for a phagocyte.
  niche: { count: 10, apart: 6, holds: 20, foul: 1 },
  fight: {
    swarm: 6, sooner: 5, // a kill draws innate cells within this many tiles, and brings the next arrivals this many seconds sooner
    primed: { from: 50, damage: 1.25, windup: 0.8 }, // neutrophils at Alarmed and above
    hold: { time: 2, burn: 2, breaks: 2, again: 4, clear: 1 }, // a macrophage that lands a blow holds you; this many strikes break free. Once out, that cell cannot take you again for `again` seconds, and nothing can for `clear`
    first: { quiet: 3, times: 3 }, // a strike on a cell that has had no trace of you for this long
  },
  // The mission: a tumor seeded through the liver, to be cut out a cell at a time.
  tumor: { cells: 10, goal: 20, gain: 1, heal: 0, alert: 2, time: 1.4, drain: 0.75 }, // drain: host health lost per host hour with the whole tumor in; it falls in step with what is left
  // The gut lumen: glucose released here is fermented by the flora, and the unit collects the products. Costs are in energy.
  lung: { macrophages: 2 },
  // Boarding: climb inside a wounded neutrophil and wear it.
  board: { reach: 1.5, below: 0.5, time: 12, speed: 0.8 },
  // Cortisol: what a fright leaves in the blood. It tells the immune system to stand down.
  // How far Shepherd trusts the unit: what it gives for obedience, and when it sends its own after you (decisions.md 3).
  draw: { disc: 2.2, hold: 10, window: 20, spacing: 1.6, kinSpeed: 1.4 }, // the blood draw: the lit disc, seconds to hold still in it, seconds before the slide is read anyway
  marks: { hold: 4, near: 1.7, yield: 10, gap: 10, lane: 4, bystander: { odds: 0.45, time: 22 }, volunteer: { hull: 0.35, hunters: 2 }, margins: 4, dockBreaks: 2, dockTrust: 15, recurrence: 0.25, regrown: 2, kinRecall: 0.5, intercept: { energy: 3, hours: 1 } }, // Shepherd's marked orders, and the small decisions around them
  trust: { start: 60, obey: 4, quota: 6, salvage: 5, tutorial: 2, escort: 2, slip: 2, wake: 8, gap: 1, deviate: { most: 6, some: 4, little: 2 }, valued: 80, nominal: 60, review: 40, flagged: 20, drop: { energy: 6, ahead: 8 }, selfTest: 25 },
  // The one garbled order of a game (decisions.md 4). fright: seconds into the vessel before it arrives.
  slip: { fright: 6, window: 20, hold: 15, near: 3, harvest: { gain: 5, host: 5 }, lamp: 2, reply: 6, hesitate: 8, fork: 1.5 },
  story: { sibling: { liver: 1, vessel: 0.4, energy: 6, hull: 5, wake: 3 }, gap: 6, kin: { most: 3, gift: 2 }, quota: 2, orders: { most: 15, some: 8, little: 4, first: 12, fullTimes: 2, escort: 0.25, acid: 2, spotted: 2, levers: 80, repeat: 45, steer: 6, nobody: 10 }, feeling: { cost: 2, heals: 4 }, sight: 1, scent: 0.85, echo: 0.5, warden: { sight: 6.5, from: [55, 80], yields: 0.5 } }, // siblings, seconds between thoughts, and what waking is worth
  flora: { cost: 4, aboard: 2, most: 4, lure: 8, lasts: 12, feast: 5, hostDamage: 2 }, // gut bacteria stuck to the hull, shed as bait
  cortisol: { drops: 3, time: 14, slow: 0.6, nose: 0.6 },
  wait: { energy: 2, legHours: 0.5 }, // an hour's idling on the map costs this; a quiet leg takes this long
  levers: { serotonin: { cost: 4, hours: 2 }, ghrelin: { cost: 3 } }, // ways to nudge the host from inside
  market: { repair: { cost: 3, hull: 15 }, patch: { cost: 4 }, upgrade: { cost: 8, stock: 3 }, butyrate: { cost: 5, forget: 0.2 } },
  vessel: { chaseBoost: 1.22, cooldown: 0.75, net: { range: 4.5, slow: 0.4, time: 1.6, every: 5 } }, // patrols on the road are faster and busier than the ones at home in tissue
  cloak: { energy: 2, base: 3, perLevel: 2, cooldown: 10, confusion: 2.5 },
  enemies: {
    neutrophil: { hp: 10, speed: 3.2, chaseSpeed: 3.9, radius: 0.3, nose: 1, reach: 0.95, windup: 0.35, cooldown: 1.1, min: 1, max: 3, forget: 4 },
    // Adaptive immunity's cytotoxic cell, made to match you. Only turns up once the host knows you, and the CD47 cloak means nothing to it.
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
  glycocalyx: { name: 'Glycocalyx plating', track: 'Tank', max: 3, per: 8, what: '+8 maximum hull, and repairs that much now.',
    real: 'The sugar coat that shields the lining of every blood vessel.' },
  clotting: { name: 'Clotting cascade', track: 'Tank', max: 3, per: 0.15, what: 'Slowly seals breaches in the hull, once you have gone 6 seconds without taking damage.',
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
