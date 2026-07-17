# Router Console PWA

**Offline-first web app for managing your router & orchestration system from your iPhone**

- 📱 Works offline with full local storage
- 🔄 Auto-syncs when online
- 🎮 Control 50-agent orchestration (Sister promotion/hibernation)
- 🌡️ Real-time thermal monitoring (GPU, CPU, battery)
- 📦 Pod seed compression tracking
- 🏠 Runs on your home network (no cloud required)

## Setup (When Your PC Comes Back Online)

### Prerequisites
- Node.js 16+ installed on your PC
- PC and iPhone on the same WiFi network

### Quick Start

**1. Clone & install:**
```bash
cd /path/to/your/project
git clone <this-repo> router-console
cd router-console
npm install
```

**2. Start the server:**
```bash
npm start
```

Output will show:
```
🚀 Router Console PWA running at:
   http://localhost:8000

📱 On your iPhone (same WiFi):
   http://192.168.x.x:8000 (replace x.x with your PC's IP)
   Or: http://pc-hostname.local:8000
```

**3. On your iPhone:**
- Open Safari
- Navigate to: `http://192.168.x.x:8000` (get IP from PC)
- Tap Share button → "Add to Home Screen"
- Now it's a native-looking app that works offline

## Finding Your PC's IP

**Windows:**
```cmd
ipconfig
# Look for "IPv4 Address" (e.g., 192.168.1.50)
```

**Mac/Linux:**
```bash
hostname -I
# or check WiFi settings
```

## Features

### Dashboard
- Active sister count
- GPU temperature
- Memory usage
- Battery drain rate
- Last sync time

### Sisters Tab
- View all 50 agents
- Promote sisters from hibernation (wake them up)
- Pause active sisters (sleep mode)
- See confidence scores and memory usage per domain

### Thermal Tab
- Real-time GPU temperature with visual gauge
- CPU temp monitoring
- Memory usage progress bar
- Battery drain tracking

### Pods Tab
- Compression status for model seeds
- Original vs compressed size
- Compression ratios (target: 150x)
- Status: ready/compressing/failed

### Sync Tab
- Network status (online/offline)
- Pending changes to sync
- Manual sync button
- Auto-sync on reconnection

## Offline Features

✅ All data cached locally  
✅ Actions queue while offline  
✅ Auto-syncs pending changes when online  
✅ Full UI works without connectivity  

## API Endpoints

- `GET /api/status` — Overall orchestration state
- `GET /api/sisters` — All sister agents
- `POST /api/sisters/:id/promote` — Wake up a sister
- `POST /api/sisters/:id/hibernate` — Sleep a sister
- `GET /api/thermal` — GPU/CPU/battery metrics
- `GET /api/compression` — Pod seed status
- `GET /api/network` — Network/sync status
- `POST /api/sync` — Force sync

## Integration with Jacky

This PWA integrates with your Jacky AI Operations Manager:

- **Thermal gating**: When GPU > 70°C, automatically routes to smaller models
- **Sister promotion**: Manually override hibernation to activate specialized agents
- **Pod seeds**: Track ECPS compression of Mistral-7B (1.2GB → 8MB)
- **Cloud fallback**: Shows when system falls back to Groq/Gemini/OpenRouter

## Browser Support

✅ Safari 14.1+ (iOS 14.5+)  
✅ Chrome 88+  
✅ Firefox 91+  
✅ Edge 88+  

## Troubleshooting

**Can't connect to server?**
- Make sure PC and iPhone are on same WiFi
- Check PC's IP: `ipconfig` (Windows) or `hostname -I` (Mac/Linux)
- Try `http://pc-hostname.local:8000` if using hostname
- Restart the server: `npm start`

**Service Worker not caching?**
- Hard refresh: Safari → Settings → Advanced → Website Data → Clear all
- Or force reload: Cmd+Shift+R

**Offline sync not working?**
- Changes are queued in browser storage
- Try manual sync in Sync tab
- Sync happens automatically when online

## Development

**Run with hot reload:**
```bash
npm run dev
```

**Database setup (production):**
Replace in-memory state with SQLite:
```bash
npm install sqlite3
# Update server.js to use db.js module
```

## Environment Variables

```bash
PORT=8000          # Server port
HOST=0.0.0.0       # Bind to all interfaces
NODE_ENV=production
```

## License

MIT
