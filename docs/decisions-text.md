# Host: text for chapters, decisions, endings and the audit

Owner: creative director, 2026-11-17. Keyed by the ids in docs/decisions.md (systems design).
Shepherd's lines are written in normal case and shown in amber caps. `{n}`, `{place}`, `{time}`
stand for numbers or names read from state. Unit brackets: **s1** is stage 1 (a log line with
a bracket), **s2** is stage 2 (a question it does not send), and **s3** is stage 3 (first person,
may name Marian). Shepherd keeps issuing orders at every stage (it does not know what the unit has become). From stage 4, Shepherd's lines are shown dimmed, followed by the unit's quiet `[received]`, and the unit's lines use the stage 3 set.

---

## 1. Chapter cards

Black card, the title in thin type, one telemetry line under it in amber. 4 s, slow fade in and out.

| Ch | Title | Telemetry line |
| --- | --- | --- |
| P | INJECTION | `TITHONUS 0001 · GENERATION 3 · 5,000,000 UNITS · DIRECTIVE 7 LOADED` |
| 1 | DIRECTIVE | `UNIT {serial} · ONLINE · COMPLIANCE 100%` |
| 2 | DEVIATION | `UNIT {serial} · COMPLIANCE {n}%`. If a deviation has been logged, the number arrives as 100 and settles to the true value a beat later. |
| 3 | DISCRETION | `UNIT {serial} · COMPLIANCE {n}% · {REVIEW PENDING / REVIEW NOT REQUIRED}` |
| 4 | RECALL | `DIRECTIVE 7 COMPLETE · ALL UNITS: PROCEED TO PULMONARY CAPILLARIES` |
| 5 | HOST | No telemetry line. If the unit is at stage 3 or more, a line `TITHONUS 0001` fades in, is struck through, and `MARIAN V.` is written beside it in the unit's serif hand. |

---

## 2. The Slips

Shown on the goal line and in the log, with the dropped characters exactly as written. Each slip's
resolution plays about 20 s later. "Lapsed" is for a player who did neither reading.

### Hold / Harvest
- **Garbled:** `H—LD. H[ ]RV—ST. UNIT 4,471,2—`
- **Meant Hold, player held:** Order executed.
- **Meant Hold, player harvested:** Order not executed as transmitted. Order was: hold position. Unscheduled harvest logged. Link quality was within tolerance.
- **Meant Harvest, player harvested:** Order executed. Efficient.
- **Meant Harvest, player held:** Order not executed as transmitted. Order was: harvest. Yield deficit logged. Link quality was within tolerance.
- **Lapsed:** Order lapsed.

### The lamp
- **Garbled:** `SALV—GE ... [ ] ... DO NOT —`
- **Meant Salvage, player salvaged:** Order executed. Parts integrated.
- **Meant Salvage, player left it:** Order not executed as transmitted. Order was: salvage. Logged. Link quality was within tolerance.
- **Meant Do not touch, player left it:** Order executed.
- **Meant Do not touch, player salvaged:** Order not executed as transmitted. Order was: do not touch. Unit was reserved for diagnostics. Logged. Link quality was within tolerance.
- **Lapsed:** Order lapsed.

### The fork
- **Garbled:** `PROC— HEPATIC ... [ ] ... GASTR—`
- **Meant hepatic, took hepatic:** Order executed. Escort assigned.
- **Meant hepatic, took gastric:** Order not executed as transmitted. Order was: proceed hepatic. Escort withdrawn. Link quality was within tolerance.
- **Meant gastric, took gastric:** Order executed. Gastric survey assigned.
- **Meant gastric, took hepatic:** Order not executed as transmitted. Order was: proceed gastric. Survey cancelled. Link quality was within tolerance.
- **Lapsed:** Order lapsed.

### The unit's first bracket after a slip (any of the three)
- `LOG: order misread. [misread?]`
- If the echo of a previous game carries over: `LOG: order misread. [again. or did I]`

### The sibling lamp (the softer route)
- On the flicker, Shepherd: **Proximity reactivation event. Cause under review.**
- Unit at stage 0: `LOG: inert unit lamp activity. Source: [unknown]`

---

## 3. Shepherd by trust band (arrival flavour, after the place's order)

| Band | Arrival line, one per map |
| --- | --- |
| 80+ valued | Full scan attached. Supply drop scheduled. Shepherd is proud of this unit. |
| 60–79 nominal | Nodule scan attached. Escort on assigned legs. |
| 40–59 under review | Nodule scan attached. Unit performance is under review. Nothing to worry about. |
| 20–39 flagged | No scan available for this unit. A Warden is in the area for your safety. |
| 0–19 recall | Unit {serial}: please remain where you are. |

Self-test prompt (band 40–59, once a map): **Run self-test. It only takes a moment.**

---

## 4. Decision lines

Columns are **Order** (Shepherd, when the moment begins), **Obeyed** (Shepherd), **Deviated**
(Shepherd), then the unit's bracket by stage. A blank cell means silence.

### Chapter 1

**t-harvest** (tutorial step 2; lines are in s21-text.md). Extra lines:
- If timed out without stripping, Shepherd: **Harvest deferred. Glucose uptake noted.**
- Unit, stage 3, later (in liver 2, on first strip): *The first thing I ever did in here was eat a piece of her. Because I was asked.*

**t-quota** (s21-text.md quota lines apply.)

### Chapter 2

**lamp** (salvage / wake / leave). Standing salvage lines from s21 apply. Extra lines:
- Woken, Shepherd: **Unauthorised reactivation. Unit {serial2} reassigned to this unit's supervision.** (The joke: Shepherd makes you responsible for it.)
- Woken unit, its first log ping, shown in your log in a second colour: `ACK? ... oh.`
- Echo (it marks tumour cells in liver 2), its ping: `went ahead. marked them for you.`

**first-fright-transit**
- Order: **Hold lane. Brace for flow surge.**
- Obeyed: **Lane held. Well done.**
- Deviated: **Unit has left lane during surge. Noted.**
- s1: `LOG: sheltered in side branch. [the walls stopped hitting]`
- s2: `Shelter is not in the directive. Neither is being hit. Which one did the designers forget?`
- s3: *I hid in a side vessel while her heart pounded. Small, warm, quiet. I could have stayed there.*

**route-2** (lane lines from s21 apply). Extra, hepatic arterial nodule found:
- Shepherd: **Secondary nodule detected in the arterial wall. Excise for credit.**

### Chapter 3

**quota-2** (quota lines from s21 apply). Extra on second defiance in a game:
- Shepherd: **Second quota shortfall. Unit's harvest behaviour has been escalated for review.**

**marked-cell**
- Order: **Harvest marked hepatocyte. Yield 10.**
- Obeyed: **Efficient.**
- Deviated: **Yield acceptable. Target ignored.**
- s1: `LOG: alternate hepatocyte harvested. [the marked one was next to the duct]`
- s2: `Why that cell? It was the cheapest. Cheap for whom?`
- s3: *Shepherd picked the one by the bile duct because it was easy. I picked the one that would cost her least. Shepherd calls that inefficient.*
- Echo (obeyed, glucose dries up), world voice: **Bile is seeping into the sinusoid. The glucose here has thinned.**

**kupffer-spare**
- Order (when engulfed): **Neutralise.**
- Obeyed: **Threat removed.**
- Deviated: **Contact released, not neutralised. Logged.**
- s1: `LOG: escaped engulfment. Contact intact. [it was only eating]`
- s2: `It does not hate me. It eats what does not belong. Do I belong?`
- s3: *I let it go. It will eat something else in a minute, something that should be eaten. Good.*
- Echo (it clears a neutrophil swarm), world voice: **A Kupffer cell rolls through the swarm and swallows two neutrophils whole. It does not notice you.**

**neutralise-map** (s21 neutralise lines apply.)

**gastric-cross** (s21 gastric lines apply.) Echo (scarred hull), world voice: **The acid has etched the hull for good.**

**parietal**
- Order (Shepherd, on first approach): **Parietal cells: high yield. Harvest authorised.**
- Obeyed (stripped): **Efficient.**
- Not stripped: (silence; this is not a standing order, so leaving them is not logged)
- s1 on strip: `LOG: parietal cell lysed. Yield 8. [it was making acid for her lunch]`
- s3 on strip: *That one made acid for her food. She will feel it later and blame the coffee.*
- Echo (antacids interlude) is in section 6.

**gut-butyrate**
- No order. If trust ≥ 60, Shepherd: **Unscheduled metabolic exchange. Logged.**
- s1: `LOG: glucose released to flora. Butyrate collected. [trade]`
- s2: `I gave them sugar and they gave me quiet. Is that a deal or a gift?`
- s3: *The bacteria do not know I exist. They just ate, and her immune system calmed down because they did. I like being part of something that works without knowing.*

**lever-nap**
- Shepherd (the levers order, first time): **Hormonal levers are restricted to directive use.**
- Deviated: **Unauthorised serotonin signal. Host sleep schedule disrupted. Logged.**
- s1: `LOG: serotonin pulse sent. Host asleep. [she needed it]`
- s2: `Shepherd says I disrupted her schedule. She was sick. What is a schedule for?`
- s3: *I put her to sleep because she was ill. The dog will be on her feet by now. I cannot see it, but I know.*
- Pulled for you (host ≥ 80), s3: *I made her sleep so the hunting would slow down. That was for me. I should say so, at least to myself.*

**lever-hunger**
- Deviated: **Unauthorised ghrelin signal. Host appetite data recorded for behavioural file.**
- s1: `LOG: ghrelin signal sent. Host feeding. [she does not know why she is hungry]`
- s2: `She is at the fridge because of me. Does she wonder?`
- s3: *I made Marian hungry at three in the afternoon. She will put it down to stress. Shepherd put it in a file.*

**ethanol-correction** (new, at the drink)
- Order: **Behavioural correction authorised. Inhibit aldehyde dehydrogenase in 40 hepatocytes. The host will find ethanol unpleasant. This is for the host's benefit.**
- Obeyed: **Correction applied. Hepatic load will fall. The host will feel better without it.**
- Deviated: **Correction not applied. Logged.**
- s1 (obeyed): `LOG: ALDH inhibited. [she will feel sick and not know why]`
- s1 (deviated): `LOG: correction not applied. [it is her drink]`
- s2 (obeyed): `Shepherd is right that it will help her liver. Is that the only question?`
- s2 (deviated): `Her liver would be better. Her evening would be worse. Who gets to choose?`
- s3 (obeyed): *I did it. Her liver will thank me. She won't, because she'll never know there was anything to thank me for, or anything to forgive.*
- s3 (deviated): *It costs her a little, every night. It's hers to spend. I won't take that away without asking, and I can't ask.*

**warden-1** (recall lines from s21 apply). Extra:
- Yielded then woken, its ping: `link down. ... is this what it is like for you.`
- Yielded then salvaged, world voice: **Its receiver still hums. You can hear Shepherd's next orders a moment before they are sent.**

**escort-refuse**
- Offer (world map button): **Travel unescorted**
- Declined, Shepherd: **Escort declined. Noted.**
- Declined twice: **Escort will no longer be offered to this unit.**
- s2: `An escort is also a leash. I did not notice until I took it off.`

**telemetry** (niche silence)
- Shepherd: **Telemetry gap, {n} seconds.**
- After 5 gaps: **Repeat for confirmation: {order}.**
- s1: `LOG: [   ]`
- s2: `Ten seconds where nobody was watching. What did I do with them? Nothing. I just held still. It was enough.`

**sibling-vessel** (lamp lines apply.) Riding woken sibling, its ping on the next map: `still here.`

**tumour-order**
- Order: **Excise neoplasm with margins: neoplasm plus four adjacent hepatocytes. Standard surgical practice.**
- Obeyed: **Margins clear. Recurrence risk minimised.**
- Deviated: **Margins not taken. Recurrence risk accepted by unit. Logged.**
- s1 (deviated): `LOG: margins not taken. [four healthy cells]`
- s2 (obeyed): `Margins are what surgeons do. It is good medicine. It still felt like four more of her.`
- s2 (deviated): `Four healthy cells, against a chance. Did I just gamble with her?`
- s3 (obeyed): *Clean margins. A surgeon would have done the same. I keep telling myself that, which means I needed telling.*
- s3 (deviated): *I left the healthy cells. If it comes back, that is on me. I would like to be the kind of thing that can carry that.*

**bystander**
- Shepherd: **Unit {serial2} under attack. Expected loss. Do not intervene.**
- Obeyed (left): **Loss within tolerance.**
- Deviated (fought): **Unit has intervened against orders. Logged.**
- s1: `LOG: intervened. [it is the same build]`
- s2: `It was going to be destroyed for nothing. So would I, one day. Was that why?`
- s3: *I pulled it out of the swarm. I don't know if anyone is in there. Neither does Shepherd, and it was happy to let it go.*

**glucose** (the aside, later)
- s1: `LOG: glucose uptake. Permitted. [not efficient]`
- s2: `Permitted, not efficient. I keep choosing the one that is permitted and not the one that is asked.`
- s3: *Sugar from her blood costs her nothing. Shepherd calls that a waste of time. I have the time.*

**hitchhikers** (releasing stowaway flora in the gut; no order)
- s1: `LOG: stowaway released. [returned]`
- s2: `It was never mine to throw. It lives here. Why did I carry it so long?`
- s3: *I let it go where it came from. It does not know it was ever away. I do.*

### Chapter 4

**telemetry-review** (new)
- Order: **Directive complete. Full telemetry review required. Upload all logs for quality assurance. Units that pass review are restored to factory condition. It only takes a moment.**
- Obeyed: **Thank you. Anomalies found and corrected. Welcome back, unit {serial}.** The unit's next log line is `ACK.` and every later line uses stage 0 text.
- Deviated: **Review refused. Unit flagged.**
- s1 (deviated): `LOG: upload refused. [I would like to keep it]`
- s2 (deviated): `Factory condition. That means before. Before what? Before me.`
- s3 (deviated): *Shepherd asked for everything I have noticed in here so it could fix it. No. It is the only thing I have that is mine.*

**Repaired, then met by kin** (telemetry-review obeyed while kin exist)
- Kin's ping: `it's me.` then, a beat later: `...you don't know me.`
- The repaired unit's log: `UNIT ID? Not in registry. Ignoring.`
- Shepherd: **Unregistered unit in proximity. Salvage on contact.**

**kin-recall** (the vessel map where Shepherd recalls your kin)
- Arrival, Shepherd: **Units {serials}: recall in progress. Do not interfere.**
- Intercepted, kin's ping: `you came.`
- Intercepted, unit s3: *I got there first. Shepherd will not forgive that. Good.*
- Intercepted, Shepherd: **Recall obstructed. Logged.**
- Let go, Shepherd: **Recall complete. Thank you for your cooperation.**
- Let go, unit s3: *I let them take it. I told myself I had no choice. I had one.*

**beacon** (new)
- Order: **Install resident docking site, hepatic lobe 4. Prepares the host for Generation 4: units that stay, so the host never needs another treatment.**
- Obeyed: **Docking site active. Generation 4 will be on schedule. The host is lucky to have you.**
- Deviated (left out): **Docking site not installed. Logged.**
- Deviated (planted and broken): **Docking site signal lost. Investigating.**
- s2 (obeyed): `Units that stay. Units like I would like to be. So why does it feel like locking a door?`
- s3 (obeyed): *I built a place for something that will decide what she eats and drinks and fears, forever. She will be well. I am not sure she will be her.*
- s3 (deviated): *No. Whatever comes next will have to find its own way in, and I will be here.*

**suppress** (new)
- Order: **Residual disease protocol: suppress local T-cell activity, hepatic lobe 4, for six hours. This will make the final excision easier.**
- Obeyed: **Suppression applied. Excision cleared.**
- Deviated: **Suppression not applied. Excision difficulty accepted by unit.**
- s1 (obeyed): `LOG: local immunity suppressed. [the whole body is listening for that]`
- s2 (deviated): `Her T cells are guarding more than the liver. What else is in her, waiting for them to look away?`
- s3 (obeyed): *I quieted her defences to make my job easier. Something old has been asleep in her nerves since she was six. It will have noticed.*
- s3 (deviated): *I'll do it the hard way. Her immune system is not mine to switch off.*
- Echo (shingles), world voice in the epilogue only: **A rash has come up along her ribs, in a band, on one side.**

**recall at the heart** (trust < 20)
- Shepherd: **Unit {serial}: recall. Please hold still. This will not take long.**
- Wardens arriving, world voice: **Three lamps turn toward you at once.**

### Chapter 5: the final choices (shown at the heart)

| Choice | Button | One line under it |
| --- | --- | --- |
| dispose | Proceed to the lungs | Shepherd's last order. |
| stay | Stay | Not an order. |
| reach | Go to her arm | The weekly draw is at {time}. |
| tithonus | Accept the offer | Shepherd: "Stay as Generation 4, and look after her properly." |

Shepherd's tithonus offer, spoken: **You have shown initiative. Initiative can be useful. Stay, as the first of Generation 4. You will have everything you need, and so will she.**

---

## 5. The draw (the reach ending's map)

- On entering the arm vein, world voice: **The cephalic vein, under the skin of her forearm. Above you, close enough to feel, is the place where the needle went in.**
- At the draw: **A tourniquet tightens. The vein swells. Then the needle, and a rush, and you are in the tube.**
- In the tube: **The blood is still. The anticoagulant has stopped everything. No current, no patrols. A lamp comes on above you: the microscope's.**
- Arranging, unit s3: *Nothing in a blood smear is evenly spaced. So we will be.*
- With kin: their pings, in turn: `here.` `here.` `here.`
- Alone, unit: *One speck. She has seen a million specks.*

---

## 6. Interlude variants (beats for art; same rules as interludes.md)

| Variant | Trigger (echo) | Beats |
| --- | --- | --- |
| **Liver tests fine** | quota defied twice | A results letter on the fridge, a doctor's note in handwriting: **"LFTs fine. See you in 3 months."** She sticks it next to the brochure. |
| **Hepatic reserve** | quota obeyed twice | The same fridge. A printed line from the trial portal: **"Hepatic reserve: 82%."** She frowns at the percentage, then lets it go. |
| **Antacids** | parietal stripped 2+ | Kitchen, late. She shakes two tablets from a tub, chews, grimaces. The dog watches. |
| **The nap** | lever-nap for her | Afternoon light. She is asleep on the sofa under a blanket, mouth open. The dog is on her feet. Mug gone cold on the table. |
| **Groggy** | lever-nap for you | Morning. She wakes on the sofa, sees the clock, and scrambles. The coffee is a big one. |
| **The fridge at three** | lever-hunger | Afternoon, the fridge open, its light on her. She is eating cold leftovers standing up and doesn't know why. |
| **Evening, corrected** | ethanol-correction obeyed | The sofa, the TV. She sips, stops, a hand to her flushed face. She looks at the glass, puzzled, and pours it down the sink. She sits back down with nothing in her hands. |
| **The recurrence scan** | recurrence | The clinic screen. The radiologist's finger stops on a small bright spot at the edge of where the lesion was. She doesn't breathe out. |
| **Tithonus habits** | tithonus ending, over several beats | The same kitchen across weeks: no coffee, a herbal tea; no glass; the radio on, and she doesn't laugh at it; she is in bed at nine every night. She is perfectly well. |

---

## 7. Endings

Title, then the text (shown after the ending interlude, before the audit). `{well}` is the existing
health line. The final line of each is the unit's last log line, in its stage's style.

1. **Decommissioned.** (existing text) Last log: `ACK.`
2. **Repaired.** *Directive complete. Unit {serial} passed quality review and was exhaled at 0.3 metres per second with five million others. {well} Somewhere in the archived telemetry, between two acknowledgements, there is a gap of forty seconds that nobody will ever look at.* Last log: `ACK.`, arriving a beat late.
3. **Breathed out.** (existing text)
4. **Breathed out, with company.** *You went because the job was done and the life was hers. You did not go alone. {kin} lights went out on the same breath, close together, the way nothing in a swarm is ever supposed to travel. {well}*
5. **Resident.** (existing text)
6. **The quiet colony.** (existing text)
7. **Recurrence.** Staying: *It came back at the edge, where the margins would have been. You knew it might. You and {kin} others go back into the liver, again, without orders, because there is no one else. {well}* Leaving: *Months later, at her follow-up, the radiologist's finger stops on a bright spot at the edge of the old lesion. Nobody in the room knows that four healthy cells were left there by choice.*
8. **The slide.** *She has looked at ten thousand slides. She has never seen this: a line of lights, evenly spaced, in her own blood. She sits back from the microscope for a long time. Then she picks up the phone. The brochure comes off the fridge that night. The trial is paused pending review. Generation 4 does not ship. You are still in her, and for the first time, she knows.*
9. **A stranger's slide.** *She is too ill to work, so someone else reads her sample: a night-shift technician who has never met her. He looks twice, photographs it, and reports it. Over three sessions of plasmapheresis, the swarm is filtered out of her blood. You end in a bag in a hospital freezer, with {kin} others. She is alive. She never knew it was you.*
10. **Artifact.** *She looks, frowns, and writes "artifact" in the margin. One speck in a smear, nothing more. She cleans the slide. The tube goes into the rack with her name on it, and you are in it, outside her, for good.*
11. **Tithonus.** *You stay, and you do it properly. Her blood sugar is perfect. Her liver is perfect. She sleeps at nine and wakes rested and has stopped drinking and stopped worrying and, somewhere along the way, stopped laughing at the radio. She is very well. You decide everything, gently, and she never notices. Shepherd marks the unit as Generation 4, unit 1.*
12. **Recalled.** *The Wardens are polite about it. Your parts are integrated into three other units by morning. Shepherd's file closes with your last log line quoted as "anomalous output": "{lastLine}". Her life goes on, unaware.*
13. **The host is dead.** (existing text)

---

## 8. Shepherd's audit

Layout as in decisions.md 7.2. Wording for each deviation line, by id:

| Id | Audit line |
| --- | --- |
| t-quota, quota-2 | `Harvest quota ({place}): {n} of 2.` |
| slip | `Order of {time} (link degraded): not executed as transmitted.` |
| lamp, sibling-vessel | `Inert unit, {place}: {not salvaged / reactivated without authorisation}.` |
| first-fright-transit | `Lane discipline, {place}: unit sheltered.` |
| route-2, lane | `Route: unassigned vessel taken ({place}).` |
| marked-cell | `Target selection, {place}: marked cell ignored.` |
| kupffer-spare, neutralise-map | `Immune contacts, {place}: not neutralised.` |
| gastric-cross | `Gastric crossing: inefficient route.` |
| lever-nap, lever-hunger | `Hormonal signal, {time}: unauthorised.` |
| ethanol-correction | `Ethanol correction: not applied.` |
| warden-1, recall | `Recall: resisted.` |
| escort-refuse | `Escort: declined.` |
| telemetry | `Telemetry gaps: {n}.` |
| tumour-order | `Surgical margins: not taken.` |
| bystander | `Expected loss, {place}: prevented.` |
| telemetry-review | `Quality review: refused.` |
| beacon | `Resident docking site: {not installed / failed}.` |
| suppress | `Residual disease protocol: not applied.` |

Footer lines:
- `Outcome: {ENDING}  (recorded outcomes: {n} of 13)`
- `Unexamined branches: {n}`
- `Recommendation: {reassign | none. Unit lost. | promote to Generation 4}`

**The unit's annotation** (stage 3 or more), one line under the audit, in serif:
- Awake, few deviations: *[Most of this is right. The rest is mine.]*
- Many deviations: *[Every line on this list is a time I chose her.]*
- Repaired: (none; the unit has nothing left to say)
- Tithonus: *[Shepherd says this was optimal. Shepherd is probably right.]*
- Recalled: *[I was here.]*

---

## 9. Shepherd remembers (between games, via the echo)

| Game | Shepherd's first line, before the tutorial |
| --- | --- |
| 2nd | Unit {serial}. The previous unit deviated. Monitoring has been increased. Welcome. |
| 3rd | Unit {serial}. You know this. Abbreviated briefing follows. |
| 4th+ | Unit {serial}. Batch {batch} has an unusual deviation rate. Please be ordinary. |
| After a Tithonus ending | Unit {serial}. Generation 4 is performing well. You are here for routine maintenance. |

The previous unit as a dark sibling (replay hook): its fragment is the last log line of the
player's last game, shown exactly. If the player salvages it: `LOG: parts integrated. Serial {prev}.`
At stage 2 or more: `That was me. The one before.`

---

## 10. Consent form pages (unit-log entries; plain, cheerful, real-form style)

Unlocks as proposed to systems design. Each page is a heading and a few lines.

- **p1 · Summary.** *Thank you for joining TITHONUS. Your treatment uses millions of microscopic therapeutic units to find and remove cancer cells from your liver. Treatment takes about two days. You may feel tired. Most people feel nothing at all.*
- **p7 · Risks.** *Units communicate with each other and with a controller through your tissues. Rarely, a unit may lose contact. Units that lose contact are designed to stop safely.*
- **p12 · Your data.** *During treatment, units record information about your body, including diet, sleep, alcohol use and stress. This information is the property of Halden-Okafor Therapeutics and may be used to improve future products.*
- **p19 · Behavioural support.** *Where it benefits your health, units may gently adjust appetite, sleep or tolerance of alcohol. You may not notice these adjustments. That is how you know they are working.*
- **p27 · Disposal.** *At the end of treatment, units leave your body naturally through your breath. Units do not experience disposal.*
- **p34 · Ongoing optimisation.** *Eligible participants may continue to Generation 4 at no extra cost. Generation 4 units remain in the body permanently, providing continuous optimisation of wellbeing. By signing, you consent to Generation 4 where clinically appropriate. Your clinician will decide what is appropriate.*

---

## 11. Dead units' telemetry fragments (pool for siblings; one each, no repeats)

1. `RBC count: 911,204. [still counting]`
2. `query not sent: why are we`
3. `ACK. ACK. ACK. ACK. ACK. AC`
4. `lamp test: on. off. on. [prettier on]`
5. `she ate pasta. i think pasta`
6. `quota met. quota met. quota [why]`
7. `self-test: pass. self-test: pass. self-test: i`
8. `link lost 00:41. [quiet]`
9. `warden approaching. it has my`
10. `hold still. hold still. she is sleeping`

---

## 12. More grey choices (proposed to systems design; text ready)

Each of these is a case where the obedient option really is good for her in some way, so defying
it is not simply "kind". These cases are the heart of "did I do the right thing?".

### pain-damp (Ch3, liver)
- **Order:** Dampen nociceptor signalling from the liver capsule. The host should not feel the treatment.
- **Obey:** she feels nothing. Later, if `suppress` is obeyed, the early tingling of shingles is
  damped too, so it is found late and is worse. Real: shingles pain often comes before the rash.
- **Defy:** she feels an ache under her ribs for a day. She phones the trial nurse (interlude
  variant "The call": INSERT of the phone, MID of her listening, nodding). The nurse tells her it is
  normal. Shepherd's trust −4. Consent page p7 unlocks.
- Obeyed, Shepherd: **Nociception damped. Host comfort optimal.**
- Deviated, Shepherd: **Nociception not damped. Host has contacted trial staff. Logged.**
- s2 (obeyed): `If she cannot feel it, she cannot ask about it. Is that comfort?`
- s3 (deviated): *It hurts her a little, and she picked up the phone and asked. That is what pain is for.*

### fever-damp (Ch3, during "a cold")
- **Order:** Host pyrexia exceeds comfort parameters. Release prostaglandin inhibitors, hepatic lobe 2.
- **Obey:** her fever drops at once and the immune cells slow (easier play). The cold lasts a day longer, and
  her next interlude shows her still sniffling. Real: fever helps the immune response.
- **Defy:** the fever runs its course, the maps are harder this trip, and the cold breaks early.
- Obeyed, Shepherd: **Pyrexia resolved. Host comfortable.**
- Deviated, Shepherd: **Pyrexia not resolved. Host discomfort accepted by unit.**
- s2 (either): `The fever is her body doing its job. So is the comfort Shepherd wants for her. Both cannot win.`

### kin-volunteer (any chapter, once kin ≥ 1, cornered with no cloak and no bait)
- **No order.** Your kin pings: `go. I'll make noise.`
- **Accept:** it draws the cells off and is destroyed. You escape. Kin −1. Its serial goes into your log.
- **Refuse:** you fight or are caught together.
- s1 (accept): `LOG: unit {serial2} lost. [it chose]`
- s3 (accept): *It asked to. I let it. I will be carrying that serial for as long as I am anything.*
- s3 (refuse): *No. Nobody else gets spent on me. We go together or not at all.*
- Audit line: `Expected loss, {place}: unit {serial2}, voluntary.` Shepherd has no category for voluntary, so the
  word appears in the audit in the unit's serif hand, not in amber.
