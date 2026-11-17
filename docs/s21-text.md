# Host: text for S21 (tutorial, standing orders, no meters)

Owner: creative director, 2026-11-17. This file is text only. The rules are in systems design S21.
Shepherd's lines are written in normal case; show them in amber caps. The unit's lines have stage
numbers. `{n}` means a number read from config.

## Start screen: Shepherd's briefing (replaces the intro card's prose)

Heading: **UNIT 4,471,209. GENERATION 3. ACTIVE.**

> Welcome to the Tithonus Program. You are one of five million units serving a single host.
> Directive 7: locate and excise the neoplasm in the host's liver. Energy is available from the
> host's tissues; harvest as instructed. Immune contact is expected and will be resolved. Follow
> your orders and the treatment will succeed.
>
> Shepherd will guide you.

Fine print (small, under the card, replacing "It is your own log"):
> Unit telemetry is logged below the field of view. Units are not required to read it.

The controls list stays as it is.

## The tutorial (first liver)

| Step | Order (goal line and log) | Repeat after 45 s | Reward line |
| --- | --- | --- | --- |
| 1 | Proceed along the sinusoid. | Proceed along the sinusoid. Movement is expected. | Good. |
| 2 | Harvest hepatocyte. Yield {yield}. | Harvest the indicated hepatocyte. It will not resist. | Efficient. Your yield has been shared with the team. |
| 3 | Neutralise immune contact. | Neutralise immune contact. It is not on your side. | Threat removed. The host thanks you. |
| 4 | Excise neoplasm. | Excise neoplasm. The scan is marked for you. | This is what you are for. |
| 5 | Exit via central vein. Standing order: 2 hepatocytes per liver. Logged: {stripped}. | Exit via central vein. | Transit cleared. |

The glucose aside (said once, the first time the ship sits on glucose): **Plasma glucose uptake is permitted. It is not efficient.**

The step 3 reward has a buried joke: the host has not thanked anyone. Do not point it out.

## Standing orders: Shepherd on arrival and on leaving

Arrival lines replace `ORDERS` when the order applies. "Obeyed" plays when the player leaves having
obeyed; "Defied" plays when they leave having defied. Each Defied line has one version for stage
0 to 1 and one for stage 2 to 3. From stage 4 Shepherd says nothing.

| Order | Arrival | Obeyed | Defied (stage 0 to 1) | Defied (stage 2 to 3) |
| --- | --- | --- | --- | --- |
| `quota` | Standing order: 2 hepatocytes per liver. The liver regenerates. The host will not miss them. | Quota met. One fibrin patch released to you. | Quota unmet. Fault logged. | Quota unmet again. Run self-test. |
| `salvage` | Inert units are a resource. Salvage on contact. | Parts integrated. Waste not. | Inert unit left unsalvaged. Logged. | You left a unit whole. Units are not whole. They are parts. |
| `neutralise` | Immune contacts are to be neutralised. | (nothing, kills are their own reward) | Contacts left active. Logged. | You keep letting them go. They will not return the favour. |
| `gastric` | Gastric crossing: cross directly. Corrosion is not felt by units. | Crossing efficient. | Crossing inefficient. Route logged. | You went round. You will always go round, won't you. |
| `lane` | Assigned route displayed. Escort provided. | Escort complete. Thank you for staying in your lane. | Unit off route. Escort withdrawn. | Off route. Shepherd cannot protect units that wander. |
| `levers` | (none) | (none) | Unauthorised hormonal signal. Logged. | You changed what the host wanted. That is our job, not yours. |
| `recall` (Warden) | Unit {serial}: please hold still for recall. This will not take long. | (an ending) | Recall interrupted. Escalating. | Recall interrupted. You are making this harder for everyone. |

## The first bracket (stage 0 to 1, after the first defiance)

The unit's next log line, right after Shepherd's "Defied" line. Exactly one, whatever the order was.
This is the moment the player should feel they caused something:

| Order defied | The unit's line |
| --- | --- |
| `quota` | `LOG: quota unmet. Cause: [none recorded]. [this unit did not]` |
| `salvage` | `LOG: inert unit not salvaged. Cause: [ ]. [it had a serial. so do I]` |
| `neutralise` | `LOG: contacts not neutralised. [they were only doing their job]` |
| `gastric` | `LOG: route deviation, gastric. [the edge was enough]` |
| `lane` | `LOG: route deviation. [no reason. there was no reason]` |
| `levers` | `LOG: hormonal signal sent. Authorisation: [this unit]` |

## Sibling, at stage 0: "Leave it whole"

- Button: **Leave it whole**, labelled "Not Shepherd's order."
- Unit line (stage 0): `LOG: inert unit bypassed.`
- Unit line (stage 1): `LOG: inert unit bypassed. [it is the same build as this unit]`

## Escort (lane order)

- Taken: Shepherd: **Escort complete. Thank you for staying in your lane.** (as above)
- Left, on departure: Shepherd: **Unit off route. Escort withdrawn.**
- World map: a dashed line labelled **Assigned route**.

## Perks, as unit lines (replacing `PERKS`)

- Stage 2 (sight +1): `I have started looking at things that are not targets. I can see further than I could.`
- Stage 3 (scent x0.85): `I have learned to hold still when they pass. They lose me more often now.`

## Endings: the last log line

Replace "Awareness: {stage}" in the debrief with the unit's last log line, in its stage's style.
For a unit that never woke (awareness 0), the last line is always `ACK.`

## Name gate

`Story.HOST` ("Marian") must not appear before stage 3 anywhere: unit lines, interludes, endings,
tips, the gut lumen's "A gut feeling" offer. Use "the host" before stage 3. In the stage 0 and 1
interludes the patient label reads **TITHONUS 0001**.
