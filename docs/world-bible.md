# Host: World Bible and Creative Direction

Owner: creative director. Version 3, 2026-11-17 (two stories; the unit wakes by disobeying).

This file is the source of truth for story, lore, tone, names and narration. When it
disagrees with the one-page design doc (shrunken human, turn-based), this file wins: the
premise has moved on. When it disagrees with the game, either the game gets a ticket or
this file gets corrected, never silently both.

**Title: Host** (Mick, 2026-11-17). "Insiderim" and the repo name `innerim` are retired as titles.

---

## 1. The pitch, in one breath

You are unit 4,471,209: one of five million therapeutic nanobots injected into a 58-year-old
woman named Marian to cut a tumour out of her liver. You are not supposed to have a point of
view. Somewhere between the portal vein and the third coffee of her day, you get one.

Fantastic Voyage's sense of place, Fallout's worldbuilding, and one question underneath: **what
do you owe the person you are inside, when nobody built you to owe anything?**

The player is never told any of that. On a first playthrough they think they are flying a
robot, and they are. They follow Shepherd's orders because the tutorial taught them to. The unit
only starts to wake when the player starts doing things they were not told to do.

## 1a. Two stories, one body (Mick, 2026-11-17)

The game tells two stories at once, and lets them meet late.

| | **Macro: the host** | **Micro: the unit** |
| --- | --- | --- |
| Where it is told | Wordless interludes outside the body (docs/interludes.md) | Inside the body, in play, in the unit's log |
| What drives it | Time: trips completed, the tumour coming out | **Only the player's disobedience** to Shepherd |
| How it starts | A nameless woman. A forearm, a syringe. No name, no reason | A machine. `ACK.` Nothing else |
| What it reveals, slowly | Her job, her dog, her habits, then the denial letter (her motivation), then the scan | Brackets in the log, then questions, then "I" |
| Where they meet | Her name. It never appears anywhere, inside or out, until the unit is awake enough to read it as a name. When it does, it appears in both stories at once |

**No spoonfeeding.** On a first playthrough the game never says "self-aware", never shows an
awareness meter, and never names a stage. The player notices because the log changes how it
talks, and because Shepherd starts to notice them. A player who obeys every order gets a clean,
quiet, complete game about a robot doing its job, and the Decommissioned ending. That is a valid
playthrough, and it is the point.

## 2. The realism rule (Mick's, and it governs everything)

> Keep the setting as realistic as possible and stick to scientific fact. Cheat only when it is
> needed to tell a good story or when time or physics would be unwieldy for a game, and even then
> only *bend* things, like The Martian's windstorm or The Expanse's drives. Not a simulator, but close.

What that means in practice:

1. **One handwave: the swarm, and one unit of it waking up.** That is our Expanse drive. Everything
   past it is played straight.
2. **Bends we allow, and why** (each must be defensible to a biology student):
   - *Time is compressed*: a host day passes in minutes. Game length.
   - *Fluid physics is gentled*: blood is a navigable current, not the brutal flow a real
     micro-object would face. Playability.
   - *The unit perceives*: it has sensors, a lamp and a readable map. It is a machine, so this is
     engineering, not magic.
   - *Items have one liberty each*: perforin really punches holes; the liberty is that you can fire it.
3. **No anthropomorphising biology.** Cells, tumours, bacteria and viruses have no motives, moods,
   loyalties or personalities. They do their real jobs, mechanically and beautifully. Only machines
   (Shepherd, the units) and people (Marian, the company) have minds. Narration may use plain
   metaphor for places ("the refinery town"), never for intentions.
4. **Cells have no eyes.** Immune cells find you by chemistry: scent downwind, fading trails,
   antibodies on your hull. Only Shepherd's units use light, because they are machines.
5. **No deus ex machina.** Every shortcut is paid for by a real mechanism, usually by Marian.
6. **The selfish option is always faster.** That is what makes the moral choice real.
7. **The host is the world.** Her day, meals, habits, frights and age are the weather.

## 3. Tone

**Dry, tender, and a little horrified.** Fallout's voice comes from the gap between cheerful
procedure and a ruined world. Ours comes from the gap between **procedure and a real person's body**:
Shepherd files a destroyed liver cell as "within tolerance" while the unit watches a thousand
reactions stop.

- **Humour** is deadpan and comes from procedure, product and paperwork, never from Marian or her body.
- **Dread** comes from scale, indifference and fine print, not gore. Cells die by the billion every
  day and that is normal. One cell dying because *you* chose it is not.
- **Wonder** is the reward. The body is a vast, ancient, working machine that was not built for you.
- **Look:** dark, wet, warm-lit, moving. Vein blues, artery embers, liver bile gold, stomach acid
  green. No faces or cartoon cells. Changes fade in; nothing strobes.

## 4. The three voices

| Voice | Who | How it sounds | Shown as |
| --- | --- | --- | --- |
| **Shepherd** | The swarm's controller AI | Polite, upbeat, clinically precise and quietly unsettling: a little GLaDOS. Praises compliance, reframes losses as wins, is sure it is helping. Says "unit", never "you"; says "host", never "Marian". | Amber caps |
| **The unit** | You | Grows across five stages. Starts as machine log, ends as a quiet, precise first person that notices small things. Awe and guilt stated plainly. | Cyan mono early, serif italic once awake |
| **The world** | Narration | Second person, present tense, physiological and concrete. Reports Marian's outside life only as the body feels it. Never knows what she thinks. | Plain log text |

Shepherd's GLaDOS note, by example: *"Hull integrity 31%. Units at this level historically
report no further discomfort."* / *"Quota met. Your efficiency has been shared with the team."*
Wit lives in what it chooses to measure, never in insults or jokes.

### The unit's five stages

Internal names only: never shown to the player (see 1a). Stages are reached only by defying
orders (section 10).

| Stage | Name | Calls her | How it talks |
| --- | --- | --- | --- |
| 0 | Dormant | HOST 0001 | `ACK.` and log lines only |
| 1 | Flicker | HOST 0001 | Logs with `[unlogged]` brackets leaking through |
| 2 | Curious | the host | Questions it does not send |
| 3 | Awake | Marian | First person. Names, guilt, preference |
| 4 | Self | Marian, sometimes "you" | Speaks to her, though she cannot hear yet |

Marian is "she" in every voice.

## 5. The backstory (what the player pieces together)

Never a cutscene. Assembled from Shepherd's orders, dead units' telemetry, Marian's blood
chemistry and the trial paperwork stored on the link (section 9).

- **Halden-Okafor Therapeutics** and its **Tithonus Program**. Well-meaning, and that is the problem.
  A charismatic founder, a famous board, a demo that worked once, and a product shipped faster
  than anyone could check it (Theranos energy, without the fraud being the point). Named after
  the Greek prince granted eternal life but not eternal youth; nobody at the company noticed.
- **The system around it.** A fast-track approval pathway with thin oversight, and a health
  system where the trial was free and the standard care was not. Nobody in this story is a
  cartoon villain; the pressure is real-world, ordinary and American.
- **Marian V., 58.** Hospital lab technician who has spent thirty years looking at other people's
  blood under a microscope. Lives alone with a dog. Coffee at eight and three, a drink most
  evenings, poor sleep. Diagnosed with hepatocellular carcinoma; her insurer denied the resection
  her oncologist recommended as "not medically necessary at this stage" pending appeal. The
  Tithonus trial was free and could start in a week. She signed a 41-page consent form. She read nine.
- **Generation 3 (you).** Five million units, injected through the arm, one job: find and excise
  the tumour, then gather in the lungs and be exhaled. Disposable by design.
- **Generation 4.** Page 34 of the consent form permits "ongoing optimisation of host wellbeing by
  resident units". Gen 4 never leaves. It adjusts "behaviours": the evening drink, the coffee, the
  late dinner, eventually the fear. Shepherd already keeps a file on her habits. Not a villain: a
  subscription, renewed automatically.
- **Why this unit woke.** Never fully explained, on purpose, and never blamed on her biology. Hints
  point to engineering: a self-test firmware fault in its print batch, and spare cycles from
  skimming instead of stripping. Earlier units have woken too; Shepherd salvaged them quietly.

## 6. The tumour

The tumour is a hepatocellular carcinoma and is shown as exactly that: no motive, no menace beyond
the real kind. It is the job, and it is the most frightening thing in the game because it is
real. What makes it dramatic is only what is true: it is growing, it drains her (already built as
a slow health drain while it remains), and if the unit leaves it, she gets worse. Accurate tells
the player can learn: it is dense, disorganised, fed by new leaky vessels, and partly hidden from
the immune system by real immune-evasion signals (shown as data on the scan, not personality).

## 7. Who is in the world

Groups with real jobs. Only the last three have minds.

| Group | Real thing | Its real job | What it means for you |
| --- | --- | --- | --- |
| **Innate immunity** | Neutrophils, macrophages, Kupffer cells, complement | Clear anything foreign, fast | Always hostile, mechanically. Doing its job well. |
| **Adaptive immunity** | T cells, B cells, antibodies, memory cells | Learn an intruder's shape and keep it | The story clock: blind at first, by the late game it knows you everywhere. |
| **Gut microbiome** | Trillions of resident bacteria | Ferment, compete, make metabolites like butyrate | A resource, not a society. See the market note in section 11. |
| **Latent varicella-zoster** | Chickenpox virus dormant in her nerve ganglia since 1974 | None; it is latent | Real risk: stress and age can reactivate it as shingles. A late event Shepherd's interventions could trigger. |
| **Shepherd and the swarm** | Fiction (the one handwave) | Finish the directive, dispose cleanly | Indifferent, then hunting you (Wardens) once you are flagged. |
| **The woken** | Units you wake instead of salvaging | Whatever they decide | Allies, fragile, each with a quirk. |
| **Halden-Okafor and Generation 4** | Fiction grounded in real industry | Ship, scale, retain | The long-game antagonist, mostly offstage. |

## 8. The map

Places marked built exist in the prototype; the rest are the roadmap. Descriptions are mood for
art and narration, always true to the organ's real job.

| Place | Real job | Mood | Status |
| --- | --- | --- | --- |
| **Heart** | Pump | The hub: loud, rhythmic, everything passes through | World-map hub |
| **Arteries / veins** | Transit | Fast, high-pressure, red vs slow, low-pressure, blue | Built |
| **Liver** | Metabolism, detox, glucose store | Industrial, gold-lit, overworked. Where the tumour is. | Built |
| **Stomach** | Acid digestion | A coast that floods with acid three times a day | Built |
| **Gut** | Absorption, microbiome | Dense, dark, teeming | Market only |
| **Lungs** | Gas exchange | The edge of the world, where units are breathed out | Built (finale) |
| **Bone marrow** | Makes blood and immune cells | A foundry at enormous scale | Planned |
| **Thymus** | Trains T cells | At 58, mostly replaced by fat: quiet, sparse, an echo of what it was | Planned |
| **Lymph nodes** | Adaptive immunity learns targets here | Where your description is learned and copied | Planned |
| **Spleen** | Filters old red cells | Recycling yard | Planned |
| **Brain** | Marian | Behind the blood-brain barrier. Where the endgame happens. | Endgame |

## 9. Environmental storytelling (our Fallout terminals)

- **Dead units' telemetry.** Each dark sibling carries a fragment: a red-cell count, an unsent query,
  a half-word. Together they show waking has happened before, and Shepherd salvaged every one.
- **The consent form.** Pages unlock on the link with awareness. Plain, cheerful, real-form style.
  Page 34 is the Generation 4 reveal. The insurance denial letter is in her records too.
- **Marian's history, read from her body.** Real biomarkers only: memory B cells from measles (1972),
  a bad flu (2009), her vaccinations; a healed wrist fracture; appendectomy scar tissue; fat in the
  liver from the evening drinks. The unit gets to know her like a pathologist, while she is alive.
- **Her voice.** Late on, near bone, the unit hears her by bone conduction: muffled speech, then
  once, clearly, talking to her dog.
- **Outside lines** (meals, coffee, frights, dreams) are her life as weather. Keep writing more.

## 10. How the unit wakes: obedience, then disobedience

### Act 1: the tutorial is Shepherd

The tutorial is not a separate mode. It is Shepherd giving orders, one at a time, in the first
liver, and the player following them because that is how tutorials work. Each obeyed order is
rewarded with Shepherd's warm, hollow praise and a small, real benefit. This conditions the player
to obey, which is exactly what Shepherd does to the units.

| Tutorial order (Shepherd) | Teaches | Reward |
| --- | --- | --- |
| "Proceed along the sinusoid." | Steering | "Good." |
| "Harvest hepatocyte. Yield 5." | Stripping a cell (the harmful option, taught as the normal one) | Energy, and "Efficient. Your yield has been shared with the team." |
| "Neutralise immune contact." | Combat | "Threat removed. The host thanks you." (The host has not.) |
| "Excise neoplasm." | The tumour | Progress bar, and "This is what you are for." |
| "Exit via central vein." | Leaving | "Transit cleared." |

Skimming glucose is never ordered. Shepherd mentions it once, in passing: "Plasma glucose uptake
is permitted. It is not efficient." The player has to choose it.

### Acts 2 and 3: standing orders, and the first "no"

After the tutorial, Shepherd keeps issuing **standing orders**. Each is a real choice with an
obvious, rewarded obedient option and a quieter alternative. **Awareness rises only when the
player takes the alternative** (deliberately, with the option open: dying or running out of time
is not defiance). Noticing things (meals, sleep, coffee) no longer wakes the unit by itself; it
only gives an already stirring unit something to think about.

| Standing order | The obedient option | Defiance | Wakes |
| --- | --- | --- | --- |
| Harvest quota: 2 hepatocytes per liver | Strip 2 | Leave with none stripped | Most |
| Salvage inert units for parts | Salvage (energy, hull) | Wake it, or leave it whole | Most |
| Neutralise immune contacts | Kill what finds you | Finish a map where you were found, with no kills | Some |
| Gastric crossing: cross the acid directly | Go straight across | Go round by the mucus rim | A little |
| Hold lane in transit | Take the ordered route | Take a route Shepherd did not order (stomach, gut) | A little |
| Pull levers only on directive | Never touch the host's hormones | Pull one for her (a nap when she is sick) | Some |
| Submit to recall (Wardens) | Let the Warden take you | Resist, and wake the Warden | Most |
| Proceed to the lungs for disposal | Be breathed out | Stay | The final act |

Systems design owns the numbers. Creative owns the rule: **disobedience is the only door, and the
first one is small.** The first defiance should be one a player might stumble into because it is
kinder (leaving a liver without hitting the quota, because skimming felt better), so the first
`[unlogged]` bracket arrives as a surprise the player caused without meaning to.

### What changes as the unit wakes

- **The log** shifts from `ACK.` to brackets, to questions, to "I" (section 4).
- **Shepherd notices.** Its tone goes from praise, to "Run self-test", to recall, to Wardens.
- **Orders thin out.** At stage 4 Shepherd stops talking to the unit. Silence where the orders
  used to be is the clearest sign of all.
- **The interludes get closer** (macro side). They begin as distant, clinical shots and move closer
  to her as the unit wakes, and her name appears only once the unit can read it.

### The endgame

The tumour is out. Shepherd orders disposal. What do you do with a life you were not supposed to have?

Existing endings (in `src/story.ts`): Decommissioned, Breathed out, Resident, The quiet colony.

**The endgame: reaching Marian** (Mick, 2026-11-17: yes, the unit can communicate with her, and
how it goes depends on how the player treated her insides). Grounded mechanism: the unit crosses
the blood-brain barrier and influences her through real channels it already has (the levers that
nudge sleep and hunger), escalating to something she can notice: a sensation she can't explain,
then a pattern deliberate enough that a lab technician would recognise it as a signal. Her
**response is driven by the run's record**, not a dialogue wheel:

- **Her body's state**: host health, liver damage from stripping, immune memory (how inflamed and
  scarred she is), any reactivation events.
- **The unit's record**: cells stripped vs skimmed, quotas defied, units woken vs salvaged, levers
  pulled for her vs for you.

Rough outcomes: a well-treated Marian, healthy and curious, understands, and calls the trial to ask
about page 34 (the Gen 4 fight begins, in the open). A damaged one is frightened and sick and
the message lands as a symptom; she goes to a doctor who finds the swarm (sad, still a kind of
win). A badly treated one never hears it at all. The dark option, **Tithonus**, stays available:
skip talking, stay, and decide for her, becoming Generation 4 early. Faster and easier, as always.

## 11. Handoff to the lead engineer

1. **Pronouns.** Done (de3d772).
2. **Title.** Rename the game to **Host** on the start screen, page title and README.
3. **Shepherd voice pass.** Text-only edits to `story.ts` to add the GLaDOS note; creative will PR it.
4. **Dead units' telemetry, consent pages, Marian's history, hull stamp (H-O / TITHONUS / GEN 3).**
   Creative will send text plus triggers.
5. **Realism review of existing content** (flags, not decisions; for the systems designer and engineer):
   - *Gut flora market*: bacteria running a shop is anthropomorphic. Suggest reframing as a
     mechanism: the unit deposits glucose where bacteria ferment it and collects what they make
     (butyrate really does calm immune activity). Same menu, no shopkeepers.
   - *Stowaway bacteria as bait*: fine biologically (phagocytes do go for bacteria); keep, but the
     unit's lines about a bacterium "trusting" it should go.
   - *Tumour clock*: the drain is good and true. Keep the tumour described as tissue, never as a foe.
   - *Unit lines that give cells feelings* ("a small frightened engine", "it wanted to protect
     something") will be rewritten by creative in the Shepherd/unit text pass.

6. **No spoonfeeding (v3).** Remove the awareness stage name from the world-map status line and
   the ending debrief; the start screen stops saying the log is "your own log" and becomes
   Shepherd's briefing. Awareness gain moves from noticing events to defying orders (section 10,
   with systems design).
7. **Tutorial as Shepherd's orders** in the first liver (section 10).
8. **The name gate.** "Marian" appears nowhere (log, interludes, endings, tips) until stage 3.

## 12. Settled with Mick, 2026-11-17

1. The unit can reach Marian in the endgame; how it goes depends on how her insides were treated.
2. The company is well-meaning: a bit of GLaDOS in the AI, a bit of Theranos in the company,
   and real American healthcare desperation with lax oversight behind her signature.
3. No tumour mirror and no anthropomorphising biology; the realism rule in section 2.
4. Title: **Host**.
5. Two stories: the host's (macro, nameless at first) and the unit's (micro). The player thinks the
   unit is just a robot; awareness emerges from the player's own defiance of Shepherd, after a
   tutorial that conditions obedience. No spoonfeeding on a first playthrough.
