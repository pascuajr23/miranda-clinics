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

## Run locally

```bash
cp .env.example .env   # then set ADMIN_PASSWORD
npm start
```

## Docker

Every push to `main` (and every `v*` tag) runs the tests, builds the image and pushes it to GitHub Container Registry: `ghcr.io/<your-github-user>/<repo>:latest` (also tagged with the commit SHA). See `.github/workflows/docker.yml`. The first time, the package is private: make it public under GitHub → Packages, or log in on the server with `docker login ghcr.io`.

Run it on the server, keeping the queue data in a named volume so it survives updates:

```bash
docker run -d --name miranda-clinics --restart unless-stopped \
  -p 3000:3000 \
  -e ADMIN_USER=admin -e ADMIN_PASSWORD='your-long-password' \
  -v miranda-data:/app/data \
  ghcr.io/<your-github-user>/<repo>:latest
```

Or with an env file kept only on the server: replace the two `-e` flags with `--env-file /path/to/miranda.env`.

Update to a new image: `docker pull …:latest`, then remove and re-run the container with the same volume. Put Caddy (or another HTTPS proxy) in front, pointing at port 3000. The login cookie is marked Secure when the proxy sends `X-Forwarded-Proto: https` (Caddy does by default).

`original/` (a snapshot of the old site, whose `auth.js` holds the old admin password) is excluded from git and the image.

## Test

```bash
node --test
```
