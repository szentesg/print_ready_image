'use strict';

const path = require('path');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const rateLimit = require('express-rate-limit');

const PORT = process.env.PORT || 8085;
const DPI = 300;
const MAX_UPLOAD_MB = 30;
const MIN_CUSTOM_CM = 1;
const MAX_CUSTOM_CM = 120;
const CUSTOM_KEY = 'custom';
const RESIZE_RATE_LIMIT = 20; // kérés / perc / IP a /api/resize végponton
const GLOBAL_RATE_LIMIT = 120; // kérés / perc / IP az összes többi végponton

// name -> [width_cm, height_cm]
const SIZES = {
  '9x13': [9, 13],
  '10x15': [10, 15],
  '11x15': [11, 15],
  '13x18': [13, 18],
  '15x21': [15, 21],
  '20x25': [20, 25],
  '20x30': [20, 30],
  '21x30': [21, 30],
  '30x40': [30, 40],
  '30x45': [30, 45],
};

const app = express();

// Reverse proxy (nginx) mögött fut, így az X-Forwarded-For fejlécből
// kell kiolvasni a valódi kliens IP-t a rate limithez.
app.set('trust proxy', 1);

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: GLOBAL_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

const resizeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: RESIZE_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Túl sok átméretezési kérés érkezett. Kérlek várj egy percet, és próbáld újra.' },
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/sizes', (req, res) => {
  res.json(
    Object.entries(SIZES).map(([key, [w, h]]) => ({
      key,
      label: `${w}×${h} cm`,
      width_cm: w,
      height_cm: h,
    }))
  );
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

function cmToPx(cm, dpi = DPI) {
  return Math.max(1, Math.round((cm / 2.54) * dpi));
}

app.post('/api/resize', resizeLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nincs feltöltött kép.' });
    }

    const sizeKey = req.body.size;
    let size = SIZES[sizeKey];

    if (sizeKey === CUSTOM_KEY) {
      const width = parseFloat(req.body.width_cm);
      const height = parseFloat(req.body.height_cm);
      const valid = (n) => Number.isFinite(n) && n >= MIN_CUSTOM_CM && n <= MAX_CUSTOM_CM;
      if (!valid(width) || !valid(height)) {
        return res.status(400).json({
          error: `Érvénytelen egyéni méret. A szélesség és a magasság ${MIN_CUSTOM_CM} és ${MAX_CUSTOM_CM} cm között lehet.`,
        });
      }
      size = [width, height];
    }

    if (!size) {
      return res.status(400).json({ error: 'Érvénytelen méret.' });
    }

    const orientation = req.body.orientation === 'landscape' ? 'landscape' : 'portrait';
    const longSide = Math.max(size[0], size[1]);
    const shortSide = Math.min(size[0], size[1]);
    size = orientation === 'landscape' ? [longSide, shortSide] : [shortSide, longSide];

    const mode = req.body.mode === 'stretch' ? 'stretch' : 'crop';
    const fit = mode === 'stretch' ? 'fill' : 'cover';

    const widthPx = cmToPx(size[0]);
    const heightPx = cmToPx(size[1]);

    const image = sharp(req.file.buffer, { failOn: 'none' }).rotate();
    const metadata = await image.metadata();

    let pipeline = image.resize(widthPx, heightPx, {
      fit,
      position: 'centre',
    });

    const inputFormat = metadata.format;
    let contentType = 'image/jpeg';
    let ext = 'jpg';

    if (inputFormat === 'png') {
      pipeline = pipeline.png();
      contentType = 'image/png';
      ext = 'png';
    } else {
      pipeline = pipeline.jpeg({ quality: 95, chromaSubsampling: '4:4:4' });
    }

    pipeline = pipeline.withMetadata({ density: DPI });

    const outputBuffer = await pipeline.toBuffer();

    const baseName = path
      .parse(req.file.originalname || 'kep')
      .name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `${baseName}_${size[0]}x${size[1]}cm.${ext}`;

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': outputBuffer.length,
    });
    res.send(outputBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hiba történt a kép feldolgozása közben.' });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Hiba a fájl feltöltése közben: ' + err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Ismeretlen hiba.' });
});

app.listen(PORT, () => {
  console.log(`Nyomda szerver fut: http://localhost:${PORT}`);
});
