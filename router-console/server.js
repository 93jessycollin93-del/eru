import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { v4 as uuid } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// In-memory store for demo (replace with SQLite in production)
let orchestrationState = {
  sisters: [
    { id: 1, name: 'Sister 1', status: 'active', confidence: 0.95, domain: 'coding', memory: 120 },
    { id: 2, name: 'Sister 2', status: 'hibernating', confidence: 0.78, domain: 'design', memory: 45 },
    { id: 3, name: 'Sister 3', status: 'queued', confidence: 0.82, domain: 'research', memory: 0 },
  ],
  thermalState: {
    gpuTemp: 62,
    gpuTarget: 75,
    cpuTemp: 45,
    memoryUsage: 68,
    batteryDrain: 2.3,
  },
  compressionStatus: {
    podSeeds: [
      { model: 'mistral-7b', original: '1.2GB', compressed: '8MB', ratio: '150x', status: 'ready' },
      { model: 'phi-3b', original: '580MB', compressed: '4.2MB', ratio: '138x', status: 'compressing' },
    ],
  },
  networkStatus: {
    connected: false,
    lastSync: new Date(Date.now() - 3600000).toISOString(),
    pendingSync: 12,
  },
};

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    orchestration: orchestrationState,
  });
});

app.get('/api/sisters', (req, res) => {
  res.json({
    sisters: orchestrationState.sisters,
    total: orchestrationState.sisters.length,
    active: orchestrationState.sisters.filter(s => s.status === 'active').length,
  });
});

app.post('/api/sisters/:id/promote', (req, res) => {
  const sister = orchestrationState.sisters.find(s => s.id === parseInt(req.params.id));
  if (!sister) return res.status(404).json({ error: 'Sister not found' });

  sister.status = 'active';
  sister.memory = 256;
  res.json({ success: true, sister });
});

app.post('/api/sisters/:id/hibernate', (req, res) => {
  const sister = orchestrationState.sisters.find(s => s.id === parseInt(req.params.id));
  if (!sister) return res.status(404).json({ error: 'Sister not found' });

  sister.status = 'hibernating';
  sister.memory = 0;
  res.json({ success: true, sister });
});

app.get('/api/thermal', (req, res) => {
  // Simulate thermal changes
  orchestrationState.thermalState.gpuTemp = Math.min(
    orchestrationState.thermalState.gpuTemp + (Math.random() - 0.5) * 3,
    85
  );
  res.json(orchestrationState.thermalState);
});

app.get('/api/compression', (req, res) => {
  res.json(orchestrationState.compressionStatus);
});

app.get('/api/network', (req, res) => {
  res.json(orchestrationState.networkStatus);
});

app.post('/api/sync', (req, res) => {
  orchestrationState.networkStatus.lastSync = new Date().toISOString();
  orchestrationState.networkStatus.pendingSync = 0;
  res.json({ success: true, synced: 12 });
});

// Service Worker registration endpoint
app.get('/sw.js', (req, res) => {
  res.type('application/javascript').send(readFileSync(join(__dirname, 'public/sw.js'), 'utf8'));
});

// Manifest for PWA
app.get('/manifest.json', (req, res) => {
  res.json({
    name: 'Router Console',
    shortName: 'Console',
    description: 'Manage your orchestration from anywhere',
    startUrl: '/',
    display: 'standalone',
    theme_color: '#000000',
    background_color: '#ffffff',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  });
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public/index.html'));
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Router Console PWA running at:`);
  console.log(`   http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`\n📱 On your iPhone (same WiFi):`);
  console.log(`   http://192.168.x.x:${PORT} (replace x.x with your PC's IP)`);
  console.log(`   Or: http://pc-hostname.local:${PORT}\n`);
});
