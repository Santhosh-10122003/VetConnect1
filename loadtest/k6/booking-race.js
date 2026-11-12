// Correctness under contention: many customers try to book THE SAME slot at the same instant.
// Pass = exactly one 201 and every other answer is 409. Anything else (two 201s, a 500) is a booking bug.
//   docker compose -f loadtest/docker-compose.yml run --rm -e RACERS=50 k6 run booking-race.js
import { Counter } from 'k6/metrics';
import exec from 'k6/execution';
import { loginCustomers, loadDoctorIds, randomWeekday, pick, getSlots, freeSlots, bookSlot } from './lib/common.js';

const RACERS = parseInt(__ENV.RACERS || '50', 10);
const won = new Counter('race_booked_201');
const lost = new Counter('race_conflict_409');
const bad = new Counter('race_unexpected');

export const options = {
  scenarios: {
    race: { executor: 'per-vu-iterations', vus: RACERS, iterations: 1, maxDuration: '1m' },
  },
  thresholds: {
    race_booked_201: ['count==1'],                    // exactly one winner: no double booking
    race_unexpected: ['count==0'],                    // no 500s, no surprises
    race_conflict_409: [`count==${RACERS - 1}`],
  },
};

export function setup() {
  const users = loginCustomers(RACERS).filter((u) => u.petIds.length > 0);
  if (users.length < RACERS) throw new Error(`need ${RACERS} customers with a pet, got ${users.length}; raise LOADTEST_CUSTOMERS`);
  const doctors = loadDoctorIds(users[0].token, 100);
  // find one free slot with a random doctor on a random weekday
  for (let i = 0; i < 50; i++) {
    const doctorId = pick(doctors);
    const date = randomWeekday(60);
    const slots = freeSlots(getSlots(users[0].token, doctorId, date));
    if (slots.length > 0) return { users, doctorId, date, slot: pick(slots) };
  }
  throw new Error('could not find a free slot');
}

export default function (data) {
  const me = data.users[exec.vu.idInTest - 1];
  const res = bookSlot(me.token, data.doctorId, me.petIds[0], data.date, data.slot, 'POST /api/appointments (race)');
  if (res.status === 201) won.add(1);
  else if (res.status === 409) lost.add(1);
  else {
    bad.add(1);
    console.error(`unexpected ${res.status}: ${res.body}`);
  }
}
