# Miranda Clinics

Website, waiting-room TV queue and staff admin panel for Miranda Clinics, a family clinic in General Trias, Cavite, run by Dr. Kenneth Miranda (internal medicine) and Dr. Kath Miranda (pediatrics).

It is built to stay **out of patient records**: the queue works on ticket numbers only, and the site never asks for or stores patient names or health information.

## Pages

| Page | Address | Who uses it |
|---|---|---|
| Home | `/` | Patients and the public |
| Queue display | `/queue` | The waiting-room TV, and patients on their phones |
| Admin panel | `/admin` | Doctors, staff and admins (login required) |
| Queue control | `/control` | Doctors, staff and admins (login required) |
| Privacy Notice | `/privacy` | Everyone |

## Features

### Home page
- Doctors, services, schedules and the announcement all come from the admin panel, so nobody edits code to change them.
- Dr. Ken and Dr. Kath are always shown under "About the clinic". Visiting doctors appear under "Services offered".
- Each doctor's clinic hours show in the Schedule section, with upcoming closures listed under the announcement.
- On phones, the section links sit behind a menu button.

### Queue display (TV and phone)
- Shows only rooms that have a doctor assigned. On a normal day that is Dr. Ken and Dr. Kath.
- On a TV, the numbers are as large as the screen allows so they can be read from across the hall.
- On a phone, both doctors fit on one screen with large numbers.
- Shows whether each doctor is in or out, and an optional message such as "Back at 1:00 PM".
- Shows a "Closed today" banner on closure days.
- Refreshes every 2 seconds and keeps the last numbers on screen if the connection drops.

### Queue control
- Call the next number (+1), go back (-1), or jump to any number.
- Set each doctor in or out, and post a short message for the TV.
- "Reset all to 000" starts the day; it asks for a second tap so it can't happen by accident.
- Each person sees only their own rooms.

### Admin panel
- **Main:** a large Queue control button, the TV display link and a password change form.
- **Announcement:** title, details and hours for the home page notice.
- **Doctors:** schedules for the two Mirandas (who can't be removed), visiting doctors that can be added and removed, and a login for each doctor.
- **Rooms:** choose which doctor is in each room, with a list of doctors on standby. A doctor's login controls whichever room they are put in.
- **Closures:** dates the clinic is closed.
- **Staff:** logins for the secretary and helpers, as Staff (runs the rooms of the doctors ticked for them) or Admin (runs everything). Only the super admin sees this tab.
- **Activity:** who did what and when, for staff actions only.

### Logins and roles

| Role | Can do |
|---|---|
| Super admin | Everything, including staff accounts. Its login is set in the server settings. |
| Admin | All rooms, room setup, doctors and their logins, announcement, closures, activity |
| Staff | Queue control for the rooms of the doctors they manage |
| Doctor | Queue control for the room they are assigned to |

The server enforces these rules on every change, not just the page.

### Security
- Passwords are stored hashed (scrypt). Sessions use HttpOnly, SameSite=Strict cookies.
- Logins are rate-limited after repeated wrong attempts.
- All text from the admin panel is escaped before it is shown.
- Data is written atomically, so a crash can't corrupt it.

## Privacy and Philippine law

- **Data Privacy Act of 2012 (RA 10173):** the site collects no patient data. The only personal information it keeps is clinic staff accounts (name, username, hashed password, assigned doctors) and a staff activity log. The [Privacy Notice](public/privacy.html), at `/privacy`, explains this, lists the rights of data subjects, and gives the clinic's contact for privacy concerns. It is linked from the home page footer and the login screen.
- **No tracking:** no analytics or advertising cookies. Visitors get no cookies; staff get one sign-in cookie.
- **Health information** (records, results, prescriptions, bookings with names) is out of scope by design. See [ROADMAP.md](ROADMAP.md) for what the site can safely add next.
- **Medical disclaimer:** the Privacy Notice states that the site's content is general information, not medical advice, and gives 911 for emergencies.

This is a summary for developers, not legal advice. Check any new feature that would handle personal data with the National Privacy Commission or a lawyer before building it.

## Licence

- **Code:** [MIT License](LICENSE), © 2026 Lyndon Pascua Jr.
- **Clinic photos, logo, names, written content and data:** © 2026 Miranda Clinics, all rights reserved, protected under the Intellectual Property Code of the Philippines (RA 8293). These are not covered by the MIT License. See [NOTICE.md](NOTICE.md) for the full list and third-party credits.

## Development

Requires Node.js 22 or newer. There are no dependencies to install.

```bash
ADMIN_PASSWORD=choose-a-password node server.js
```

```bash
node --test
```

The site runs at http://localhost:3000. Rooms, doctors, staff and closures are saved in `data/`, which git ignores.
