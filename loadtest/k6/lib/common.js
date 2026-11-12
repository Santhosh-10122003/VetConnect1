// Shared helpers for the Jenni k6 tests.
import http from 'k6/http';
import { check, fail } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8091';
export const PASSWORD = __ENV.LT_PASSWORD || 'LoadTest@123';
// how many distinct customers are signed in once, up front (login is deliberately slow: bcrypt)
export const TOKEN_POOL = parseInt(__ENV.TOKEN_POOL || '200', 10);
const CUSTOMER_PHONE_BASE = 9000000000;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function customerPhone(n) {
  return '+91' + (CUSTOMER_PHONE_BASE + n);
}

export function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
}

export function login(mobile, password) {
  return http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ mobile, password: password || PASSWORD }),
    { headers: JSON_HEADERS, tags: { name: 'POST /api/auth/login' } });
}

// Signs in customers 1..count (in parallel batches) and loads each one's pets. Run this in setup().
export function loginCustomers(count) {
  const users = [];
  const BATCH = 20;
  for (let start = 1; start <= count; start += BATCH) {
    const reqs = [];
    for (let n = start; n < start + BATCH && n <= count; n++) {
      reqs.push(['POST', `${BASE_URL}/api/auth/login`,
        JSON.stringify({ mobile: customerPhone(n), password: PASSWORD }),
        { headers: JSON_HEADERS, tags: { name: 'setup login' } }]);
    }
    const res = http.batch(reqs);
    const tokens = [];
    res.forEach((r) => {
      if (r.status !== 200) fail(`setup login failed: HTTP ${r.status} ${r.body} (did the backend finish seeding?)`);
      tokens.push(r.json('data.accessToken'));
    });
    const petReqs = tokens.map((t) => ['GET', `${BASE_URL}/api/pets`, null, { headers: authHeaders(t), tags: { name: 'setup pets' } }]);
    const pets = http.batch(petReqs);
    tokens.forEach((t, i) => {
      const list = pets[i].json('data') || [];
      users.push({ token: t, petIds: list.map((p) => p.id) });
    });
  }
  return users;
}

// Approved doctors (first page of the search). Run this in setup().
export function loadDoctorIds(token, size) {
  const r = http.get(`${BASE_URL}/api/doctors?size=${size || 50}`, { headers: authHeaders(token), tags: { name: 'setup doctors' } });
  if (r.status !== 200) fail(`doctor list failed: HTTP ${r.status} ${r.body}`);
  return r.json('data.content').map((d) => d.id);
}

// A weekday between 1 and "within" days from now, as yyyy-mm-dd (UTC).
export function randomWeekday(within) {
  for (let i = 0; i < 20; i++) {
    const d = new Date(Date.now() + (1 + Math.floor(Math.random() * within)) * 86400000);
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) return d.toISOString().slice(0, 10);
  }
  return new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function getSlots(token, doctorId, date) {
  return http.get(`${BASE_URL}/api/doctors/${doctorId}/availability?date=${date}`,
    { headers: authHeaders(token), tags: { name: 'GET /api/doctors/:id/availability' } });
}

export function freeSlots(res) {
  if (res.status !== 200) return [];
  return (res.json('data') || []).filter((s) => s.available);
}

// 201 = booked, 409 = someone else took the slot first. Both are correct answers under contention.
export const bookingCallback = http.expectedStatuses(201, 409);

export function bookSlot(token, doctorId, petId, date, slot, tagName) {
  return http.post(`${BASE_URL}/api/appointments`, JSON.stringify({
    doctorId, petId, appointmentDate: date, startTime: slot.startTime, endTime: slot.endTime, reason: 'k6 load test',
  }), { headers: authHeaders(token), responseCallback: bookingCallback, tags: { name: tagName || 'POST /api/appointments' } });
}

export function checkOk(res, name) {
  return check(res, { [`${name}: 200`]: (r) => r.status === 200 });
}
