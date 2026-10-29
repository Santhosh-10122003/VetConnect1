# VetConnect

Veterinary appointment booking: pet owners find verified vets and book slots; doctors manage schedules, consultations and prescriptions; admins verify doctors.

- `backend/` Spring Boot 3 (Java 21), PostgreSQL, Flyway, JWT, Swagger UI
- `frontend/` React Native (Expo SDK 52, TypeScript), role-based navigation (customer / doctor / admin)

## Prerequisites

| Tool | Version |
|---|---|
| JDK | 21 |
| Node.js | 20+ (tested on 24) |
| PostgreSQL | 16+ (local) **or** Docker Desktop |
| Android Studio (emulator) or Expo Go on a phone | optional |

Maven is not required: use the bundled wrapper (`backend/mvnw`, `mvnw.cmd`).

## 1. Configure

Copy `.env.example` to `.env` and adjust. Defaults assume Postgres at `localhost:5432`, database `vetconnect`, user/password `postgres`/`postgres`. Change `JWT_SECRET` for anything beyond local development.

## 2. Run the backend

### Option A: local PostgreSQL

```powershell
# create the database once
psql -U postgres -c "CREATE DATABASE vetconnect;"

cd backend
.\mvnw.cmd spring-boot:run          # macOS/Linux: ./mvnw spring-boot:run
```

Override connection settings with `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (or `SPRING_DATASOURCE_URL`). Flyway creates the schema and sample data on first start.

### Option B: Docker

The backend image copies a prebuilt jar, so build it first:

```powershell
cd backend
.\mvnw.cmd clean package -DskipTests
cd ..
docker compose up --build
```

Postgres 16 is published on host port `5433` (override with `DB_PORT`) so it does not clash with a local install; the API listens on `8080`.

### Check it works

- Swagger UI: http://localhost:8080/swagger-ui.html (if it loads, the API is up)

## 3. Run the frontend

```powershell
cd frontend
npm install
npx expo start
```

Point the app at the API with `EXPO_PUBLIC_API_URL`:

| Where the app runs | URL |
|---|---|
| Android emulator (default) | `http://10.0.2.2:8080/api` |
| iOS simulator / web | `http://localhost:8080/api` |
| Physical device (Expo Go) | `http://<your-LAN-IP>:8080/api` (phone and PC on the same Wi-Fi; allow port 8080 in the firewall) |

```powershell
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.20:8080/api"; npx expo start
```

Press `a` for the Android emulator, or scan the QR code with Expo Go.

## Demo accounts (seeded)

| Role | Email | Password |
|---|---|---|
| Customer | santhoshp9150491@gmail.com | San1012 |
| Doctor | vas1012@gmail.com | Vas1012 |
| Admin | admin@vetconnect.com | Admin@1234 |
| Groomer (pet care business) | groomer@vetconnect.com | Groomer@1234 |
| Boarding & training (pet care business) | stay@vetconnect.com | Stay@1234 |

Dr. Sarah's clinic also offers pet care ("Paws & Claws Pet Spa"), so her **Pet Care** tab is a ready example of a vet clinic running a grooming business.

These are development credentials. Remove the seed data and rotate secrets before any real deployment.

## Tests and checks

```powershell
cd backend;  .\mvnw.cmd clean test      # unit/integration tests (H2, profile "test")
cd frontend; npx tsc --noEmit           # type check
```

Note: backend tests run on H2, so the PostgreSQL partial unique index that prevents double booking (`idx_unique_active_doctor_slot`) is exercised only when you run against real PostgreSQL (see manual checks below).

## Manual verification

1. Log in as the customer: tabs, pets and doctor search load.
2. Log in as the doctor: dashboard shows today's schedule and pending requests.
3. Log in as the admin: verification queue and platform stats load.
4. Book: pick a doctor, a date, a free slot and a pet. The booking gets a `VC-YYYYMMDD-XXXX` reference and appears under Upcoming and on the doctor's dashboard.
5. Double booking: book the same slot from a second account/session. The API returns HTTP 409 and the app shows the message.
6. Doctor confirms, then completes via Consultation Notes (diagnosis and prescriptions). The customer sees the record under the pet's Medical History.
7. Customer submits a 5-star review. The doctor's rating updates.

## Building an Android app

Install EAS CLI and sign in to Expo:

```powershell
npm install -g eas-cli
cd frontend
eas login
eas build:configure
eas build -p android --profile preview      # installable APK
eas build -p android --profile production   # AAB for Google Play
```

Set `EXPO_PUBLIC_API_URL` to your deployed HTTPS API in the EAS build profile (`env`) before building, since `10.0.2.2` only works in the emulator. The app id is `com.vetconnect.app` (see `frontend/app.json`).

Local Gradle build (needs Android SDK): `npx expo prebuild -p android` then `cd android && .\gradlew.bat assembleRelease`.

The icons in `frontend/assets/` are plain teal placeholders; replace them with real artwork before publishing.

## Notes and limitations

- **Vet appointments take an advance (50% of the consultation fee).** Booking holds the slot for 15 minutes; the customer pays the advance, then the request goes to the doctor (who does not see unpaid ones). The other half is paid at the clinic. Refunds: the doctor rejecting or cancelling refunds it all; the customer cancelling at least 24 hours before the visit gets it all back, later cancellations keep the advance (the app states the exact outcome before confirming). Unpaid holds expire and free the slot. Set the share with `CLINIC_ADVANCE_PERCENT`; a doctor with a zero fee needs no advance.
- **Doctors give payment details at sign-up too, and earn into a wallet.** A veterinarian must add a UPI id or bank account when registering (same rules and masking as pet-care businesses; existing doctors are asked on their dashboard and when they next save their profile). Every advance paid for a doctor's appointment is credited to that doctor's **Wallet** (card on the dashboard, full history on the Wallet screen); a refund (doctor rejects or cancels, or the customer cancels early) is debited back, and an advance that is kept (late cancellation, completed visit) stays. Pet-care businesses have the same wallet on their home screen, and a clinic that offers pet care reuses the payment details from its doctor profile. The wallet is a ledger: it shows what you are owed, but nothing is sent to a bank from it yet (payouts are manual or via Razorpay Route, not included). The three demo doctors have demo UPI ids.
- **Payment details are mandatory for pet care.** Every pet-care business, and every vet clinic that offers pet care, must say where it gets paid: a UPI id, or a bank account (holder name, account number, IFSC). It is asked at sign-up and in the clinic's "set up pet care" form, validated on the server, and the account number is only ever shown masked (last four digits) to the owner and the admin, never to customers. A business without them is not shown to customers, cannot be booked, and cannot be approved by an admin; its home screen explains what to add. The three demo businesses come with demo UPI ids. Note that VetConnect records where to pay out but does not send payouts itself: advance payments land in your Razorpay account and settling them to businesses is a separate step (Razorpay Route or manual transfers).
- **Doctors manage their own day.** The Calendar tab opens **My day**: every slot of any date, showing what customers booked (pet, owner, reference), what is free, breaks and what the doctor blocked. A doctor can **mark a free slot as booked** (customers then cannot see or book it, nor reschedule into it) and **undo only those blocks**. A slot a customer booked, or is still paying the advance for, is **locked**: the doctor cannot mark or unmark it; it becomes free only when its appointment is cancelled, rejected or expires. The slot that ends exactly when a break starts is no longer treated as part of the break.
- **Rescheduling is a request the doctor answers.** When a pet owner picks a new time, the appointment keeps its current slot and the doctor is notified (a "Reschedule requested" card on the appointment, also listed under their Pending tab). The doctor approves (the appointment moves and is confirmed) or declines with a reason (it stays as it was); the owner can withdraw the request while it waits, and gets a notification either way. Only one request can wait at a time, and if the new slot is taken before the doctor answers, approving fails cleanly and they can decline.
- **Payments: simulated by default, Razorpay when you add keys.** With no keys the app shows clearly marked test buttons and no money moves. For **Razorpay**: create keys at dashboard.razorpay.com (start with the `rzp_test_` pair), then start the backend with `PAYMENT_GATEWAY=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `CARE_CURRENCY=INR` / `CARE_CURRENCY_SYMBOL=₹` (see `.env.example`; in PowerShell: `$env:PAYMENT_GATEWAY="razorpay"; ...; .mvnw.cmd spring-boot:run`). Then the Pay button opens Razorpay's own checkout (cards, UPI, net banking); card details never touch this app or the server. The server creates the order, and a payment counts only after its signature is verified with your secret key (forged or replayed results are refused); refunds go through Razorpay's refund API. The secret key is only ever on the server. Not included yet: a Razorpay **webhook**. If a customer pays and the app is closed before it reports back, that payment is not auto-confirmed (the slot hold expires; you would refund it from the Razorpay dashboard). Add a webhook before going live.
- **Pet care (grooming, boarding, training).** Pet owners get a **Pet Care** tab; businesses sign up with the third role, **Pet Care**, and a vet clinic can also offer these services from a **Pet Care** tab in the doctor app, so both can exist separately. Businesses are approved by an admin with a reason, exactly like doctors (separate "Pet care queue" and "Pet care re-approvals" on the admin dashboard), and customers only see approved businesses in their area, by the same location rule as doctors.
  - **Prices** depend on the pet's size (small up to 7 kg, medium up to 20, large up to 35, giant above); grooming and training are per session, boarding per night, and extras (nail trim, daily walk) are flat add-ons.
  - **Advance payment.** The customer pays the business's advance (30% by default, set by the business) to confirm; the balance is paid at the visit. The slot is held for 15 minutes while paying, then released. The payment gateway is the same one as for vet appointments (see above): test buttons by default, Razorpay with keys. `PaymentGateway` is the seam if you want another provider.
  - **Refunds.** The business rejecting or cancelling refunds everything; the customer cancelling at least 24 hours before the start gets a full refund, later cancellations keep the advance. The app shows the exact outcome before the customer confirms.
  - **Flow:** request (after the advance) → the business accepts → done on or after the date → the customer can leave a review, which feeds the business rating.
  - Config: `vetconnect.care.currency`, `currency-symbol`, `hold-minutes`, `cancellation-window-hours`, `max-boarding-nights` (and the env names above). Home visits are not part of this version.
- **Password reset has no email delivery.** The flow itself is secure: an 8-character random code (stored only as a SHA-256 hash), bound to the account's email, valid 30 minutes, single-use, locked after 5 wrong attempts, and a successful reset signs the account out everywhere. Because no mail service is configured, the code is written to the server log as `[SIMULATED EMAIL] Password reset code for <email>: <code>` (`backend/logs/vetconnect.log`). Plug a mail sender into `AuthService.forgotPassword` before going beyond local development.
- **Accounts are identified by a mobile number.** People register and log in with their mobile number plus password, typed with the country code (+91 98765 43210) and stored in international form; one number can belong to one account. Registering creates an unverified account and a 6-digit code (valid 10 minutes, stored hashed, locked after 5 wrong tries, resend every 30 s) that is sent to the mobile number; logging in before verifying sends the user back to the code screen. Forgot password also works by mobile number. An email is optional (an account made without one gets an internal address that is never shown or used). Older accounts can still log in with the email they registered with. **No SMS provider is configured yet**: the "text message" is written to the server log as `[SIMULATED SMS] Verification code for <number> [<email>]: <code>` (and the same for reset codes) until a sender is plugged in (`EmailOtpService`, `AuthService.forgotPassword`). The demo accounts log in with: customer +1 555-0201, doctor +1 555-0111, admin +1 555-0100, groomer +1 555-0301.
- **Location decides which doctors a customer sees.** A place is chosen with dropdowns: **Country → State/Province → District/City** (250 countries, ~5,000 states, ~148,000 districts and cities, bundled in `backend/src/main/resources/geo/world.json.gz` and served by `/api/geo/*`). It can also be set from a **postal/PIN code** (the app fills in state and district and pins the spot), from **GPS**, or by dropping a **pin on a map** (OpenStreetMap, no API key). Customers need the dropdown place (GPS optional); clinics must also **pin the exact spot**. A customer only gets doctors in their area: by distance (default 25 km, up to 100 km with the radius chips) when both sides have a pin, otherwise by matching district/city name (and country/state when both are known, so "Springfield" in two countries is never confused). This applies to search, doctor details, availability and booking. Admins and doctors are not restricted. Changing the place drops the stored pin, since it no longer describes the spot.
- **Navigation to the clinic.** The doctor page, the booking screen, the booking summary and the appointment details show the clinic address with a map and a **Get Directions** button that opens turn-by-turn navigation (Apple Maps on iPhone, the default maps app on Android, Google Maps in a browser). Clinics registered before pins existed fall back to an address search.
- **Postal-code / map lookups use OpenStreetMap Nominatim** through the backend (`geo/NominatimClient`): results are cached, calls are spaced out (its policy allows about one per second) and each client is limited to 30 lookups a minute. The public service is fine for development; for production, point `vetconnect.geo.nominatim-url` at your own instance or a commercial geocoder.
- **Sign-up checks.** The email must look real (a proper domain and top-level domain, no spaces or doubled dots; the app shows an inline error and a "did you mean gmail.com?" hint for typos) and the password has to be typed twice. The same rules are enforced by the API.

- **Doctors must be approved, with a reason.** New doctor sign-ups start as `PENDING`, are hidden from search and cannot be booked until an admin approves them. Approving or rejecting always needs a written reason, which the doctor sees (profile, dashboard and a notification). A rejected doctor can edit their details and press "Send for Approval Again"; those requests appear in a separate **Re-approval requests** section for admins (with the earlier reason and the doctor's note) instead of the first-time queue. Customers never see the admin's reason. The seeded demo doctors are already approved: Dr. Sarah (Springfield, ~2 km from the demo customer), Dr. Raj (West Bay, ~20 km) and Dr. Emily (Northview, ~67 km), so the default 25 km radius shows Sarah and Raj only.
- **Logs.** The backend writes `backend/logs/vetconnect.log` (rolling, 14 days): one line per API request (method, path, status, time, user, IP) plus service-level events. Request bodies and passwords are never logged.
- Help & Support phone numbers and email in `HelpSupportScreen.tsx` are placeholders.
- The Vaccinations tab lists prescriptions whose medication looks like a vaccine; there is no dedicated vaccination record.
