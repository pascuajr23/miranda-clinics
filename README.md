# Miranda Clinics

Website, TV queue display and staff control panel, run with Docker.

| Page | URL | Who |
|---|---|---|
| Home | `/` | Public |
| Queue display | `/queue` | The TV outside (open full-screen) |
| Control panel | `/control` | Staff (username and password) |

The Docker image `ghcr.io/pascuajr23/miranda-clinics:latest` is built and published automatically by GitHub Actions on every push to `main`.

## Install

**1. Make a folder on the server**

```bash
mkdir miranda-clinics && cd miranda-clinics
```

**2. Create `docker-compose.yml`** with this content:

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

**3. Create `.env`** in the same folder (keep it private):

```bash
ADMIN_USER=admin
ADMIN_PASSWORD=your-long-password
PORT=3000
```

`PORT` is the port the site is served on, on the server.

**4. Start it**

```bash
docker compose up -d
```

If the image is private, run `docker login ghcr.io` first (or make the package public under GitHub → Packages).

**5. Open the site** at `http://<server>:3000`. For HTTPS, put Caddy (or another proxy) in front, pointing at that port. The login cookie is marked Secure when the proxy sends `X-Forwarded-Proto: https` (Caddy does by default).

## Everyday tasks

| Task | Command |
|---|---|
| Update to the newest image | `docker compose pull && docker compose up -d` |
| Change the username or password | edit `.env`, then `docker compose up -d` |
| View logs | `docker compose logs -f` |
| Stop | `docker compose down` |

Rooms and queue numbers are stored in the `miranda-data` volume, so they survive updates and restarts. On first start there are two rooms (Dr. Kenneth / Dr. Kath); add, rename or remove rooms from `/control`.
