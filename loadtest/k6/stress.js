// Stress test: keep raising the request rate until something breaks, to find the limit.
// Read the first stage where p95 or the error rate climbs: that is the capacity of this setup.
//   docker compose -f loadtest/docker-compose.yml run --rm k6 run stress.js
import http from 'k6/http';
import { BASE_URL, TOKEN_POOL, authHeaders, loginCustomers, loadDoctorIds, randomWeekday, pick, getSlots, checkOk } from './lib/common.js';

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-arrival-rate',   // a fixed requests/second, however slow the server gets
      startRate: 20,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 50, duration: '1m' },
        { target: 100, duration: '1m' },
        { target: 200, duration: '1m' },
        { target: 400, duration: '1m' },
        { target: 600, duration: '1m' },
        { target: 0, duration: '30s' },
      ],
    },
  },
  // no pass/fail gates: the point is to read the numbers. The abort rule only stops a test that has clearly collapsed.
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.5', abortOnFail: true, delayAbortEval: '30s' }],
  },
};

export function setup() {
  const users = loginCustomers(TOKEN_POOL);
  return { users, doctors: loadDoctorIds(users[0].token, 100) };
}

export default function (data) {
  const me = pick(data.users);
  const h = { headers: authHeaders(me.token) };
  const r = Math.random();
  if (r < 0.4) checkOk(http.get(`${BASE_URL}/api/doctors?size=10`, { ...h, tags: { name: 'GET /api/doctors' } }), 'search');
  else if (r < 0.7) checkOk(http.get(`${BASE_URL}/api/doctors/${pick(data.doctors)}`, { ...h, tags: { name: 'GET /api/doctors/:id' } }), 'doctor');
  else checkOk(getSlots(me.token, pick(data.doctors), randomWeekday(30)), 'slots');
}
