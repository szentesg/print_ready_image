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
podman run -d --name nyomda -p 3000:3000 nyomda
```

Ezután nyisd meg: http://localhost:3000

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
PublishPort=3000:3000
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

A `compose.yaml` alapból csak `127.0.0.1:3000`-en publikálja a portot — ezt egy reverse proxy (pl. Caddy vagy nginx) mögé érdemes tenni TLS-sel, mielőtt kívülről elérhetővé teszed. Példa Caddy konfig egy domainhez:

```
nyomda.pelda-domained.hu {
    reverse_proxy 127.0.0.1:3000
}
```

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

## Fejlesztés helyi Node-dal

```bash
npm install
npm start
```

Alapértelmezett port: 3000 (a `PORT` környezeti változóval módosítható).

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
podman run -d --name nyomda -p 3000:3000 nyomda
```

Then open: http://localhost:3000

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
PublishPort=3000:3000
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

By default the port is published only on `127.0.0.1:3000` — put it behind a reverse proxy (e.g. Caddy or nginx) with TLS before exposing it publicly. Example Caddy config for a domain:

```
photos.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

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

## Local development with Node

```bash
npm install
npm start
```

Default port: 3000 (configurable via the `PORT` environment variable).
