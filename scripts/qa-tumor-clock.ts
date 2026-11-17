// QA model: does a careful, skim-only human-paced mission finish with the host alive?
// Uses the real tumorDrain and host clock numbers; play time per place is an assumption,
// taken from Mick's run reports (livers 6-12 min, vessels 1-2 min). Run: npx tsx scripts/qa-tumor-clock.ts
import { CONFIG } from '../src/config';
import * as G from '../src/game';
const h = CONFIG.host, perHour = h.secondsPerHour;
const asleep = (hr: number) => hr >= h.asleepFrom || hr < h.asleepUntil;
function play(livers: number, liverSec: number, vesselSec: number, otherDamage = 0) {
  let hour = h.startHour, host = 100, excised = 0, drained = 0, low = 100, mend = 0, minutes = 0;
  const spend = (sec: number) => {
    for (let t = 0; t < sec; t += 1) {
      hour = (hour + 1 / perHour) % 24; minutes += 1 / 60;
      drained += G.tumorDrain(excised) / perHour; if (drained >= 1) { drained -= 1; host--; }
      if (asleep(hour) && host < 100 && (mend += 1) >= h.sleepHeals) { mend = 0; host++; }
      low = Math.min(low, host);
    }
  };
  const quiet = () => { hour = (hour + CONFIG.wait.legHours) % 24; drained += G.tumorDrain(excised) * CONFIG.wait.legHours; while (drained >= 1) { drained--; host--; } };
  for (let trip = 0; trip < livers; trip++) {
    spend(vesselSec);           // hepatic artery patrol
    spend(liverSec);            // the liver
    excised = Math.min(CONFIG.tumor.goal, excised + CONFIG.tumor.cells);
    host -= otherDamage;        // frights, slams, the odd strip
    spend(vesselSec);           // hepatic vein patrol
    quiet();                    // vena cava
    if (excised >= CONFIG.tumor.goal) break;
  }
  spend(90);                    // the lungs
  return { host, low, minutes: Math.round(minutes), hour: Math.floor(hour) };
}
console.log('drain at 0, 9, 18 excised:', [0, 9, 18].map((e) => G.tumorDrain(e).toFixed(2)).join(', '), '% per host hour; sleep mends', (perHour / h.sleepHeals).toFixed(1), 'per host hour asleep');
for (const liverMin of [4, 6, 8, 10, 12, 15]) for (const other of [0, 5, 10]) {
  const r = play(3, liverMin * 60, 90, other);
  console.log(`liver ${String(liverMin).padStart(2)} min, other host damage ${String(other).padStart(2)}/liver: host ends ${String(r.host).padStart(3)}%  (lowest ${r.low}%), ${r.minutes} min of play, ends ${r.hour}:00`);
}
