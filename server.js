const express = require('express');
const multer = require('multer');
const unzipper = require('unzipper');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Use persistent volume in Railway if available
const gamesDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'games')
  : path.join(__dirname, 'games');

const upload = multer({ dest: 'uploads/' });

// Serve static files (index.html, styles.css)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/styles.css', (req, res) => res.sendFile(path.join(__dirname, 'styles.css')));

// Serve unzipped games
app.use('/games', express.static(gamesDir));

// Upload endpoint
app.post('/upload', upload.single('gameZip'), async (req, res) => {
  const zipPath = req.file.path;
  const gameName = path.basename(req.file.originalname, '.zip');
  const gamePath = path.join(gamesDir, gameName);

  if (!fs.existsSync(gamesDir)) fs.mkdirSync(gamesDir, { recursive: true });

  fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: gamePath }))
    .on('close', () => {
      fs.unlinkSync(zipPath);
      res.sendStatus(200);
    });
});

// List uploaded games
app.get('/games', (req, res) => {
  if (!fs.existsSync(gamesDir)) return res.json([]);
  fs.readdir(gamesDir, (err, files) => {
    if (err) return res.status(500).send('Error reading games');
    res.json(files);
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
