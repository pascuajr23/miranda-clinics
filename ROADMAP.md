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

## Phase 1: Launch and trust (now)

Get the current site live and dependable.

- **Deploy** the Docker image behind Caddy on `mirandaclinics.com`, with HTTPS.
- **Change the admin password** (the current one has been shared in chat).
- **Back up** the `miranda-data` volume (rooms only, no patient data) on a schedule.
- **Uptime check:** a free monitor that alerts the clinic if the site or TV page goes down.
- **Privacy notice page** stating plainly that the site collects no patient information. Short, and true by design.
- **Search basics:** page titles and descriptions, `MedicalClinic` structured data (address, hours, phone) so Google shows the clinic correctly, and a link to the Google Business Profile.

## Phase 2: Run the clinic from the control panel

Replace hard-coded text with things staff can change themselves. All clinic data, no patient data.

- **Announcements editor:** add, edit, schedule and expire announcements (for example "Open on Sunday", "Closed on Dec 25") instead of editing code.
- **Doctor schedules:** each doctor's clinic days and hours, shown on the home page and the TV.
- **Holidays and closures:** a date list that shows a banner on the site and the TV.
- **Room status messages:** "Back at 1:00 PM", "On break", shown under the number on the TV.
- **Staff accounts with roles:** separate logins for each doctor and the secretary, instead of one shared password. Each can be removed when someone leaves.
- **Staff activity log:** who changed which number or room, and when. This logs staff actions, not patients.

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

**Suggested order:** Phase 1 first. Phases 2 and 3 give the most day-to-day value for the least risk. Phase 4 builds on the estimated wait from Phase 3. Phase 5 can run alongside any phase. Treat the boundary zone as a separate decision, not a default next step.
