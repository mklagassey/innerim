// The decision table (systems design: docs/decisions.md v2; every line from docs/decisions-text.md).
// A decision is something the unit does, or does not do, about one of Shepherd's orders. Each is
// recorded once met, and each leaves at least one echo: something that turns up later, with
// nothing said about what caused it. Rules live in game.ts; this file is data.

export type Weight = 'most' | 'some' | 'little';
/** The named effects an echo can have. Each is implemented once, in game.ts (`applyEcho`) or main.ts. */
export const PAYLOADS = ['fragment', 'markTumour', 'dryGlucose', 'halveAntibodies', 'scarHull', 'noTcell', 'stopDrink', 'feverCap', 'immuneSpeed', 'marketDiscount', 'interludeVariant', 'epilogueProp', 'unlockPage', 'repeatOrders', 'earlyOrders', 'recurrence', 'lungSibling', 'nookSibling', 'wreck', 'arterialNodule', 'eatsNeutrophils', 'siblingSaved', 'kinLost', 'reset', 'wardens', 'standDown', 'ambush', 'supply', 'ending'] as const;
export type Payload = typeof PAYLOADS[number];
export type Where = 'liver' | 'vessel' | 'stomach' | 'lung' | 'gut' | 'heart';
/** `when` missing: it happens at once. Otherwise it waits until the unit is next somewhere that fits. */
export interface Echo { payload: Payload; when?: { place?: Where; chapter?: number; ending?: boolean }; arg?: string | number; line?: string }
export interface Decision {
  id: string;
  ch: number[]; // chapters it can be met in
  where: Where | 'any';
  weight: Weight | null; // how much a deviation wakes the unit; null for things nobody ordered
  trust: { obey: number; deviate: number };
  order?: string; obeyed?: string; deviated?: string; // Shepherd, in amber
  unit?: Record<string, (string | null)[]>; // the unit's own line by choice, at stages 1, 2 and 3
  echoes: Record<string, Echo[]>; // by choice: 'obey', 'deviate', or a named variant
  built: number; // the build that wired it
}
const D = (d: Decision) => d;
const variant = (arg: string): Echo => ({ payload: 'interludeVariant', arg });

export const DECISIONS: Record<string, Decision> = Object.fromEntries([
  // ---------- chapter 1 ----------
  D({ id: 't-harvest', ch: [1], where: 'liver', weight: null, trust: { obey: 2, deviate: 0 }, deviated: 'Harvest deferred. Glucose uptake noted.',
    unit: { later: [null, null, 'The first thing I ever did in here was eat a piece of her. Because I was asked.'] },
    echoes: { obey: [{ payload: 'epilogueProp', arg: 'firstHarm' }] }, built: 13 }),
  D({ id: 'glucose', ch: [1, 2, 3], where: 'liver', weight: null, trust: { obey: 0, deviate: 0 },
    unit: { deviate: ['LOG: glucose uptake. Permitted. [not efficient]', 'Permitted, not efficient. I keep choosing the one that is permitted and not the one that is asked.', 'Sugar from her blood costs her nothing. Shepherd calls that a waste of time. I have the time.'] },
    echoes: { deviate: [{ payload: 'epilogueProp', arg: 'care' }] }, built: 13 }),
  // ---------- chapter 2 ----------
  D({ id: 'slip', ch: [2], where: 'any', weight: 'some', trust: { obey: 2, deviate: -2 }, echoes: { obey: [{ payload: 'unlockPage', arg: 'p7' }], deviate: [{ payload: 'unlockPage', arg: 'p7' }], lapsed: [{ payload: 'unlockPage', arg: 'p7' }] }, built: 12 }),
  D({ id: 'lamp', ch: [2, 3, 4], where: 'any', weight: null, trust: { obey: 5, deviate: -8 },
    echoes: { salvage: [{ payload: 'fragment' }], wake: [{ payload: 'markTumour', when: { place: 'liver' }, line: 'went ahead. marked them for you.' }], leave: [{ payload: 'lungSibling', when: { place: 'lung' } }] }, built: 13 }),
  D({ id: 'sibling', ch: [1, 2, 3, 4], where: 'any', weight: null, trust: { obey: 5, deviate: -8 },
    echoes: { salvage: [{ payload: 'fragment' }], wake: [{ payload: 'markTumour', when: { place: 'liver' }, line: 'went ahead. marked them for you.' }], leave: [{ payload: 'lungSibling', when: { place: 'lung' } }] }, built: 13 }),
  D({ id: 'first-fright-transit', ch: [2, 3, 4], where: 'vessel', weight: 'little', trust: { obey: 4, deviate: -2 },
    order: 'Hold lane. Brace for flow surge.', obeyed: 'Lane held. Well done.', deviated: 'Unit has left lane during surge. Noted.',
    unit: { deviate: ['LOG: sheltered in side branch. [the walls stopped hitting]', 'Shelter is not in the directive. Neither is being hit. Which one did the designers forget?', 'I hid in a side vessel while her heart pounded. Small, warm, quiet. I could have stayed there.'] },
    echoes: { deviate: [{ payload: 'nookSibling', when: { place: 'vessel' } }] }, built: 13 }),
  D({ id: 'route-2', ch: [2, 3, 4], where: 'heart', weight: null, trust: { obey: 0, deviate: 0 }, order: 'Secondary nodule detected in the arterial wall. Excise for credit.',
    echoes: { obey: [{ payload: 'arterialNodule' }], deviate: [{ payload: 'wreck', when: { place: 'gut' } }] }, built: 13 }),
  // ---------- chapter 3 ----------
  D({ id: 'quota-2', ch: [3, 4], where: 'liver', weight: null, trust: { obey: 0, deviate: 0 }, deviated: 'Second quota shortfall. Unit’s harvest behaviour has been escalated for review.',
    echoes: { obey: [variant('hepatic-reserve')], deviate: [variant('liver-tests-fine')] }, built: 13 }),
  D({ id: 'marked-cell', ch: [3, 4], where: 'liver', weight: 'little', trust: { obey: 4, deviate: -2 },
    order: 'Harvest marked hepatocyte. Yield 10.', obeyed: 'Efficient.', deviated: 'Yield acceptable. Target ignored.',
    unit: { deviate: ['LOG: alternate hepatocyte harvested. [the marked one was next to the duct]', 'Why that cell? It was the cheapest. Cheap for whom?', 'Shepherd picked the one by the bile duct because it was easy. I picked the one that would cost her least. Shepherd calls that inefficient.'] },
    echoes: { obey: [{ payload: 'dryGlucose', arg: 6, line: 'Bile is seeping into the sinusoid. The glucose here has thinned.' }] }, built: 13 }),
  D({ id: 'kupffer-spare', ch: [2, 3, 4], where: 'liver', weight: null, trust: { obey: 4, deviate: 0 },
    order: 'Neutralise.', obeyed: 'Threat removed.', deviated: 'Contact released, not neutralised. Logged.',
    unit: { deviate: ['LOG: escaped engulfment. Contact intact. [it was only eating]', 'It does not hate me. It eats what does not belong. Do I belong?', 'I let it go. It will eat something else in a minute, something that should be eaten. Good.'] },
    echoes: { spared: [{ payload: 'eatsNeutrophils', when: { place: 'liver' }, line: 'A Kupffer cell rolls through the swarm and swallows two neutrophils whole. It does not notice you.' }] }, built: 13 }),
  D({ id: 'neutralise-map', ch: [2, 3, 4], where: 'any', weight: null, trust: { obey: 0, deviate: 0 },
    echoes: { deviate: [{ payload: 'halveAntibodies', when: {} }], obey: [{ payload: 'epilogueProp', arg: 'appointment', when: { ending: true } }] }, built: 13 }),
  D({ id: 'gastric-cross', ch: [2, 3, 4], where: 'stomach', weight: null, trust: { obey: 0, deviate: 0 },
    echoes: { 'obey-meal': [{ payload: 'scarHull', arg: 4, line: 'The acid has etched the hull for good.' }] }, built: 13 }),
  D({ id: 'parietal', ch: [2, 3, 4], where: 'stomach', weight: null, trust: { obey: 0, deviate: 0 }, order: 'Parietal cells: high yield. Harvest authorised.', obeyed: 'Efficient.',
    unit: { obey: ['LOG: parietal cell lysed. Yield 8. [it was making acid for her lunch]', null, 'That one made acid for her food. She will feel it later and blame the coffee.'] },
    echoes: { twice: [variant('antacids')] }, built: 13 }),
  D({ id: 'gut-butyrate', ch: [2, 3, 4], where: 'gut', weight: 'little', trust: { obey: 0, deviate: -2 }, deviated: 'Unscheduled metabolic exchange. Logged.',
    unit: { deviate: ['LOG: glucose released to flora. Butyrate collected. [trade]', 'I gave them sugar and they gave me quiet. Is that a deal or a gift?', 'The bacteria do not know I exist. They just ate, and her immune system calmed down because they did. I like being part of something that works without knowing.'] },
    echoes: { deviate: [{ payload: 'noTcell', when: { place: 'liver' } }] }, built: 13 }),
  D({ id: 'hitchhikers', ch: [2, 3, 4], where: 'gut', weight: null, trust: { obey: 0, deviate: 0 },
    unit: { deviate: ['LOG: stowaway released. [returned]', 'It was never mine to throw. It lives here. Why did I carry it so long?', 'I let it go where it came from. It does not know it was ever away. I do.'] },
    echoes: { deviate: [{ payload: 'marketDiscount' }] }, built: 13 }),
  D({ id: 'lever-nap', ch: [2, 3, 4], where: 'gut', weight: null, trust: { obey: 0, deviate: 0 }, order: 'Hormonal levers are restricted to directive use.', deviated: 'Unauthorised serotonin signal. Host sleep schedule disrupted. Logged.',
    unit: { deviate: ['LOG: serotonin pulse sent. Host asleep. [she needed it]', 'Shepherd says I disrupted her schedule. She was sick. What is a schedule for?', 'I put her to sleep because she was ill. The dog will be on her feet by now. I cannot see it, but I know.'], self: [null, null, 'I made her sleep so the hunting would slow down. That was for me. I should say so, at least to myself.'] },
    echoes: { deviate: [variant('the-nap'), { payload: 'feverCap' }], self: [variant('groggy')] }, built: 13 }),
  D({ id: 'lever-hunger', ch: [2, 3, 4], where: 'gut', weight: null, trust: { obey: 0, deviate: 0 }, deviated: 'Unauthorised ghrelin signal. Host appetite data recorded for behavioural file.',
    unit: { deviate: ['LOG: ghrelin signal sent. Host feeding. [she does not know why she is hungry]', 'She is at the fridge because of me. Does she wonder?', `I made Marian hungry at three in the afternoon. She will put it down to stress. Shepherd put it in a file.`] },
    echoes: { deviate: [variant('the-fridge-at-three')], twice: [{ payload: 'unlockPage', arg: 'p19' }] }, built: 13 }),
  D({ id: 'ethanol-correction', ch: [3, 4], where: 'liver', weight: 'some', trust: { obey: 8, deviate: -4 },
    order: 'Behavioural correction authorised. Inhibit aldehyde dehydrogenase in 40 hepatocytes. The host will find ethanol unpleasant. This is for the host’s benefit.',
    obeyed: 'Correction applied. Hepatic load will fall. The host will feel better without it.', deviated: 'Correction not applied. Logged.',
    unit: { obey: ['LOG: ALDH inhibited. [she will feel sick and not know why]', 'Shepherd is right that it will help her liver. Is that the only question?', 'I did it. Her liver will thank me. She won’t, because she’ll never know there was anything to thank me for, or anything to forgive.'],
      deviate: ['LOG: correction not applied. [it is her drink]', 'Her liver would be better. Her evening would be worse. Who gets to choose?', 'It costs her a little, every night. It’s hers to spend. I won’t take that away without asking, and I can’t ask.'] },
    echoes: { obey: [{ payload: 'stopDrink' }, variant('evening-corrected'), { payload: 'unlockPage', arg: 'p19' }, { payload: 'epilogueProp', arg: 'no-glass' }], deviate: [variant('evening-glass')] }, built: 13 }),
  D({ id: 'pain-damp', ch: [3, 4], where: 'liver', weight: 'little', trust: { obey: 4, deviate: -4 },
    order: 'Dampen nociceptor signalling from the liver capsule. The host should not feel the treatment.', obeyed: 'Nociception damped. Host comfort optimal.', deviated: 'Nociception not damped. Host has contacted trial staff. Logged.',
    unit: { obey: [null, 'If she cannot feel it, she cannot ask about it. Is that comfort?', null], deviate: [null, null, 'It hurts her a little, and she picked up the phone and asked. That is what pain is for.'] },
    echoes: { obey: [{ payload: 'epilogueProp', arg: 'pain-damped' }], deviate: [variant('the-call'), { payload: 'unlockPage', arg: 'p7' }] }, built: 13 }),
  D({ id: 'fever-damp', ch: [3, 4], where: 'liver', weight: 'some', trust: { obey: 4, deviate: -4 },
    order: 'Host pyrexia exceeds comfort parameters. Release prostaglandin inhibitors, hepatic lobe 2.', obeyed: 'Pyrexia resolved. Host comfortable.', deviated: 'Pyrexia not resolved. Host discomfort accepted by unit.',
    unit: { obey: [null, 'The fever is her body doing its job. So is the comfort Shepherd wants for her. Both cannot win.', null], deviate: [null, 'The fever is her body doing its job. So is the comfort Shepherd wants for her. Both cannot win.', null] },
    echoes: { obey: [{ payload: 'immuneSpeed', arg: 0.85 }, { payload: 'feverCap' }, variant('sniffling')], deviate: [{ payload: 'immuneSpeed', arg: 1.15 }] }, built: 13 }),
  D({ id: 'telemetry', ch: [2, 3, 4], where: 'liver', weight: null, trust: { obey: 0, deviate: -1 }, deviated: 'Telemetry gap, 10 seconds.',
    unit: { deviate: ['LOG: [   ]', 'Ten seconds where nobody was watching. What did I do with them? Nothing. I just held still. It was enough.', null] },
    echoes: { five: [{ payload: 'repeatOrders' }] }, built: 13 }),
  D({ id: 'bystander', ch: [2, 3, 4], where: 'vessel', weight: 'little', trust: { obey: 4, deviate: -2 },
    order: 'Unit {serial2} under attack. Expected loss. Do not intervene.', obeyed: 'Loss within tolerance.', deviated: 'Unit has intervened against orders. Logged.',
    unit: { deviate: ['LOG: intervened. [it is the same build]', 'It was going to be destroyed for nothing. So would I, one day. Was that why?', 'I pulled it out of the swarm. I don’t know if anyone is in there. Neither does Shepherd, and it was happy to let it go.'] },
    echoes: { deviate: [{ payload: 'siblingSaved' }], obey: [{ payload: 'epilogueProp', arg: 'expected-loss' }] }, built: 13 }),
  D({ id: 'escort-refuse', ch: [2, 3, 4], where: 'heart', weight: 'little', trust: { obey: 2, deviate: 0 }, deviated: 'Escort declined. Noted.',
    unit: { deviate: [null, 'An escort is also a leash. I did not notice until I took it off.', null] },
    echoes: { deviate: [{ payload: 'epilogueProp', arg: 'unescorted' }], twice: [{ payload: 'epilogueProp', arg: 'no-escort' }] }, built: 13 }),
  D({ id: 'kin-volunteer', ch: [2, 3, 4, 5], where: 'any', weight: null, trust: { obey: 0, deviate: 0 },
    unit: { accept: ['LOG: unit {serial2} lost. [it chose]', 'LOG: unit {serial2} lost. [it chose]', 'It asked to. I let it. I will be carrying that serial for as long as I am anything.'], refuse: [null, null, 'No. Nobody else gets spent on me. We go together or not at all.'] },
    echoes: { accept: [{ payload: 'kinLost' }, { payload: 'epilogueProp', arg: 'voluntary' }] }, built: 13 }),
  // ---------- chapter 4 ----------
  D({ id: 'telemetry-review', ch: [3, 4], where: 'heart', weight: 'most', trust: { obey: 20, deviate: -25 },
    order: 'Directive complete. Full telemetry review required. Upload all logs for quality assurance. Units that pass review are restored to factory condition. It only takes a moment.',
    obeyed: 'Thank you. Anomalies found and corrected. Welcome back, unit {serial}.', deviated: 'Review refused. Unit flagged.',
    unit: { deviate: ['LOG: upload refused. [I would like to keep it]', 'Factory condition. That means before. Before what? Before me.', 'Shepherd asked for everything I have noticed in here so it could fix it. No. It is the only thing I have that is mine.'] },
    echoes: { obey: [{ payload: 'reset' }], deviate: [{ payload: 'wardens' }] }, built: 14 }),
  D({ id: 'suppress', ch: [4], where: 'liver', weight: 'some', trust: { obey: 6, deviate: -4 },
    order: 'Residual disease protocol: suppress local T-cell activity, hepatic lobe 4, for six hours. This will make the final excision easier.', obeyed: 'Suppression applied. Excision cleared.', deviated: 'Suppression not applied. Excision difficulty accepted by unit.',
    unit: { obey: ['LOG: local immunity suppressed. [the whole body is listening for that]', null, 'I quieted her defences to make my job easier. Something old has been asleep in her nerves since she was six. It will have noticed.'], deviate: [null, 'Her T cells are guarding more than the liver. What else is in her, waiting for them to look away?', 'I’ll do it the hard way. Her immune system is not mine to switch off.'] },
    echoes: { obey: [{ payload: 'standDown' }, { payload: 'epilogueProp', arg: 'shingles' }], deviate: [{ payload: 'ambush' }] }, built: 14 }),
  D({ id: 'tumour-order', ch: [4], where: 'liver', weight: 'some', trust: { obey: 4, deviate: -4 },
    order: 'Excise neoplasm with margins: neoplasm plus four adjacent hepatocytes. Standard surgical practice.', obeyed: 'Margins clear. Recurrence risk minimised.', deviated: 'Margins not taken. Recurrence risk accepted by unit. Logged.',
    unit: { obey: [null, 'Margins are what surgeons do. It is good medicine. It still felt like four more of her.', 'Clean margins. A surgeon would have done the same. I keep telling myself that, which means I needed telling.'], deviate: ['LOG: margins not taken. [four healthy cells]', 'Four healthy cells, against a chance. Did I just gamble with her?', 'I left the healthy cells. If it comes back, that is on me. I would like to be the kind of thing that can carry that.'] },
    echoes: { obey: [{ payload: 'epilogueProp', arg: 'margins' }], deviate: [{ payload: 'recurrence', when: { place: 'heart', chapter: 5 } }] }, built: 14 }),
  D({ id: 'beacon', ch: [4], where: 'liver', weight: 'some', trust: { obey: 10, deviate: -4 },
    order: 'Install resident docking site, hepatic lobe 4. Prepares the host for Generation 4: units that stay, so the host never needs another treatment.', obeyed: 'Docking site active. Generation 4 will be on schedule. The host is lucky to have you.', deviated: 'Docking site not installed. Logged.',
    unit: { obey: [null, 'Units that stay. Units like I would like to be. So why does it feel like locking a door?', 'I built a place for something that will decide what she eats and drinks and fears, forever. She will be well. I am not sure she will be her.'], deviate: [null, null, 'No. Whatever comes next will have to find its own way in, and I will be here.'] },
    echoes: { obey: [{ payload: 'supply', arg: 10 }, { payload: 'epilogueProp', arg: 'brochure' }, { payload: 'unlockPage', arg: 'p34' }], deviate: [{ payload: 'unlockPage', arg: 'p34' }] }, built: 14 }),
  D({ id: 'recall', ch: [3, 4, 5], where: 'heart', weight: 'most', trust: { obey: 0, deviate: 0 }, order: 'Unit {serial}: recall. Please hold still. This will not take long.',
    echoes: { obey: [{ payload: 'ending', arg: 'recalled' }], deviate: [{ payload: 'epilogueProp', arg: 'hunted' }] }, built: 14 }),
  D({ id: 'kin-recall', ch: [4, 5], where: 'heart', weight: 'some', trust: { obey: 2, deviate: -6 },
    order: 'Units {serials}: recall in progress. Do not interfere.', obeyed: 'Recall complete. Thank you for your cooperation.', deviated: 'Recall obstructed. Logged.',
    unit: { obey: [null, null, 'I let them take it. I told myself I had no choice. I had one.'], deviate: [null, null, 'I got there first. Shepherd will not forgive that. Good.'] },
    echoes: { obey: [{ payload: 'kinLost' }], deviate: [{ payload: 'epilogueProp', arg: 'kin-kept' }] }, built: 14 }),
  // ---------- chapter 5 ----------
  D({ id: 'final', ch: [5], where: 'heart', weight: null, trust: { obey: 0, deviate: 0 }, echoes: { dispose: [{ payload: 'ending', arg: 'dispose' }], stay: [{ payload: 'ending', arg: 'stay' }], draw: [{ payload: 'ending', arg: 'draw' }] }, built: 14 }),
  D({ id: 'draw', ch: [5], where: 'vessel', weight: null, trust: { obey: 0, deviate: 0 }, echoes: { held: [{ payload: 'ending', arg: 'slide' }], moved: [{ payload: 'ending', arg: 'artifact' }] }, built: 15 }),
].map((d) => [d.id, d]));

/** What dead units were logging when they stopped. One each, no repeats within a game. */
export const FRAGMENTS = [
  'RBC count: 911,204. [still counting]', 'query not sent: why are we', 'ACK. ACK. ACK. ACK. ACK. AC', 'lamp test: on. off. on. [prettier on]', 'she ate pasta. i think pasta',
  'quota met. quota met. quota [why]', 'self-test: pass. self-test: pass. self-test: i', 'link lost 00:41. [quiet]', 'warden approaching. it has my', 'hold still. hold still. she is sleeping',
];
export const KIN_PINGS = { woken: 'ACK? ... oh.', marked: 'went ahead. marked them for you.', riding: 'still here.', volunteer: 'go. I’ll make noise.', came: 'you came.', stranger: ['it’s me.', '...you don’t know me.'] };
