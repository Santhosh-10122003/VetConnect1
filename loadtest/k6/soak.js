// Soak test: steady moderate load for a long time (default 1 hour) to expose memory leaks, connection leaks
// and slow degradation. Compare the first and last 10 minutes of p95 and watch the JVM heap / Hikari pool.
//   docker compose -f loadtest/docker-compose.yml run --rm -e DURATION=30m k6 run soak.js
import http from 'k6/http';
import { sleep } from 'k6';
import { BASE_URL, TOKEN_POOL, authHeaders, loginCustomers, loadDoctorIds, randomWeekday, pick, getSlots, freeSlots, bookSlot, checkOk } from './lib/common.js';

export const options = {
  scenarios: {
    steady: { executor: 'constant-vus', vus: parseInt(__ENV.VUS || '30', 10), duration: __ENV.DURATION || '1h' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export function setup() {
  const users = loginCustomers(TOKEN_POOL).filter((u) => u.petIds.length > 0);
  return { users, doctors: loadDoctorIds(users[0].token, 100) };
}

export default function (data) {
  const me = pick(data.users);
  const h = { headers: authHeaders(me.token) };
  checkOk(http.get(`${BASE_URL}/api/doctors?size=10`, { ...h, tags: { name: 'GET /api/doctors' } }), 'search');
  const doctorId = pick(data.doctors);
  const date = randomWeekday(45);
  const slots = freeSlots(getSlots(me.token, doctorId, date));
  if (Math.random() < 0.1 && slots.length > 0) bookSlot(me.token, doctorId, pick(me.petIds), date, pick(slots));
  sleep(1 + Math.random() * 2);
}
