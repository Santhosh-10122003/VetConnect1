# Load and performance testing

A self-contained stack (Postgres + backend + k6) with generated test data. It does not touch the normal
`docker-compose.yml` (different ports, containers and volume).

## Start

```bash
docker compose -f loadtest/docker-compose.yml up -d --build postgres backend
```

The first start creates test data (about 15 s): **2000 customers** (1-2 pets each), **100 approved doctors**
(Mon-Fri 09:00-17:00, 30 min slots) and **5000 past appointments**. Change the size with `LOADTEST_CUSTOMERS`,
`LOADTEST_DOCTORS`, `LOADTEST_PAST_APPOINTMENTS`. The backend is on <http://localhost:8091>, Postgres on `localhost:5434`.
Both containers are limited to 2 CPUs and 1 GB so runs are comparable.

| Account | Mobile | Password |
|---|---|---|
| Customers | `+919000000001` ... `+91900000xxxx` | `LoadTest@123` |
| Doctors | `+918000000001` ... | `LoadTest@123` |
| Admin (metrics) | `+919999999999` | `LoadTest@123` |

## Run the tests

k6 runs in Docker, so nothing needs installing. From the repository root:

```bash
docker compose -f loadtest/docker-compose.yml run --rm k6 run smoke.js          # 1 user, whole flow: run this first
docker compose -f loadtest/docker-compose.yml run --rm k6 run booking-race.js   # 50 customers, same slot, same instant
docker compose -f loadtest/docker-compose.yml run --rm k6 run load.js           # expected traffic (80% browse / 20% book)
docker compose -f loadtest/docker-compose.yml run --rm k6 run stress.js         # keep raising the rate until it breaks
docker compose -f loadtest/docker-compose.yml run --rm -e DURATION=1h k6 run soak.js   # leaks and slow degradation
```

Options (`-e NAME=value` after `run --rm`): `PEAK_VUS` (load, default 50), `RACERS` (race, default 50), `VUS` and
`DURATION` (soak), `TOKEN_POOL` (customers signed in up front, default 200).
Use the relative script name (`load.js`, not `/scripts/load.js`): Git Bash on Windows rewrites absolute paths.

| Script | Question it answers | Passes when |
|---|---|---|
| `smoke.js` | Do the scripts and data work? | every check passes |
| `booking-race.js` | Can two people get the same slot? | exactly **one** 201, all others 409, no 5xx |
| `load.js` | Is it fast enough at expected traffic? | p95 < 500 ms (booking < 800 ms), errors < 1% |
| `stress.js` | Where does it break? | no gate: read where p95 / errors start to climb |
| `soak.js` | Does it degrade or leak over an hour? | p95 stays flat, errors < 1% |
| `rate-limit.js` | Does the limiter block abuse? | the 11th login in a minute gets 429 |

A 409 on a booking is a correct answer (the slot was taken) and is not counted as a failure.

### Rate limiter test

All k6 traffic comes from one address, so the limiter is **off** in this stack (`RATE_LIMIT_ENABLED=false`).
To test it, turn it on, then run `rate-limit.js`. Export the variable for the whole session: if it is missing when
you run k6, compose sees a changed backend config and recreates the backend with the limiter off again.

```bash
export RATE_LIMIT_ENABLED=true
docker compose -f loadtest/docker-compose.yml up -d backend
docker compose -f loadtest/docker-compose.yml run --rm k6 run rate-limit.js
export RATE_LIMIT_ENABLED=false                                                       # back to load testing
docker compose -f loadtest/docker-compose.yml up -d backend
```
(PowerShell: `$env:RATE_LIMIT_ENABLED = "true"`.) The same applies to `DB_POOL_MAX` and the other knobs below.

## Watching the server during a test

Health is public: `curl localhost:8091/actuator/health`. Metrics need an admin token:

```bash
TOKEN=$(curl -s localhost:8091/api/auth/login -H 'Content-Type: application/json' \
  -d '{"mobile":"+919999999999","password":"LoadTest@123"}' | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')
curl -s -H "Authorization: Bearer $TOKEN" localhost:8091/actuator/metrics/hikaricp.connections.active
curl -s -H "Authorization: Bearer $TOKEN" localhost:8091/actuator/metrics/hikaricp.connections.pending
curl -s -H "Authorization: Bearer $TOKEN" localhost:8091/actuator/metrics/jvm.memory.used
curl -s -H "Authorization: Bearer $TOKEN" localhost:8091/actuator/prometheus | head   # everything, for Prometheus/Grafana
```

What to look at:

- `hikaricp.connections.pending` above 0 for long = the DB pool is the bottleneck: raise `DB_POOL_MAX` (keep
  instances x pool below Postgres `max_connections`) or make queries cheaper.
- `hikaricp.connections.usage` high = slow queries or long transactions (the booking path holds a lock).
- `http.server.requests` per `uri` shows which endpoint is slow.
- `jvm.memory.used` growing during `soak.js` and never coming back = a leak.
- `docker stats` shows CPU: backend at 200% = it is CPU bound, not DB bound.
- Postgres logs queries slower than 500 ms: `docker logs jenni_lt_postgres | grep duration`.

## Tuning knobs (environment variables)

| Variable | Default | Effect |
|---|---|---|
| `DB_POOL_MAX` / `DB_POOL_MIN` | 20 / 5 | Hikari pool size per instance |
| `DB_POOL_TIMEOUT_MS` | 5000 | how long a request waits for a connection before failing |
| `DB_POOL_LEAK_MS` | 20000 | logs a stack trace when a connection is held this long |
| `TOMCAT_MAX_THREADS` | 200 | concurrent requests being processed |
| `TOMCAT_ACCEPT_COUNT` | 100 | requests queued when all threads are busy |
| `RATE_LIMIT_ENABLED` | true (false in this stack) | per-client limiter |
| `RATE_LIMIT_AUTH_PER_MINUTE` | 10 | login / sign-up / OTP / reset per client |
| `RATE_LIMIT_API_PER_MINUTE` | 300 | every other `/api` call per client |

Change one at a time, e.g. `DB_POOL_MAX=40 docker compose -f loadtest/docker-compose.yml up -d backend`, and
re-run `load.js` to compare.

## Reset

```bash
docker compose -f loadtest/docker-compose.yml down -v   # removes the database, so the next start regenerates the data
```
