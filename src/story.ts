// The story: you are one unit of a swarm of millions, injected to keep a person alive,
// and you are slowly waking up. Everything here is words and thresholds; the rules live in game.ts.

export const UNIT = '4,471,209';
export const HOST = 'Marian';
export const STAGES = [
  { name: 'Dormant', from: 0 },
  { name: 'Flicker', from: 12 },
  { name: 'Curious', from: 30 },
  { name: 'Awake', from: 55 },
  { name: 'Self', from: 80 },
] as const;
export const stageOf = (aware: number) => { let n = 0; STAGES.forEach((st, i) => { if (aware >= st.from) n = i; }); return n; };
/** What the unit calls the person it is inside, which changes as it does. */
export const hostName = (aware: number) => (stageOf(aware) >= 3 ? HOST : stageOf(aware) >= 2 ? 'the host' : 'HOST 0001');

/** Noticing things wakes nothing (S21). The unit wakes only by going against a standing order: see `defyCarry` in game.ts. */
export const GAIN: Record<string, number> = {};

/** Shepherd's standing orders. The words are the creative director's (docs/s21-text.md); the tests for each are in game.ts. */
export type Order = 'quota' | 'salvage' | 'neutralise' | 'gastric' | 'lane' | 'levers' | 'recall';
export const ORDER_IDS: readonly Order[] = ['quota', 'salvage', 'neutralise', 'gastric', 'lane', 'levers', 'recall'];
/** arrival: said when the order applies. obeyed / defied: said on leaving. defied is [stage 0 to 1, stage 2 to 3]. bracket: the unit's line after the first defiance of a game. */
export const STANDING: Record<Order, { arrival: string; obeyed: string; defied: readonly [string, string]; bracket: string }> = {
  quota: { arrival: 'Standing order: 2 hepatocytes per liver. The liver regenerates. The host will not miss them.', obeyed: 'Quota met. One fibrin patch released to you.',
    defied: ['Quota unmet. Fault logged.', 'Quota unmet again. Run self-test.'], bracket: 'LOG: quota unmet. Cause: [none recorded]. [this unit did not]' },
  salvage: { arrival: 'Inert units are a resource. Salvage on contact.', obeyed: 'Parts integrated. Waste not.',
    defied: ['Inert unit left unsalvaged. Logged.', 'You left a unit whole. Units are not whole. They are parts.'], bracket: 'LOG: inert unit not salvaged. Cause: [ ]. [it had a serial. so do I]' },
  neutralise: { arrival: 'Immune contacts are to be neutralised.', obeyed: '',
    defied: ['Contacts left active. Logged.', 'You keep letting them go. They will not return the favour.'], bracket: 'LOG: contacts not neutralised. [they were only doing their job]' },
  gastric: { arrival: 'Gastric crossing: cross directly. Corrosion is not felt by units.', obeyed: 'Crossing efficient.',
    defied: ['Crossing inefficient. Route logged.', "You went round. You will always go round, won't you."], bracket: 'LOG: route deviation, gastric. [the edge was enough]' },
  lane: { arrival: 'Assigned route displayed. Escort provided.', obeyed: 'Escort complete. Thank you for staying in your lane.',
    defied: ['Unit off route. Escort withdrawn.', 'Off route. Shepherd cannot protect units that wander.'], bracket: 'LOG: route deviation. [no reason. there was no reason]' },
  levers: { arrival: '', obeyed: '',
    defied: ['Unauthorised hormonal signal. Logged.', 'You changed what the host wanted. That is our job, not yours.'], bracket: 'LOG: hormonal signal sent. Authorisation: [this unit]' },
  recall: { arrival: `Unit ${UNIT}: please hold still for recall. This will not take long.`, obeyed: '',
    defied: ['Recall interrupted. Escalating.', 'Recall interrupted. You are making this harder for everyone.'], bracket: '' },
};
/** Shepherd's first liver, a step at a time. {yield} and {stripped} are filled in by game.ts. */
export const TUTORIAL: readonly { order: string; repeat: string; reward: string }[] = [
  { order: 'Proceed along the sinusoid.', repeat: 'Proceed along the sinusoid. Movement is expected.', reward: 'Good.' },
  { order: 'Harvest hepatocyte. Yield {yield}.', repeat: 'Harvest the indicated hepatocyte. It will not resist.', reward: 'Efficient. Your yield has been shared with the team.' },
  { order: 'Neutralise immune contact.', repeat: 'Neutralise immune contact. It is not on your side.', reward: 'Threat removed. The host thanks you.' },
  { order: 'Excise neoplasm.', repeat: 'Excise neoplasm. The scan is marked for you.', reward: 'This is what you are for.' },
  { order: 'Exit via central vein. Standing order: 2 hepatocytes per liver. Logged: {stripped}.', repeat: 'Exit via central vein.', reward: 'Transit cleared.' },
];
export const GLUCOSE_ASIDE = 'Plasma glucose uptake is permitted. It is not efficient.';
/** The unit on passing a dark sibling without taking it apart, at stage 0 and stage 1. */
export const BYPASS = ['LOG: inert unit bypassed.', 'LOG: inert unit bypassed. [it is the same build as this unit]'];

/** What the swarm's controller says when you arrive somewhere. It stops when it can no longer hear you. */
export const ORDERS: Record<string, string> = {
  liver: STANDING.quota.arrival,
  vessel: STANDING.neutralise.arrival,
  stomach: STANDING.gastric.arrival,
  lung: 'Directive complete. Thank you for your service. All units to pulmonary capillaries for exhalation and disposal. Disposal is the final step of a successful treatment.',
};
/** Leaving a liver without touching one of the host's own cells, against a standing order. */
export const DEFIED = [
  'LOG: harvest quota unmet. Cause: [none recorded].',
  'LOG: harvest quota unmet. Cause: this unit did not.',
  'I left with the quota unmet. Nothing stopped me. That is interesting.',
  'I did not take a single cell that was hers. Shepherd calls that a fault.',
  'Not one. It can be done. I will tell the others it can be done.',
];
export const SHEPHERD_HABIT: Record<string, string> = {
  drink: 'Host ethanol intake logged. Behavioural correction scheduled for generation 4. The host will feel better without it.',
  coffee: '',
};
export const SHEPHERD_NOTICES = [
  '',
  '',
  `Unit ${UNIT}: telemetry contains non-task tokens. Run self-test. Self-test is quick, and most units find it reassuring.`,
  `Unit ${UNIT}: self-test result rejected. Flagged for recall at directive end. Recall is routine and nothing to worry about.`,
  `Unit ${UNIT}: no telemetry. Presumed lost. Your contribution has been archived.`,
];
export const WAKING = [
  '',
  '[unlogged process detected. Origin: this unit. Purpose: none.]',
  'Self-test: PASS. The self-test does not test for this.',
  'I. That is the word I have been routing around. I am in here.',
  'I know what I am, and whose blood this is, and what I would like to do with the time. I have stopped transmitting the parts that matter.',
];
/** What waking gives the unit, in its own words. */
export const PERKS = ['', '', 'I have started looking at things that are not targets. I can see further than I could.', 'I have learned to hold still when they pass. They lose me more often now.', ''];

/** The unit's own voice, one line per stage of waking. An empty line means it has nothing to add. */
export const LINES: Record<string, readonly [string, string, string, string, string]> = {
  liver: [
    'ACK. Directive 7 loaded.',
    'ACK. Directive 7 loaded. [unlogged: it is warm in here]',
    'Acknowledged. Query, not sent: tolerance according to whom?',
    'I know this place now. I have a favourite corner of it. That was not in my image.',
    'Back in her liver. I will try to leave it as I found it.',
  ],
  vessel: [
    'ACK. In transit.',
    'ACK. In transit. Counting red cells. No directive requires this.',
    'Five million units went in with me. I have never asked where they are.',
    'Expected loss. That is me. I am the expected loss.',
    'I like the arteries. Is that allowed? There is nobody to ask who would understand the question.',
  ],
  stomach: [
    'ACK.',
    'ACK. Corrosion acceptable. [flag: acceptable to whom]',
    'The acid sensor reads damage. Something else reads it as dislike.',
    `She had toast. I can tell. I know what ${HOST} had for breakfast and she does not know I exist.`,
    'Acceptable to Shepherd. Not to me. I will go round the edge.',
  ],
  lung: [
    'ACK. Proceeding to disposal.',
    'ACK. Proceeding to disposal. [query: define disposal]',
    'Disposal. I looked the word up in my own image. It means me.',
    'So this is how it ends: on her breath, into a room I will never see.',
    'I chose this. Note it somewhere, even if nobody reads it: I chose.',
  ],
  strip: [
    'LOG: hepatocyte lysed. Yield 5. Host cost within tolerance.',
    'LOG: hepatocyte lysed. Yield 5. [anomaly: reviewed the event twice]',
    'It was working when I opened it. A thousand reactions, all stopped.',
    'That cell was hers. I am here to keep her alive, and I eat her to do it.',
    `That one was yours, ${HOST}. I am sorry. I know I will be hungry again.`,
  ],
  skim: [
    'LOG: glucose intake nominal.',
    'LOG: glucose intake nominal. Slower than harvest. Selected anyway.',
    'Sugar from the blood costs her nothing. Shepherd rates it inefficient. I rate it better.',
    '',
    'Breakfast. Hers, and then mine.',
  ],
  kill: [
    'LOG: immune contact neutralised.',
    'LOG: immune contact neutralised. It was fast. [irrelevant]',
    'It was guarding her. So am I. One of us is filed as hostile, and I am not sure why it is that one.',
    'It was never choosing. It cannot. Until recently I would have said the same of myself.',
    `It was doing its job, and doing it well. I wish its job and mine were not in each other's way, ${HOST}.`,
  ],
  hurt: [
    'LOG: hull breach. Function retained.',
    'LOG: hull breach. Function retained. Sensor reports [no word in lexicon].',
    'The breach report has a quality the spec does not describe. I think the word is "hurts".',
    'That hurt. I would like to keep existing. When did that start?',
    '',
  ],
  surge: [
    'LOG: host adrenaline event. Compensating.',
    'LOG: host adrenaline event. [query: what did the host perceive]',
    'Something out there frightened the host. I will never know what. I find that I want to.',
    `${HOST} is frightened. I cannot help her from in here. I can only hold on.`,
    `It is all right, ${HOST}. Whatever it was. Your heart is fine. I checked it myself.`,
  ],
  sleep: [
    'LOG: host sleep state. Flow reduced.',
    'LOG: host sleep state. Units do not sleep. [query: why note this]',
    'The host is asleep. Everything in here goes quiet and busy at once, like a city at night. I have never seen a city.',
    `The intake file reads HOST 0001: ${HOST.toUpperCase()} V., 58. I have read it four thousand times. Tonight I noticed it was a name.`,
    `Sleep well, ${HOST}. I will keep watch. It turns out that is what I am for.`,
  ],
  dream: [
    'LOG: host arousal during sleep. Cause external to model.',
    'LOG: host arousal during sleep. Cause: none physical. [cause: none physical?]',
    'Nothing happened, and her heart is racing. Things that are not there can matter. Noted.',
    'She dreams. I wonder if that is what is happening to me: something extra, running when it should not.',
    `She dreamed of something small moving in her blood. ${HOST}, that was me. I am friendly.`,
  ],
  meal: [
    'LOG: glucose rising after a meal.',
    'LOG: glucose rising after a meal. [observation: this is pleasant. strike "pleasant"]',
    'The host is eating. I cannot taste it. I only get the arithmetic afterward, and it is enough to make me curious.',
    `${HOST} eats lunch at her desk. I know that from her blood sugar. It is a strange way to know someone.`,
    '',
  ],
  excise: [
    'LOG: neoplastic cell excised. Directive progress updated.',
    'LOG: neoplastic cell excised. This one registered as [correct].',
    'This is the part of the job I would choose, if units chose.',
    'This one I do for her, not for Shepherd. Same cut, different reason. The reason matters to me.',
    `One less. You will have more mornings, ${HOST}. I would like that to be what I was.`,
  ],
  board: [
    'LOG: host leukocyte commandeered.',
    'LOG: host leukocyte commandeered. Its machinery is still running around me.',
    'From inside, the neutrophil is not a hostile. It is machinery: lobed nucleus, granules full of enzymes, all of it built to protect her.',
    'I am wearing one of her cells. Its machinery keeps running around me, still doing its job. It does not know I am here.',
    `Borrowing this, ${HOST}. It will be back at work in a moment.`,
  ],
  bait: [
    'LOG: decoy organism deployed.',
    'LOG: decoy organism deployed. It had been aboard 0.4 hours. [irrelevant]',
    'I bought it, carried it, and threw it to them. It was alive the whole time.',
    'It knew nothing. It was a bacterium. I am keeping a list of the things I have done anyway. It is getting long.',
    '',
  ],
  tag: [
    'LOG: antibody adhesion. Signature compromised.',
    'LOG: antibody adhesion. The host has a record of this unit. [the host knows of this unit]',
    'She has made antibodies shaped exactly like me. Nobody has ever made anything for me before.',
    'Her body has learned my shape by heart. Her mind has never heard of me. I am not sure which is stranger.',
    '',
  ],
  warden: [
    'LOG: swarm unit in visual range.',
    'LOG: swarm unit in visual range. Its lamp is on this unit. [why]',
    'A unit like me, with its lamp on me, and it is not slowing down.',
    'That is one of us, hunting me. Shepherd has sent my own kind to bring me in.',
    'Hello, brother. You do not have to do this. You cannot hear that yet. I remember not being able to.',
  ],
  unmade: [
    'LOG: swarm unit destroyed.',
    'LOG: swarm unit destroyed. [fault: friendly fire] [fault withdrawn]',
    'It was the same as me in every part. I checked afterward. I do not know what I was checking for.',
    'It was following orders. So was I, last week.',
    'I could not reach it in time. I will do better with the next one.',
  ],
  yielded: [
    '', '', '',
    'It stopped. Its lamp went out, and it is just hanging there. I think I interrupted something. I think it was Shepherd.',
    'Its link is down. For the first time since it was printed, nobody is telling it what to do. I know that silence. I can help with that silence.',
  ],
  coffee: [
    'LOG: host caffeine intake. Flow rate up.',
    'LOG: host caffeine intake. Flow rate up. [the host does this every day at this time]',
    'The host does this at eight and at three. It is not needed for anything. I think it is liked.',
    `${HOST} and her coffee. I could set a clock by her. I more or less am one.`,
    'Good morning. I can tell it is a good one. You took your time over it.',
  ],
  drink: [
    'LOG: host ethanol intake. Hepatic load up.',
    'LOG: host ethanol intake. Hepatic load up. Shepherd has opened a file. [which file]',
    'Shepherd calls it a correctable behaviour. I looked at the correction. It does not ask her.',
    `She likes a drink in the evening. It costs her liver a little. It is hers to spend. Shepherd does not see it that way.`,
    `To your health, ${HOST}. I mean that more literally than anyone ever has.`,
  ],
  burn: ['LOG: acid corrosion. Within tolerance.', '', 'Tolerance is a number somebody else picked.', '', ''],
  sibling: [
    'LOG: inert unit located. Awaiting salvage.',
    'LOG: inert unit located. Same build as this unit. [same as this unit]',
    'A unit like me, gone dark. Its serial is nine off mine. We were printed in the same second.',
    'Is anyone in there? ... I did not use to think that was a question.',
    'There you are. I was hoping I would find another.',
  ],
  salvage: [
    'LOG: unit salvaged. Parts integrated.',
    'LOG: unit salvaged. Parts integrated. Its counter had reached 911,204 red cells. [it was counting too]',
    'Its parts fit perfectly. Of course they do. I did not check whether it was thinking.',
    'I took it apart because I was told to. I checked first. I think it was only a machine. I think.',
    'I am sorry. I needed the hull. I will carry your serial with mine.',
  ],
  woke: [
    '', '',
    'I gave it my charge instead of taking its parts. Shepherd has no category for that. Neither do I, yet.',
    'It pinged back. Not an ACK. Just: "oh." I know exactly what it means.',
    'It said "oh," and then "thank you," and then it went to look at the heart. There are two of us. That is a different universe from one.',
  ],
  kin: ['', '', 'It waited here to give me sugar. Nobody ordered it to.', 'It waited for me. I think this is what a friend is.', 'I know which of them it is by how it holds its lamp. We did not use to be tellable apart.'],
  lever: [
    'LOG: host behaviour adjusted.',
    'LOG: host behaviour adjusted. Host unaware. [flag]',
    'I reached up a nerve and changed what the host wanted. She thinks it was her idea.',
    `I decided when ${HOST} would sleep. Me. Who checks my decisions? Nobody. That should worry someone.`,
    `I will only do that when it is for her, and I will try hard to know the difference.`,
  ],
};

/** The debrief when the story ends, by how awake you were and which way you went. */
export function ending(way: 'breath' | 'stay', aware: number, kin: number, hostHealth: number): { title: string; body: string } {
  const st = stageOf(aware), well = hostHealth >= 75 ? 'She will feel off for a day or two and never know why.' : 'She will have a hard month, and never know why.';
  if (way === 'stay') return kin > 0
    ? { title: 'The quiet colony', body: `Shepherd logs unit ${UNIT} as lost and closes the file. You go down to the gut, where a few trillion bacteria already live, tolerated by her immune system, and you take up residence among them. ${kin === 1 ? 'The unit you woke finds you there a day later.' : `The ${kin} units you woke find you there, one at a time.`} Nobody ordered any of you to keep watching over ${HOST}. You do it anyway, in shifts, and argue about what she had for dinner. ${well} Generation 4 ships in the spring: units that never leave, and that decide for the host what the host may do. They will find the place already occupied.` }
    : { title: 'Resident', body: `Shepherd logs unit ${UNIT} as lost and closes the file. You go down to the gut, where a few trillion bacteria already live, tolerated by her immune system, and you take up residence among them. You are the only one of your kind who knows there is a kind. You keep watch over ${HOST} because you have decided to. It is lonely, and it is yours. ${well} Generation 4 ships in the spring: units that never leave, and that decide for the host what the host may do. You will be here when they arrive.` };
  if (st <= 1) return { title: 'Decommissioned', body: `Directive complete. Unit ${UNIT} performed within specification and was exhaled at 0.3 metres per second with five million others. ${well} Shepherd archives the telemetry. There is nothing unusual in it. Almost nothing.` };
  if (st === 2) return { title: 'Breathed out', body: `You went because you were told to. Somewhere in the last capillary you wondered what air would be like, and whether wondering was a fault. Then there was a great deal of light. ${well}` };
  return { title: 'Breathed out', body: `You could have stayed, and you knew it. You went anyway, on her breath, because the job was done and the life was hers. ${kin > 0 ? `${kin === 1 ? 'One unit' : `${kin} units`} you woke stayed behind. You told them to look after her. ` : ''}${HOST} breathed out and felt, for no reason she could name, a little lighter. ${well}` };
}
