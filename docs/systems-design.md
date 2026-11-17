# Host: systems design

(The game was called Insiderim until 2026-11-17; Mick renamed it **Host**.)

Owner: systems design. Audience: lead engineer (builds), creative director (story fit), QA (what to test).
Status: first audit, 2026-11-17, against `realtime-isometric` at commit `90af4fc` (stats build `unit-2`). S1 to S7, S10 and S12 shipped the same day as builds `unit-3` to `unit-5`.

This doc covers the gameplay systems: progression and builds, items, immune detection, alert loss, the host's body cycles, and balance. Every number below is a proposal to be tuned in `src/config.ts`; specs name the config keys and functions they touch so they can be built without guessing.

---

## 1. Design pillars (what every system should serve)

1. **The host is the world.** Body cycles, meals, sleep and fright change the map under you. A good run is one that reads the host and times itself to them.
2. **No eyes, only noses.** Innate immune cells find you by scent drifting downstream and by footprints. Nothing innate is omniscient. (Mick's rule.)
3. **The selfish option is always faster.** Skim vs strip, salvage vs wake, obey vs defy. Each choice must cost something you feel within the same run.
4. **Builds, not classes.** Tank, warrior, stealth and scout are directions the player drifts in, not menus. Committing to one should feel different, not just bigger.
5. **Close to real.** (Mick, 2026-11-17.) Stick to scientific fact. Bend it only when the story needs it or when real time or physics would be unwieldy in a game, the way The Martian bends its windstorm. Never anthropomorphise biology: tumours, cells, bacteria and viruses have no motives, moods or personalities. Every mechanic is a real mechanism, and text describes it that way.
6. **Readable danger.** The player should always be able to see a death coming a few seconds early. No surprise wipes, no flashing (Mick is sensitive to strobing; ease things in).

---

## 2. Audit: what is in the game now

### 2.1 Loop and structure
- **World map** (`trip.ts`): heart → hepatic artery (80% patrol) or mesenteric artery → gut market → portal vein, or gastric artery → stomach → portal vein; portal → liver → hepatic vein → vena cava → heart. Lungs unlock at 20 tumor cells excised.
- **Local maps**: liver (the feeding ground, 20-energy fare to leave), vessel (patrol gauntlet), stomach (acid lake), lung (breathing finale).
- **Carry** between maps: hull, energy, upgrades, patches, host health, hour, immune memory, tumor progress, flora, awareness, kin.

### 2.2 Systems inventory

| System | State | Notes |
|---|---|---|
| Skim / strip energy | Core, tested by Mick | Skim always wins in real runs (see 2.3) |
| Scent plume + footprints | Core, built to Mick's design | Biologically grounded; two leaks (see 2.4) |
| Alert tiers + shedding | Core | Shedding exists (`loseAfter` 4 s, `shake` 5/s) but is invisible to the player |
| Upgrades (9, four tracks) | Core | Pure stat bumps; random offers; no build identity |
| Fibrin patches, IL-10 calms | Core | Patch auto-applies at 35% hull |
| CD47 cloak (auto) | Core | Mick asked for auto-deploy; gated behind a random upgrade |
| Host clock, sleep, frights | Built, lightly played | Strong ideas, mostly invisible inside a map |
| Meals + stomach acid | Built, played twice: died both times | See 2.3: it is a trap |
| Coffee, drink, nightmares | Built, unreviewed | |
| Fever from host damage | Built, unreviewed | The only lasting cost of stripping |
| Immune memory, antibodies, T cells | Built, unreviewed | Good "story clock" from the design doc |
| Boarding a neutrophil | Built, unreviewed | |
| Cortisol pickups | Built, unreviewed | |
| Gut market, levers (serotonin, ghrelin), stowaway bait | Built, unreviewed | |
| Awareness, Shepherd, siblings, kin, wardens, quota | Built, unreviewed | Story systems; creative director's area |
| Tumor (Directive 7), lungs finale | Built, unreviewed | |

That is about twenty systems, roughly fifteen of which Mick has never touched. The game's problem right now is not missing systems. It is that most of them cannot be seen, read, or planned around, and the first ones a new player meets are punishing.

### 2.3 What the run data says (16 runs in the artifact's `runs` table)

- **Skim beats strip every time.** Pre-trip liver runs: 41 to 54 skims each, 0 to 3 strips, all wins, 6 to 12 minutes. With no clock and no lasting cost to waiting, the slow honest option is free. Step 4 of the design doc ("feels like a real decision") is not yet passing.
- **The stomach killed Mick twice in a row** (builds `unit-1`, `unit-2`). Both deaths at host hour 19.7, so dinner (19:00) flooded the acid to full strength mid-visit. In the `unit-1` run hull went 29 → 17 → 5 → 1 in fifteen seconds while skimming. Cause: every glucose patch in the stomach sits in open acid (`map.ts`, the last meal "afloat in the acid"), the player arrives low on energy, and nothing in the map warns that dinner is coming. Three patches auto-fired and did not save him.
- **Trip 1 is a starvation spiral on the gastric route.** A fresh unit has 3 energy and burns 1 every 14 s. The `unit-2` vessel run ended at 1 energy and 16/40 hull (4 net snares, 9 wall slams in one fright), then entered the stomach at 0 energy. Vessel maps hold only 2 glucose patches.
- **Leaving the liver costs everything.** Trip-build liver exits show 0 to 1 energy left after the 20 fare, so every vein trip home starts starving.
- **Clotting is the best upgrade.** Taken in 8 of the 11 distinct builds that had any upgrades; at level 3 it heals 1.05 hull/s, which let Mick sit in Cytokine surge for over five minutes. CD47 (the stealth track Mick wanted auto-cloak for) was taken twice.
- **Bots (last recorded on build ship-4):** skim bot 60/60 in the liver, strip bot about 1/60. The strip bot result is a bot problem (it strips near the exit and fights responders badly), not proof strip is too weak. The sim only covers the liver.

### 2.4 Scent model leaks (places the "no eyes" rule is broken)
1. `arrive()` in `game.ts`: reinforcements with no damage site are sent to `tileOf(s.player)`, the player's exact tile, from across the map. That is omniscience.
2. Killer T cells see through the cloak by **line of sight** within 6 tiles (`CONFIG.memory.tcellSight` + `sees()`). T cells recognise antigen by contact, so this should be a touch/scent check, not sight.
3. Footprint pickup (`freshPrint`) requires line of sight between the cell and the print. A smell does not need a clear line; it only needs the print to be close. Minor, keep for now (it stops cells sniffing through walls).

Wardens using eyes are fine: they are machines, and that contrast is good design.

---

## 3. Prioritised changes

Priority key: **P0** fixes a trap that is costing real runs now. **P1** makes an existing system readable or meaningful. **P2** deepens builds and balance. **P3** later or optional.

Rule for the next few builds: **no new systems until P0 and P1 ship and Mick has played them.** Every item below changes, exposes or tunes something that already exists.

| # | Pri | Change | Size |
|---|---|---|---|
| S1 | P0 | Make the stomach survivable and readable | S |
| S2 | P0 | Fix the trip-1 energy spiral | S |
| S3 | P0 | Soften wall slams | XS |
| S4 | P1 | "Search zone": GTA-style alert you can see and escape | M |
| S5 | P1 | Host-clock ribbon on the HUD | S |
| S6 | P1 | Tumor growth: a clock that makes strip vs skim a real decision | S |
| S7 | P1 | Close the scent leaks | XS |
| S8 | P2 | Build identity: track thresholds and signature traits | M |
| S9 | P2 | Upgrade offers lean toward what you already have | XS |
| S10 | P2 | Rebalance clotting and the cloak | XS |
| S11 | P2 | Extend the balance sim to full trips | M |
| S12 | P2 | Run report additions | XS |
| S13 | P3 | Consolidation review of unreviewed systems | - |
| S14 | P1 | Gut market becomes a fermentation site (no shopkeepers) | S |
| S15 | P1 | Stewardship ledger: track how her insides were treated, for the endgame | S |
| S16 | P2 | Realism pass on system text | XS |
| S17 | P0 | Stealth that works: run silent, Disse hiding, losing a tail | M |
| S18 | P0 | Fights that cost something at every build stage | S |
| S19 | P1 | Difficulty settings | S |
| S20 | P1 | Less repetitive trips: two livers and a host event per trip | S |

### S1 (P0). Make the stomach survivable and readable

**Problem.** All food is in acid; dinner arrives unannounced; full acid kills a 40-hull ship in about 6 s.

**Spec.**
- `generateStomach` (`map.ts`): place **2 of the 4** glucose patches on the mucus rim (acid tile value 1), 2 stay in open acid as the risky bonus.
- New `CONFIG.stomach.rise`: acid strength eases up over **20 s** after a meal starts instead of jumping. Implement in `acidLevel` by smoothing toward the target (`s.host.acidNow += (target - acidNow) * dt / rise`). Easing also suits Mick's dislike of sudden changes.
- **Warning:** 30 s of play (one host hour) before a meal, log line "The host is reaching for food. Acid will rise." plus a gentle green tint ramp on the acid. Emit `'mealsoon'` for audio.
- `burn` 6.5 → **4.5** per second at full strength. Fasting burn unchanged (`resting` 0.2).
- Death message should name the cause: "Dinner. The acid rose while you were in it."

**Done when.** A fresh 40-hull ship standing in full-strength acid takes ≥ 8 s to die; a bot that skims only rim glucose survives a meal arriving mid-visit.

### S2 (P0). Fix the trip-1 energy spiral

**Spec.**
- `CONFIG.player.startEnergy` 3 → **8**.
- Vessel maps (`generateVessel`): glucose patches 2 → **3**.
- Liver fare: the 20 is the *fare*; add `CONFIG.energy.quotaKeep` = **4**: the vein will not let you leave unless you have fare + 4 ("You would arrive starving"), shown on the HUD goal line as `20 + 4 for the road`. This teaches the player to bank a reserve instead of silently starting the next leg at 0.
- Starvation should warn: at energy 0, a single log line and an amber pulse on the energy gauge (eased, no flashing).

**Done when.** A new unit can take the gastric route on trip 1 without starving before the stomach.

### S3 (P0). Soften wall slams

**Spec.** `CONFIG.host.slam`: damage 2 → **1**, and add `perFright: 6` (max hull lost to slams per fright). Slams also only count when the ship is not thrusting against the current (if the player is actively steering, they are fighting it, which should feel like effort, not damage). Keep the screen-shake gentle.

**Done when.** One fright in an artery costs at most 6 hull from walls.

### S4 (P1). Search zone: a GTA-style alert you can see and escape

**Problem.** Alert shedding already exists (`loseAfter`, `shake`), but the player cannot see it, and reinforcements home on the player. Mick asked for a GTA "lose the wanted level" loop.

**Spec.**
- New state `s.search: { x, y, r } | null`: the **last place an immune cell had contact** with you (set wherever `saw` is true in `enemyActs`), with radius `r`.
- When contact is lost, `r` grows from **4** tiles at **0.8 tiles/s** to a max of **14** (the hunt spreading out on the cytokine signal). Alert only drains while you are **outside** the zone; inside it, alert holds. Contact anywhere resets the centre to you.
- Shedding outside the zone: existing `shake` 5/s, after the existing `loseAfter` 4 s.
- **Reinforcements** (`arrive()`) go to a random open tile inside the zone, never to the player's tile (also fixes leak 1 in 2.4).
- **Render:** a soft, slowly breathing red-violet ring on the floor and the automap (no blinking). HUD alert bar shows a draining animation when you are outside it ("Losing them").
- **Hiding spots that actually exist in biology**, ways to shed faster:
  - Standing in stomach acid or mucus clears contact instantly (already true for scent).
  - Riding a neutrophil (boarding) moves the zone centre with nobody.
  - IL-10 droplets: keep, they are the "pay and spray".
  - A cortisol pickup halves the zone's max radius for its duration.
- Escalation stays as tiers. Keep the music escalation tied to alert (Mick likes the Geometry Wars build-up).

**Done when.** A player who breaks contact and leaves the ring sees the alert bar drain and the music calm within ~15 s, and no reinforcement ever spawns aimed at the player's tile.

### S5 (P1). Host-clock ribbon on the HUD

**Problem.** Meals, coffee, the drink, sleep and frights all change the rules, but inside a map the player only finds out as it happens. The world-map forecast is good; it needs to live in the map too.

**Spec.** A thin strip under the gauges showing the next **2 host hours** (60 s of play) as icons sliding toward a "now" marker: meal (fork), coffee (cup), drink (glass), sleep (moon), wake (sun). Hover/tap shows one line of what it does ("Dinner: sugar ×2.5, stomach acid rises"). Frights are random and stay unforecast, which keeps them frightening. Data comes from `CONFIG.host` plus `s.host.snack`/`nap`; no new rules.

**Done when.** Mick can see dinner coming 60 s before it lands.

### S6 (P1). Tumor growth: make strip vs skim a real decision

**Problem.** Nothing presses on the player's time, so skimming is free (2.3). The design doc needs the selfish option to be faster *and* tempting.

**Spec.** The tumor is the clock, which is also the mission's reason to exist.
- New `CONFIG.tumor.drain`: while any tumor cells remain in the host (`excised < goal`), host health falls by **1 per host hour** (30 s of play), on every map. Excising a cell already heals 2.
- The world map and HUD show "Tumor: 14 cells left, the host is losing ground" with the drain rate.
- Net effect: a player who skims for 10 minutes in one liver costs the host about 20 health; a player who strips 2 cells costs 20 health in 2 s but saves the time. Both are now prices, and the player picks which to pay. Sleep heal (1 per 6 s) still lets a well-timed player recover overnight, which rewards reading the clock (S5).
- Tune target: a run that skims only and excises steadily ends trip 3 with host around 60; a run that strips 2 per liver ends around the same but a trip sooner.

**Done when.** In playtests, Mick strips at least sometimes and can say why.

### S7 (P1). Close the scent leaks

- Leak 1: fixed by S4.
- Leak 2: T cells see through the cloak only within `CONFIG.scent.touch` (1.3 tiles), by contact, not 6 tiles of line of sight. To keep them scary, raise their `nose` 1.4 → **1.7** so they track scent better than anything else. Update the T-cell tip text.

### S8 (P2). Build identity: track thresholds and signature traits

**Problem.** The four tracks are just stat bumps; a tank build plays the same as a warrior build with a bigger number. Mick wants free builds that feel like tank / warrior / stealth.

**Spec.** Keep the nine upgrades. Count levels per track (`UPGRADES[id].track`). At **4 points in one track** the unit gains that track's signature trait, shown as a banner and in the build screen. Each one is a real mechanism with one liberty (the design doc's Fat Man test).

| Track | Trait at 4 points | Effect | Real thing |
|---|---|---|---|
| Tank | **Clot shell** | When hull drops below 35%, fibrin seals the hull for 3 s (no damage taken), once per map. Replaces the auto-patch at that moment, so patches last longer. | Fibrin clot |
| Warrior | **Respiratory burst** | Every 5th strike releases a 2-tile burst of 6 damage around you. | Neutrophil oxidative burst |
| Stealth | **Apoptotic cloak** | Stripping a cell raises no alert and leaves no footprint for 4 s afterwards; the cloak's cooldown is halved. | Apoptotic cells are cleared silently |
| Scout | **Chemical sense** | You can see the scent plume of nearby immune cells (their search patterns), and the search-zone ring shows on the automap at any distance. | Chemoreceptors |

Mixed builds still work: they just do not get a trait, which is the trade-off of staying flexible. A hybrid can hit two traits by the third trip.

### S9 (P2). Offers lean toward what you have

`openCache` picks 3 at random. Change to: one slot always from your strongest track (if not maxed), one from a track you have not touched, one random. This lets a build form on purpose while still showing alternatives. Gut-market stock unchanged (still random, which makes the market feel like a market).

### S10 (P2). Rebalance clotting and the cloak

- `clotting.per` 0.35 → **0.2** hull/s per level, and clotting pauses for 3 s after taking damage (so it heals between fights, not during them). This stops the "tank in Cytokine surge forever" pattern.
- The cloak is the stealth fantasy Mick asked for, but it only exists if CD47 is offered. Give every unit **CD47 level 1 at the start of trip 2** as Shepherd's "standard issue", or offer it guaranteed in the first liver cache. Prefer the first-cache guarantee (keeps the choice). Further levels stay optional.

### S11 (P2). Extend the balance sim to full trips

`scripts/sim.ts` only plays the liver. Needed so balance changes can be checked before Mick plays them:
- Add a trip driver that walks `trip.ts` legs with a fixed route policy (hepatic, mesenteric, gastric), playing vessel, stomach and liver maps with the existing bots and carrying `Carry` across.
- Report per route: survival to heart, hull and energy at each node, host health at trip end, deaths by cause.
- Make the strip bot competent: strip only when no enemy within 10 tiles, then retreat downstream from the damage site (scent travels downstream, so it should leave across the current).
- Target bands for the first pass: trip 1 survival ≥ 90% on every route for the skim bot; strip bot finishes the liver ≥ 40% faster at ≤ 25 extra host damage.

### S12 (P2). Run report additions (`stats.ts`)

Add: `route` (list of nodes this trip), `energyOnArrival`, `hullOnArrival`, `acidAtDeath`, `secondsInAcid`, `slamDamage`, `secondsInSearchZone`, and `traits` (once S8 exists). Bump `BUILD` with each rules change.

### S13 (P3). Consolidation review

Before adding anything new, each unreviewed system gets one playtest from Mick and a keep / fix / cut call. Candidates to cut or merge if they do not land, because they overlap:
- **Cortisol pickups** overlap with IL-10 calms (both calm the immune system). Option: merge into S4's search zone (cortisol shrinks the zone) and drop the separate "suppressed" state.
- **Levers** (serotonin, ghrelin) and **habits** (coffee, drink) are the same idea from two sides. Keep both only if S5 makes them readable.
- **Stowaway bait** and the **cloak** both answer "a cell found me". Bait should stay for non-stealth builds; check it does not make CD47 pointless.

### S14 (P1). The gut market becomes a fermentation site

**Problem.** Bacteria "trade for sugar" reads as microbes running a shop, which breaks the realism rule (pillar 5). Flagged by the creative director (world bible section 11).

**Spec.** Same node, same menu, same prices, no shopkeepers. The unit is doing chemistry, not commerce: it releases glucose into the gut lumen where the flora ferment it, and collects what fermentation and the gut wall make. Rename the node **Gut lumen** (kind `town` can stay in code). Each menu line is a real product of the gut:

| Old item | New item | What the unit actually does (one bend at most) |
|---|---|---|
| Repair hull (3) | **Biofilm patch** | Gut bacteria secrete exopolysaccharide biofilm; the unit lets a film grow over the cracked hull and hardens it. Bend: it works as plating. |
| Fibrin patch (4) | **Vitamin K2** | Gut bacteria make menaquinone (K2), which the liver needs to make clotting factors. The unit stores it and builds one fibrin patch from it. |
| Butyrate (5) | **Butyrate** (unchanged) | A short-chain fatty acid from fermenting fibre; it really does push the immune system toward tolerance (regulatory T cells). Memory −0.2. |
| Three upgrades (8 each) | **Shed lining salvage** | The gut lining replaces itself every few days; the unit picks through shed enterocytes for parts. Same 3 random upgrades. |
| Stowaways (4) | **Hitchhikers** | Bacteria adhere to any surface, the hull included. The unit lets a few attach before leaving. No text about them trusting or wanting anything. |
| Serotonin lever | **Serotonin** (unchanged) | About 90% of the body's serotonin is made by enterochromaffin cells in the gut wall, and fermentation products stimulate it. True as written. |
| Ghrelin lever | **Ghrelin** | Made mostly in the stomach wall, not the gut. Keep the lever here for now but word it as the unit signalling the stomach; move it to the stomach map later. |

All of it is text in `main.ts` (`market()`), `trip.ts` (`NODES.gut`) and `tips.ts`, plus the config comment "The gut flora trade for sugar". "Prices" become **glucose spent**: wording such as "Release 4 glucose" instead of "Buy for 4". No rules change.

### S15 (P1). Stewardship ledger: track how her insides were treated

**Why.** In Mick's endgame (world bible section 10), the unit reaches Marian, and how she responds depends on how her body was treated. The game needs a running record of it from now on, so the ending has real data and the run reports show the player's moral profile.

**Spec.** Add `ledger` to `Carry` (and `State`), summed across every map of the mission and never reset until a new unit begins:

| Field | Counted when |
|---|---|
| `stripped` | a host cell is stripped (hepatocyte or parietal), already `cellsKilled` per map |
| `skimmed` | a skim finishes |
| `excised` | already carried |
| `quotaObeyed`, `quotaDefied` | `leave()` sets `verdict` |
| `woken`, `salvaged` | `answer()` with `wake` / `salvage` (`kin` today only counts woken) |
| `leversForHer`, `leversForMe` | serotonin nap while host health < 80 counts for her (she mends); ghrelin or a nap used only to refill glucose counts for you. Rule: a lever used when host health < 80 is for her, otherwise for you. |
| `baitReleased` | `bait()` (each costs her 2%) |
| `hostLowest` | lowest host health ever reached |
| `feverPeak` | highest fever level ever reached |
| `memoryPeak` | highest immune memory (already ratchets, so `memory` at the end) |
| `feelings` | "A gut feeling" bought at stage 4 |

Derived numbers for the endgame (computed, not stored): `harm = stripped×10 + baitReleased×2 + (100 − hostLowest)`, and `care = skimmed÷5 + excised×2 + leversForHer×5 + feelings×5 + quotaDefied×3`. Ending bands are the creative director's call; systems will set the thresholds once real runs exist. Show the ledger on the world map's unit log as plain facts ("Her cells you took: 6. Sugar you skimmed: 212."), never as a score.

Add `ledger` to the run report (S12) so we can see real players' spread before tuning the bands.

### S16 (P2). Realism pass on system text

Text that gives cells or bacteria intent, to reword (not rules):
- `game.ts` `bait()`: "Innate immune cells cannot resist a real bacterium" becomes "Phagocytes are built to engulf bacteria: any nearby will go for it."
- `game.ts` cortisol pickup: "the immune system has orders to stand down" becomes "Cortisol damps immune activity for a while."
- `config.ts` comments: "The gut flora trade for sugar" (see S14), "Adaptive immunity's assassin" becomes "Adaptive immunity's cytotoxic cell, made to match you".
- Tumour wording everywhere: the tumour is tissue that drains her (S6 text "host losing 1% an hour" is fine). Never "enemy", "fights back" or similar.
- Story lines that give feelings to cells are the creative director's pass, not this one.

---

## 3b. After Mick's first full game (2026-11-17, build unit-5)

Mick's verdict: easy once he had armour and self-healing; "go in swinging" was the best strategy; stealth was close to pointless because trail and scent are found easily and, once found, you are nearly always caught; three round trips felt repetitive. He asked for difficulty settings. Data agrees: 0 deaths, lowest hull 51/64 after trip 1, 5 patches unused, 0 cloaks all game.

The root cause of the stealth problem in code: an investigating cell walks at **chase speed** (`follow(... e.mood === 'patrol' ? c.speed : c.chaseSpeed)`), `contact` is 2.5 cost units (about 2.5 tiles downstream), and once chasing **any** trace of scent keeps the lock (`saw = found || (e.mood === 'chase' && whiff > 0)`). So a sniff is effectively a catch. Combat is easy because neutrophils hit for 1 to 3 and clotting refills between every fight.

Build all of S17 to S19 as one build (`unit-8`), then S20 (`unit-9`). S8 traits and S9 offers come after, and S8's Stealth trait is replaced by S17.

### S17 (P0). Stealth that works

Goal: a careful player can cross a liver unnoticed, and a player who is sniffed has real ways to break off.

**Detection is slower and less certain**
- Investigating cells move at patrol speed × 1.15, not chase speed. Only `chase` uses `chaseSpeed`.
- `CONFIG.scent.contact` 2.5 → **1.5**. A cell has to come close in the plume to know exactly where you are.
- Chase lock needs a real trace: `saw = found || (e.mood === 'chase' && whiff > CONFIG.scent.hold)` with `hold` = **0.35**. Below that the cell falls back to footprints and then gives up after `forget`.
- A sniffing cell shows a slowly filling "?" ring (0 to 1 over **1.2 s** of continuous plume contact) before it turns to chase. Leaving the plume in that window drops it back to investigate. This is the readable "they're onto you" beat. Ease it in, no blinking.

**Run silent (new action, all builds)**
- Hold **Shift** (keyboard) or toggle the **Silent** button (touch). Speed × **0.5**, no footprints, plume reach × **0.5**, glucose skim unchanged.
- Real basis: the ship's motor stirs the plasma and sheds more of its surface chemistry; idling sheds far less. Bend: we let the player control it precisely.
- Cost: no energy, just time. Skimming while silent is allowed, which makes careful feeding a playstyle.

**Disse niches: places to hide (liver only)**
- The space of Disse is the real gap between hepatocytes and the sinusoid wall, reached through the wall's fenestrations. Neutrophils and Kupffer cells stay in the sinusoid; the unit is small enough to slip in.
- `generate()` marks **10** wall-adjacent floor tiles per liver as `s.niche` (drawn as a dim slit in the cell wall, visible on the automap once seen). Inside one: no plume, no prints, alert drains at `shake` rate even inside the search zone, and innate cells cannot reach you (they path to the tile in front). T cells *can* enter (they migrate into tissue for real), and wardens can see in.
- A niche holds you for at most **20 s** before your hull starts to foul (1 hull/s): it is a breather, not a base.

**Losing a tail**
- Crossing the current breaks footprints: a print laid while moving more than 60 degrees across the flow lasts half as long (`trailLife × 0.5`). Moving upstream lays prints that last a quarter as long. This rewards reading the flow, which is the point of the scent model.
- Stomach acid, mucus and niches already clear contact. Add: passing through a **sinusoid junction** (a tile with 3 or more open neighbours) while silent drops the search-zone centre to the junction and does not follow you. (Real basis: mixing at junctions dilutes the plume.)

**Stealth pays off**
- **First strike:** a strike on a cell in `patrol` mood that has not had your scent in the last 3 s deals × **3** damage. A stealthy player kills a neutrophil in one blow before it can call others.
- **The host does not learn you:** a map left with peak alert below 25 adds **no** immune memory (`memoryAfter` returns `s.memory`). Real basis: adaptive immunity needs inflammation and danger signals to prime; quiet contact without them tends to tolerance.
- **CD47 cloak** stays auto, but now also fires on the "?" ring filling, before the chase starts, which is when it helps most.

**Done when.** A skim bot that uses run-silent near cells and never fights finishes a liver unspotted in at least half of 20 seeds; a sniffed player who goes silent and crosses the current escapes in most cases.

### S18 (P0). Fights that cost something at every build stage

Goal: going in swinging is a real choice with a real price, even with plating and clotting.

- **Swarming.** Every immune kill releases danger signals: all innate cells within **8** tiles turn to investigate the kill site, and the next spawn comes **5 s** sooner. (Real: neutrophil swarming, driven by LTB4 from cells that are already engaged.) A fight draws more fights.
- **Activated neutrophils.** At alert tier Alarmed and above, neutrophil damage × **1.5** and windup −20%. (Real: inflammatory signals prime neutrophils to degranulate harder.)
- **Engulfment.** A Kupffer cell or alveolar macrophage that lands a blow holds you for **2 s** (no movement, 2 hull/s), unless you strike it twice to break free. (Real: phagocytosis.) Tank builds can afford to be grabbed; others should not be.
- **Clotting rebalanced again:** pause after damage 3 s → **6 s**, rate 0.2 → **0.15** per level. Healing is for between fights, never during a swarm.
- **Glycocalyx** +12 → **+8** per level (max hull 64 → 52).
- **Neutrophil hp** 8 → **10**, so strikes take three blows without elastase, two with it. Paired with first strike (S17), sneaking up is now clearly better than brawling.
- Fights still pay: a kill drops a patch (20%) as now.

**Done when.** The skim bot fighting everything it meets loses 25 to 40% hull per liver on Standard with a full Tank build, and dies on trip 2 or 3 in at least a quarter of seeds without one.

### S19 (P1). Difficulty settings

Chosen on the start screen, stored in `Carry.difficulty`, shown in the run report, changeable only at Begin. Multipliers only, so balance work happens on Standard.

| Setting | Name | Enemy damage | Enemy hp | Spawns | Healing (clotting, patches, sleep) | Starting energy | Detection |
|---|---|---|---|---|---|---|---|
| Easy | **Observer** | × 0.6 | × 0.8 | × 0.7 | × 1.3 | 12 | × 0.8 |
| Normal | **Standard** | × 1 | × 1 | × 1 | × 1 | 8 | × 1 |
| Hard | **Clinical** | × 1.4 | × 1.25 | × 1.3 | × 0.7 | 6 | × 1.15 |

"Detection" scales `scent.reach` and `contact`. Clinical also turns off the auto patch (patches are used by hand). The names are world-flavoured; the creative director can rename them.

### S20 (P1). Less repetitive trips

Systems leads this; the creative director supplies the text for each event.

- **Two livers, not three.** One nodule of **10** cells per liver, goal 20. The mission becomes two round trips and the lungs.
- **The return leg is one stop.** Hepatic vein → vena cava → heart becomes a single choice with one patrol roll at the higher of the two risks, unless the player picks the vena cava stop on purpose. This cuts a third of the world-map clicks without removing the danger.
- **Each trip has a host event**, drawn so no two in a game repeat, announced on the world map before you leave the heart, and shown on the S5 ribbon. Real physiology only:

| Event | What changes (whole trip) | Real basis |
|---|---|---|
| **A cold** | Innate cells busy elsewhere: liver neutrophils −3, but antibodies × 1.5 and fever starts at level 1 | Viral infection draws the innate response and raises temperature |
| **Ibuprofen** | Fever capped at 1, alert decay × 1.5, sleep heals × 0.8 | NSAIDs block prostaglandins: less fever and inflammation |
| **A run** | Arteries fast all trip (stressed push), glucose regen × 0.6, frights rarer | Exercise sends blood to muscle and burns blood sugar |
| **Skipped lunch** | Lunch never comes: acid stays low, glucose × 0.7 until dinner | Fasting |
| **A bad night** | Host asleep 3 hours less, frights × 1.5 | Short sleep raises cortisol and stress reactivity |

Trip 1 has no event (learn the rules first); trips 2 and the lung trip get one each.

**Done when.** Mick can name something that was different about his second trip.

## 4. Build order for the lead engineer

1. **Build `unit-3`:** S1, S2, S3, S7 (small, mostly `config.ts` plus `generateStomach` and `arrive()`). Add tests: stomach rim glucose exists; reinforcements never target the player tile; slam cap per fright.
2. **Build `unit-4`:** S4 search zone and S5 clock ribbon (render + HUD work; rules are small).
3. **Build `unit-5`:** S6 tumor drain, S10 rebalance, S12 report fields.
4. **Then** S11 sim, S8 traits and S9 offers, and a balance pass from the sim plus Mick's runs.

6. **`unit-8`:** S17, S18, S19 together. **`unit-9`:** S20. Then S8 (Tank, Warrior and Scout traits only) and S9.
5. **Next text-and-data build:** S14, S15, S16. No gameplay change, so it can ship before Mick's unit-5 playtest.

Ask Mick to play after steps 1 and 2; those fix what killed him and add the alert loop he asked for.

## 5. Open questions (for Mick or the creative director)

- Should the tumour clock (S6) be visible as a number, or only as the host getting sicker? It ships as a number ("host losing 1% an hour"), which is clearer.
- Are the four track traits (S8) the right fantasies? In particular, is "Scout" a track Mick wants, or should it fold into stealth?
- Size tiers (design doc) are not in the game at all. They are the biggest unbuilt system and should get their own design pass once the current loop is solid.
