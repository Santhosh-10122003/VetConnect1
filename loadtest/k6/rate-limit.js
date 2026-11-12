// Proves the rate limiter works. The backend must run with RATE_LIMIT_ENABLED=true (the default outside this stack):
//   RATE_LIMIT_ENABLED=true docker compose -f loadtest/docker-compose.yml up -d backend
//   docker compose -f loadtest/docker-compose.yml run --rm k6 run rate-limit.js
// One client sends 40 login attempts in a row: the first ~10 are answered, the rest get HTTP 429.
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import http from 'k6/http';
import { login } from './lib/common.js';

const limited = new Counter('rate_limited_429');
const answered = new Counter('answered_not_429');
http.setResponseCallback(http.expectedStatuses(200, 401, 429));

export const options = {
  vus: 1,
  iterations: 40,
  thresholds: {
    rate_limited_429: ['count>=20'],   // the limiter kicked in
    answered_not_429: ['count>=1'],    // normal use before the limit still works
  },
};

export default function () {
  const res = login('+919000000001', 'wrong-password-on-purpose');
  if (res.status === 429) {
    limited.add(1);
    check(res, { '429 has Retry-After': (r) => !!r.headers['Retry-After'] });
  } else {
    answered.add(1);
  }
}
