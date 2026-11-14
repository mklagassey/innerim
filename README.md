# Insiderim

A turn-based RPG set inside a living human body. Working title.

This repository holds the first prototype: one visit to a liver lobule at cell tier, in
placeholder shapes. Gather energy by skimming glucose (slow, harmless) or by stripping
mitochondria out of the host's liver cells (fast, damaging), then get out through the
central vein before the immune system clears you.

## Play it

    npm install
    npm run dev      # builds and serves http://localhost:5173

`npm run build` writes a single self-contained page to `dist/index.html`.

## Where things are

| File | What it holds |
| --- | --- |
| `src/config.ts` | Every tunable number: action points, damage, energy, alert tiers |
| `src/map.ts` | The liver map, drawn in text |
| `src/game.ts` | All the rules, with no drawing code, so they can be tested and simulated |
| `src/render.ts` | Canvas drawing |
| `src/main.ts` | Mouse, keyboard and the side panel |
| `tests/` | Rule tests (`npm test`) |
| `scripts/sim.ts` | Two simple bots that play 300 games each, for balance checks (`npx tsx scripts/sim.ts`) |
