# QA report

Owner: QA thread. Newest pass first. Bug format follows `studio/engineering-handbook.md`: steps, what happened, what was expected, build, device.

## Pass 7: 2026-11-17 overnight, Versions 60 to 69 (chapters, decisions, travel, cut scenes)

Tests pass at every build (88 at v60, 109 at v69), `tsc` clean. There were 0 page errors across about 250 whole-mission bot runs. New tools: `scripts/qa-endings.cjs` (Begin to end screen, one policy per outcome, `--seeds`), `scripts/qa-slip.cjs` (every Slip) and `scripts/qa-branches.cjs` (32 obey/defy policies), merged in PR #21.

**Bugs found**
- **P0, fixed in v63. Continue was gone (v61 to v62).** `savedTrip()` ran at module load and called `freshCarry`, a `const` declared later. The TDZ error was swallowed by the catch, so no save could be resumed. Verified fixed: a reload in liver 1 offers "Continue trip 1 from the liver".
- **P1, fixed in v69. Obeying killed the host (v65).** The all-obey policy ended host-dead or at 9 to 11% in 3 of 3 runs (8% per healthy cell; the chapter 3 liver alone cost about 40%). After the retune (decisions.md 6.5): 0 deaths in 20 runs.
- **P1, fixed in v69. Awareness overshot 80 (v65).** At 80 Shepherd stopped ordering, so recalled, recurrence and Tithonus were out of reach for natural play.
- **P1, open. Recurrence soft-lock (v69).** When the 25% recurrence roll fires at the chapter 5 heart, the lungs mouth stays offered. Taking it hangs the game: status won, no flight, no ending. Seen in 2 of 2 rolls. The exits are built before the roll, and `go('lungs')` returns silently when `T.depart` fails.
- P2, fixed in v63. A lamp Slip never resolved if its unit was never approached, and it re-armed on every road home. A fork Slip never fired if a mouth was taken in the first 1.5 s.
- P3, fixed in v69. The "A fright" info box covered the garbled order and told the player to "steer with it".

**The Slip (v61 to v63):** all 21 cases give the right verdict, Shepherd line and bracket line: 3 kinds × meant A/B × did A/B/lapse, plus early fork. Brightness through the fright varies by under 1% of the frame (no flash).

**Endings (v69, `qa-endings.cjs`):** all 13 outcomes reach their end screen. Natural policies reach 12. Recalled hit 6 of 6 and Tithonus 4 of 6; recurrence is blocked by the soft-lock above. Against the systems targets:
- All-obey, 20 seeds: 15 Decommissioned and 5 Breathed out, 0 deaths. Host lowest was 3 to 53 (median about 37; target 40+). Host at the end was 15 to 65% (target 55 to 70). Awareness was 15 to 50 (target 0). The bot refused the review in those runs (harness fixed since). Its other awareness came from orders it could not obey cleanly: kupffer-spare in 20 of 20 runs, suppress in 14, marked-cell in 7, and the Slip.
- Defiant: host 89 to 94% and awareness 64 to 82, both on target. Mixed: awareness 49 to 66 (target 35 to 60). Switch to obey at 60: ends at 67 to 69 (target 70 or under).

**Recheck on Versions 73 and 74.** The recurrence soft-lock is fixed: 16 margin-skipping runs had no hangs, and one reached the Recurrence ending. All-obey on v74, 20 seeds: 20 of 20 Decommissioned, 0 deaths, 0 page errors. Host lowest had a median of 42 (range 15 to 57). Host at the end had a median of 57 (range 31 to 72). Awareness had a median of 15.5 (range 12 to 22), almost all of it from wrong-reading Slips. These meet the systems targets: median lowest 40 or more, median end 55 to 70.

**Branch explorer (v60 to v62):** 32 policies, 0 errors. At v60, Resident was unreachable: stay needed stage 3, which needed waking kin, and kin make it a colony. At v62 all 5 of the endings at that time were reached.

**Cut scenes (v63, 15 reels):** sampled every animation frame on an 8x6 grid. 14 reels are flash-safe. `ending:stranger` shows 3 large luminance swings within 1 s around 24 s. That is at the WCAG limit, so it is borderline; it was passed to art.

## Pass 6: 2026-11-17, Version 54 (head d26ac3c, unit-10)

84 tests pass, `tsc` clean, no page errors.

**Pass 5 rechecks.** S2 fixed: the top row fits at 320 px (Map ends at 297). S3 fixed: no macrophage re-grabbed within 1 s of a release in 45 test fights (worst chain 1, was 4), and holds still never last over 2.0 s.

**Tutorial (Briefing, on by default):**
- **T1 (P2) Step 3 drags when no immune cell is near.** With no immune cell in the liver, each step waits 45 s, repeats its order, waits 45 s more and moves on, so step 3 ("neutralise the contact") costs a player 90 s with no target ring and nothing to do. Steps 2 and 4 behave the same if the player ignores them, which is fine because there is something to do. Suggest: if no immune cell is within the 12-tile target range, skip step 3 after about 10 s.
- **T2 (P3) Info boxes pop up over the first order.** In the first seconds of the tutorial liver the "Portal vessel" info box opens while Shepherd's first order is up. They do not overlap (the order line stays readable above the box, screen `/mnt/project-files/qa/tutorial-tip-phone.png`), but it is two teachers talking at once. Suggest holding the non-danger info boxes until the tutorial's step 5, or folding them into the orders.
- **T3 (P3) Four lines of amber text on phones.** Order line, two to three lines of goal text and the clock ribbon stack above the play area on a 390 px phone, pushing the ship down to mid-screen.
- Resuming mid-tutorial works: a reload in the tutorial liver offers "Continue trip 1 from the liver", the saved trip still carries the tutorial flag, and the liver restarts at step 1.
- Info boxes and orders never collide as popups: orders are a HUD line (`#order`), not a veil.
- No-cell timeout confirmed for every step: an idle player with no immune cells advances 1 to 5 at 90, 180, 270 and 360 s. Caches and dark units appear at step 5 as intended.

**Obedient run shows no bracket lines.** A bot that strips the 2-cell quota, kills what finds it, salvages dark units and excises the nodule finished the tutorial liver with awareness 0, no defiance, and no line containing "[" in its thoughts or Shepherd's rulings (10 of 10 runs).

**Recheck at Version 56 (head a7a5188):** T1 fixed (with no immune cell near, step 3 is dropped after 10 s: 3 to 4 at 190 s, was 270 s). T2 fixed (no info box opened during steps 1 to 4 in the phone run). T3 fixed per the engineer (goal line hidden on narrow screens during steps 1 to 4). Hold-to-steer on touch completes step 1 (14.6 tiles moved, step 2 order shown). Obedient bot still shows 0 bracket lines in 10 runs.

**Old saves** from Version 40, pre-ledger builds and Version 47 still resume and play.

## Pass 5: 2026-11-17, Versions 49 to 52 (unit-8, unit-8b, unit-9; head b3a1c50)

79 tests pass, `tsc` clean, no page errors.

**S1 (P0, fixed in Version 52) The opening scene could trap the player.** Tapping or pressing Space during the scene's 1.2 s fade-out (or Skip followed by one tap) left `#scene` un-hidden at opacity 0, the world map never opened, and Escape and Skip did nothing; only a reload helped. 3 of 3 repros on an iPhone 13 size at Versions 49 to 51. Cause: `next()` cleared the shared timer that held `end()`'s hide-and-continue step. Rechecked at Version 52: tap, Space and Skip-then-tap all reach the world map.

**S2 (P2) Map button runs off a 320 px screen.** With the new Silent button the top row is pause, sound, silent, two turns, map; at 320 px the Map button ends at 354 px, off the right edge (no sideways scroll, it is simply cut off). Fine at 360, 375 and 390 px. Shortening "Sound on" to an icon, or dropping the key hints on touch, would fit it.

**S3 (P2) A fleeing ship gets engulfed again straight away.** Holds always release (never longer than 2.0 s, and two strikes break free in under 1 s), but after a timed release the macrophage's next blow usually lands before the ship is clear: a bot that flees on release was re-engulfed up to 4 times in a row, each within 1 s of the last release, and died 10 of 15 times against one macrophage in 30 s (a bot that strikes back died 0 of 15). A second or two of grace after a release, or a knock-back, would make "run" a real answer to engulfment and not only "strike".

**S4 (P3) Scene ignores taps for its first 2 s.** By design, but on a phone a tap that does nothing reads as frozen. Skip works throughout.

**Checked and fine:**
- Hiding places: all 10 per liver are reachable from the start (12 seeds), a niche tile always has an open side so you cannot get stuck, and a ship sitting in one with a neutrophil and a macrophage next to it took no damage and was never engulfed over 20 s.
- Saved trips from older builds resume cleanly: a Version 40 save at the liver, an older save at the gut with no ledger, and a Version 47 save at the heart all showed the right world map, filled in missing fields, and played on with difficulty Typical.
- Difficulty carries in the saved trip (`carry.difficulty`).
- Scene and tip popups: tips only fire when nothing else is open and the world is paused while one is, so "Run silent" and "Engulfed" cannot land on another popup; the scene sits above everything (z-index 30).

**Typical over three trips (balance).** `npm run sim 20 3` at Version 51, the engineer's skim and strip bots (they do not use niches, silent running or the cloak well, so this is a floor, not a forecast):

| Route | Skim bot home after 3 trips | Strip bot home | Host at end (skim / strip) |
|---|---|---|---|
| Hepatic | 40% | 55% | 96% / 29% |
| Mesenteric | 60% | 50% | 97% / 24% |
| Gastric | 65% | 40% | 96% / 19% |

Almost every loss is to neutrophils in the liver. The design target is skim home at least 90% on every route; for a single trip the skim bot was at 95 to 100% at Version 40, so the combined unit-6 to unit-9 changes (weaker clotting and plating, primed neutrophils, engulfing, swarm on kill) have made the liver much more lethal for a simple fighter. A careful human who hides and runs silent should do better; Mick's next runs will tell. Worth a sim bot that uses niches before tuning numbers.

## Pass 4: 2026-11-17, Version 47 (head 42f6bb9, unit-7)

69/69 tests, `tsc` clean, no page errors.

**Can a careful run still finish with the host alive? Yes, with real pressure.** `scripts/qa-tumor-clock.ts` models a skim-only mission of three hepatic-route trips using the real drain (2% an hour with the whole tumor in, falling in step with what is left) and sleep mending (1 point per 15 s, so 2 per host hour asleep), with liver times taken from Mick's run reports:

| Minutes per liver | No other host damage | 5 per liver (frights, a strip) | 10 per liver |
|---|---|---|---|
| 4 | ends 90% (low 75%) | 75% | 60% |
| 8 | ends 80% (low 59%) | 65% | 50% |
| 12 | ends 69% (low 44%) | 54% | 39% |
| 15 | ends 58% (low 35%) | 43% | 28% (low 18%) |

Mick's livers have taken 6 to 12 minutes, so a careful Mick should finish around 50 to 75% with lows in the 40s to 60s. Only a very slow run that also hurts her often gets close to zero. Day/night timing shifts results by about 10 points (a run whose livers fall at night mends more).

**HUD drain rate reads sensibly.** It shows one decimal place: 2% an hour at 0 out, 1.1 at 9, 0.2 at 18, 0.1 at 19, and the line drops to "Tumor all out" at 20. The world-map status line uses the same number.

**Tumor count stops at 20.** Later livers hold only what is still needed (9 at 0 or 9 out, 2 at 18, 1 at 19, none at 20). Note that 20% of first livers generate 7 or 8 tumor cells rather than 9 (200 seeds: 161 had 9, 22 had 8, 17 had 7), so "about 3 more liver visits" is right but the count per liver varies. Three livers always cover 20.

**Overlay map tumor marks (asked to eyeball): readable, but three problems** (screens `/mnt/project-files/qa/overlay-map-desktop.png` and `overlay-map-phone.png`):
- **M1 (P2)** The violet tumor marks are drawn on the overlay map, which sits at a different offset from the world, so with the map open they land on top of the ship sprite while the gold "ringed on the map" circle sits on the real cell a tile or two away. Two markers for one thing, in two places, is confusing. Either draw the overlay with the ship in a corner or inset, or drop the gold world ring while the map is open.
- **M2 (P3)** There is no legend: the map uses red, amber, cyan, green, violet and blue dots, and a new player cannot tell glucose from immune cells from antibodies. A one-line key on the map or a field-note entry would do.
- **M3 (P3)** On a phone the log and Shepherd lines are drawn over the open map, so the middle third of the map is under text.

**Immune memory (unit-7).** Not measured this pass beyond the tests; the bots do not reach memory 0.5 in a single trip either way.

## Pass 3: 2026-11-17, recheck at Version 44 (head 73903bd)

69/69 tests, no JavaScript errors and no layout flags in a phone bot run. **B1 fixed:** walking to the stomach exit in fog now spends 0.0 s in open acid (was 5.7), fully explored also 0.0; the rim bot that waits out dinner then leaves now loses 4 hull on average with 0 deaths in 15 (was 24 hull, 1 death); a tap on the exit at any hour costs about 1 hull. As the engineer notes, a human reaches the exit in several taps, since each path stops at the edge of the known rim. **B5 fixed** (veil 99%), **B7 fixed** (clock ribbon icons are 36x36, and the bot no longer flags any small tap targets). All pass-1 bugs are now closed; realism items R1 to R3 stay open for the creative director and systems designer.

## Pass 2: 2026-11-17, recheck at Version 43 (head e2489a3)

`tsc` clean, 68/68 tests, bot runs at desktop, iPhone 13 and Galaxy S8 sizes with no JavaScript errors. Acceptance checks unchanged from pass 1 (S1, S2, S3, S7 met).

| Bug | Status | Evidence |
|---|---|---|
| B1 stomach pathing through acid | **Half fixed** | With the stomach fully explored the walk to the exit now spends 0.0 s in open acid (was 5.7). With normal fog it is still 5.7 s, because `moveTo` only routes through explored tiles, so the dry rim route is almost never known yet when the player taps the exit, and the fallback wades straight across. Suggest: when the dry search does not reach, walk the dry route to the known dry tile closest to the target instead of wading, and only wade when the tap itself lands in acid. |
| B2 fare shown as 20 | Fixed | Orb reads `8/24`; `#need` says "You need 24 energy to ride it out: 20 for the ride, 4 for the road." |
| B3 F strips a healthy cell | Fixed | Tumor cell chosen in 20 of 20 test livers (was 15). |
| B4 starvation blamed on neutrophils | Fixed | Ending "The ship ran dry", log "Nothing left to burn." |
| B5 see-through menus | Mostly fixed | Veil is now 95% opaque; on a phone the HUD buttons and log line are still faintly visible behind the world map text. Low priority now. |
| B6 lungs leg drawn early | Fixed | Not drawn until unlocked. |
| B7 small phone buttons | Fixed for the top row | 40 px tall now. The clock ribbon icons (meal, coffee, sleep) are still 22x18 px tap targets. |

**New, watch only:** the page bot, which cuts the tumor out first and then skims, ran dry in a liver in both desktop runs that ended there (Version 38 and Version 43) (24-energy fare, 1 energy burned every 14 s). That is a simple bot, not proof, but it is the same direction as the S2 energy concern, so it is worth watching in Mick's `energyOnArrival` numbers. Desktop frame times in this pass (median 33 ms) are not meaningful: three browsers shared four CPUs.

## Pass 1: 2026-11-17, builds unit-2 to Version 40 (head 51e9e59)

**How it was tested.** `npm run build`, `tsc` and `npm test` (66/66 pass at 51e9e59). A Playwright bot (`scripts/qa-bot.cjs`) played the real page at desktop 1366x768, iPhone 13 and Galaxy S8 sizes, about 45 bot minutes in all, clicking every menu, info box, offer and choice through the DOM. Rules-level checks in Node for the systems-design "Done when" lines (`scripts/qa-accept.ts`). Touch tests on an emulated iPhone. Mick's 16 run reports from the artifact's `runs` data.

**Headline.** No JavaScript errors or console errors in any run, and no stuck screens. The S1, S2, S3 and S7 fixes meet their "Done when" lines. The biggest remaining problems are (1) clicking the stomach exit routes the ship straight through the acid, (2) the HUD still says you need 20 energy when the vein now wants 24, and (3) pressing F next to a tumor cell can strip a healthy cell instead, which now costs the host 8%.

### Bugs, most important first

**B1 (P1) Click-to-move in the stomach walks you through the acid lake.**
Steps: enter the stomach, click or tap the exit vein. What happens: the path goes straight across open acid, about 5.7 s in it, costing about 20 of 40 hull if the host has eaten (19 hull at 19:20, 5 hull fasting). A bot that waited on the rim through dinner and then clicked the exit spent 14 s in acid, lost 24 hull on average and died 1 time in 15. Expected: an acid-free route exists in 20 of 20 generated stomachs, so pathing should prefer it (weight acid tiles heavily in `findPath`, or treat them as walls unless the click target is in acid). This is the trap that killed Mick twice on unit-1/unit-2 (runs at 00:26 and 00:54, 74 and 45 hull lost to acid). Builds: unit-2 to Version 40, all devices.

**B2 (P1) The HUD tells you the fare is 20 when the vein requires 24.**
Steps: enter a liver with 20 to 23 energy, stand on the central vein. What happens: the energy orb reads `20/20`, the vein message says "You need 20 energy to ride it out", and the vein will not take you. Expected: all three say 24, or "20 + 4". Places: `main.ts` line 444 (`${p.energy}/${CONFIG.energy.quota}`), `page.html` line 178 (`#need`, hard-coded 20), and the liver opening line in `game.ts` (`You need ${CONFIG.energy.quota} energy`). The goal line and the vein info box are already right. Build: unit-3 onward.

**B3 (P1) F beside a tumor cell can strip a healthy cell instead.**
Steps: stand on an open tile touching a tumor cell that also touches healthy cells, press F. What happens: `stripTarget` takes the nearest cell in the 3x3 around you, and in 5 of 20 test livers that was a healthy cell, not the tumor. Since Version 40 that costs the host 8% and +18 alert, the opposite of what the player meant. Expected: prefer a tumor cell when one is in reach, and/or show which cell F will hit. Build: all, worse since Version 40.

**B4 (P2) Starving to death is reported as being killed by neutrophils.**
Steps: let energy run out in a liver and wait. What happens: the ending says "The liver cleared you" and the log says "The neutrophils dissolve you where you stand" (starvation calls `hurtPlayer(s, starveDamage, 'neutrophil')` in `game.ts`). Expected: an ending that names starvation. Build: all.

**B5 (P2) Menus are see-through on phones, so HUD text shows behind them.**
Steps: open the world map or the gut lumen on a phone. What happens: the veil is 84% opaque (`.veil` background `rgba(10,4,7,0.84)`), so the trip line overlaps the Sound and Map buttons and the goal line and log text show faintly through the title and body. Expected: a solid backdrop, or hide the HUD while a veil is open. Screen: `/mnt/project-files/qa/phone-world.png` in the project files. Build: all, phone sizes.

**B6 (P2) The world map draws the heart-to-lungs leg as open before it is unlocked.**
Steps: start a new mission and look at the map. What happens: the heart-to-lungs arrow is drawn in the same bright "open" style as the legs you can take, because `openWorld` marks every leg from your node as open without checking `after`. Expected: dim or hide it until 20 tumor cells are out. Build: all.

**B7 (P2) Phone HUD buttons are small tap targets.**
The top row (pause, sound, both turn buttons, map) is 27 px tall on iPhone 13 and Galaxy S8, and pause and turn are 43 to 53 px wide; the clock ribbon's meal, coffee and drink icons are 22x18 px. Apple and Google guidance is 44 to 48 px. They also show keyboard hints ("Z", "X", "Tab") on touch screens. Build: Version 40.

**B8 (P3) A meal called with Ghrelin gets no warning.** The "reaching for food" warning only looks at the fixed meal times (`h.meals`), so a snack from the gut lumen floods the stomach with no warning.

**B9 (P3) Acid death message tests the meal, not the acid.** It names the meal when `digesting > 0.4`, but the acid now eases in, so the message and the actual acid strength can disagree in the first 20 s of a meal.

**B10 (P3) Phone play area is small.** On a portrait phone the top HUD and goal line take about the top fifth of the screen and the log plus action buttons the bottom fifth, leaving a band in the middle. Worth a look once the clock ribbon settles.

**Checked and fine:** tap to move, hold to steer, pause button, map toggle on touch; gut lumen buttons fit at 320, 360 and 390 px wide with no sideways scrolling (they are tall, up to 226 px each on iPhone SE, so the market is a long scroll); the ledger survives a reload mid-trip (values set, saved at a world-map stop, reloaded, continued, intact); "The tumor is a clock" tip cannot land on another popup, because tips only fire when no tip, offer or choice is open and the world stops while one is.

### Balance

**Mick's runs (16 reports).** Before tonight's fixes, 2 of his last 4 runs ended in the stomach, both killed by acid when dinner landed at 19:00 while he was inside (he entered at about 13:00 and 14:00 and stayed 150 to 186 s skimming). His runs at unit-1/unit-2 also show him arriving at the stomach with 16 of 40 hull after a vessel.

**Acceptance checks at Version 40** (`npx tsx scripts/qa-accept.ts`):

| Spec | Done when | Result |
|---|---|---|
| S1 stomach | 40-hull ship in full acid lasts at least 8 s | Met: 10.4 s at 0.85 strength (about 8.9 s at full), 14.4 s with one auto-patch |
| S1 stomach | a rim-skimming bot survives a meal mid-visit | Mostly: 14 of 15 lived, but see B1, all the damage came from the walk out |
| S1 stomach | 2 rim glucose patches | Met in 15 of 15 maps |
| S2 energy | trip 1 gastric route without starving | Met: 0 of 15 starved, 7 energy on arrival on average, 36.7 hull |
| S3 slams | one artery fright costs at most 6 hull | Met, but exactly at the cap: an idle ship loses 5.9 on average, so every fright costs about 6 |
| S7 T cell | cloak holds beyond touch range | Met in 11 of 12 (the 12th wandered into contact) |

**Tumor clock (Version 38/40).** The drain is 1% per host hour; sleep mends 5% per host hour asleep (8 hours a night). Over one host day (12 minutes of play) a player who does not strip ends about +16% ahead, so a slow, careful run can still finish: the clock only bites when combined with stripping or frights. If the clock is meant to press, the drain needs to be about 2% an hour or sleep healing lower. Related: "Wait an hour" while the host sleeps nets +4% host health for 2 energy, repeatable, which is a cheap heal.

**Stripping at Version 40:** 8 energy for 8% host health and +18 alert. Three strips pay the whole 24 fare in about 4 s at a cost of 24% host health, against several minutes of skimming. That makes the choice real; watch Mick's next runs for how often he takes it.

**Performance.** Headless Chromium uses software rendering, so these are pessimistic: median frame 16.7 ms (60 fps) at every size; 95th percentile 33 ms; desktop 1366x768 had 9% of frames over 33 ms and a 99th percentile of 50 ms, phones 2 to 12%. Worth checking on Mick's real devices before reading much into it; the game already drops to 1x resolution when it sees 90 slow frames.

### Realism (world bible section 2)

Most wording issues were already fixed by the creative director by Version 40 (gut lumen no longer trades, T-cell tip no longer calls it an assassin, antibody line reworded). Remaining:

- **R1 (mechanic) Killer T cells hunting the ship.** Real cytotoxic T cells recognise peptides presented on MHC class I by infected host cells; they do not recognise or chase a free particle, least of all a machine. Antibodies plus complement, or macrophages, are the realistic adaptive threat to a foreign object. This is the biggest science bend left without a stated story reason; options are a new adaptive enemy (antibody-coated, complement-tagged) or a story reason (Shepherd's units carry host-derived proteins that get presented).
- **R2 (mechanic) Antibodies home on the ship within 3 tiles.** Antibodies cannot swim; they drift with the flow and bind on contact. Pure drift (no `homing`) would be accurate, with denser clouds downstream of where you were tagged.
- **R3 (comment only, not shown to players)** `game.ts` still says T cells "want you in particular". Harmless, but it will steer whoever edits next.

### Test tools added

- `scripts/qa-bot.cjs`: plays the built page in headless Chromium at desktop and phone sizes, clicks the real UI, records errors, stuck states, layout problems (sideways scroll, off-screen buttons, small tap targets, HUD overlaps), frame times and screenshots. `npm run build && node scripts/qa-bot.cjs --runs 2 --speed 6`. Output in `scratch/qa/` (git-ignored).
- `scripts/qa-accept.ts`: rules-level checks for the systems-design "Done when" lines. `npx tsx scripts/qa-accept.ts`, about 2 minutes.
