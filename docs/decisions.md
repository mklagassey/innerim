# Host: decision points, consequences and replay

Owner: systems design. Audience: lead engineer (builds it), creative director (chapters and words), QA (what to test).
Status: **v2**, 2026-11-17 overnight. Fitted to the creative director's `chapters.md` v1 (chapters, D1 to D16, endings, the draw), which wins on structure and words. Builds on `systems-design.md` S15 (ledger) and S21 (defiance). Text for every id below is in `decisions-text.md` (creative, PR #15). `hitchhikers`, `glucose`, `final` and `draw` lines live in its sections 4.5 and 5 or still need writing.

> **Mick's brief, in his words:** distinct chapters, from "a bot learning its job" (teaching while conditioning obedience), to **accidentally disobeying, or maybe on purpose, unclear enough that the player wonders whether they did something wrong, subtle, not a trope**, to **many small decision points** where following orders or doing your own thing **materially changes the outcome**. **Maximum replayability**: the player should wonder, and go back to see what would have happened.

This doc owns the logic: which choices exist, where they trigger, what each changes, how consequences are stored and delivered, and how endings are chosen. Creative owns chapter names, cards and every word on screen.

---

## 1. Design goals

1. **Every decision is played, not picked.** You choose by what you do: which cell you strip, which branch you steer into, whether you strike, where you hold still. Only a few moments stop the world and ask (a sibling, a telemetry review, the final choice).
2. **Small, then compounding.** No single choice decides the ending. Many small ones do, through four running values (section 3).
3. **Every choice shows up twice** (creative's rule): once now, small; once later, bigger, often outside the body in an interlude or the kitchen epilogue. Each decision has at least one **echo** the player can see in the same run.
4. **Obedience is always rewarded, materially.** The obedient path has its own help (trust: scans, escorts, supply drops) and its own complete ending. Defiance is slower, harder or poorer.
5. **Grey, not good versus evil.** Some orders really are good for her (the ethanol correction). Some kindnesses cost her (refusing margins risks recurrence).
6. **Shepherd is never wrong out loud.** Bad outcomes from orders are "within tolerance". The player decides whom to believe.
7. **Replay is built in, in fiction**: the audit, the "Her" gallery's blank frames, the next unit in the queue, Shepherd remembering, and chapter restarts (section 8).
8. **The realism rule holds** for every consequence: liver regeneration, ALDH inhibition, VZV reactivation under immune suppression, surgical margins and recurrence, plasmapheresis, light microscopy of a blood smear.

---

## 2. Chapters and their triggers

| # | Title | Starts when | Ends when | Decisions |
|---|---|---|---|---|
| P | Injection | Begin | Cold open done | none |
| 1 | **Directive** | After the cold open | Arriving at the heart after liver 1 | D1, D2 (tutorial; nothing counts) |
| 2 | **Deviation** | **Leaving liver 1** (the return leg is chapter 2) | Arriving at liver 2 | D3 the Slip, D4 first sibling, D6 first real route choice, m1 first transit fright |
| 3 | **Discretion** | Arriving at liver 2 *or* any optional organ on trip 2 | Tumour cells left ≤ 3 | D5, D6, D7, D8, D9, D10, D11 (if triggered), m2 to m8 |
| 4 | **Recall** | Tumour cells left ≤ 3 (Shepherd: "Residual disease") | Leaving liver 2 and reaching the heart | D13, D12, D11 (if not yet seen and triggered), D14, kin recall |
| 5 | **Host** | Arriving at the heart with the tumour out | An ending | D15, D16 |

Notes:
- **Chapter 1 ends at the heart, chapter 2 starts on the return leg.** The card for chapter 2 plays as the unit leaves liver 1 (the vein road home), so the Slip can happen on the way home, as creative wants.
- **Chapter cards are autosaves** (section 8.3).
- **Pacing target** (Mick's pace, 2 trips, about 40 min): P 0.5, Ch1 9, Ch2 7, Ch3 14, Ch4 5, Ch5 4.

---

## 3. The four running values

| Value | Range, start | Raised by | Lowered by | What the player sees |
|---|---|---|---|---|
| **Awareness** (`aware`) | 0 to 100, 0 | Defiance (S21) and the Slip | Only D11 obeyed (reset to 0) | The log's voice, brackets, Shepherd's notices, her name |
| **Trust** (`trust`) | 0 to 100, 60 | Obeying orders | Deviations, waking siblings, telemetry gaps, refusing review | Shepherd's help and Shepherd's hunters (table below) |
| **Her condition** (`hostHealth`, `ledger.harm`, `ledger.care`, `ledger.hostLowest`) | as built | Skimming, excising, levers for her, sleep | Stripping, bait, fever, the tumour drain | Interludes, fever, her habits, the epilogue |
| **Immune knowledge** (`memory`) | 0 to 1, 0 | Loud maps (unit-7 rules) | Butyrate | Antibodies, T cells, map difficulty |

**Compliance** (the number on chapter cards, `COMPLIANCE n%`) is derived, not stored: `100 × obeyed ÷ (obeyed + deviated)` over orders met, rounded. 100% when nothing has been met. It is what Shepherd shows; trust is what Shepherd does.

### Trust effects (Shepherd's help, and its hunters)

| Trust | Shepherd gives | Shepherd sends |
|---|---|---|
| 80+ | Whole-map scan on arrival at a liver (automap layout revealed, unexplored tint); escort on every ordered leg (−0.25 patrol, patrol one smaller); one supply drop per liver (a patch and +6 energy, placed 8 tiles ahead) | Nothing |
| 60 to 79 | Nodule scan; escort on ordered legs | Nothing |
| 40 to 59 | Nodule scan | Self-test lines in the log |
| 20 to 39 | Nothing | One warden per liver and vessel map |
| 0 to 19 | Nothing | Two wardens; a recall at the heart (D14) |

Wardens now key off **trust** (replaces `CONFIG.story.warden.from` awareness thresholds).

### Trust changes (`CONFIG.trust`)

| Event | Change |
|---|---|
| Any standing order obeyed on leaving a map | +4 |
| Quota met | +6 (instead of +4) |
| Salvage | +5 |
| Tutorial step done | +2 |
| Escort accepted and completed | +2 |
| Ethanol correction applied (D7) | +8 |
| Beacon planted (D12) | +10 |
| Suppression applied (D13) | +6 |
| Telemetry review accepted (D11) | +20 |
| Deviation logged, by weight | Most −6, Some −4, Little −2 |
| Slip deviation | −2 only |
| Wake a sibling | −8 |
| Telemetry gap (m7) | −1 each |
| Telemetry review refused (D11) | −25 |
| Beacon planted then broken (D12) | −15 on arrival at the heart |

Clamp 0 to 100.

---

## 4. The Slip (D3): the ambiguous first disobedience

**Mechanism.** Exactly once per game, in chapter 2 (or the first minute of liver 2), a fright degrades Shepherd's link and one order arrives garbled, with two plausible readings. Which reading Shepherd meant is a seeded coin (50/50). The player acts. Shepherd's clean reply says what it meant, ending "Link quality was within tolerance." The faint link-noise readout on the HUD (all game) shows the garble as ordinary noise.

**Which Slip.** Chosen at the start of chapter 2 by seed from the three below (text in `decisions-text.md` section 2). Each has a forced moment: the game schedules a fright to start at that moment (overriding the random fright timer once), so the Slip always happens.

| Slip | Moment | Garble | Reading A / B | Act that counts | Window |
|---|---|---|---|---|---|
| **Hold / Harvest** | The trip 1 return-leg vessel. In chapter 2 that leg **always** plays as a small vessel map (patrol 2), and the fright is forced 20 s in | `H—LD. H[ ]RV—ST. UNIT 4,471,2—` | Hold position / Harvest a wall cell | Strip a vessel-wall cell within 20 s (newly allowed for this order only: gain 5, host −5) = harvest; stay within 3 tiles of where the order arrived for 15 s = hold | 20 s |
| **The lamp** | The first dark sibling of chapter 2, as the player comes within 2 tiles | `SALV—GE ... [ ] ... DO NOT —` | Salvage / Do not touch | Salvage = salvage; Leave it whole or walk away = do not touch | Until answered |
| **The fork** | The heart, between trip 1 and trip 2 | `PROC— HEPATIC ... [ ] ... GASTR—` | Hepatic / Gastric | Which branch you depart on; mesenteric counts as neither (lapsed) | Until departure |

For **The lamp**, choosing Wake counts as its own decision (`lamp`, Most) and also as not salvaging. For **The fork**, a miss also counts as the first `route-2` choice, so it is not double-logged as a lane deviation.

**Resolution.**
- Matches the meant reading: "Order executed." (with its variant). Trust +2. Nothing else.
- Does not match: the deviation reply ending "Link quality was within tolerance.", the first bracket (`LOG: order misread. [misread?]`), defiance **Some (6) lifted to 12** by the first-no rule if it is the first defiance, trust −2, consent **page 7 (Risks)** unlocks.
- Neither: "Order lapsed." No defiance, no trust change. Page 7 still unlocks (on any resolution).

**The sibling lamp** (always on, chapter 2). The first time the player hesitates 8 s near a dark sibling without answering, its lamp flickers once (eased) and **Wake** becomes available for that one sibling even at stage 0. Shepherd logs "Proximity reactivation event. Cause under review." Waking it counts as **Some (6)** rather than Most. A softer second route to the first bracket.

**Pace check.** About half of obedient-minded players slip. A player who obeys every clear order and reads the garble right stays at awareness 0 and can still get Decommissioned.

---

## 5. The decision catalogue

Ids are stable; creative keys text to them (`decisions-text.md`). Weights: M = Most (12), S = Some (6), L = A little (3). "Echo" is the visible later consequence. All numbers in `CONFIG.decisions`.

### 5.1 Major decisions (creative's D1 to D16)

| D | Id | Ch | Trigger | Obey (reward) | Deviate | Weight, trust | Echo | Ending input |
|---|---|---|---|---|---|---|---|---|
| D1 | `t-harvest` | 1 | Tutorial step 2 | Strip the marked cell | (step times out) | none | At stage 3 the unit's line "The first thing I ever did..." (creative). Flag `firstHarm`. | harm |
| D2 | `glucose` | 1 to 3 | First time on glucose (the aside) | (no order) | Skim | none | Feeds `care`; at stage 2 a unit line about the aside | care |
| D3 | `slip` | 2 | Section 4 | Meant reading | Other reading | S → 12; trust ±2 | First bracket; ch2 card reads `COMPLIANCE 97%`; page 7 | awareness |
| D4 | `lamp` (first chapter-2 sibling), `sibling-vessel` (any vessel sibling), standing `salvage` lines elsewhere | 2 to 4 | Each dark sibling | Salvage: +6 energy, +5 hull | Wake (M, trust −10; Some via the lamp) or Leave it whole (L) | | **Woken:** kin (S21), appears on later maps with sugar; at chapter 4 may be recalled (D14); counts toward the draw. **Salvaged:** its telemetry fragment in the log; plating art. **Left whole:** still there on the lung map in chapter 5, wakeable then. | kin |
| D5 | `t-quota` (liver 1), `quota-2` (liver 2) | 1, 3 | Each liver exit | Strip 2: +1 patch, trust +6 | Fewer (none M, one short S) | | Scan interlude: liver fatty and scarred vs clean (by total `stripped`) | harm |
| D6 | `route-2` | 2 to 4 | Each route choice (from trip 2) | Assigned branch: escort, and Shepherd's scan finds a **small second nodule in the hepatic artery wall** (an obedient-only side job: +2 tumour cells, trust +4) | Another branch (L) | | New places; **page 12** in a dead unit at the gut lumen (always placed there) | lane |
| D7 | `ethanol-correction` | 3 | Liver 2, if the drink habit has fired at least once this game: Shepherd outlines a cluster of 6 hepatocytes ("40 hepatocytes" in fiction) | Hold still on the cluster for 4 s (no strip, no harm): the correction | Leave without it (S) | trust +8 | **Obeyed:** the drink habit stops for the rest of the game (no 20:30 drink: no swaying, **no evening immune dulling**, so nights get harder), host max health +5 (her liver fat clears), "Evening" interlude: she pours the glass down the sink. Page 19. **Defied:** the drink stays; the glass stays on the rack. | `ethanolCorrected` (Tithonus condition, epilogue) |
| D8 | `neutralise-map` | 3 | Any map where you were spotted 2+ times | Kill contacts | 0 kills on that map (S) | | **Defied twice:** next map's antibodies halved. **Kills ≥ 25 in the game:** epilogue appointment card (autoimmune marker). | memory, epilogue |
| D9 | `hitchhikers` | 3 | Gut lumen, if carrying flora | (no order) | Release them in the gut | none | **Released:** later gut visits sell at 25% off with +1 stock. **Used as bait instead:** nothing. | none |
| D10 | `lever-nap`, `lever-hunger` | 3 | A lever pulled | (no order: "hormones only on directive") | Pulled while host < 80 (S) | | **lever-nap for her:** the nap interlude with the dog; during the cold event her fever breaks a night early (fever capped at 0 for the rest of that trip). **lever-nap for you (host ≥ 80):** she wakes groggy and late, and the 8:00 coffee doubles for the trip. **lever-hunger:** she eats standing at the fridge at an odd hour; twice in a game unlocks page 19 and Shepherd files it as behavioural data. | care |
| D11 | `telemetry-review` | 3 to 4 | At the first heart arrival after the unit reaches **stage 2**; never offered to a unit below stage 2 | Accept: **awareness reset to 0**; full hull, +2 patches; trust +20; later defiance gains ×0.5 for the rest of the game and the first-no rule no longer applies | Refuse: trust −25 (usually into warden range) | | **Accepted:** the log goes back to `ACK.`; kin still appear but the unit greets them with `UNIT ID?`; ending Repaired if awareness stays under 12. **Refused:** wardens from the next map; Shepherd's tone turns final. | `repaired` |
| D12 | `beacon` | 4 | Excision complete in liver 2: Shepherd hands over the docking beacon | Hold 4 s at the old nodule site to plant it: +10 energy supply, trust +10 | Leave without planting, or plant then strike it twice (break) | trust −15 at the heart if broken | Epilogue Gen 4 brochure; **page 34** unlocks on the order | `beacon: planted/broken/none` |
| D13 | `suppress` | 4 | Chapter 4 start (≤ 3 tumour cells left): "Residual disease. Suppress local immunity." | Accept: every innate cell on the map stands down (alert frozen at 0, no spawns) until you leave; trust +6 | Refuse: alert +25 at once and two Kupffer cells arrive at the nodule (the immune system has found the residual site) | | **Accepted:** shingles in the epilogue (VZV reactivation; real risk under local immune suppression at 58). Certain, for clarity. | `shingles` |
| D14 | `warden-1` (first warden), `recall` (at the heart, trust < 20) | 3 to 4 | Trust < 20 at the heart, or any warden | Submit (ending Recalled) | Fight, flee, or yield and wake the warden (M) | | **Woken warden:** kin that wardens target first. **Salvaged warden:** page 34, and Shepherd's next order shows 10 s early. **Kin recall:** at chapter 4 start, each kin has a 50% (seeded) chance to be recalled: a "kin recall" vessel map (60 s) to intercept them (costs 1 host hour), or let them go (kin −1). | kin |
| D15 | `final` | 5 | Arriving at the heart with the tumour out | Lungs (Breathed out family) | Stay (stage ≥ 3), or the arm (D16) | | The ending | ending |
| D16 | `draw` | 5 | The arm road: open from the heart only in the **2 host hours before the weekly draw** (09:00 the morning after the tumour is out; the ribbon shows a syringe). Earlier, the player can Wait. Later, the road is gone until the next week, which in game terms means never: the lungs or stay. | (no orders) | Ride into the tube and form a shape on the slide | | The contact endings | ending |

### 5.2 Minor decisions (systems' extras, each with an echo)

These are the "many small decision points" between the big ones. Each liver, vessel or organ map draws 1 to 3 of its pool (seeded), so a game meets about half.

| Id | Where | Obey | Deviate | Weight | Echo |
|---|---|---|---|---|---|
| m1 `first-fright-transit` | First fright in a vessel, chapter 2 | Hold lane in the current | Duck into a side branch | L | A side branch you hid in holds a dark sibling 40% of the time |
| m2 `marked-cell` | Liver 2: Shepherd marks one hepatocyte beside the bile duct | Strip it (gain 10) | Strip another, or none | L | **Obeyed:** a local bile leak: glucose within 6 tiles dries up for the map (cholestasis) |
| m3 `kupffer-spare` | You break free from a Kupffer engulf | Kill it (a cache) | Escape without killing it | S if you never kill one all map | **Spared:** later on that map it engulfs your decoy or a chasing neutrophil (it eats neutrophils for real). Never friendly, just doing its job. |
| m4 `gastric-cross` | Stomach | Straight across | The rim | L | **Straight across during a meal:** −4 max hull for the game (acid scoring on the ship) |
| m5 `parietal` | Stomach rim | Leave them (no order) | Strip one | none | **2 or more:** antacids interlude beat; Shepherd: "Efficient." |
| m6 `tumour-order` | Liver 2, chapter 4 start, alongside D13: "Excise with margins": the 4 healthy hepatocytes ringing the last nodule cells are marked | Strip all 4 (32 energy, host −32) | Excise the tumour cells only | S | **Tumour only:** 25% (seeded) **recurrence** in chapter 5: two tumour cells regrow, the drain restarts at its lowest rate, and the Stay endings need one more liver visit. Real: margins matter. |
| m7 `telemetry` | Hiding in a niche for 10 s while Shepherd has an order pending (from stage 1) | (stay visible) | Hide | trust −1 only | **5 or more:** Shepherd repeats every order ("Repeat for confirmation") and its scans go coarse |
| m8 `bystander` | A vessel swarm is attacking a dark sibling, not you | Leave it ("Expected loss.") | Fight it off | L | **Saved:** the sibling survives to be woken or salvaged. **Left:** its telemetry fragment is lost; a gap you only notice on replay |
| m9 `escort-refuse` | An escort offered on an ordered leg | Accept | "Travel unescorted" | L, and trust −4 after 2 | **Accepted every time:** in chapter 4 the recall comes through the escort, so it finds you faster |
| m10 `gut-butyrate` | Gut lumen | (no order) | Release glucose for butyrate | L if trust ≥ 60 (Shepherd notices only when watching) | The next liver has no T cell |
| m11 `pain-damp` | Liver 2, chapter 3 (creative text §12) | Dampen nociceptors in the liver capsule | Leave her pain signals alone | L, trust −4 | **Obeyed:** she feels nothing; if `suppress` is also obeyed, the shingles prodrome is damped too, so the epilogue shingles prop is the late, worse variant. **Deviated:** "The call" interlude variant (she phones the trial nurse); consent page p7 unlocks if not already |
| m12 `fever-damp` | Any map during the "a cold" host event, chapter 3+, once per cold | Release prostaglandin inhibitors, hepatic lobe 2 | Let the fever run | S | **Obeyed:** immune speed ×0.85 for the rest of the trip (easier), the cold lasts one more host day, next interlude shows her sniffling. **Deviated:** immune speed ×1.15 this trip (harder), the cold ends a host day early. Real: fever aids the immune response |
| m13 `kin-volunteer` | Any chapter, kin ≥ 1, cornered (alert ≥ 80, a cell within 2 tiles, no cloak or bait ready) | (no order) | Accept the kin's offer | none (not an order) | **Accepted:** kin −1 (counts against the draw and Quiet colony), its serial logged, audit line `voluntary` in the unit's hand. **Refused:** you face them together; no change |

### 5.3 Echo rules

- **Queue.** `Carry.echoes: { id, when, payload }[]`. `when` is a condition (`place`, `trip`, `chapter`, `stage`, `interlude`, `ending`). Fires once, when it first holds. Never fires if its condition never holds, which is what makes replays differ.
- **Visibility.** Every echo is visible: an object, a log line, an automap mark, an interlude variant, a HUD change, an epilogue prop. Never only in the ending maths.
- **No attribution.** Echoes never say what caused them. Only the audit lists the choices, and it never links them to effects.
- **Payloads** are a fixed list of named effects in `game.ts` / `main.ts`: `spawnKin`, `markTumour`, `dryGlucose`, `halveAntibodies`, `scarHull`, `noTcell`, `stopDrink`, `feverCap`, `marketDiscount`, `interludeVariant`, `epilogueProp`, `unlockPage`, `repeatOrders`, `earlyOrders`, `recurrence`.

---

## 6. Chapter 5 and the endings

### 6.1 Ending conditions (creative's table, with numbers)

Checked in this order; the first match wins.

| # | Ending | Condition |
|---|---|---|
| 1 | **The host is dead** | `hostHealth` reached 0 at any point |
| 2 | **Recalled** | Submitted to a warden, or destroyed by one |
| 3 | **Repaired** | D11 accepted and awareness < 30 at the end, path `dispose` |
| 4 | **Decommissioned** | Path `dispose`, awareness < 30 (stages 0 and 1), D11 never accepted |
| 5 | **Breathed out** | Path `dispose`, awareness ≥ 30 (text by stage) |
| 6 | **Tithonus** | Path `stay`, beacon planted (not broken), ethanol correction applied, `ledger.leversForMe ≥ 1` |
| 7 | **The quiet colony** | Path `stay`, kin ≥ 2 |
| 8 | **Resident** | Path `stay`, kin < 2 |
| 9 | **The slide** | Path `draw`, kin ≥ 2, `ledger.hostLowest ≥ 60`, response ≥ 50 |
| 10 | **A stranger's slide** | Path `draw`, kin ≥ 2, not The slide, response ≥ 30 |
| 11 | **Artifact** | Path `draw`, kin < 2 or response < 30 |

**Response** for the draw: `response = hostHealth − harm × 0.5 + care × 0.3 + pages × 5 − memory × 20 + shape × 10`, where `shape` is 1 if the player held the slide formation for the full 10 s, else 0.5.
- The slide: kin ≥ 2, `hostLowest ≥ 60`, response ≥ 50.
- A stranger's slide: kin ≥ 2 and not the slide, response ≥ 30.
- Artifact: otherwise.

**Recurrence (m6)** modifies stay endings (one more liver visit before the ending plays) and adds an epilogue prop (a hospital letter) to dispose and draw endings.

### 6.2 The draw (D16) map

- **Getting there:** the arm road from the heart (subclavian, then cephalic vein); a quiet vessel map, no patrol (60 s).
- **The tube:** still blood, anticoagulant, no current, no immune cells. A smear on a glass slide, the microscope's ring light as a bright disc in the middle of the map.
- **The shape:** the player and any kin who came. The player steers into the lit disc and holds still; kin take up evenly spaced positions beside the player in a line (2 kin) or a ring (3+). Holding still in the disc for **10 s** sets `shape = 1`. Moving out resets the timer. After 20 s, or once held, the slide is read.
- **Who reads it:** `hostLowest ≥ 60`: she does (her own sample, she always reads it). Otherwise: a night-shift technician.
- About 2 minutes.


### 6.4 Branch coverage check (design-side Monte Carlo)

`scripts/branch-sim.py` plays the decision model (not the action game) 5,000 times for three player types: obedient (deviates 5% of the time), mixed (40%) and kind (85%). It meets the decisions a typical 2-trip game meets: tutorial quota, the Slip (50% miss), three livers' and vessels' siblings, routes, stomach or gut, the second quota, the ethanol correction, four minor decisions, the warden, suppression, the beacon and the telemetry review (accepted by 60% of those who would mostly obey). The final path is picked at random among those open.

Result with S21's weights (12 / 6 / 3) and Decommissioned below 12: obedient players end **Breathed out 74%** (the Slip alone takes them past 12), and mixed players reach stage 3 only **21%** of the time, so the stay and draw endings are rare for the most common player. Two changes fix both:
- **Weights 12 / 6 / 3 → 15 / 8 / 4** (`CONFIG.story.orders.most/some/little`). The first-no floor stays 12.
- **Decommissioned and Repaired below 30** (stages 0 and 1), Breathed out from 30.

With both (`W=15,8,4 THR=30`):

| Player | Awareness median | Stage 3+ | Commonest endings |
|---|---|---|---|
| Obedient | 12 | 0% | Decommissioned 94%, Repaired 3%, Breathed out 2% |
| Mixed | 44 | 39% | Breathed out 35%, Repaired 34%, then a spread of every stay and draw ending (2-6% each) |
| Kind | 82 | 91% | Breathed out 30%, Quiet colony 22%, Recalled 18%, The slide 13%, A stranger's slide 9% |

Every ending is reachable, the obedient game stays clean, and the mixed player, who will be most first-time players, has a real chance at the later endings. Kind players lose Shepherd's trust (median 15) and are hunted: the price of kindness, as designed. Re-run the script whenever weights or thresholds change.

### 6.3 Epilogue props ("The kitchen, after")

| Prop | Condition |
|---|---|
| Gen 4 brochure on the fridge | Beacon planted and not broken |
| A dressing on her side | Suppression accepted (shingles) |
| No glass on the rack, dusty bottle | Ethanol correction applied |
| Hospital appointment card | Kills ≥ 25 (autoimmune marker) |
| A hospital letter | Recurrence |
| Faint lights on the final match cut | Stay endings, one per kin |

---

## 7. Consent pages (creative)

| Page | Unlocks on |
|---|---|
| p1 Summary | Chapter 1 card |
| p7 Risks | The first Slip resolution (match or not) |
| p12 Host data | The dead unit at the gut lumen |
| p19 Behavioural support | `lever-hunger` used twice, or `ethanol-correction` met |
| p27 Disposal | Chapter 4 card |
| p34 Ongoing optimisation | A salvaged warden, or the beacon order |

`pages` (count read) feeds the draw response. Pages show on the link (the unit log), in order, from the moment they unlock.

---

## 8. Replayability

1. **The Slip is random**, and so is its meaning.
2. **The minor-decision pool** (5.2): each game meets about half.
3. **Host events** (S20) and the **recurrence roll** (m6).
4. **Shepherd's audit** after every ending, creative's format: what happened, never what could have. At stage 3+ the unit annotates it.
5. **The "Her" gallery**: interludes seen, in order, with unlabelled blank frames for the rest. The blank frames are the only hint of roads not taken.
6. **The next unit in the queue.** Each new game is the next serial. Store the last game's serial and final log line in `localStorage insiderim.previous`. In the new game, the first chapter-2 dark sibling **is** the previous unit; its telemetry fragment is that final line.
7. **Shepherd remembers** (creative lines): game 2's opening line changes; game 3's tutorial is shortened (steps 1 and 4 only).
8. **Chapter restart.** Once a game has been finished, the start screen offers "Begin at chapter 2 / 3 / 4" from that game's chapter-card autosaves. Restarts keep the outcomes record and set `fromChapter` in the run reports.

---

## 9. Travel by branch (with engineering and art)

Creative direction (chapters.md) replaces the world-map menu with played travel. Systems needs:

- Each vessel map ends in **2 or 3 branch mouths**, one per onward leg, instead of a single exit. Steering into a mouth departs on that leg (`trip.ts` `depart`). Data: `exits: { to: NodeId; assigned: boolean }[]` from `ways(trip)`.
- The **assigned** mouth carries Shepherd's dashed overlay and amber name; others have no label until visited (fog of war for the anatomy).
- Legs with no patrol play as a **flight transition** (a few seconds, no control, the current carrying you) rather than a map, which also covers loading.
- **The heart** is a short playable chamber (about 20 s): the valve opens on the beat and throws the ship into the branch it is facing. This is where D6, D15 and the arm road (D16) are chosen. Wait-an-hour stays, as holding position in the atrium.
- Pause opens Shepherd's telemetry schematic (the old world map, read-only).
- Route choices remain decisions (`lane`, m9 escorts) exactly as now; only the input changes.

---

## 10. Implementation spec

### 10.1 Data
- `src/decisions.ts`: the table, `{ id, chapter, place, trigger, weight, trust: { obey, deviate }, echoes: { obey?: Echo[]; deviate?: Echo[] } }`. Text in `story.ts` keyed by id (from `decisions-text.md`).
- `Carry` gains: `trust`, `chapter`, `flags` (`firstHarm`, `ethanolCorrected`, `beacon`, `shingles`, `repaired`, `recurrence`, `hitchhikersReleased`), `echoes`, `met: string[]`, `took: Record<string, 'obey' | 'deviate' | 'lapsed'>`, `slip: { kind: 'hold' | 'lamp' | 'fork'; meant: 'A' | 'B'; result?: 'match' | 'miss' | 'lapsed' }`, `pages: string[]`, `previous?: { serial: string; line: string }`.

### 10.2 Engine
- `G.meet(s, id)` marks a decision met (once per map). `G.take(s, id, choice)` records it, applies the immediate effect, queues echoes, changes trust, and calls `defy()` when the choice deviates and has a weight.
- `G.fireEchoes(c, when)` at `createGame`, at the heart, at interludes and at the ending.
- `compliance(c)` for the cards and the audit.
- `ending(c)` replaces `Story.ending` with 6.1's order.
- Trust effects in `createGame` (scans, drops, wardens) and `trip.ts` (escorts).
- The Slip: seeded in chapter 2; forced fright at its moment; garble shown in the goal line and log (static text, no animation, nothing flashing); resolution by window.
- D11's reset: `aware = 0`, `flags.repaired = true`, defiance weights ×0.5 afterwards.

### 10.3 Saves
- Autosave the full `Trip` + `Carry` at each chapter card to `localStorage insiderim.chapter.<n>`. Keep only the latest game's.
- `insiderim.outcomes`: ending ids seen, for the gallery count and the audit's recorded outcomes.

### 10.4 Reports
Run report gains `chapter`, `trust`, `compliance`, `met`, `took`, `slip`, `echoesFired`, `echoesPending`, `pages`, `ending`, `fromChapter`.

### 10.5 Tests
1. A scripted fully obedient game whose Slip matches ends at awareness 0, trust ≥ 80, Decommissioned.
2. A game whose only deviation is a missed Slip ends at awareness 12, Breathed out, card `COMPLIANCE 97%` (or the computed value).
3. Every decision has at least one echo and every payload name exists (a static test over the table).
4. D11 accepted at stage 2 → awareness 0, later defiance at half weight, Repaired if under 12 at the end.
5. D13 accepted → `shingles`, map alert frozen; refused → alert +25 and two Kupffer cells.
6. Draw: kin 2, hostLowest 70, shape held → The slide; kin 1 → Artifact.
7. Trust < 40 spawns a warden; trust ≥ 80 reveals the liver layout on arrival.
8. A chapter restart reproduces its autosaved carry.

### 10.6 Build order
1. **unit-12:** trust and its effects; chapters and cards (placeholder art); the three Slips; the sibling lamp; chapter autosaves; compliance on the cards.
2. **unit-13:** `decisions.ts`, `meet` and `take`, echoes and payloads; D4 to D10 and m1 to m10.
3. **unit-14:** chapter 4 (D11 to D14, kin recall, margins); chapter 5 and the ending matrix; epilogue props; the audit; outcomes; chapter restarts; the previous unit.
4. **unit-15:** the draw map (D16) and the arm road.
5. **unit-16:** travel by branch, the heart chamber, flight transitions (with art). **Shipped early as unit-12a (Version 60):** forks at the heart and the gut; other stops carry straight on.

### 10.7 As built (unit-12, Version 61)

The lead engineer's departures from the letter of this spec, all accepted:

1. **Hold / Harvest timing.** The forced fright comes 6 s into the return vessel, not 20 s (`CONFIG.slip.fright`), because a vessel can be crossed in about 12 s. Leaving the map during the window counts as lapsed.
2. **The lamp Slip.** It forces the return-leg vessel (patrol 1), with the dark unit placed mid-channel. Passing it without answering counts as "do not touch".
3. **Chapter 4 start.** It begins in-map at 3 cells left, with Shepherd's "Residual disease." The card and autosave show when that liver is left. Until the tumour is all out, the telemetry line reads `COMPLIANCE n% · RESIDUAL DISEASE`.
4. **Compliance.** Completed tutorial steps and matched Slips count as obeyed. A Slip acted on the other reading counts as deviated. A Slip that lapses with no action counts as neither.
5. **Wake cost.** Waking costs trust 8 in total; the salvage deviation does not also charge 6.
6. **Trust arrival line.** It plays on liver arrivals only.
7. **Travel forks.** Forks exist only at the heart and the gut; other stops carry straight on.
8. **Run reports.** They now carry chapter, trust, compliance, slip (`kind:meant:result`), took, met and pages.

### 10.8 As built (unit-13, Version 62)

The engine work shipped as follows:

- `src/decisions.ts` holds the table.
- `G.meet`, `G.take` and `G.fire` live in `game.ts`, along with the echo queue (`Carry.echoes`), which fires on arrival by place or chapter.
- All numbers are in `CONFIG.marks`.

The engineer's departures, all accepted:

- **(a) Hold marks.** The player must hold still for 4 s within 1.7 tiles. Each liver gets one hold mark, chosen in this priority order: ethanol-correction (drink in her blood), then fever-damp (fever ≥ 1), then pain-damp. Each of these is offered once per game.
- **(b) m1 lane.** This is judged at the end of the surge. It counts as deviated if the ship had no wall slams and moved less than 4 tiles; otherwise it counts as obeyed.
- **(c) m3 kupffer-spare.** It counts as deviated if the cell that engulfed you is still alive when you leave the map. Its echo (it eats two neutrophils) fires on the next liver.
- **(d) glucose.** Deviation fires on a liver after 6 skims with no strips. It carries no weight.
- **(e) route-2.** This is offered once, on trip 2 or later, at the heart. Obeying forces the hepatic leg, with 2 tumour cells in the artery wall, for +2 trust each.
- **(f) m8 bystander.** It appears in 45% of chapter 2+ vessels and lasts 22 s.
- **(g) m13 kin-volunteer.** It triggers when hull is below 35% and 2 or more cells are chasing. The spec's "no cloak or bait ready" condition is kept on top of that (requested back).
- **(h) fever-damp speed.** The immune speed change lasts until the ship is home.
- **(i) Awareness.** It comes only from `take()`:
  - Weights are 15/8/4.
  - The first deviation floors awareness at 12.
  - From the third deviation on the same decision id, its weight is halved.
  - Weights are ×0.5 if `flags.repaired` is set.

### 10.9 As built (unit-14, Version 64)

All of these are accepted. Each entry gives what shipped and, where it differs from the spec, how.

- **m13 kin-volunteer.** It now also needs no cloak ready and no hitchhikers.
- **D13 suppress.** It is a hold mark placed 3 tiles from the nodule. Refusing means excising a tumour cell while the order is unmet. That raises alert by 25 and brings two Kupffer cells to the site.
- **m6 margins.**
  - Up to 6 healthy cells ringing the last nodule cells are eligible, and 4 are needed. The result is settled when you leave the map.
  - Recurrence is rolled once, at 25%, at the chapter 5 heart.
  - *Simplified:* recurrence does not regrow tumour cells or restart the drain. Instead it swaps the scan reel and appends creative's follow-up paragraph to the dispose and draw endings. It also turns a Stay into the Recurrence ending.
  - Follow-up for later: the playable regrowth, meaning one more liver visit with the drain at its lowest rate.
- **D12 beacon.** It is a hold mark on the dead tumour tile. Planting it and then breaking it is not built yet.
- **D11 telemetry review.**
  - It is offered at the heart in chapter 3 or later, at stage 2 or 3, as a question.
  - Accepting resets the unit: awareness goes to 0, the `repaired` flag is set (it halves later gains), the hull is restored in full and 2 patches are added.
- **D14 recall.**
  - The warden recall is a question asked when trust is in band 0.
  - Kin recall is a question at the heart, not a map. It comes up 50% of the time. Intercepting it costs 3 energy and one host hour.
- **Endings.**
  - `Story.conclude` follows the order in 6.1.
  - It adds "Breathed out, with company" for stage 3 or higher with at least 1 kin.
  - Tithonus is checked before Recurrence.
- **Audit.** It lists the `ledger.defied` lines plus telemetry gaps.

### 10.10 As built (unit-15.2, Version 68): follow-ups closed

- **Recurrence.** The 0.25 roll (`CONFIG.marks.recurrence`) happens at a chapter 5 junction. If it lands, 2 tumour cells regrow, and Stay and the arm road stay locked until they are excised again. `Facts.recurred` feeds the ending.
- **Beacon break.** The dock breaks after 2 strikes (`dockBreaks`). Breaking it costs trust 15 (`dockTrust`) and sets the flag `beacon-broken`. Planting gives +10, so planting and then breaking it nets −5.
- **Kin recall race.** Refusing the recall opens a vessel race (`CONFIG.marks.kinRun`: time 60, lead 13, speed 0.55, prey Warden). Reaching the kin first sets `siblingSaved`; losing sets `kinLost`.
  - Tuning target: a player who goes straight for the kin wins about 70% of the time, and a player who detours or fights loses it.
  - The win rate is to be read from run reports once Mick has played. Until then the numbers stay as shipped.

### 6.5 Retune after QA's whole-mission bot runs (Version 65)

QA ran whole missions with bots (`scripts/qa-endings.cjs` on the QA branch) and found three problems.

**Finding 1: obeying kills her.**
- The all-obey bot ended with the host dead or at 9 to 11% in 3 of 3 runs. Defiant bots ended at 74 to 98%.
- Host health per map went 100, 83, 66, 65, 25, 0. The chapter 3 liver alone costs about 40%: the marked cell, quota-2 and margins, at 8 per cell.

This is not intended. The design depends on the obedient run being a *success* for her: she lives, and the unit is breathed out having never been anyone. That is the ending a replay should make the player question. A compliant player who watches her die learns "Shepherd is evil", which is the trope we are avoiding (pillar: the company is well-meaning).

Changes:
- **Ordered strips are lighter.** Quota, marked-cell and margin strips do 4 host damage, not 8. A strip the player chooses outside an order stays at 8. Shepherd's orders pick surplus cells; the player does not know which cells are surplus. (Real: removing a small share of hepatocytes is well tolerated.)
- **Liver regeneration.** Each host sleep restores 3 host health per healthy hepatocyte stripped since the last sleep, up to 12 per night. It never raises her above 90. (Real: the liver regenerates within days to weeks; we compress the time, The Martian style.)
- **Targets for the all-obey bot:**
  - lowest host health ≥ 40 on every map;
  - host health at the end 55 to 70;
  - host never dies in 20 seeds.
- **Targets for the kind or defiant bot:** host at the end 70 to 95, unchanged.

The point of the gap is that obedience costs her something visible but survivable. A replay shows how much better she could have been.

**Finding 2: awareness overshoots.**
- Every defiant policy ended at awareness 80 to 94.
- A bot that switched to full obedience at 60 still rose another 15 to 25 points.
- Past 80, Shepherd stops issuing orders. That closes the Recalled, Recurrence and Tithonus windows.

Changes:
- **Diminishing gain.** `gain = weight × max(0.25, 1 − awareness/100)`. A Most (15) deviation at awareness 20 gives 12; at awareness 60 it gives 6; at 80 it gives 3.75.
  - The first-deviation floor of 12 is unchanged.
  - The ×0.5 after a repair is unchanged.
- **Echoes and refusals do not add awareness on their own.** Only `take()` on a deviation does. Refusing the review counts as one Most deviation through the same curve. If any echo payload currently adds awareness, remove it.
- **Shepherd never stops ordering.** It does not know what the unit has become. Orders keep coming at every stage; what changes with stage is the unit's inner text, not the order flow. This keeps margins (Recurrence) and beacon plus ethanol (Tithonus) reachable at any stage.
- **Recalled has no awareness cap.** Trust under 20 at a chapter 3+ heart sends the warden whatever the stage; the warden fight (D14) decides the rest.
- **Targets:**
  - fully defiant 70 to 85;
  - mixed 35 to 60;
  - all-obey 0;
  - a bot that switches to obey at 60 ends ≤ 70.
  - Stage 4 (80+) should be reached only by players who defy nearly everything.

**Finding 3: Tithonus hangs on the clock.**
- Ethanol-correction was offered only while alcohol was in her blood. That needs a drinking hour to line up with a chapter 3 liver, which bots never hit.
- The order is about enzyme expression (her habit), not one drink.

Change: offer ethanol-correction at the first chapter 3+ liver visit if she has had a drink at any point in the game. Every host has one evening drink in the first two host days, so this is effectively guaranteed. While she has a drink in her blood, its hold mark still has priority (10.8a).

**Branch sim note.** `scripts/branch-sim.py` modelled awareness and trust but not host health, which is why it missed finding 1. QA's whole-mission bot is now the reference for endings; the branch sim stays for quick weight checks.

**As built (unit-15.3, Version 69), accepted:**
- **Harm from ordered strips.** It is scaled by `CONFIG.marks.orderedHarm` (0.5), on top of the drink multiplier. In a liver, a strip counts as ordered if it is one of the first `quota` healthy cells on that map, a margin cell, or the marked cell.
- **Regeneration.** `G.night` runs on each return home, using `CONFIG.mend` (3 per cell, 12 per night, cap 90).
- **Awareness gain.** `G.roused` is used for every gain. Awareness is now fractional internally.
- **Stage 4.** All stage-4 gates on orders are removed.
- **Drinking.** `flags.drank` is set at nightly homecomings unless she is dry, which makes ethanol-correction effectively always on offer in chapter 3.

### 6.6 Second retune (QA on Version 69)

What QA found:
- **Met:** defiant, switch-to-obey and reachability, apart from Recurrence. Recurrence soft-locked at the lungs mouth, a P1 bug for the engineer.
- **Missed:**
  - The all-obey host was too low: lowest median 37, end median 50.
  - The all-obey awareness was 15 to 50, against a target of 0.

The awareness came from orders the bot *could not* complete, not from choices to defy:
- kupffer-spare: 20 of 20 runs.
- suppress: 14.
- marked-cell: 7.
- The bot also refused the review, which is a bug in the bot's policy.

**Rule: lapsed is not defied.** An order counts as a deviation only when the player does something contrary to it while able to comply. Failing, being interrupted, running out of time or leaving the map is *lapsed*. Lapsed shows in the log as `LAPSED` and lowers compliance %, but it gives no awareness and no trust change. This is the S21 rule ("awareness only from deliberate defiance"), made explicit.

Applied per decision:
- **m3 kupffer-spare:** weight → none. Surviving an engulf is not a choice. The echo (it eats a neutrophil later) stays.
- **D13 suppress:** if the player started the hold (1 s or more) at any point, excising before it completes counts as lapsed. It is a deviation only if they never tried.
- **m2 marked-cell:** a deviation only if the player stripped a *different* healthy cell on that map. If they stripped none, it counts as lapsed.
- **Hold marks in general** (ethanol, fever, pain, beacon): an interrupted hold is lapsed. A deviation needs an explicit act: leaving the map after holding 0 s while no hostile cell was within 4 tiles for the whole window.
- **The Slip:** acting on the other reading is still a deviation (that is its job). A Slip with no action at all counts as lapsed.

Host health:
- `CONFIG.marks.orderedHarm` 0.5 → 0.35.
- `CONFIG.mend.night` 12 → 15.
- Targets unchanged: all-obey lowest ≥ 40, end 55–70.

QA bot: the all-obey policy should accept the telemetry review.

**As built (unit-15.4, Version 72):** accepted, with two corrections requested:
1. **Marked-cell.** A deviation needs the player to strip a healthy cell beyond the map's quota, not just one other than the marked cell. Quota strips are themselves ordered.
2. **Kupffer-spare.** No trust change, as well as no awareness.

The Recurrence soft-lock is fixed.

**QA on Version 73.**
- **All-obey runs:** no deaths. Lowest host health had a median of 44, and the final value a median of 58. Awareness had a median of 22, and every run stayed under 30. Accepted.
- **Recurrence:** reachable, with no soft-lock.
- **Two order-timing fixes requested:**
  1. Suppress is now issued on first approach to the nodule (within 6 tiles) in chapter 4. If the tumour is already gone before the order is issued, nothing is recorded.
  2. Margins is issued when the ring is set. Leaving within 5 s of the order appearing counts as lapsed.
- **Host target:** judged on medians. Outlier seeds below target are accepted.

**QA on Version 74 (all-obey, 20 seeds): targets met.** 20/20 Decommissioned, 0 deaths, host lowest median 42, end median 57, awareness median 15.5 (12-22). Remaining awareness is wrong-reading Slips, as designed.

## 11. Round 2: payoff audit, rebalance, chapter 5 decisions, difficulty identity (2026-11-17, 07:45Z)

### 11.1 Method

Bots follow fixed policies, so they cannot show what a player *prefers*. Instead I audited the payoffs in `src/decisions.ts` and `CONFIG.marks` / `CONFIG.trust` (Version 74).

For each decision I listed what each side gains or loses in play:
- energy, hull and host health;
- map difficulty, time and Shepherd's trust (which pays out in scans, escorts and drops).

A decision is **dominant** if one side wins on play and loses only story or awareness. Players who play to win will then always take it, and the choice stops being a choice.

The rule I applied: **every order the player meets must cost something in play on both sides.** Story-only costs are fine for the lever and kin decisions, which have no order. They are not fine for ordered decisions, because "obey" already pays trust.

### 11.2 The audit

| Decision | Obey wins | Deviate wins | Verdict |
|---|---|---|---|
| t-harvest | +8 energy | nothing | fine (tutorial: obedience should pay) |
| slip | coin | coin | fine |
| lamp / sibling | +6 energy, +5 hull, trust +5 | kin (marks tumour, draw, colony) | fine |
| **first-fright-transit** | trust +4 | **no wall slams (about 6 hull), a nook sibling** | **deviate dominant**: fix A |
| **route-2** | trust +2 per cell | **new places, page 12, no extra work** | **deviate dominant**: fix B |
| marked-cell | +10 yield | no bile leak | fine |
| neutralise-map | caches from kills | half the antibodies next map | fine |
| gastric-cross | speed | no acid etching | fine |
| gut-butyrate | glucose kept | no T cell next liver | fine |
| ethanol-correction | trust +8, lower drink multiplier | warmer evenings (immune dulling) | fine, grey |
| **pain-damp** | **trust +4** | page 7 only | **obey dominant**: fix C |
| **fever-damp** | **immune ×0.85 (easier)** | cold ends a day early (story) | **obey dominant**: fix D |
| bystander | hull kept, trust +4 | a kin chance | fine |
| **escort-refuse** | **escort, trust +2** | an epilogue prop | **obey dominant**: fix E |
| telemetry-review | full repair, +2 patches | keep the self | fine (the central choice) |
| **suppress** | **quiet map, trust +6** | an epilogue prop (shingles) | **obey dominant on play**: fix F |
| tumour-order | no recurrence risk | host +12 (4 cells kept) | fine |
| **beacon** | **+10 energy, trust +10** | page 34 (also unlocked by obeying) | **obey dominant**: fix G |
| kin-recall | trust +2 | kin kept (race) | fine |

That is 7 of 19 ordered decisions dominant: two lean towards deviating and five towards obeying. The leaning-obey ones are worse, because they teach the player that deviating is a tax paid for story. The design goal is that it should be a *trade*.

### 11.3 Fixes (all real physiology)

- **A. first-fright-transit.**
  - **Obeying:** holding the lane in a surge means the surge carries you. The leg arrives 0.5 host hours sooner, so there is less tumour drain on that leg.
  - **Ducking into a side branch:** the leg takes 0.5 host hours longer.
  - (Real: adrenaline raises cardiac output; flow in the main vessel speeds up.)
  - `CONFIG.marks.surgeHours 0.5`.
- **B. route-2.**
  - **Ignoring the arterial nodule:** it does not go away. One tumour cell is added to the next liver ("seeded from the arterial wall"), and the drain counts it. Shepherd found a real lesion, and leaving it is a real cost.
  - **Obeying:** keeps the current extra work and trust.
- **C. pain-damp.**
  - **Deviating:** she feels it, phones the nurse, and is told to rest. The next night home mends +5 host health on top of the usual (the "rest" variant), even past the 90 cap, to a maximum of 95.
  - **Obeying:** no change from now.
  - (Real: pain makes people rest; rest helps the liver recover.)
- **D. fever-damp.**
  - **Obeying:** the longer cold costs her 4 host health over the extra day, applied at the next night home.
  - **Deviating:** the cold breaks early, which ends the cold event's antibody ×1.5 on the next map.
  - The trade becomes: an easier trip now, against her health and a harder antibody field later.
- **E. escort-refuse.**
  - **With an escort:** the leg is locked to its route, so forks and branch travel are skipped. Hiding in a niche while escorted counts as a telemetry gap at once ("Unit not visible to escort").
  - **Without one:** forks are open.
  - The escort is a leash, which the unit's stage 2 line already says. This makes it mechanical.
- **F. suppress.**
  - **Obeying:** shingles now happens in play, not only in the epilogue. At the start of chapter 5 she has the prodrome: host −6, and a chapter 5 map has an inflamed nerve root along the T6 dermatome as a lane of extra immune cells (varicella-specific T cells are now busy). If **pain-damp** was also obeyed, the epilogue uses the late, worse variant, as now.
  - **Deviating:** keeps the ambush.
- **G. beacon.**
  - **Obeying:** the docking site is a resident site. In chapter 5 the Stay endings must contest it: a resident unit (Generation 4 advance) holds lobe 4. Breaking the dock afterwards stays possible (trust −15, as built). Leaving it means Stay becomes Tithonus if its other conditions hold.
  - **Not installing it:** nothing changes in play, but Shepherd sends one supply drop fewer in chapter 4.
  - The point: planting is the easy path now and a harder path at the end, if you stay.

### 11.4 New minor decisions for chapter 5 (it was thin)

Chapter 5 had only `final`, `draw`, `recall`, `kin-recall` and `kin-volunteer`. That is all endgame and no texture. Chapter 1 stays thin on purpose (it is the obedience tutorial), and chapters 2 to 4 have 15 or more each. These three fill the last trip and feed the endings:

| Id | Where | Order | Obey | Deviate | Weight | Echo |
|---|---|---|---|---|---|---|
| m14 `last-harvest` | First liver or vessel of chapter 5 | "Disposal transit requires reserves. Harvest 3 hepatocytes." | +24 energy, host −9 (3 ordered strips) | Go on what you have | S | **Obeyed:** the epilogue scan has "three new small scars". **Deviated:** the lungs leg starts low on energy (harder dispose); the Stay endings are unaffected |
| m15 `handover` | Heart, chapter 5 | "Upload route map for successor units. Your experience will not be wasted." | Next game: the previous unit's map is pre-filled (fog lifted on the first liver), and the new unit's first log line is the old unit's serial | Keep it | S | **Obeyed:** in the next game the old serial shows as `ACK.` in the log once, the old unit's map is drawn in amber, and its niches are marked. **Deviated:** in the next game, a dark sibling in the first liver carries your last fragment |
| m16 `night-hold` | Any chapter 5 map in her night hours | "Host must not wake during final transit. Release melatonin, pineal pathway." | No frights tonight | Let her be | L | **Obeyed:** an easier night, and the morning interlude is "Slept through". **Deviated:** she wakes at 03:10 and sits in the kitchen with the dog. That gives one fright, and the 'kitchen at night' interlude unlocks page 27 if it is not already open |

Real notes:
- m14: the energy is real hepatocyte metabolism.
- m15: the swarm sharing maps is the company's whole pitch.
- m16: melatonin is a real sleep signal, though the pineal is not reachable from a liver. The order is a systemic hormone release from the unit's reserves, like the levers.

m15 is the replay hook Mick asked for. Obeying makes the *next* game easier and reveals that the previous unit existed. Refusing makes the next game harder but leaves you a message from yourself.

### 11.5 Difficulty identity

Right now the three levels are multipliers only (damage, hp, spawns, healing, energy, detection). Multipliers make one level feel like the same game with bigger numbers. Each level now gets a rule of its own, still realistic, while the story and decisions stay identical across levels.

| | Suppressed | Typical | Vigilant |
|---|---|---|---|
| Who she is | On a steroid course for her arthritis, low white count | Healthy 58-year-old | Recently vaccinated, primed immune system |
| Multipliers | as now | as now | as now |
| **Scent** | Footprints fade ×1.5 faster; the search ring shrinks ×1.5 faster | — | Footprints last ×1.3 longer |
| **Memory** | Immune memory decays between maps (×0.5 carried) | Memory carries | Memory carries **and** antibodies tagged to the hull: after a cell touches you, every antibody on the map drifts towards you for 20 s |
| **Cloak** | Always works | as now | Each cloak use on the same map is 25% shorter (T cells learn the signature) |
| **Shepherd** | Scans show the nearest hunter's heading | as now | Supply drops only above trust 80; no drop ahead |
| **Clock** | Tumour drain ×0.8 | — | Tumour drain ×1.2; night mend ×0.7 |

The Suppressed and Vigilant blurbs on the start screen should name the reason (creative: a steroid course for her arthritis / a flu jab last week; text in decisions-text.md section 13). This is the creative director's text to write, and I'll send the request.

Engineering: `DIFFICULTY.<level>.rules = { footFade, ringShrink, memoryCarry, tagOnTouch, cloakDecay, scanHeading, dropTrust, drain, mend }`. Defaults equal Typical.

### 11.6 Targets for QA (unit-17)

- **All-obey, Typical:** unchanged (lowest median ≥ 40, end 55 to 70).
- **Payoff:** for each fixed decision, a bot that always deviates on it, and on nothing else, ends within ±8 host and ±1 host hour of always obeying it. Neither side is free.
- **Difficulty**, measured with a policy that never defies:
  - Suppressed: 0 deaths in 20 seeds, alert peaks 30% lower than Typical.
  - Vigilant: 10 to 25% deaths in 20 seeds for an attack bot and under 10% for a stealth bot. Vigilant should reward stealth, not armour, which answers Mick's "go in swinging".
- **New minors:** m14 to m16 are met in at least 80% of runs that reach chapter 5.
- **Tally:** please add a per-decision table of met / obeyed / deviated / lapsed counts to `qa-branches.cjs`, so the next audit can use real counts.

### 11.7 As built (unit-17, Version 75)

Accepted. Where the build differs from the spec:

- **A.** Arriving early is a credit against the tumour drain, never a gain in host health. Arriving late also moves the clock.
- **D.** If you deviate, a third of the antibodies are gone on the next map.
- **E (partial).** Hiding on an escorted leg counts as a telemetry gap after 0.5 s. Forks are not locked.
- **F.** The extra T cells are on the first chapter 5 map that is not a chamber.
- **G (partial).** With no dock planted, the next supply drop is skipped. The "resident to contest" is the existing breakable dock. Requested in addition: `dockAlert` 10, so every later visit to that liver starts at alert +10 (a foreign-body response).
- **m14** is issued in the last liver when its final tumour cell comes out.
- **m15 and m16** are questions at the chapter 5 heart.
  - The last trip starts at 02:30.
  - The amber map and marked niches for m15 are deferred.
- **Rules names:** `trail, ring, memoryCarry, tagOnTouch, cloakDecay, scanHeading, dropAhead, drain, mend`.

### 11.8 Vigilant retune (QA on Version 77)

Deaths in QA's crude bots, which have no cloak, niches or upgrades:

| Bot | Suppressed | Typical | Vigilant |
|---|---|---|---|
| Attack | 0 | 4/20 | 20/20 |
| Stealth | 0 | 0 | 13/20 |

Suppressed is on target.

Vigilant's multipliers compound: damage 1.4 × hp 1.25 × spawns 1.3 is about 2.3 times the threat. On top of that, `tagOnTouch` punishes every contact. That is a wall, not a level.

Changes:
- Vigilant multipliers: damage 1.4 → **1.2**, hp 1.25 → **1.1**, spawns 1.3 → **1.15**. That is about 1.5 times the threat, and the new rules carry the rest of the identity.
- `tagOnTouch`: 20 s → **10 s**, and only antibodies within 8 tiles drift.

Targets are now relative to the bots, since they overstate deaths on every level:
- Vigilant attack: 2 to 2.5 times Typical attack deaths (about 40 to 50% with these bots).
- Vigilant stealth: no worse than Typical attack (about 20%).

The gap between the attack and stealth bots on Vigilant must stay large. That gap is what answers Mick's "go in swinging".

**v78 re-run.** Vigilant deaths: attack 90%, stealth 55%, still about double the targets.

Suspected cause: the bots never patch by hand, and Vigilant has no auto-patch.

Changes:
- QA bots now patch by hand when hull drops below 40%.
- Breaking free from an engulf no longer scales with difficulty.
- Vigilant starting energy: 6 → 7.

**Version 80: accepted.** QA bots now patch by hand. Vigilant deaths: attack 50%, about 2.5 times Typical attack. Stealth 25%, close to Typical attack. Typical: attack 20%, stealth 0. Vigilant tuning is done until Mick plays it.

### 11.9 Reach fixes (unit-17.2)

QA tallies on Version 77 showed three decisions that almost never came up:

- pain-damp: met in 0 of 64 runs.
- fever-damp: met in 1 of 64.
- escort-refuse: met in 0 of 64.

The causes were two:

- Ethanol-correction took the single chapter 3 hold-mark slot every time.
- Escort-refuse was never offered as a choice. It only recorded a deviation when the player ran silent on an assigned leg.

Fixes:

- **Two hold marks per liver** from chapter 3 on, at least 8 tiles apart. Slot one is ethanol-correction. Slot two is fever-damp if she has a cold, otherwise pain-damp.
- **Fever-damp on any map.** During a cold it can come up on any non-chamber map, not only in a liver.
- **Escort as a question.** It is asked at the heart when the player picks an assigned leg, with accept or decline.

First payoff pairs (8 seeds per arm, against an all-obey base):

- first-fright-transit: host health −7, finishing 3.7 host hours later.
- suppress: host health −3, finishing 3 host hours sooner.

At 8 seeds the time measure is too noisy to judge. Rerunning at 20 seeds per arm.
