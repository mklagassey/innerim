# Host: art and audio direction

(Working title changed from Insiderim to **Host** on 2026-11-17.)

The look and sound of the game, for anyone (human or Claude) adding to it. The world bible
(`/mnt/project-files/creative/world-bible.md`, section 3) sets the tone; this file turns it into
rules you can check a change against. When the two disagree, the world bible wins on *what*
something means and this file wins on *how* it looks or sounds.

## 1. The one-line brief

**A live microscope feed from inside a warm, wet, enormous animal that does not know you are there.**

Not a cartoon of biology. Not sci-fi chrome. Think of confocal micrographs, electron-microscope
colourings, Drew Berry's molecular animations and Harvard's *Inner Life of the Cell*, lit by a
single small lamp and filmed through fluid.

Four words to test every change against: **dark, wet, warm-lit, moving.**

## 2. Pillars

1. **The lamp is the only key light.** The unit carries the light. Everything outside its reach
   falls to deep maroon and then to `--void`. Other light is *organic*: glucose glows, an
   inflamed patch smoulders, a vein has a cold bioluminescent cast. Nothing is lit from a
   ceiling, because there is no ceiling.
2. **Everything is suspended in fluid.** Plasma is full of things: platelets, protein flecks,
   lipid droplets, debris. They drift with the current, catch the lamp and blur when they pass
   close to the lens. This is what sells scale: you are smaller than the dust.
3. **Nothing is still.** Walls pulse with the heartbeat, the stomach churns, the lung breathes.
   Even an idle screen should drift. But the motion is slow, heavy and liquid: tissue eases,
   it never snaps.
4. **Wet surfaces.** Membranes have a thin specular rim and a soft glint. Surfaces read as soft
   and slightly translucent (light bleeds into them), never as hard plastic or flat colour.
5. **The machine is the stranger.** The unit, wardens and anything Shepherd makes are the only
   hard, straight-edged, cold-coloured things in the frame. Their teal and cyan should feel
   foreign against the warm flesh.
6. **Readable first.** At 1x zoom on a phone, the player must find their ship, every threat and
   the exit in under a second. Atmosphere layers sit *under* readability: if a mote or haze
   hides a neutrophil, the mote loses.

## 2a. Realism rule (Mick, 2026-11-17)

Keep it as close to scientific fact as a game allows. Bend physics or biology only where a good
story, time or scale would otherwise be unworkable, the way *The Martian* bends its windstorm or
*The Expanse* its drives. We are not making a simulator, but it should be close.

- **Nothing biological is a character.** No faces, eyes, expressions or creature-like body
  language on cells, the tumour, bacteria or viruses. A tumour is frightening because it is
  real, not because it is evil.
- **Draw things as they really look and behave.** Shapes, sizes, colours (stain logic) and
  motion should come from micrographs and physiology. Immune cells crawl and extend
  pseudopods; they do not lunge, snarl or pounce.
- **The only bends allowed are for readability.** Exaggerated contrast, a colour key per place,
  a soft glow on something the player must find, or slightly larger scale on a tiny thing.
  Write a one-line comment in the code naming the bend.
- The machine side (the unit, wardens, Shepherd's UI) can carry personality. The biology
  cannot.

## 3. Motion and flashing safety (hard rules)

Mick is sensitive to flashing and abrupt pops. These are not style preferences; a change that
breaks one is a bug.

- **No more than one brightness pulse per beat, and never more than 3 per second** in total.
  The music can play double-time kicks; the picture still moves once per beat.
- **No full-screen flashes.** A beat-synced brightness change may cover the screen edges or a
  ring, and may change brightness by at most ~15% of the area it covers.
- **Avoid saturated red flicker** (the most provocative colour for photosensitivity). Red can
  glow and swell; it cannot blink.
- **Everything appears and disappears with a fade**, 0.3 s at the very least, 0.5 to 1 s for
  anything large (tiles, cards, colour grades). Use smoothstep easing, not linear.
- **Honour reduced motion** (`view.still`, from `prefers-reduced-motion`): no camera punch, no
  wall sway, no scan lines, no drifting particles across the screen; keep information.
- **No high-contrast fine patterns that move** (stripes, checkerboards) larger than a small
  icon.

## 4. Palette

Colours live as CSS tokens in `src/page.html` and as constants in `src/render.ts`. Reuse these
before adding new ones.

### Ground and UI

| Token | Hex | Use |
| --- | --- | --- |
| `--void` | `#0a0407` | Unlit tissue, the edge of everything |
| `--clot` | `#1c0b11` | Panels |
| `--seam` | `#4a2028` | Panel edges |
| `--bone` / `--bone-dim` | `#f1e3d0` / `#a8917f` | Text |
| `--blood` | `#e23a30` | Hull, damage, danger |
| `--amber` | `#ecb42e` | Energy, glucose, Shepherd's voice |
| `--vein` | `#5680ff` | Veins, deoxygenated blood |

### Places (the organ keys)

Each place has a **key colour** that tints its light, haze and particles, so a screenshot tells
you where you are.

| Place | Key | Haze tint | Feel |
| --- | --- | --- | --- |
| Liver | bile gold `#d9a441` over flesh pink | warm amber | Dense, granular, crowded |
| Artery | ember red `#ff5a3c` | hot red-orange | Fast, bright, loud |
| Vein | bioluminescent blue `#4f7dff` | cold blue | Slow, dim, cold |
| Stomach | acid green `#9cd25a` | sickly yellow-green | Slimy, churning, corrosive |
| Lung | pale rose `#e8b8cc` | cool pink-white | Airy, thin, vast, breathing |
| Heart | deep crimson `#b0122a` | dark red | Enormous, violent, rhythmic |

### Factions

| Who | Colour | Shape language |
| --- | --- | --- |
| Host tissue | Flesh pinks and maroons, purple nuclei (H&E stain logic) | Lumpy, soft, rounded, packed |
| Immune cells | Pale ivory to lilac, lobed dark nuclei | Blobby, reaching, pseudopods |
| T cells | Pale with a blue-violet cast | Smaller, rounder, quicker |
| The unit (you) | Gunmetal and pale grey, hazard-yellow band, cyan lights | Hard teardrop, straight seams |
| Wardens (Shepherd's units) | Same hull, amber lights | Same silhouette, colder posture |
| Shepherd's UI | Amber caps | Clean, procedural |

## 5. Lighting and atmosphere stack

Drawn in this order (bottom to top). `src/atmosphere.ts` owns layers 5 to 8.

1. **Floor**, faded between remembered and lit.
2. **Standing things** (cells, enemies, ship), depth sorted.
3. **Shots and effects**, additive.
4. **Lamp falloff** (in `render.ts`): darkness by distance from the unit.
5. **Plasma particulate**: small specks drifting with the current at three depths, brightest
   inside the lamp's reach. Count scales with screen area, capped for phones.
6. **Lamp haze**: a soft warm in-scatter glow around the ship, as if the lamp lights the fluid
   itself.
7. **Foreground bokeh**: a few large, very soft, out-of-focus discs drifting slowly past the
   lens. Low opacity (under 0.12). They are the strongest scale cue we have.
8. **Grade**: a gentle place-keyed colour wash and a vignette. Changes between places fade
   over about a second.
9. **Alert overlays** (edge glow, rings), **info markers**, **night tint**, **map**.

## 6. The unit's ship

- **Silhouette**: a fat teardrop with twin engine pods; must read at 20 px.
- **Materials**: worn gunmetal and pale grey, not toy white. Satin, not chrome.
- **Lights**: cyan running lights and engine wash; the lamp warms from cold white toward amber as
  the unit wakes up (awareness stage), the only warm machine light in the game.
- **State reads on the hull** (already in `hero()`): cracks and scorch with damage, plating lines
  per glycocalyx level, cloak shimmer, cortisol halo, stowaways.
- Turning eases with a slight roll; never snaps.

## 7. Audio direction

### The brief

**You are inside a body, so you hear it through a body.** Everything is warm, low, damp and a
little muffled. High frequencies are rare and therefore special: they belong to the machine.

### Rules

1. **Synthesised, not sampled.** Everything is generated with Web Audio in `src/audio.ts` and
   `src/music.ts`. The published page cannot load sound files.
2. **The heart is the clock.** The host's heartbeat sets the tempo of the music, the wall pulse
   and the screen's one-per-beat movement. Nothing rhythmic runs on its own timer.
3. **A shared acoustic space.** Effects and music pass through one body-cavity reverb: short,
   dark and dense (around 1.5 s, heavily low-passed), so everything sounds like it is in the
   same wet room.
4. **Each place has a bed.** A continuous ambience under everything, keyed to the place:
   - Vessel: rushing flow that swells with each beat, brighter in arteries.
   - Liver: a slower, thicker flow; faint granular ticking.
   - Stomach: deep, irregular gurgles and slow churn when digesting.
   - Lung: airy wind that rises with inhale and falls with exhale.
   - Heart: the heartbeat itself, huge.
   Beds cross-fade over 1 to 2 seconds when the place changes.
5. **Frequency budget.** Below 120 Hz belongs to the heart and the bass. 300 Hz to 3 kHz is
   effects and voice-like sounds. Above 4 kHz is the machine (UI ticks, the unit's systems,
   glitches) and is used sparingly.
6. **Music escalation** (in `music.ts`, Geometry Wars-style): from sparse glitch-pop blips at
   calm, through a sub-bass throb when noticed, to a full beat with bass, hats, lead and stabs
   at high alert. Tension arrives fast and drains slowly. The picture's escalation (edge glow,
   rings, camera punch) follows the same `heat` number.
7. **No sudden loud.** Every sound has an attack of at least a few milliseconds; nothing jumps
   more than about 6 dB above the mix; the master runs through a compressor. Damage is told by
   a low thud, not a shriek.
8. **Ear fatigue.** Repeated sounds vary pitch slightly and are rate-limited so a busy fight
   sounds busy, not harsh.

## 8. Checklist for anything new

- [ ] Reads as a real biological thing (with one liberty), not a cartoon. No faces, no creature-like behaviour (section 2a).
- [ ] Fits the place key colour, or is the machine's cyan/amber on purpose.
- [ ] Fades in and out; no pops; obeys the flashing rules in section 3.
- [ ] Moves a little, slowly, unless reduced motion is on.
- [ ] Readable on a phone at default zoom, and does not hide threats.
- [ ] Has a sound that fits the frequency budget, routed through the shared reverb.
- [ ] Gets an info box in `src/tips.ts` the first time the player meets it.
