# Host

A turn-based RPG set inside a living human body. Working title.

This repository holds the first prototype: a real-time, isometric action RPG slice set in
a liver lobule at cell tier, in placeholder shapes. You see only what is near you, and the
overlay map fills in as you explore. Gather energy by skimming glucose (slow, harmless) or
by stripping mitochondria out of the host's liver cells (fast, damaging), then find the
central vein and get out before the immune system clears you.

An earlier turn-based, top-down version of the same slice is on the `main` branch.

## Play it

    npm install
    npm run dev      # builds and serves http://localhost:5173

`npm run build` writes a single self-contained page to `dist/index.html`.

## Where things are

| File | What it holds |
| --- | --- |
| `src/config.ts` | Every tunable number: speeds, vision, damage, energy, alert tiers |
| `src/map.ts` | Generates a new liver each run: sinusoid channels converging on the central vein |
| `src/game.ts` | All the rules, with no drawing code, so they can be tested and simulated |
| `src/render.ts` | Isometric canvas drawing, fog of war and the overlay map |
| `src/main.ts` | Mouse, keyboard, game loop and the heads-up display |
| `tests/` | Rule tests (`npm test`) |
| `scripts/sim.ts` | Two simple bots that play 60 games each in fast-forward, for balance checks (`npx tsx scripts/sim.ts`) |
