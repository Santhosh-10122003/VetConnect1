// Load test: expected traffic. ~80% browsing (doctors, slots, my appointments), ~20% booking.
// Ramp up, hold, ramp down. Pass/fail is decided by the thresholds below.
//   docker compose -f loadtest/docker-compose.yml run --rm -e PEAK_VUS=50 k6 run load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL, TOKEN_POOL, authHeaders, loginCustomers, loadDoctorIds, randomWeekday, pick, getSlots, freeSlots, bookSlot, checkOk } from './lib/common.js';

const PEAK = parseInt(__ENV.PEAK_VUS || '50', 10);
const bookings = new Counter('bookings_created');
const conflicts = new Counter('bookings_conflict');

export const options = {
  scenarios: {
    mixed: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: PEAK },   // ramp up
        { duration: '3m', target: PEAK },   // hold
        { duration: '30s', target: 0 },     // ramp down
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],                  // under 1% errors (a 409 on booking is expected and not counted as failed)
    http_req_duration: ['p(95)<500'],                // 95% of requests under 500 ms
    'http_req_duration{name:POST /api/appointments}': ['p(95)<800'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  const users = loginCustomers(TOKEN_POOL).filter((u) => u.petIds.length > 0);
  const doctors = loadDoctorIds(users[0].token, 100);
  return { users, doctors };
}

export default function (data) {
  const me = pick(data.users);
  const h = { headers: authHeaders(me.token) };

  if (Math.random() < 0.8) {
    // read path: search, open a doctor, look at free slots, sometimes check my own bookings
    checkOk(http.get(`${BASE_URL}/api/doctors?size=10&page=${Math.floor(Math.random() * 5)}`, { ...h, tags: { name: 'GET /api/doctors' } }), 'search');
    sleep(Math.random() * 2);
    const doctorId = pick(data.doctors);
    checkOk(http.get(`${BASE_URL}/api/doctors/${doctorId}`, { ...h, tags: { name: 'GET /api/doctors/:id' } }), 'doctor');
    checkOk(getSlots(me.token, doctorId, randomWeekday(30)), 'slots');
    if (Math.random() < 0.3) {
      checkOk(http.get(`${BASE_URL}/api/appointments/my`, { ...h, tags: { name: 'GET /api/appointments/my' } }), 'my appointments');
    }
  } else {
    // write path: pick a free slot and book it
    const doctorId = pick(data.doctors);
    const date = randomWeekday(45);
    const slots = freeSlots(getSlots(me.token, doctorId, date));
    if (slots.length > 0) {
      const res = bookSlot(me.token, doctorId, pick(me.petIds), date, pick(slots));
      if (res.status === 201) bookings.add(1);
      else if (res.status === 409) conflicts.add(1);
      check(res, { 'booking: 201 or 409': (r) => r.status === 201 || r.status === 409 });
    }
  }
  sleep(1 + Math.random() * 2); // think time
}
