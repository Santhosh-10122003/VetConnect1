// Smoke test: one user walks the main flow once. Run it first, to prove the scripts and the data are right.
//   docker compose -f loadtest/docker-compose.yml run --rm k6 run smoke.js
import http from 'k6/http';
import { check, group } from 'k6';
import { BASE_URL, authHeaders, loginCustomers, loadDoctorIds, randomWeekday, pick, getSlots, freeSlots, bookSlot } from './lib/common.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1.0'], http_req_failed: ['rate<0.01'] },
};

export default function () {
  group('health', () => {
    const r = http.get(`${BASE_URL}/actuator/health`);
    check(r, { 'health UP': (x) => x.status === 200 && x.json('status') === 'UP' });
  });

  const [user] = loginCustomers(1);
  check(user, { 'logged in, has a pet': (u) => !!u.token && u.petIds.length > 0 });

  group('browse and book', () => {
    check(http.get(`${BASE_URL}/api/specializations`), { 'specializations 200': (r) => r.status === 200 });
    const doctors = loadDoctorIds(user.token, 20);
    check(doctors, { 'doctors found': (d) => d.length > 0 });
    const doctorId = pick(doctors);
    check(http.get(`${BASE_URL}/api/doctors/${doctorId}`, { headers: authHeaders(user.token) }), { 'doctor 200': (r) => r.status === 200 });

    const date = randomWeekday(30);
    const slots = freeSlots(getSlots(user.token, doctorId, date));
    check(slots, { 'slots listed': (s) => s.length > 0 });

    const res = bookSlot(user.token, doctorId, user.petIds[0], date, pick(slots));
    check(res, { 'booked (201)': (r) => r.status === 201 });
    check(http.get(`${BASE_URL}/api/appointments/my`, { headers: authHeaders(user.token) }), { 'my appointments 200': (r) => r.status === 200 });
  });
}
