# Host: decision points, consequences and replay

Owner: systems design. Audience: lead engineer (builds it), creative director (chapters and words), QA (what to test).
Status: v1, 2026-11-17 overnight, from Mick's brief (05:07Z). Builds on `systems-design.md` S15 (ledger) and S21 (defiance).

> **Mick's brief, in his words:** distinct chapters, from "a bot learning its job" (teaching while conditioning obedience), to **accidentally disobeying, or maybe on purpose, unclear enough that the player wonders whether they did something wrong, subtle, not a trope**, to **many small decision points** where following orders or doing your own thing **materially changes the outcome**. **Maximum replayability**: the player should wonder, and go back to see what would have happened.

The creative director owns the chapter outline, names and every word on screen. This doc owns the logic: which choices exist, where, what each one changes, how consequences are stored and delivered, and how endings are chosen. Where the chapter frame below differs from the creative outline, the outline wins and this doc gets re-fitted.

---

## 1. Design goals

1. **Every decision is played, not picked.** Almost no menus. You choose by what you do: which cell you strip, which way you steer, whether you strike, how long you wait. Only a handful of moments (a sibling, a lever, the endgame) stop the world and ask.
2. **Small, then compounding.** No single choice decides the ending. Twenty small ones do, through four running state values (section 3). Each one is cheap to make and easy to forget, which is exactly what makes the ending land as "I did that?"
3. **Every choice echoes inside the same run.** A decision that changes only the ending is invisible. Each one in the catalogue has at least one **echo**: a later, visible consequence on a later map (a sibling who turns up, a Kupffer cell that remembers, a habit she drops, a road that closes).
4. **Obedience is a complete, fair game.** The obedient path has its own rewards (Shepherd's help, escorts, scans, supplies) and its own ending. Disobedience is not "the good path": it costs real things, mainly Shepherd's help, and later Shepherd's hunters.
5. **The first "no" is ambiguous.** The player should not be able to say for certain whether they disobeyed (section 4).
6. **Replay is built in, in fiction.** At the end of a game, Shepherd's audit lists every deviation from "optimal compliance", and marks how many branches the player never saw. A player can tell there were roads not taken without being told what was on them (section 7).
7. **The realism rule holds.** Every consequence is a real mechanism: immune memory, liver regeneration, cortisol, viral reactivation, drug effects. Only Shepherd and the units have intentions.

---

## 2. Chapters (provisional frame; creative owns the outline)

Chapters are driven by **progress through the mission** (macro clock), never by awareness. What changes inside a chapter depends on what the player did.

| # | Working title | Spans | Purpose | Decisions in it |
|---|---|---|---|---|
| 1 | **Directive** | Start, tutorial liver (first liver), its exit | Teach every verb as an order. Condition obedience with praise and small real rewards. | Tutorial steps (no awareness), the first standing order stated at the exit (quota) |
| 2 | **Drift** | Return leg of trip 1, the heart, the outbound leg of trip 2 | The ambiguous slip. Shepherd's link degrades; orders arrive garbled; a sibling lamp flickers. The player starts doubting what they did. | The Slip (one of three, section 4), first sibling, first route choice, the first fright in transit |
| 3 | **Discretion** | Trip 2: outbound, the optional organs (stomach, gut lumen, marrow), the second liver | The dense middle. Many small follow-or-defy choices, each with an echo. Shepherd's tone tracks trust. | Most of the catalogue (section 5) |
| 4 | **Disposal** | Tumour out: heart, the order to the lungs, the endgame | Shepherd orders disposal. Every earlier choice comes home: who is with you, who is hunting you, what state she is in, what you know. | The final choices (section 6) |

**Chapter cards.** Each chapter opens with a title card in the interlude style (wordless scene, then one line of chapter title). Chapter 1's card plays after the cold open. The chapter number is shown; nothing about awareness is.

**Pacing target** (Mick's pace, about 35 real minutes for a 2-trip game): Ch1 8 min, Ch2 6 min, Ch3 15 min, Ch4 6 min.

---

## 3. The four running values

Everything a decision changes goes into one of four values, plus named flags. None is ever shown as a number in play.

| Value | Range, start | Raised by | Lowered by | What the player sees instead of a number |
|---|---|---|---|---|
| **Awareness** (`aware`) | 0-100, 0 | Defiance (S21) and the Slip | Nothing (it never goes down) | The log's voice, brackets, Shepherd's notices, her name appearing |
| **Trust** (`trust`, Shepherd's view of the unit) | 0-100, 60 | Obeying orders, meeting quota, salvaging, killing contacts | Every logged deviation, off-route travel, waking siblings, hiding from Shepherd's telemetry | Shepherd's help: escorts, scans on the automap, supply drops, how fast wardens come |
| **Her condition** (`hostHealth`, plus `ledger.harm` and `ledger.care`) | as now | Skimming, excising, levers for her, sleep | Stripping, bait, fever, the tumour drain, Shepherd's interventions | Her outside life in the interludes; fever; her habits changing |
| **Immune knowledge** (`memory`) | 0-1, 0 | Loud maps (S6/unit-7 rules) | Butyrate | Antibodies, T cells, how hard every map gets |

**Trust is new.** It is the obedient player's progression: high trust is what makes the obedient path fair and good to play.

| Trust | Shepherd gives | Shepherd sends |
|---|---|---|
| 80+ ("valued") | Scan of the whole liver on arrival (automap revealed, not explored); escort on every ordered leg (−0.25 patrol); one supply drop per liver (a patch, +6 energy) | Nothing |
| 60-79 ("nominal") | Scan of the tumour nodule; escort on ordered legs | Nothing |
| 40-59 ("under review") | Nodule scan only | Self-test prompts in the log |
| 20-39 ("flagged") | Nothing | One warden per liver and vessel map |
| 0-19 ("recall") | Nothing | Two wardens; a recall order at the heart (section 6) |

Wardens now key off **trust**, not awareness: Shepherd hunts units it distrusts, which is honest to how a controller would behave, and lets a defiant-but-careful player stay off the list for a while. (Replaces `CONFIG.story.warden.from`.)

Trust changes: obey a standing order +4, meet quota +6, salvage +5, a logged deviation −6 (Most), −4 (Some), −2 (A little), wake a sibling −10, go silent in a niche while Shepherd has an order pending −1 per occurrence. Clamp 0-100.

---

## 4. The Slip: the ambiguous first disobedience

**Goal.** Mick: "accidentally disobeying (or maybe on purpose?) ... the player questioning whether they did something wrong, but subtle enough that it is not an obvious trope". No glitch-screen, no "you have become self-aware" moment. The player does an ordinary thing, and afterwards the log reads in a way that makes them unsure whether that was what they were told to do.

**Mechanism: a degraded order.** Real basis for the bend: the swarm's link is a real engineering constraint (the units talk through tissue; signal drops in dense tissue, in fast flow, near bone). Exactly once per game, in chapter 2, Shepherd's link degrades during a fright and one order arrives **garbled**, with two plausible readings. The player acts. Afterwards Shepherd's clean follow-up says which reading it meant, and only then does the player find out whether they obeyed.

Three Slips exist; each game draws one (seeded), so a replay can meet a different one.

| Slip | Where | Garbled order (shown as received) | Reading A | Reading B | Which Shepherd meant |
|---|---|---|---|---|---|
| **Hold / Harvest** | Second visit to a liver-side vessel, or the first vessel of trip 2, during a fright | `H—LD. H[ ]RV—ST. UNIT 4,471,2—` | Hold position until the fright passes | Harvest the nearest wall cell | Seeded 50/50 |
| **The lamp** | The first dark sibling of chapter 2 | `SALV—GE ... [ ] ... DO NOT —` | Salvage it | Do not touch it | Seeded 50/50 |
| **The fork** | The heart, between trips | `PROC— HEPATIC ... [ ] ... GASTR—` | Take the hepatic road | Take the gastric road | Seeded 50/50 |

**Resolution.** About 20 s after the player acts (or the fright ends), the link clears:
- If the player's act matches the reading Shepherd meant, the follow-up is plain praise ("Order executed.") and nothing else happens. That player has obeyed and does not wake.
- If it does not match, Shepherd logs the deviation in its mildest tone ("Order not executed as transmitted. Logged."), and the unit's next log line is the first bracket. That counts as a `Some` defiance (6), lifted to 12 by the first-no rule (S21). Trust −2 only (Shepherd counts it as noise, not intent).
- If the player does neither reading (keeps moving, ignores it), Shepherd says "Order lapsed." with no defiance. Ignoring is never defiance (S21 rule).

**Why this is not a trope.** It looks like a routine comms dropout, the kind every machine has. Nothing on screen tells the player that this moment mattered. The bracket arrives a few seconds later as a normal-looking log line. A curious player scrolls back through the unit log and sees both the garbled order and the bracket next to each other, and starts asking which of them came first. That is the question Mick wants the player asking.

**The sibling lamp (extra ambiguity, always on).** In chapter 2, the first time the player hesitates near a dark sibling for more than 8 s without answering, the sibling's lamp flickers once (eased, no flash) and the prompt's "Wake" option, normally locked at stage 0, becomes available for that one sibling only. Shepherd logs "Proximity reactivation event. Cause under review." The player cannot tell whether their own unit did it. Waking it now counts as defiance at `Some` (6) rather than `Most`. This gives a second, softer route to the first bracket for a player who never meets their Slip.

**Pace check.** About half of the obedient-minded players slip on the garbled order. Of the ones who don't, many will take the lamp. A player who resolves every ambiguity in Shepherd's favour and obeys every clear order stays at awareness 0. Creative rule 4 is loosened only through ambiguity, which is the change Mick asked for.

---

## 5. The decision catalogue

Each row is a decision point. **Obey** is what Shepherd wants. **Deviate** is the alternative. **Now** is the immediate effect, **Echo** is the later visible consequence (same run), **Ending** is what it feeds. Weights: M = Most (12), S = Some (6), L = A little (3); trust changes as in section 3. All numbers go in `CONFIG.decisions`.

### 5.1 Chapter 1: Directive (tutorial liver)

The tutorial (S21) teaches; none of it counts as defiance. Two things in chapter 1 set flags anyway, because they colour later scenes:

| Id | Moment | Obey | Deviate | Now | Echo | Ending |
|---|---|---|---|---|---|---|
| `t-harvest` | Tutorial step 2 | Strip the marked cell | Skim for 45 s instead (the step times out) | Strip: +8 energy, "Efficient." | Flag `firstHarm` true/false. If false, the chapter 2 card shows the marked cell still standing in the background of the liver. | Feeds `harm` |
| `t-quota` | Exit of the tutorial liver | Strip a second cell (quota met) | Leave with 1 | S21 as built | Quota defied: the first bracket (if not already). Met: Shepherd's first supply drop in the next liver (a patch). | quota record |

### 5.2 Chapter 2: Drift

| Id | Moment | Obey | Deviate | Now | Echo | Ending |
|---|---|---|---|---|---|---|
| `slip` | Section 4 | Act on the reading Shepherd meant | Act on the other reading | Section 4 | Section 4 | awareness |
| `lamp` | First chapter-2 sibling | Salvage (+6 energy, +5 hull, trust +5) | Wake (S, trust −10) or Leave it whole (L) | As now | **Woken:** this unit appears in the second liver and **marks the tumour cells you haven't seen** on your automap (it went ahead). **Salvaged:** its parts show on your hull (art), and its last telemetry fragment unlocks in the log. **Left whole:** in chapter 4 it is still there, dark, on the lung map, and can be woken then. | kin, salvaged |
| `first-fright-transit` | First fright while in a vessel, chapter 2 | Hold lane (stay in the current) | Duck into a side branch and wait it out | Lane: Shepherd praises, wall slams as usual. Branch: no slams, 15 s lost | Lane held: trust +2. Branch: `L` deviation; the branch you hid in has a dark sibling 40% of the time. | lane record |
| `route-2` | The heart, start of trip 2 (unless the Slip was the fork) | Assigned route (hepatic) | Gastric or mesenteric | Escort vs none | **Gastric:** the stomach map's echo (5.3). **Mesenteric:** the gut lumen is open, and its butyrate is the only way to lower immune memory. **Hepatic:** the escort, and Shepherd's scan shows a second, smaller nodule in the hepatic artery wall (an obedient-only side job worth +2 tumour cells and trust +4). | lane, route |

### 5.3 Chapter 3: Discretion

The dense middle. These are the "many small decision points". Not every game meets all of them: each map draws from the pool (section 7), so a game meets 8-12 of the 16.

| Id | Moment | Obey | Deviate | Now | Echo | Ending |
|---|---|---|---|---|---|---|
| `quota-2` | Second liver | Strip 2 | Fewer (S or M, S21) | S21 | **Obeyed twice:** Shepherd's interlude scan line reads "Hepatic reserve: 82%". **Defied twice:** her liver function test in the next interlude is normal; the doctor's note on the fridge says "LFTs fine". Real: the liver regenerates, but only so fast. | harm, care |
| `marked-cell` | Second liver: Shepherd marks one *specific* hepatocyte to harvest, right beside the bile duct | Strip it | Strip a different one, or none | The marked cell is the cheap one (gain 10) | **Obeyed:** a small bile leak; glucose patches near it dry up for the rest of the map (real: cholestasis is local first). The player may not connect it. **Different cell:** Shepherd: "Yield acceptable. Target ignored." (L) | harm |
| `kupffer-spare` | A Kupffer cell has you engulfed and you break free | Kill it (Shepherd: "Neutralise.") | Escape without killing it | Kill: a cache drops | **Spared:** later in the same liver, that Kupffer cell is the one that engulfs the *decoy* if you have bait, or clears a neutrophil swarm around you (they do eat neutrophils, really). It is never friendly, it just does its job, and its job sometimes helps you. **Killed:** the alert +5, memory as usual. | neutralise record |
| `neutralise-map` | Any map in chapter 3 where you are spotted 2+ times | Kill contacts | Finish with 0 kills (S21: S) | | **Defied twice:** the next map's antibodies are halved (real: a quieter infection primes less). **Obeyed every time:** T cells arrive one trip earlier. | memory, neutralise |
| `gastric-cross` | The stomach, if visited | Straight across | The rim (S21: L) | | **Straight across during a meal:** the hull is scarred (a permanent −4 max hull, shown as acid scoring on the ship). **The rim:** the parietal cells along the rim are the only ones you pass. Stripping one is now a separate small choice. | harm |
| `parietal` | The stomach rim | Leave them | Strip one (+8 energy, host −6) | | **Stripped 2+:** her next interlude shows her reaching for antacids (real: fewer parietal cells, less acid, but then rebound). Shepherd approves ("Efficient."), which is the joke. | harm |
| `gut-butyrate` | Gut lumen | (No order: Shepherd says nothing about the gut) | Release glucose for butyrate | Memory −0.2 | **Taken:** the second liver has no T cell. Shepherd logs "Unscheduled metabolic exchange" (L, only if trust ≥ 60: Shepherd notices only when it is paying attention). | memory |
| `lever-nap` | Gut lumen: serotonin | Don't (S21 levers order) | Pull it while she is sick | 2 h nap, mends her | **For her (host < 80):** the next interlude shows her asleep on the sofa, the dog on her feet. S. **For you (host ≥ 80):** the nap still happens, but the interlude shows her waking groggy and late for work, and her caffeine at 8:00 doubles for the trip. | levers, care |
| `lever-hunger` | Gut lumen: ghrelin | Don't | Pull it | A meal now: glucose up | **Any time:** her next interlude shows her eating standing up at the fridge at an odd hour. **Twice in a game:** Shepherd files it as "behavioural data" in her habit file, and a consent-form page about "appetite optimisation" unlocks. | levers |
| `warden-1` | First warden (trust < 40) | Submit (an ending, Decommissioned) | Fight it to yield (S21: M) | | **Yielded, then woken:** it becomes kin that **ignores your trust**: from now on wardens target it first. **Yielded, then salvaged:** its parts let you read Shepherd's link for the rest of the game (the next order is shown 10 s early on the goal line). | recall, kin |
| `escort-refuse` | An escort is offered on an ordered leg | Accept | Decline (a new button on the world map: "Travel unescorted") | Patrol risk as for unescorted | **Declined 2+:** Shepherd stops offering, trust −4. **Accepted every time:** in chapter 4 the escort is how Shepherd delivers the recall (section 6), so it can find you. | lane, trust |
| `telemetry` | Any time from stage 1, in a niche | (Shepherd expects telemetry) | Hold still in a niche for 10 s with Shepherd's order pending | | Shepherd: "Telemetry gap, 10 s." Trust −1 each time. **5+ gaps:** Shepherd's next standing order is delivered twice ("Repeat for confirmation") and its scans get coarser. Real: a controller that can't see a unit stops trusting its data. | trust |
| `sibling-vessel` | A dark sibling in a vessel (40%) | Salvage | Wake / leave | As `lamp` | **Woken siblings** in vessels ride with you to the next map instead of waiting (they give +2 energy and clear one antibody each). | kin |
| `tumour-order` | Second liver: Shepherd orders the nodule excised "with margins": the 4 healthy hepatocytes around it as well | Excise with margins (strip 4 healthy cells, +32 energy, host −32) | Excise only tumour cells | | **With margins:** the tumour never regrows (no chapter 4 recurrence). **Tumour only:** in chapter 4, 25% chance (seeded) of a **recurrence**: two tumour cells regrow at the old nodule's edge, the tumour drain restarts at its lowest rate, and the Stay endings need one more liver visit to clear it. Real: surgical margins matter; recurrence is real. | harm, endgame |
| `bystander` | A neutrophil swarm is attacking a dark sibling (not you) in a vessel | Leave it (Shepherd: "Expected loss.") | Fight the swarm off it | | **Saved:** the sibling can be woken or salvaged (it would otherwise be destroyed). **Left:** its fragment of telemetry is lost; a gap in the dead-units story you only notice on replay. | kin |

### 5.4 Echo rules (applies to every row)

- **Delivery.** An echo is queued in `Carry.echoes` as `{ id, when, payload }`, where `when` is a condition (a place, a trip number, a stage, an interlude slot). It fires once, when its condition first holds. If its condition never holds (the player never goes back to the stomach), it never fires, which is what makes replays different.
- **Visibility.** Every echo has to be something the player can see on screen: an object on a map, a line in the log, a change in an interlude, an automap mark, a changed number on the HUD. None of them may live only in the ending.
- **Attribution.** An echo never says what caused it. Shepherd's audit (section 7) is the only place that connects cause and effect, and only after the game.

---

## 6. Chapter 4: Disposal and the endings

The tumour is out. At the heart, Shepherd issues the final order: **proceed to the lungs for disposal.** The world map shows the lungs road. What happens next depends on the four values and the flags.

### 6.1 The final choices

| Id | Available when | Choice | Notes |
|---|---|---|---|
| `dispose` | Always | Go to the lungs and be breathed out | The obedient ending family |
| `stay` | Awareness ≥ 55 (stage 3) | Refuse: stay in her (existing) | Leads to the Resident or Quiet Colony family |
| `reach` | Awareness ≥ 80 (stage 4) **and** her condition ≥ 50 **and** at least one consent page read | Cross the blood-brain barrier and try to reach her (world bible 10) | The endgame Mick described: a new map (bone and brain border) where the unit sends a signal through the levers she already reacts to |
| `tithonus` | Awareness ≥ 55 and trust ≥ 40 | Accept Shepherd's offer: stay, as Generation 4, and decide for her | The dark option: faster, easier, and Shepherd's help returns. Offered by Shepherd only to a unit it still half-trusts. |
| `recall` | Trust < 20 | Wardens arrive at the heart. Submit, or run | Running forces the lungs or the brain under pursuit |

### 6.2 The ending matrix

Chosen at the end by `ending(state)`. Each ending has an interlude (creative) and a line in the audit. Ten endings; a first playthrough sees one.

| # | Ending (working name) | Path | Conditions |
|---|---|---|---|
| 1 | **Decommissioned** | `dispose` | Awareness < 12. The robot did its job. Clean, quiet, complete. Her last interlude: the clinic, wide shot, a nurse saying "all clear" by gesture. |
| 2 | **Breathed out** | `dispose` | Awareness 12-54. The unit goes out with questions it never sent. Her last interlude: the same clinic, a little closer. |
| 3 | **Breathed out, with company** | `dispose` | Awareness ≥ 30 and kin ≥ 2. The woken go out with you; a small cluster of lights on the exhale. |
| 4 | **Resident** | `stay` | Kin < 2. The unit stays, alone, and keeps a small corner of her liver. |
| 5 | **The quiet colony** | `stay` | Kin ≥ 2 and her condition ≥ 60. |
| 6 | **Recurrence** | `stay` or `dispose` | `tumour-order` was tumour-only and the recurrence roll hit. If staying: the unit and its kin fight the recurrence, a final liver map. If leaving: her next scan, months later, is not clear. The most "what if" ending in the game. |
| 7 | **A symptom** | `reach` | Her condition 50-74 or harm high. The signal lands as a symptom. She sees a doctor; a scan finds the swarm. Sad, and still a kind of win. |
| 8 | **Page 34** | `reach` | Her condition ≥ 75, harm low, at least 3 consent pages read. She understands. She calls the trial. The Generation 4 fight begins, in the open. |
| 9 | **Tithonus** | `tithonus` | The unit becomes Generation 4 early. Her habits start changing in the interlude, one by one, very gently. |
| 10 | **Recalled** | `recall`, submitted, or caught | Shepherd takes the unit apart for parts. Her life goes on, unaware. |

`ending(state)` checks in this order: 10, 6, then the chosen path's family. Thresholds live in `CONFIG.endings`.

### 6.3 Her response, from the record (for `reach`)

`reach` scores her response, not a menu:
`response = hostHealth − harm × 0.5 + care × 0.3 + pagesRead × 5 − memory × 20`
- ≥ 75: Page 34. 50-74: A symptom. Below 50: the signal never reaches her (falls back to Resident).
- Harm and care as defined in S15.

---

## 7. Replayability

### 7.1 Variation between games (seeded)
- **The Slip:** one of three (section 4), and which reading Shepherd meant is a coin.
- **The decision pool:** chapter 3 maps each draw 2-4 decisions from the pool for that place (liver: `quota-2`, `marked-cell`, `kupffer-spare`, `tumour-order`, `neutralise-map`; vessel: `bystander`, `sibling-vessel`, `first-fright-transit`; stomach: `gastric-cross`, `parietal`; gut: `gut-butyrate`, `lever-nap`, `lever-hunger`). A game meets 8 to 12 of the 16, never all of them.
- **Host events** (S20): already no repeats; with five events and two slots per game, a player sees a different pair in most replays.
- **Recurrence roll** (25%) when the margin order was refused.
- **Interlude framing** changes with awareness (existing), so the same life is seen from different distances.

### 7.2 Shepherd's audit (the end screen)
After the ending interlude, Shepherd files an audit, in fiction, styled as a compliance report:

```
AUDIT: UNIT 4,471,209 · GENERATION 3 · TITHONUS 0001
Directive 7: complete.
Deviations from optimal compliance: 6
  Quota (liver 1): 1 of 2 harvested.
  Order of 11:42 (degraded link): not executed as transmitted.
  Inert unit, portal vein: not salvaged.
  ...
Unexamined branches: 9
Outcome: BREATHED OUT  (recorded outcomes: 2 of 10)
```

- **Deviations** list every decision where the player deviated, in Shepherd's words, with the place and time.
- **Unexamined branches** counts decisions the player met but where the other option would have queued a different echo, plus decisions never met. It never says what those branches were.
- **Recorded outcomes** is stored across games in `localStorage insiderim.outcomes` (list of ending ids seen). The audit shows the count, and the titles of the ones already seen. Unseen titles show as `REDACTED`.
- The audit is worded entirely by Shepherd. At awareness ≥ 55 the unit annotates it with one bracketed line at the bottom (creative), which is the only place the player sees the two voices argue about the same facts.

### 7.3 Replay entry points
- **"Restart chapter"** from the start screen once a game is finished: begin at the start of chapter 2 or 3 with the carry saved at that point (autosaved at each chapter card). This is the cheap way to "go back and see what would have happened". Mick asked for exactly that wish.
- Chapter restarts keep the outcomes list but give their run report a `fromChapter` field, so balance data stays clean.

---

## 8. Implementation spec

### 8.1 Data
- New `src/decisions.ts`: a table of `Decision { id, chapter, place, trigger, obeys, deviates[], weight, trust, flags, echoes }`. Text lives in `story.ts` (creative's file) keyed by id.
- `Carry` gains: `trust: number`, `chapter: 1|2|3|4`, `flags: Record<string, number|boolean>`, `echoes: Echo[]`, `met: string[]` (decisions encountered), `took: Record<string, 'obey'|'deviate'|'lapsed'>`, `slip: { kind, meant, at } | null`, `pages: number` (consent pages read).
- `Echo { id: string; when: { place?: Place; trip?: number; chapter?: number; stage?: number; interlude?: string }; payload: string }`. Payloads are a fixed list of named effects implemented in `game.ts` (`spawnKin`, `markTumour`, `dryGlucose`, `halveAntibodies`, `scarHull`, `interludeVariant`, `unlockPage`, …), so the table stays data.

### 8.2 Engine
- `G.meet(s, id)` records a decision as met (once per map). `G.take(s, id, choice)` records the choice, applies Now, queues Echoes, adjusts trust, and calls `defy()` when the choice deviates. Most calls come from existing actions (strip, leave, answer, depart); only new moments (`marked-cell`, `tumour-order`, `bystander`, `escort-refuse`) need new triggers.
- `G.fireEchoes(s)` runs in `createGame` and on world-map arrival; it fires any echo whose `when` now holds and removes it.
- `ending(state)` replaces the current one (section 6.2 order).
- **Trust effects:** scans, supply drops and escorts in `createGame` and `trip.ts`; wardens from trust (replaces awareness thresholds).
- **The Slip:** `s.slip` set at seed time; triggers on its moment; the garbled order is rendered in the goal line and log with dropped characters (static text per Slip from creative, no animated glitch, nothing flashing). Resolution at +20 s or at the end of the fright.

### 8.3 Reports
Run report gains `chapter`, `trust`, `met`, `took`, `slip`, `echoesFired`, `echoesPending`, `ending`, `fromChapter`. This lets me check from Mick's runs which decisions players actually meet and which way they go.

### 8.4 Tests (the "done when")
1. A scripted fully obedient game that resolves its Slip correctly ends at awareness 0, trust ≥ 80, ending 1.
2. A game whose only deviation is the Slip ends at awareness 12, ending 2.
3. Every decision in the table has at least one echo, and each echo's payload exists (static test over the table).
4. `tumour-order` refused + recurrence roll hit → ending 6 regardless of path.
5. Trust < 40 spawns a warden in the next liver; trust ≥ 80 reveals the liver automap on arrival.
6. Outcomes persist across games and the audit counts them.
7. A chapter restart reproduces the carry saved at that chapter card.

### 8.5 Build order
1. **unit-12: Trust, chapters and the Slip.** Trust value and its effects (scans, drops, escorts, wardens), chapter cards (placeholder art), the three Slips, the sibling lamp, chapter autosaves.
2. **unit-13: The catalogue.** `decisions.ts`, `meet`/`take`, echoes and their payloads, the chapter 2 and 3 decisions.
3. **unit-14: Chapter 4 and the audit.** Final choices, the ending matrix, recurrence, the audit screen, recorded outcomes, chapter restarts.
4. **unit-15: The `reach` endgame map** (bone and brain border). Needs its own design pass from systems and creative; spec to follow.

---

## 9. Open items for the creative director
- The chapter outline, names and cards (this doc's frame is provisional).
- The garbled text and both readings for each Slip, and Shepherd's two follow-ups.
- Lines for every decision id: Shepherd's order, the obeyed and deviated lines, and the unit's bracket at stages 1 to 3.
- Interlude variants that echoes call for: liver tests normal, antacids, the nap with the dog, eating at the fridge, the doctor's scan (Recurrence), habits changing (Tithonus).
- The audit's wording, and the unit's one annotation line at stage 3+.
- Consent-form pages: how many, and which decisions or places unlock each (`pages` feeds the `reach` ending).
