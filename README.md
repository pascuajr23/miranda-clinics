# Miranda Clinics

Website, TV queue display and staff control panel. Plain Node, no `npm install` needed (Node 22.9+).

| Page | URL | Who |
|---|---|---|
| Home | `/` | Public |
| Queue display | `/queue` | The TV outside (open full-screen) |
| Control panel | `/control` | Staff (password) |

## Settings

All configuration comes from environment variables. Copy `.env.example` to `.env` for local use; on a server, set them in Docker / your host instead. `.env` is git-ignored and never baked into the image.

| Variable | Required | Default |
|---|---|---|
| `ADMIN_PASSWORD` | yes (nobody can log in without it) | none |
| `ADMIN_USER` | no | `admin` |
| `PORT` | no | `3000` |
| `DATA_FILE` | no | `data/rooms.json` (`/app/data/rooms.json` in Docker) |

To change the login, change the variables and restart. Rooms and numbers are saved in `DATA_FILE`; on first start it holds the two original rooms (Dr. Kenneth / Dr. Kath). Add, rename or remove rooms from `/control`.

## Run without Docker

```bash
cp .env.example .env   # then set ADMIN_PASSWORD
npm start
```

## Run with Docker Compose

On the server, make a folder with two files.

`docker-compose.yml`:

```yaml
services:
  miranda-clinics:
    image: ghcr.io/pascuajr23/miranda-clinics:latest
    container_name: miranda-clinics
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:3000"
    environment:
      ADMIN_USER: ${ADMIN_USER:-admin}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:?Set ADMIN_PASSWORD in .env}
    volumes:
      - miranda-data:/app/data

volumes:
  miranda-data:
```

`.env` (keep it private):

```bash
ADMIN_USER=admin
ADMIN_PASSWORD=your-long-password
```

Then start it:

```bash
docker compose up -d
```

The site is then on port 3000 (set `PORT` in `.env` to change it). Queue numbers and rooms live in the `miranda-data` volume, so they survive updates.

| Task | Command |
|---|---|
| Update to the newest image | `docker compose pull && docker compose up -d` |
| Change the login | edit `.env`, then `docker compose up -d` |
| View logs | `docker compose logs -f` |
| Stop | `docker compose down` (data is kept) |

The image `ghcr.io/pascuajr23/miranda-clinics:latest` is built and published by GitHub Actions on every push to `main` (`.github/workflows/docker.yml`). If the package is private, run `docker login ghcr.io` on the server first, or make it public under GitHub → Packages.

Put Caddy (or another HTTPS proxy) in front, pointing at port 3000. The login cookie is marked Secure when the proxy sends `X-Forwarded-Proto: https` (Caddy does by default).

`original/` (a snapshot of the old site, whose `auth.js` holds the old admin password) is excluded from git and the image.

## Test

```bash
node --test
```
