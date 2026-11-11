# Deploying the Jenni backend

This guide takes the Spring Boot backend from your PC to a public HTTPS address that the phone app can use. It uses **Docker** (the backend ships a `Dockerfile`) and a managed **PostgreSQL** database. The steps use **Render** as the worked example. Railway, Fly.io, AWS and any VPS follow the same shape, and the settings table in step 3 is the same everywhere.

## 0. What is already prepared in the code

| Item | What it does |
|---|---|
| `backend/Dockerfile` | Builds the jar inside Docker (no local Maven needed) and runs it as a non-root user in the `prod` profile |
| `ProductionGuard` | In the `prod` profile the server **refuses to start** if `JWT_SECRET` is missing or is the built-in development value, or if demo data is still on |
| `SEED_DEMO_DATA=false` | Stops the sample doctors, customers and bookings (which have well-known passwords) being created. Only the speciality list is created |
| `SEED_ADMIN_PHONE`, `SEED_ADMIN_PASSWORD` | Creates your **first real admin** on the first start, so someone can approve doctors and businesses |
| `PORT` | The port the host tells the app to use |
| `UPLOADS_DIR` | Where photos and documents are saved (point it at a persistent disk) |
| `CORS_ALLOWED_ORIGINS` | Which web origins may call the API (native apps do not need CORS) |
| Health check | `GET /api/care/config` returns `200` with no sign-in |

## 1. Before you start: decide these

1. **SMS for the sign-up code.** Right now the code is only written to the server log, so real users can not verify their number. Pick an SMS provider (for India: MSG91, Twilio, Fast2SMS and similar) and connect it in `EmailOtpService` before launch. Until then you can read codes from the log yourself, which is fine for a private test.
2. **Where files live.** Pet photos and verification documents are saved on disk. Use a **persistent disk** on the host (step 2), or move to S3 later. Without one, every redeploy erases them.
3. **Payments.** Start with `PAYMENT_GATEWAY=simulated` (test buttons). For real money use Razorpay live keys, `CARE_CURRENCY=INR`, and add the Razorpay webhook first (see the known gaps in `KT_DOCUMENT.md`).
4. **Cost.** A small always-on web service plus a small managed PostgreSQL is the minimum. Free plans on most hosts sleep when idle or delete the database after a trial, which is not suitable for real users.

## 2. Create the database (Render example)

1. Create a Render account and click **New → PostgreSQL**. Choose a region close to your users (for India, Singapore is usually nearest). Pick a paid plan for anything real.
2. After it is created, open it and note the **Internal** connection details: host, port, database, user, password.
3. Flyway creates every table on the first start. You do not run any SQL yourself.

## 3. Create the web service

1. **New → Web Service**, connect your Git repository (push the project to GitHub first).
2. Settings:
   - **Language/Runtime:** Docker
   - **Root Directory:** `backend`
   - **Dockerfile Path:** `./Dockerfile`
   - **Health Check Path:** `/api/care/config`
   - **Instance type:** a paid instance (needed for a disk)
3. **Environment variables**

| Variable | Value |
|---|---|
| `DB_HOST` | the database's internal host |
| `DB_PORT` | `5432` |
| `DB_NAME` | the database name |
| `DB_USER` | the database user |
| `DB_PASSWORD` | the database password |
| `JWT_SECRET` | a long random value (see below) |
| `SEED_DEMO_DATA` | `false` |
| `SEED_ADMIN_PHONE` | your admin mobile number, like `+91 98765 43210` |
| `SEED_ADMIN_PASSWORD` | a strong password you choose |
| `PAYMENT_GATEWAY` | `simulated` for now, later `razorpay` |
| `CARE_CURRENCY` | `INR` |
| `CARE_CURRENCY_SYMBOL` | `₹` |
| `CLINIC_ADVANCE_PERCENT` | `50` |
| `APP_ANDROID_URL` | your app's download link (used on the QR landing page) |
| `CORS_ALLOWED_ORIGINS` | leave unset (or your web origin) |

   Make a `JWT_SECRET` on your PC: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. **Keep it secret and never change it casually**: changing it signs everyone out.

4. If your database host is **not** on the same private network (Neon, Supabase, an external host), use one variable instead of the five `DB_*` ones: `SPRING_DATASOURCE_URL=jdbc:postgresql://HOST:5432/NAME?sslmode=require` plus `SPRING_DATASOURCE_USERNAME` and `SPRING_DATASOURCE_PASSWORD`.

5. **Persistent disk:** in the service, add a **Disk**, mount path `/data`. The Docker image already uses `/data/uploads` for files. Without the disk, photos and documents vanish on every redeploy.

6. Click **Create Web Service**. The first build takes a few minutes. When it is live the log shows `Started JenniApplication` and `Created the first admin account`.

## 4. Check it works

Replace `YOUR-APP` with the address Render gave you (it is HTTPS automatically):

```
curl https://YOUR-APP.onrender.com/api/care/config
```

You should see `{"success":true, ... "currency":"INR" ...}`.

Then sign in as the admin from the app (or Swagger at `/swagger-ui.html`):

```
POST https://YOUR-APP.onrender.com/api/auth/login
{ "mobile": "+91 98765 43210", "password": "<SEED_ADMIN_PASSWORD>" }
```

## 5. Point the app at it

In `frontend/eas.json` replace `REPLACE-WITH-YOUR-API-DOMAIN` with `YOUR-APP.onrender.com` so the value reads `https://YOUR-APP.onrender.com/api`, then build the APK (see the Uptodown steps). For the QR codes set `EXPO_PUBLIC_PET_LINK_BASE` to `https://YOUR-APP.onrender.com/api`, or to your own domain's landing page address.

## 6. After launch

- **Updates:** push to Git. Render rebuilds and redeploys. Database changes are new `V<n>__name.sql` files in `backend/src/main/resources/db/migration`. **Never edit a migration that has already run.**
- **Backups:** turn on the database's automatic backups. Back up the `/data` disk too (or move files to S3).
- **Logs:** use the host's log viewer. The sign-up code lines look like `[SIMULATED SMS] Verification code for ...`.
- **Custom domain:** add it in the service settings, then update `EXPO_PUBLIC_API_URL` and rebuild the app.
- **Monitoring:** use the health check path above with any uptime service.

## 7. Using another host

| Host | How |
|---|---|
| **Railway** | New project → Deploy from repo (root `backend`, it finds the Dockerfile) → add the PostgreSQL plugin → set the same variables (Railway gives `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`; copy them into `DB_*`) → add a Volume mounted at `/data` |
| **Fly.io** | `fly launch` inside `backend` → `fly postgres create` and attach → `fly secrets set JWT_SECRET=... SEED_DEMO_DATA=false ...` → `fly volumes create` and mount at `/data` |
| **AWS** | RDS PostgreSQL + App Runner or ECS (or an EC2 instance running the Docker image) + an EBS volume or S3 for files |
| **A plain VPS** | Install Docker, run PostgreSQL (the repository `docker-compose.yml` has one), then `docker build -t jenni-backend ./backend` and `docker run -d -p 80:8080 --env-file prod.env -v jenni-data:/data jenni-backend`, with Caddy or Nginx in front for HTTPS |

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Container exits at start with "JWT_SECRET must be set" | Set `JWT_SECRET` to your own value of 32+ characters |
| Exits with "SEED_DEMO_DATA must be false" | Set `SEED_DEMO_DATA=false` |
| "Connection refused" or "password authentication failed" | Check the five `DB_*` values, or use `SPRING_DATASOURCE_URL` with `?sslmode=require` for an external database |
| Flyway checksum error after a redeploy | A migration that had already run was edited. Restore it and add a new migration |
| Health check fails | The service must listen on `PORT` (it does by default). Check the log for the start-up error |
| App cannot connect | The API address in the build must be `https://...` and end with `/api` |
| Photos disappear after a redeploy | The persistent disk is missing or not mounted at `/data` |
| No sign-up code arrives | Connect an SMS provider (step 1), or read the code from the log |
