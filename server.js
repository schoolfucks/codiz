const express = require('express');
const multer = require('multer');
const unzipper = require('unzipper');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Use Railway volume or fallback to local
const gamesDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'games')
  : path.join(__dirname, 'games');

const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync(gamesDir)) fs.mkdirSync(gamesDir, { recursive: true });

// Serve index and CSS
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/styles.css', (req, res) => res.sendFile(path.join(__dirname, 'styles.css')));

// Serve games
app.use('/games', express.static(gamesDir));

// Upload handler
app.post('/upload', upload.single('gameZip'), async (req, res) => {
  const zipPath = req.file.path;
  const gameName = path.basename(req.file.originalname, '.zip');
  const gamePath = path.join(gamesDir, gameName);

  if (!fs.existsSync(gamePath)) fs.mkdirSync(gamePath);

  // Step 1: Unzip into a temp folder
  const tempPath = path.join(gamesDir, `${gameName}_tmp`);
  fs.mkdirSync(tempPath);

  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: tempPath }))
    .promise();

  fs.unlinkSync(zipPath); // cleanup zip

  // Step 2: Find folder containing index.html
  function findIndexHtml(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isFile() && item === 'index.html') return dir;
    }
    for (const item of items) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        const result = findIndexHtml(full);
        if (result) return result;
      }
    }
    return null;
  }

  const gameRoot = findIndexHtml(tempPath);
  if (!gameRoot) {
    fs.rmSync(tempPath, { recursive: true });
    return res.status(400).send('No index.html found in uploaded game.');
  }

  // Step 3: Move the correct folder to the final destination
  fs.renameSync(gameRoot, gamePath);
  if (tempPath !== gameRoot && fs.existsSync(tempPath)) {
    fs.rmSync(tempPath, { recursive: true });
  }

  res.sendStatus(200);
});

// List games
app.get('/games', (req, res) => {
  if (!fs.existsSync(gamesDir)) return res.json([]);
  fs.readdir(gamesDir, (err, files) => {
    if (err) return res.status(500).send('Error reading games');
    res.json(files.filter(f => fs.existsSync(path.join(gamesDir, f, 'index.html'))));
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

