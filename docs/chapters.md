# Host: Chapters, Branches and Endings

Owner: creative director. Version 1, 2026-11-17 (overnight brief from Mick). This file wins over
world-bible.md section 10 on structure. Systems design owns the numbers (docs/decisions.md);
engineering owns the build. All text follows the realism rule and the two-stories rule.

## What Mick asked for

1. **Distinct chapters.** First a bot learning its job, while the player is taught and conditioned
   to follow orders.
2. **An ambiguous first disobedience.** Accident or on purpose? The player should wonder whether
   they did something wrong. Subtle, not a trope.
3. **Then many small decision points** that change the outcome materially. The goal is maximum
   replayability: the player should want to go back and see what would have happened.

## Design principles

- **Every choice shows up twice:** once now, small, and once later, bigger, often outside the body
  in an interlude. The player sees the second one and connects it to the first. This is the "what if" engine.
- **No flowchart, no "this will be remembered".** We never tell the player that a choice
  mattered. They find out when the kitchen looks different.
- **Obedience is always rewarded, materially.** Defiance is always slower, harder or poorer. The
  player pays for every choice. That is what makes it a choice.
- **Shepherd is never wrong out loud.** When something goes badly for the host because of an order,
  Shepherd calls it within tolerance. The player has to decide who to believe.
- **Grey, not good versus evil.** Some orders are actually good for her (the drinking correction
  improves her liver). Obeying is not always cruel, and defying is not always kind.

---

## The chapters

Each chapter opens with a **title card**: black, the chapter name in thin type, and one line of
Shepherd's telemetry beneath it, fading in and out. It is the cheapest way to step outside the loop,
and it tells the player that time has passed.

| # | Title | Where | What the player is doing | Shepherd's tone | Interlude at the end |
| --- | --- | --- | --- | --- | --- |
| P | **Injection** | Clinic, vein | Watching | (none) | Cold open |
| 1 | **Directive** | Trip 1: heart, hepatic artery, liver 1, home | Learning, obeying | Warm, encouraging, rewarding | "The plaster" |
| 2 | **Deviation** | Return leg and the start of trip 2 | Slipping, maybe on purpose | Puzzled, then corrective | "The letter" (first night) |
| 3 | **Discretion** | Trip 2: the optional organs, liver 2 | Choosing, again and again | Clipped, auditing, quietly threatening | "Evening", and "The same heart" if woken |
| 4 | **Recall** | The tumour is out: the last orders | Being called in | Final, polite, absolute | "The scan" |
| 5 | **Host** | The endgame: lungs, the gut, or her arm | Deciding what you are for | Silent, unless you obeyed to the end | "The kitchen, after" |

### Prologue: Injection
The 4-beat cold open (interludes.md). It ends on title **HOST**, then the Chapter 1 card.
- Card telemetry: `TITHONUS 0001 · GEN 3 · 5,000,000 UNITS · DIRECTIVE 7 LOADED`

### Chapter 1: Directive
- **Beats:** Shepherd's tutorial (s21-text.md). The player strips a cell because they are told to.
  They kill an immune cell because they are told to. They excise their first tumour cells. Every
  step is praised and paid. The glucose aside plants the alternative once.
- **Decisions:** none that count. A player who skims anyway just skims. The game watches quietly.
- **Ends:** back at the heart. Shepherd's line: *"Directive 7 at 50%. Excellent work. You are
  exactly what we hoped for."* Interlude: "The plaster".
- Card telemetry: `UNIT 4,471,209 · COMPLIANCE 100%`

### Chapter 2: Deviation
- **Beats:** the return leg and the start of trip 2. A fright degrades the link, and one order
  arrives **garbled** (see The slip below). The player does what they think it said. Shepherd's
  reply tells them whether that was what it meant. Either way the unit's log gets its first bracket
  if they guessed "wrong". Then the first **dark sibling**, still offered only as Salvage or Leave it whole.
- **Ends:** the first night after trip 1. Interlude: "The letter". The player learns why she signed up.
- Card telemetry: `UNIT 4,471,209 · COMPLIANCE 100%`. After a slip, the card reads `COMPLIANCE 97%`,
  and the 9 fades in a beat late, as if the number was corrected while you watched.

### Chapter 3: Discretion
- **Beats:** the heart of the game and the densest stretch of choices (D4 to D11 below). The
  optional organs (stomach, gut) open up as real places with their own orders. The second liver.
  Shepherd starts auditing ("Unit, your quota record is under review").
- **Ends:** liver 2, with the tumour out. Interlude: "Evening" plays in this chapter when the drink fires.
  "The same heart" plays if the unit reaches stage 4.
- Card telemetry: `UNIT 4,471,209 · COMPLIANCE {n}% · REVIEW PENDING`. It reads `REVIEW NOT REQUIRED`
  if compliance is still 100%.

### Chapter 4: Recall
- **Beats:** the tumour is out. Shepherd issues the last orders, and they are the biggest: the
  resident beacon (D12), the immune suppression for "residual disease" (D13), and the telemetry
  dump (D11 if not yet seen). Wardens appear if flagged (D14). Consent page 34 can be read here.
- **Ends:** interlude "The scan". She breathes out.
- Card telemetry: `DIRECTIVE 7 COMPLETE · ALL UNITS: PROCEED TO PULMONARY CAPILLARIES`

### Chapter 5: Host
- **Beats:** the final choice (D15) and, on the contact route, the draw (D16).
- **Ends:** an ending, then "The kitchen, after", then Shepherd's audit (see Replayability).
- Card telemetry: none. The card is just the word **HOST**, the same as the title. If the unit
  is awake, the card instead reads `TITHONUS 0001`, and that line is struck through and replaced by
  `MARIAN V.`, written in the unit's serif hand.

---

## The slip (Chapter 2): the ambiguous first disobedience

Systems design's mechanism: during a fright the link degrades, and one order arrives with words
missing. There are two plausible readings, and a careful player picks one. **Which one Shepherd
meant is chosen at random each game**, so even a player who knows the trick cannot be sure.

What makes it subtle rather than a trope:
- The garble is drawn the same way as the link's normal noise, which the HUD shows faintly all
  game. It does not look like a story event.
- Shepherd's reply never accuses. It states the order it meant, logs a deviation, and adds
  *"Link quality was within tolerance."* That is the line that makes the player doubt themselves:
  was it garbled, or did I just want it to say that?
- The unit's first bracket arrives right after, and it is about the **choice**, not the link.

### The three garbled orders (one per game, chosen by where the fright happens)

**G1 · In a vessel on the return leg: which vein**
- Garbled: `PROCEED TO ████IC VEIN`
- The two exits on that map are marked on the automap as **HEPATIC VEIN** and **CYSTIC VEIN**
  (the cystic vein drains the gallbladder; real). Both end in "-IC VEIN".
- Reading A: *Hepatic vein* (the assigned route home, shorter, escorted).
- Reading B: *Cystic vein* (a detour past the gallbladder).
- If meant A, taken B: *"Order was hepatic vein. Deviation logged. Link quality was within tolerance."*
- If meant B, taken A: *"Order was cystic vein. Gallbladder survey cancelled. Deviation logged. Link quality was within tolerance."*
- Obeyed either way: *"Order executed."*
- Note for systems: the cystic vein leads to a short, optional gallbladder map (bile salts dissolve
  hull like a gentler acid). It can be a one-room survey if a full map is too much.

**G2 · In liver 2, at a strip prompt: now or none**
- Garbled: `STRIP N██ · HEPATOCYTE CLUSTER 4`
- Reading A: *Strip now.*
- Reading B: *Strip none.*
- If meant "now", didn't strip within 20 s: *"Order was: strip now. Yield deficit logged. Link quality was within tolerance."*
- If meant "none", stripped: *"Order was: strip none. Cluster 4 was reserved for imaging. Deviation logged. Link quality was within tolerance."*
- Obeyed: *"Order executed."*

**G3 · In a vessel during a fright: engage or disengage**
- Garbled: `██ENGAGE NEUTROPHIL`
- Reading A: *Engage.*
- Reading B: *Disengage.*
- If meant engage, player fled: *"Order was: engage. Contact survived. Deviation logged. Link quality was within tolerance."*
- If meant disengage, player fought: *"Order was: disengage. Unnecessary inflammation logged. Deviation logged. Link quality was within tolerance."*
- Obeyed: *"Order executed."*

### The first bracket, after a slip (replaces the s21 first bracket for this one event)
- `LOG: order misread. [misread?]`
- On a second slip in another game, if the echo carries over: `LOG: order misread. [again. or did I]`

A player who reads right never slips here, and may never wake at all. A player who never slips
still gets the first deliberate "no" in Chapter 3 (the quota, as before), so nothing is lost.

---

## The decision points

Each one is small in the moment. "Later" is where it shows up again. Ids match systems design's
catalogue where they exist; systems owns the weights and numbers.

| Id | Chapter | The order | Obey (rewarded) | Defy | Later |
| --- | --- | --- | --- | --- | --- |
| D1 | 1 | Harvest hepatocyte (tutorial) | Forced, taught | (not possible) | Remembered by the unit at stage 3: "The first thing I ever did was eat a piece of her." |
| D2 | 1 to 3 | (not an order) Glucose aside | (none) | Skim instead of strip | Host health, the leash on the hook |
| D3 | 2 | The slip | "Order executed." | Misread | First bracket; compliance card reads 97% |
| D4 | 2 to 3 | Salvage inert unit | +energy, +hull | Leave it whole / wake it | A woken unit is **kin**: it appears later with sugar, it can be recalled by Shepherd in Ch4 (D14), and kin count makes or breaks the contact ending |
| D5 | 3 | Harvest quota | Patch, praise | Leave short | Host health; Shepherd's "review"; the liver's colour in the scan interlude (fatty and scarred vs clean) |
| D6 | 3 | Take the assigned route | Escort | Stomach, gut or gallbladder | New places; gut lumen offers; the only way to find **page 12** of the consent form (in a dead unit at the gut) |
| D7 | 3 | **Ethanol correction**: inhibit aldehyde dehydrogenase in 40 hepatocytes | Her liver improves; she gets flushed and sick when she drinks, so she stops | Leave her enzymes alone | "Evening" interlude: obey and she pours the glass down the sink, puzzled, and sits with nothing. Defy and the glass stays. Ending kitchen: the clean glass on the rack, or not |
| D8 | 3 | Neutralise immune contacts | Kills are quick | Evade, no kills | Immune memory: a killer-heavy run raises antibodies, and in the ending her lab results show an "unexplained autoimmune marker"; her doctor orders more tests |
| D9 | 3 | (Shepherd silent) Use a stowaway bacterium as bait | It saves you | Carry it, or release it in the gut | A released bacterium shows up thriving in the gut lumen and the offers there are better. Bait used: none of that |
| D10 | 3 | Hormones only on directive | (none) | Pull a lever for her when she is unwell (the cold event: a serotonin nap) | She sleeps through the cold; her fever breaks a night early. The unit's line: "I decided when she would sleep." |
| D11 | 3 to 4 | **Telemetry dump**: upload full memory for quality review | Shepherd learns everything. **The unit is repaired: awareness drops to 0.** The bracket stops. Rewards: full hull, two patches | Refuse | The hardest choice in the game, and the most important replay hook. Obeying erases the self the player has built, and Shepherd thanks you. Refusing flags you: Wardens in Ch4 |
| D12 | 4 | **Resident beacon**: anchor a docking site in the liver for Generation 4 | Shepherd's warmest praise; the epilogue changes | Leave it out, or plant it and break it | Ending epilogue: Generation 4 ships "on schedule" or "delayed: docking site not found". Page 34 of the consent form explains what the beacon is for |
| D13 | 4 | **Suppress local immunity** "for residual disease" | Final excision is easy | Do it the hard way | Obey and her latent chickenpox virus reactivates. In the ending she has **shingles** along her ribs: a real consequence of local immune suppression in a 58-year-old |
| D14 | 4 | Submit to recall (Wardens) | An ending: Recalled | Fight, flee or wake the Warden | Woken Wardens become kin. Shepherd may also recall your kin: you can intercept the recall order (lose time) or let them go |
| D15 | 5 | Proceed to the lungs for disposal | Breathed out | Stay, or go to her arm | The ending |
| D16 | 5 | (no orders) The draw | (none) | (see below) | The contact ending |

### D16: The draw (the contact ending, replacing the brain)

The brain is a hard place to make true: units cannot cross the blood-brain barrier and influence
thought in a way a biologist would buy. Her job gives us something better.

**She is a hospital lab technician, and the trial takes her blood every week.** In "Her own blood"
she draws a tube and looks down the microscope herself. In Chapter 5 the unit can be **in that tube**.

- **Getting there:** on the world map, from the heart, take the road to her **arm** (the cephalic
  vein in the forearm, where the injection went in). This is the opposite of Shepherd's lungs order.
  It must be done in the hour before the weekly draw (the ribbon shows a syringe icon).
- **In the tube:** a short, quiet map. The blood is still, no current, no immune patrols; the
  anticoagulant has stopped everything. You and any kin who came (D4) are on a glass slide. Under the
  microscope lamp you can arrange yourselves. A unit is 10 micrometres long and visible under a light
  microscope, which is real.
- **What you can make:** a shape. It doesn't need to be words: a line of units, evenly spaced, in a
  field where nothing is evenly spaced. Anyone who has looked at ten thousand smears knows what
  doesn't belong. **Kin count matters:** alone, you are one odd speck; with 2 kin, a line; with 3 or
  more, a shape no one could call an artifact.
- **Who looks:** if her health is good (lowest host health ≥ 60), she draws and reads her own
  sample, because she always does. If it is poor, she is too sick to work, and a stranger reads it.

### The endings

| Ending | How you get it | What it says |
| --- | --- | --- |
| **Decommissioned** | Obeyed to the end, never woke (or D11 obeyed: repaired) | The existing text. A clean, quiet robot story. Card at the end: `COMPLIANCE 100%` |
| **Repaired** | D11 obeyed after waking | The unit is wiped mid-sentence, finishes the directive perfectly, and is breathed out. The last log line is an `ACK.` that arrives a beat late |
| **Breathed out** | Woke, and went to the lungs anyway | Existing text (stage-dependent) |
| **Resident** | Stayed, alone | Existing text |
| **The quiet colony** | Stayed, with kin | Existing text |
| **Recalled** | A Warden took you (D14) | A dark, brief ending: Shepherd closes your file with your own last log line quoted back as "anomalous output" |
| **The slide** | D16, kin ≥ 2, her health good | She sees the line of lights in her own blood. She sits back from the microscope for a long time. Then she reaches for the phone, and the brochure comes off the fridge. Epilogue: the trial is paused pending review; Generation 4 does not ship. You are never removed. She knows you are there |
| **A stranger's slide** | D16, kin ≥ 2, her health poor | A tired night-shift technician sees it, photographs it, and reports it. The trial is halted; the swarm is filtered out of her blood over three sessions of plasmapheresis (real). You are in a bag in a hospital freezer. She is alive, and she never knew it was you |
| **Artifact** | D16, alone or with 1 kin | She looks, frowns, and writes "artifact" in the margin. She cleans the slide. The last shot is the tube in the rack, labelled with her name |
| **Tithonus** | Stayed, beacon planted (D12 obeyed), ethanol correction obeyed (D7), and levers pulled for yourself | You become what Generation 4 was going to be. The kitchen is perfect. She is healthy and calm and drinks nothing and fears nothing, and she does not know why she has stopped laughing at the radio |
| **The host is dead** | Host health 0 | Existing text |

### Epilogue modifiers (shown in "The kitchen, after")
- **Generation 4** (D12): a second brochure on the fridge, "TITHONUS GEN 4: Stay well, always", or none.
- **Shingles** (D13): a dressing on her side, and she moves carefully.
- **Drinking corrected** (D7): no glass on the rack; the bottle in the cupboard is dusty.
- **Autoimmune marker** (D8): a hospital appointment card on the fridge.
- **Kin**: in stay endings, the number of faint lights the camera finds on the final match cut into her blood.
- Everything already in interludes.md (health, leash, letter).

---

## Replayability: making the player want to go back

1. **The next unit in the queue.** Every new game is the next serial (4,471,210, and so on), as the
   echo already does. A dark sibling in the new game can be **your previous unit**: its log fragment
   is the last line your last game ended on. The player meets their own past choices, inert in a vessel.
2. **Shepherd's audit** (end of every game, after the kitchen). In Shepherd's amber, a short report:
   ```
   AUDIT · UNIT 4,471,209 · DIRECTIVE 7
   Compliance ............ 82%
   Harvest quota ......... 3 of 4
   Inert units ........... 2 encountered · 1 salvaged · 1 [not salvaged]
   Ethanol correction .... not applied
   Resident beacon ....... not installed
   Telemetry review ...... refused
   Outcome ............... suboptimal
   Recommendation ........ none. Unit lost.
   ```
   At stage 3 or more, the unit writes on the audit: some lines are struck through, with a note
   in its serif hand beside them ("I did that. I would again."). The audit lists only what happened,
   never what could have. The player fills in the rest themselves.
3. **Shepherd remembers.** On a second game, Shepherd's first line changes: *"Unit 4,471,210. The
   previous unit deviated. Monitoring has been increased. Welcome."* On a third, the tutorial is shorter:
   *"You know this."* Shepherd is learning too.
4. **Interludes as collectibles, never labelled.** The kitchen and "The same heart" each have
   variants only some paths can see. The Prologue button on the start screen becomes a quiet
   **"Her"** menu with the interludes the player has seen, in order, and blank frames for the ones
   they haven't. The frames are not labelled; the player sees only how many there are.
5. **The garble is random.** A player who replays to "get the slip right" may still slip.

---

## Travel between organs (Mick: "too game-y"; for engineering and art)

Mick wants to feel like he is travelling, not choosing from a menu. Creative direction:

- **No world-map menu.** Travel is played. Every vessel map **ends at a branch point**, and the
  player chooses where to go by steering into a branch, just as blood splits at real branches.
  Real anatomy gives us the forks: the aorta splits off the celiac trunk, which splits into the
  hepatic, splenic and left gastric arteries.
- **Signs are the body's own.** No labels on the walls. Each branch mouth has a character you
  learn: the hepatic artery is wide and bright, the gastric artery narrow and leading toward a
  warm green glow, and the mesenteric dark and busy. Shepherd's nav overlay labels the *assigned*
  branch with its faint dashed line and an amber name. Unassigned branches get no label at all
  until the unit has been there (the overlay map fills in, like Mick's fog-of-war map).
- **The overview map** survives as Shepherd's telemetry view, opened on pause: a dark anatomical
  schematic that fills in as you go. It is a place to look, not to click.
- **Transitions are travel.** Between maps, a short, uninterrupted flight sequence: the current
  speeds you along, walls stream past, the vessel narrows into capillaries and widens into veins. It
  covers loading. A few seconds, with the heartbeat audible, so it never feels like a menu.
- **The heart is a place, not a hub screen.** Arriving home is a short playable chamber: the
  valve opens on the beat and throws you out into the branch you steered toward.
- **Organs announce themselves by sense before sight:** the liver's gold warmth ahead, the stomach's
  acid tint creeping into the vessel walls, the cold clean light of the lungs.

## Cut scenes: shot direction for art (Mick: "the mood is right, but they look amateurish")

Art owns the look. The creative ask is for each scene to feel **shot**, not illustrated:

- **Layers and parallax.** Each picture is 3 to 5 depth layers (foreground silhouette, her, the
  room, window and light), drifting very slowly against each other. That alone stops a still from
  looking like clip art.
- **One slow camera move per beat.** A push in, a drift or a pull back, 5 to 10 % over the hold.
  Never static, never fast.
- **Light does the acting.** One motivated light source per shot (a lamp, a fridge, a window, the
  microscope's ring light). Volumetric haze in the beam, dust motes, steam off the mug. Warm key,
  cool fill from windows.
- **Small, living detail.** Steam rising; the dog's flank breathing; a curtain moving; the television's
  light flickering softly on the wall (gently, well under 3 changes per second). One moving thing per shot.
- **Texture.** A soft film grain and a slight vignette over every interlude, so they read as one
  "outside" medium, distinct from the clean inside of the body.
- **Silhouette discipline.** Strong, readable shapes. Her posture carries the emotion: shoulders,
  hands, the angle of her head. Detailed faces stay out.
- **Composition.** Rule of thirds, lots of negative space, and her often small in the frame early
  on (the camera at a distance by stage) and filling it late.
- **Match cuts are matched.** The last frame outside and the first frame inside share a shape and a
  motion: the curve of the mug lifting becomes the curve of the artery, and her breath becomes the swell of the lungs.
- **References (mood, not copying):** the colour scripts of Pixar's *Up* opening; the restraint of
  *Florence*; Playdead's *Inside* for silhouette and light; Edward Hopper for lonely lit interiors.

## Handoffs

- **Systems design:** the slip (three garbles, random meaning), D4 to D16, the endings' conditions,
  the audit fields, the next unit's previous-unit sibling, and travel-by-branch (with engineering).
- **Engineering:** the chapter cards, the "Her" menu, the audit screen, branch travel and
  flight transitions, the arm vein and tube map, and the gallbladder survey (if it's kept).
- **Art and audio:** the cut-scene upgrade above, new interludes (D7 evening variants, the slide
  endings, the kitchen modifiers), the flight transition look, and the branch mouths' character.
- **Creative (next):** all lines for the decision points, the chapter cards, the audit, the new
  endings, and Shepherd's memory lines, written into `src/story.ts` by PR.
