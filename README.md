# Miranda Clinics

Website, TV queue display and staff control panel, run with Docker.

| Page | URL | Who |
|---|---|---|
| Home | `/` | Public |
| Queue display | `/queue` | The TV outside (open full-screen) |
| Control panel | `/control` | Staff (username and password) |

The Docker image `ghcr.io/pascuajr23/miranda-clinics:latest` is built and published automatically by GitHub Actions on every push to `main`.

## Install

Run each command on the server, in order.

**1. Make a folder and go into it**

```bash
mkdir miranda-clinics && cd miranda-clinics
```

**2. Create `docker-compose.yml`**

Open the editor:

```bash
sudo nano docker-compose.yml
```

Paste this in:

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

Save and close: press `Ctrl + O`, then `Enter`, then `Ctrl + X`.

**3. Create `.env`** (the login and port; keep it private)

Open the editor:

```bash
sudo nano .env
```

Paste this in, then change `your-long-password` to your own password:

```bash
ADMIN_USER=admin
ADMIN_PASSWORD=your-long-password
PORT=3000
```

Save and close: press `Ctrl + O`, then `Enter`, then `Ctrl + X`.

`ADMIN_USER` and `ADMIN_PASSWORD` are the control panel login. `PORT` is the port the site is served on.

**4. Log in to GitHub's image registry** (only needed if the image is private)

```bash
sudo docker login ghcr.io
```

Username: your GitHub username. Password: a GitHub personal access token with the `read:packages` permission.

**5. Start the site**

```bash
sudo docker compose up -d
```

**6. Check it is running**

```bash
sudo docker compose ps
```

The site is now at `http://<server-address>:3000` (or the `PORT` you chose). For HTTPS, put Caddy (or another proxy) in front, pointing at that port.

## Update to the newest version

Run these in the `miranda-clinics` folder:

```bash
cd miranda-clinics
```

```bash
sudo docker compose pull
```

```bash
sudo docker compose up -d
```

Rooms and queue numbers are kept (they live in the `miranda-data` volume).

## Change the username or password

**1. Go to the folder and open `.env`**

```bash
cd miranda-clinics
```

```bash
sudo nano .env
```

**2. Change** `ADMIN_USER` and/or `ADMIN_PASSWORD`, then save and close: `Ctrl + O`, `Enter`, `Ctrl + X`.

**3. Restart with the new login**

```bash
sudo docker compose up -d
```

## Other commands

Run these in the `miranda-clinics` folder.

See the logs (press `Ctrl + C` to stop watching):

```bash
sudo docker compose logs -f
```

Stop the site (rooms and numbers are kept):

```bash
sudo docker compose down
```

On first start there are two rooms (Dr. Kenneth / Dr. Kath). Add, rename or remove rooms from `/control`.
