# Nyomda

*[English version below](#nyomda-english)*

Fénykép feltöltése és átméretezése szabványos fotóméretekre (pl. 13×18 cm), nyomtatásra készen, 300 DPI-vel.

## Funkciók

- Kép feltöltése (húzd ide vagy kattintás), azonnali előnézet
- Szabványos méretek: 9×13, 10×15, 11×15, 13×18, 15×21, 20×25, 20×30, 21×30, 30×40, 30×45 cm
- Egyéni méret megadása (1–120 cm közötti szélesség és magasság)
- Tájolás választása (álló / fekvő), alapértelmezetten a feltöltött kép tájolása szerint
- Illesztési mód: középre vágás (crop) vagy nyújtás (stretch)
- A feldolgozott kép letöltése a böngészőből
- "Új feltöltés" gomb az oldal újratöltéséhez

## Futtatás Podman-nal (Atomic Linux / Fedora Silverblue / CoreOS)

### 1. Build és futtatás plain podman-nal

```bash
podman build -t nyomda -f Containerfile .
podman run -d --name nyomda -p 8085:8085 nyomda
```

Ezután nyisd meg: http://localhost:8085

Leállítás / eltávolítás:

```bash
podman stop nyomda
podman rm nyomda
```

### 2. podman-compose használatával

Ha telepítve van a `podman-compose` (pl. `rpm-ostree install podman-compose`, vagy `pip install --user podman-compose`):

```bash
podman-compose up -d --build
```

Újabb podman verziók a `podman compose` (kötőjel nélküli) alparancsot is tudják a compose.yaml fájllal:

```bash
podman compose up -d --build
```

### 3. Rootless podman + systemd (quadlet, ajánlott Atomic Linux-on)

Hozz létre egy `~/.config/containers/systemd/nyomda.container` fájlt:

```ini
[Unit]
Description=Nyomda fénykép átméretező

[Container]
Image=localhost/nyomda:latest
ContainerName=nyomda
PublishPort=8085:8085
AutoUpdate=registry

[Service]
Restart=always

[Install]
WantedBy=default.target
```

Előtte építsd meg a képet (`podman build -t localhost/nyomda:latest -f Containerfile .`), majd:

```bash
systemctl --user daemon-reload
systemctl --user enable --now nyomda.service
```

## Üzemeltetés Docker-rel (pl. Ubuntu/Debian VPS-en)

### 1. Docker telepítése

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # jelentkezz be újra utána
```

### 2. Build és futtatás Docker Compose-zal

A `compose.yaml` sima Docker Compose fájl, közvetlenül használható:

```bash
git clone git@github.com:szentesg/print_ready_image.git
cd print_ready_image
docker compose up -d --build
```

A `compose.yaml` alapból csak `127.0.0.1:8085`-en publikálja a portot — ezt egy reverse proxy mögé kell tenni, mielőtt kívülről elérhetővé teszed (lásd lentebb).

A Docker daemon és a `restart: unless-stopped` policy gondoskodik róla, hogy a konténer szerver-újraindítás után is automatikusan elinduljon.

### 3. Frissítés új verzióra

```bash
cd print_ready_image
git pull
docker compose up -d --build
```

### 4. Naplók / státusz

```bash
docker compose ps
docker compose logs -f
```

## Nyilvános kitettség: bot- és túlterhelés-védelem

Mivel egy publikus, kép-feltöltő/átméretező végpont vonzza a botokat és a tömeges visszaéléseket, több védelmi réteg is be van építve:

**1. Cloudflare (vagy hasonló CDN/WAF) a domain előtt** — ez a te feladatod: állítsd be a domaint Cloudflare mögé (ingyenes tier is elég), kapcsold be a Bot Fight Mode-ot, és DNS-ben csak a proxyzott (narancssárga felhő) rekordot használd.

**2. nginx reverse proxy, IP-alapú rate limittel és méretkorláttal** — a `deploy/nginx.conf` egy kész, telepíthető konfig:
- `/api/resize` végpont: 6 kérés / perc / IP (burst 3), mert ez a CPU-igényes művelet
- minden más végpont: 60 kérés / perc / IP (burst 20)
- egyidejű kapcsolatok korlátozása IP-nként
- `client_max_body_size 32m` — a túl nagy feltöltés már az nginx-nél elakad

Telepítés:
```bash
sudo apt install -y nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/nyomda
sudo sed -i 's/your-domain.example/nyomda.pelda-domained.hu/' /etc/nginx/sites-available/nyomda
sudo ln -s /etc/nginx/sites-available/nyomda /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d nyomda.pelda-domained.hu   # TLS, ha a DNS már a szerverre mutat
```

**3. Alkalmazás szintű rate limit** — a szerver maga is korlátoz IP-nként (`express-rate-limit`), akkor is, ha valaki megkerülné az nginx-et: 20 kérés / perc / IP a `/api/resize`-on, 120 kérés / perc / IP mindenhol máshol. A limit túllépésekor `429 Too Many Requests` választ ad, `Retry-After` fejléccel. Mivel az app reverse proxy mögött fut, a `trust proxy` beállítás miatt a valós kliens IP-t (`X-Forwarded-For`) használja, nem az nginx saját címét.

**4. Konténer erőforráskorlátok** — a `compose.yaml`-ban be van állítva:
- max. 1 CPU mag és 768 MB memória a konténerre (`deploy.resources.limits`)
- max. 100 egyidejű process/thread (`pids`)
- `VIPS_CONCURRENCY=2` — a képfeldolgozó (libvips) szálpoolja ne tudja lefoglalni az összes magot egyetlen nagy kép feldolgozásakor

Így egy visszaélésszerű terhelési hullám legrosszabb esetben is csak ennyi a konténer erőforrásait tudja felhasználni, a VPS többi szolgáltatása (és maga az SSH-elérés) nem esik ki. Igazítsd a `cpus`/`memory` értékeket a VPS tényleges kapacitásához.

## Fejlesztés helyi Node-dal

```bash
npm install
npm start
```

Alapértelmezett port: 8085 (a `PORT` környezeti változóval módosítható).

---

<a id="nyomda-english"></a>

# Nyomda (English)

*[Magyar verzió fent](#nyomda)*

Upload a photo and resize it to standard print sizes (e.g. 13×18 cm), ready for printing at 300 DPI.

## Features

- Upload a photo (drag & drop or click), instant preview
- Standard sizes: 9×13, 10×15, 11×15, 13×18, 15×21, 20×25, 20×30, 21×30, 30×40, 30×45 cm
- Custom size input (width and height between 1–120 cm)
- Orientation selection (portrait / landscape), defaulting to the orientation of the uploaded photo
- Fit mode: center crop or stretch
- Download the processed image straight from the browser
- "New upload" button to reload the page

## Running with Podman (Atomic Linux / Fedora Silverblue / CoreOS)

### 1. Build and run with plain podman

```bash
podman build -t nyomda -f Containerfile .
podman run -d --name nyomda -p 8085:8085 nyomda
```

Then open: http://localhost:8085

Stop / remove:

```bash
podman stop nyomda
podman rm nyomda
```

### 2. Using podman-compose

If `podman-compose` is installed (e.g. `rpm-ostree install podman-compose`, or `pip install --user podman-compose`):

```bash
podman-compose up -d --build
```

Newer podman versions also support the `podman compose` subcommand (no hyphen) with the compose.yaml file:

```bash
podman compose up -d --build
```

### 3. Rootless podman + systemd (quadlet, recommended on Atomic Linux)

Create a `~/.config/containers/systemd/nyomda.container` file:

```ini
[Unit]
Description=Nyomda photo resizer

[Container]
Image=localhost/nyomda:latest
ContainerName=nyomda
PublishPort=8085:8085
AutoUpdate=registry

[Service]
Restart=always

[Install]
WantedBy=default.target
```

Build the image first (`podman build -t localhost/nyomda:latest -f Containerfile .`), then:

```bash
systemctl --user daemon-reload
systemctl --user enable --now nyomda.service
```

## Running in production with Docker (e.g. on an Ubuntu/Debian VPS)

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # log back in afterwards
```

### 2. Build and run with Docker Compose

`compose.yaml` is a plain Docker Compose file and works out of the box:

```bash
git clone git@github.com:szentesg/print_ready_image.git
cd print_ready_image
docker compose up -d --build
```

By default the port is published only on `127.0.0.1:8085` — put it behind a reverse proxy before exposing it publicly (see below).

The Docker daemon plus the `restart: unless-stopped` policy make sure the container comes back up automatically after a server reboot.

### 3. Updating to a new version

```bash
cd print_ready_image
git pull
docker compose up -d --build
```

### 4. Logs / status

```bash
docker compose ps
docker compose logs -f
```

## Public exposure: protecting against bots and overload

A public photo upload/resize endpoint is exactly the kind of thing bots and abusive traffic target, so several layers of protection are built in:

**1. Cloudflare (or similar CDN/WAF) in front of the domain** — this part is on you: put the domain behind Cloudflare (the free tier is enough), enable Bot Fight Mode, and only use the proxied (orange cloud) DNS record.

**2. nginx reverse proxy with per-IP rate limiting and a body size cap** — `deploy/nginx.conf` is a ready-to-install config:
- `/api/resize`: 6 requests / minute / IP (burst 3), since this is the CPU-heavy operation
- everything else: 60 requests / minute / IP (burst 20)
- per-IP concurrent connection limit
- `client_max_body_size 32m` — oversized uploads are rejected at nginx already

Install it:
```bash
sudo apt install -y nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/nyomda
sudo sed -i 's/your-domain.example/photos.example.com/' /etc/nginx/sites-available/nyomda
sudo ln -s /etc/nginx/sites-available/nyomda /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d photos.example.com   # TLS, once DNS points at the server
```

**3. Application-level rate limiting** — the server itself also rate-limits per IP (`express-rate-limit`), so it's still protected even if nginx were bypassed: 20 requests / minute / IP on `/api/resize`, 120 requests / minute / IP everywhere else. Exceeding the limit returns `429 Too Many Requests` with a `Retry-After` header. Because the app runs behind a reverse proxy, `trust proxy` is enabled so it rate-limits by the real client IP (`X-Forwarded-For`), not nginx's own address.

**4. Container resource limits** — configured in `compose.yaml`:
- max 1 CPU core and 768 MB memory (`deploy.resources.limits`)
- max 100 concurrent processes/threads (`pids`)
- `VIPS_CONCURRENCY=2` — caps the image-processing library's thread pool so a single large image can't claim every core

This way, even a worst-case abusive traffic spike is contained to the container's own resource budget, and the rest of the VPS (including SSH access) stays responsive. Tune the `cpus`/`memory` values to your VPS's actual capacity.

## Local development with Node

```bash
npm install
npm start
```

Default port: 8085 (configurable via the `PORT` environment variable).
