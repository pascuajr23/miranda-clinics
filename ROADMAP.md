# Miranda Clinics website: roadmap

What the site can grow into while staying **out of patient records**.

## The line we don't cross

In the Philippines, health information is *sensitive personal information* under the Data Privacy Act of 2012 (RA 10173). Storing it brings consent, security, breach-reporting and retention duties, and possibly registration with the National Privacy Commission (NPC).

So every feature below follows three rules:

1. **Numbers, not names.** The queue works on ticket numbers only. Nothing ties a number to a person or a visit.
2. **Nothing about anyone's health.** No symptoms, diagnoses, prescriptions, lab results or medical history, ever.
3. **Data about the clinic is fine.** Schedules, rooms, announcements, staff accounts and whole-day totals are clinic data, not patient data.

Anything that needs real patient data (records, results, prescriptions, bookings with names) goes to a dedicated, compliant system, linked from the site, not built into it.

*This roadmap is planning, not legal advice. Check anything in the "boundary" items with the NPC or a lawyer before building it.*

---

## Where things stand (27 Nov 2026)

| Phase | Status |
|---|---|
| 1. Launch and trust | In progress: privacy notice, licence and image speed-ups done; deploy and backups still to do |
| 2. Run the clinic from the admin panel | Done |
| 3 to 5 | Proposed |
| 6. Reliable every day | Started: self-healing TV done |
| 7. Easier for every patient | Started: light queue page for old phones and slow data done |
| 8 to 11 | Proposed |

Also done along the way: a two-doctor TV layout with numbers sized for elderly patients across the hall, both doctors on one phone screen, a phone menu that floats over the page and holds the Login button, a Home button and top bar on the admin login, accessibility fixes (labelled fields, contrast, keyboard tabs), WebP images and a self-hosted hero photo, an MIT licence for the code with the clinic's photos and data kept as its own, and a privacy notice.

## Phase 1: Launch and trust (now)

Get the current site live and dependable.

- **Deploy** the Docker image behind Caddy on `mirandaclinics.com`, with HTTPS.
- **Change the admin password** (the current one has been shared in chat).
- **Back up** the `miranda-data` volume (rooms only, no patient data) on a schedule.
- **Uptime check:** a free monitor that alerts the clinic if the site or TV page goes down.
- ~~**Privacy notice page**~~ Done: `/privacy`, under RA 10173, linked from the footer and the login screen.
- ~~**Licence**~~ Done: MIT for the code; photos, logo, content and data stay the clinic's (NOTICE.md).
- **Self-host the Inter font** so visitors' browsers no longer contact Google (one less thing in the privacy notice).
- **Search basics:** page titles and descriptions, `MedicalClinic` structured data (address, hours, phone) so Google shows the clinic correctly, and a link to the Google Business Profile.

## Phase 2: Run the clinic from the admin panel (done)

Everything on the home page and TV that used to be hard-coded is now set from `/admin`. All of it is clinic data, no patient data.

What was built:

- **Admin panel with tabs:** Main (big link to queue control, TV display, own password), Announcement, Doctors, Rooms, Closures, Staff and Activity. Login lands here.
- **Logins by role:**
  - *Super admin:* the login in `.env`. Manages staff accounts and roles.
  - *Admin:* a staff account set to Admin. Runs every room, sets up rooms, adds doctors and their logins.
  - *Staff:* runs the rooms of the doctors ticked for them; one staff can handle several doctors.
  - *Doctor:* login on the doctor's card; controls whichever room the doctor is put in.
- **Doctors:** Dr. Ken and Dr. Kath are always listed (only their schedule changes). Visiting doctors can be added and removed; they show under Services, not About.
- **Rooms:** pick the doctor for each room; doctors not in a room show as on standby.
- **Announcement editor:** title, details and hours.
- **Doctor schedules:** shown in the home page Schedule section.
- **Closures:** dates the clinic is closed. The home page lists the next 30 days; the TV shows "Closed today".
- **Room messages:** "Back at 1:00 PM" set from queue control, shown under the number on the TV.
- **Activity log:** who did what and when (staff actions only, last 1,000 entries).
- **Queue on phones:** compact layout so every room fits at a glance; the TV layout is unchanged.

Left over (small, pick up any time):

- Doctor schedules on the TV, not just the home page.
- Scheduled announcements that start and expire on their own.
- Logins survive a server restart (sessions are kept in memory today).
- Photos for visiting doctors (upload from the admin panel).

## Phase 3: A better waiting room

Make waiting easier, still with numbers only.

- **Sound and voice on the TV:** a chime and "Now serving number 12, Pediatrics" when a number changes. It says the number, never a name.
- **Estimated wait:** average minutes per number today, worked out from when staff press Next, shown as "About 15 minutes" on the TV and site. It uses timestamps of the queue, not people.
- **Automatic daily reset** at a set time, so nobody forgets to reset the queue.
- **Several screens:** a separate TV view per room or floor (`/queue?room=…`).
- **Daily totals for the doctors:** patients seen per day and per room, busiest hours, as plain counts. No individual visits.

## Phase 4: Phones in the waiting room

Let patients follow the queue on their own phones, anonymously.

- **QR code at reception** that opens the live queue on the patient's phone.
- **Digital ticket (optional):** the patient takes a number on their phone instead of paper. The ticket is just a number kept in their browser, with no name, phone number or login.
- **"You're almost up" alert:** a browser notification when their number is 3 away. The only thing stored is the ticket number, deleted at the end of the day.
- **Installable queue page** (add to home screen), still with no account.

## Phase 5: Information patients look for

Answer common questions so the front desk gets fewer calls.

- **Services and fees page:** consultation fees, vaccine prices and certificate fees, editable from the control panel.
- **HMOs accepted:** a list staff can update.
- **What to bring:** for well-baby visits, vaccines, medical certificates, fit-to-work.
- **General health information:** the national childhood immunization schedule and seasonal reminders (dengue, flu). General guidance, not advice to individuals.
- **Filipino and English** versions of the main pages.
- **FAQ** built from the questions the front desk hears most.

## Phase 6: Reliable every day (proposed)

Make the system boring in the best way: it just keeps working.

- **Logins that survive a restart:** keep sessions in the data folder so an update doesn't sign everyone out.
- **Backup and restore from the admin panel:** download all clinic settings (doctors, rooms, staff, closures) as one file, and restore it on a new server.
- ~~**TV that heals itself**~~ Done: if the server is unreachable the last numbers stay, faded, under a "Reconnecting…" bar and update only when it's back; open TVs reload themselves after an update.
- **Health check page** for the uptime monitor, so an alert fires before the clinic notices.
- **Two-step login for admins (optional):** a code from an authenticator app on top of the password.

Risk: none for patients. Staff accounts only.

## Phase 7: Easier for every patient (proposed)

Built around elderly patients, parents with children, and visitors who read Filipino more easily.

- **Spoken announcements in Filipino and English:** "Numero labindalawa, Internal Medicine" with a soft chime, numbers only.
- **Large-text mode** for the phone queue and website, one tap, remembered on that phone.
- **Colour-blind-safe rooms:** each room also gets a letter or shape (A / B), not just blue and green.
- **Clear "your turn is next" moment on the TV:** the number pulses briefly when it changes, so people looking away still notice.
- ~~**Readable on old phones and slow data**~~ Done: compressed and cached files (first load about 26 KB, unchanged checks download nothing), slower checks when the screen is off, and code older phones can run.

Risk: none. No personal data.

## Phase 8: The clinic online (proposed)

Help new families find and trust the clinic.

- **Map and directions** with the exact pin, parking notes and landmarks near Bella Vista.
- **Google Business Profile and Facebook links**, with opening hours kept in sync from the admin panel (the schedules already live there).
- **Clinic photo gallery:** waiting area, rooms, entrance. Never patients.
- **Doctor profiles:** training, specialties and memberships, written by the doctors.
- **Health tips page** the doctors can post to from the admin panel: seasonal reminders, vaccine drives, clinic news.

Risk: low. Only clinic and doctor information, published by the doctors.

## Phase 9: Running the clinic behind the scenes (proposed)

Tools for staff that use clinic data only, never patient data.

- **Vaccine and supplies stock:** counts per item with a low-stock warning on the admin panel. It stores stock, not who received it.
- **Price list** for consultations, vaccines and certificates, editable once and shown on the website (links with Phase 5).
- **Opening and closing checklist** for the secretary, ticked each day.
- **Staff notice board:** short internal messages ("Lab courier at 3 PM") shown only after login.
- **Staff schedule:** who is on duty each day.

Risk: low. Staff and stock information only; keep it behind logins.

## Phase 10: Numbers that help the doctors plan (proposed)

Anonymous totals from the queue, to plan hours and staff. Builds on the daily totals in Phase 3.

- **Monthly view:** patients per day and per doctor, busiest days and hours, as a simple chart.
- **Average wait** per doctor and by time of day.
- **Effect of closures and Sunday openings** on the following days.
- **Export to a spreadsheet** for the clinic's own records.

Risk: none, as long as it stays counts and timestamps of numbers, never linked to a person.

## Phase 11: Growing the clinic (proposed)

Only when the clinic needs it.

- **More doctors and rooms on the TV:** the three- and four-room layouts already exist; tune them the way the two-doctor view was tuned.
- **A second branch:** each branch with its own rooms, TV and staff, managed from one admin panel.
- **Per-room or per-floor TV screens** (`/queue?room=…`), already listed in Phase 3.
- **Visiting-doctor calendar:** which visiting doctor comes on which days, shown on the website.

Risk: none extra; the same numbers-only rules apply to every branch.

## Boundary zone: only with care

These touch personal (not health) data. Each is possible but needs a privacy notice, consent and a deletion policy before building.

- **Contact form.** People will type symptoms into it. Prefer showing the phone, Viber and email. If a form is added, send it straight to the clinic's email without storing it on the server, and add a clear "Please don't include medical details" note.
- **Appointment requests.** A name and phone number for a booking is personal data. Rather than building booking into this site, **link to an established Philippine clinic booking platform** that already handles compliance, or keep booking by phone or Viber (the current "Book an appointment" approach).
- **SMS or Viber "your turn" messages.** These need a phone number tied to a ticket. Only consider them with consent, deletion the same day, and a provider that has a data processing agreement.

## Out of scope for this website

Use a proper electronic medical record (EMR) system for any of these, never this site:

- patient records, charts or medical history
- diagnoses, prescriptions or lab results
- patient accounts or portals
- billing tied to named patients
- anything that stores symptoms or reasons for visit

---

**Suggested order:**

1. **Finish Phase 1** (go live with HTTPS, a new password and backups).
2. **Finish Phase 6** right after (logins that survive restarts, backup and restore), so the live site stays up and recoverable.
3. **Phase 3 and Phase 7 together:** the waiting room gets sound, estimated waits and the accessibility touches that matter most to elderly patients.
4. **Phase 5 and Phase 8** whenever there's time; they're mostly writing, and can run alongside anything.
5. **Phase 4, 9 and 10** once the basics are settled. Phase 4 builds on Phase 3's estimated wait; Phase 10 builds on its daily totals.
6. **Phase 11** only when a new doctor, room or branch actually needs it.

Treat the boundary zone as a separate decision, not a default next step.
