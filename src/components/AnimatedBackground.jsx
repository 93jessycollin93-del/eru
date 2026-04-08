import { useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';

// ─── ANIMATION ENGINES ───────────────────────────────────────────────────────
const ENGINES = {
  matrix: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const cols = Math.floor(canvas.width / 16 * Math.min(density, 2));
    const drops = Array(cols).fill(1);
    return setInterval(() => {
      ctx.fillStyle = 'rgba(10,12,20,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00e676';
      ctx.font = '14px JetBrains Mono, monospace';
      drops.forEach((y, i) => {
        const char = String.fromCharCode(0x30A0 + Math.random() * 96);
        ctx.fillText(char, i * 16, y * 16);
        if (y * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
    }, 50);
  },

  neural_mesh: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const n = Math.floor(40 * density);
    const pts = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: 2,
    }));
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100,200,255,0.7)'; ctx.fill();
      });
      pts.forEach((a, i) => pts.slice(i + 1).forEach(b => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 120) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(100,200,255,${0.2 * (1 - d / 120)})`; ctx.stroke();
        }
      }));
    }, 33);
  },

  code_streams: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const CHARS = '01アイウエオカキクケコ<>{}[]()';
    const cols = Math.floor(canvas.width / 20 * density);
    const streams = Array.from({ length: cols }, (_, i) => ({
      x: i * 20 + 10, y: Math.random() * canvas.height, speed: 1 + Math.random() * 2, chars: [],
    }));
    return setInterval(() => {
      ctx.fillStyle = 'rgba(5,8,15,0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '12px JetBrains Mono';
      streams.forEach(s => {
        s.y += s.speed;
        if (s.y > canvas.height) s.y = -20;
        const alpha = Math.random() * 0.6 + 0.2;
        ctx.fillStyle = `rgba(0,200,150,${alpha})`;
        ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], s.x, s.y);
      });
    }, 40);
  },

  wire_grid: (canvas) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    let t = 0;
    const GRID = 50;
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.005;
      ctx.strokeStyle = `rgba(0,200,100,0.12)`;
      ctx.lineWidth = 0.5;
      for (let x = 0; x < canvas.width; x += GRID) {
        const wave = Math.sin(t + x * 0.01) * 8;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + wave, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += GRID) {
        const wave = Math.cos(t + y * 0.01) * 8;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y + wave); ctx.stroke();
      }
    }, 50);
  },

  stars: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const n = Math.floor(200 * density);
    const stars = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3, twinkle: Math.random() * Math.PI * 2,
    }));
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.twinkle += 0.03;
        const alpha = 0.4 + Math.sin(s.twinkle) * 0.4;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${alpha})`; ctx.fill();
      });
    }, 50);
  },

  nebula: (canvas) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    let t = 0;
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.004;
      for (let i = 0; i < 5; i++) {
        const x = canvas.width / 2 + Math.sin(t + i * 1.2) * canvas.width * 0.3;
        const y = canvas.height / 2 + Math.cos(t * 0.7 + i) * canvas.height * 0.3;
        const g = ctx.createRadialGradient(x, y, 0, x, y, canvas.width * 0.3);
        const colors = ['#00e67628','#7c4dff22','#ff525218','#2196f320','#ffeb3b18'];
        g.addColorStop(0, colors[i]); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }, 50);
  },

  galaxy: (canvas) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const pts = Array.from({ length: 300 }, (_, i) => {
      const angle = (i / 300) * Math.PI * 4;
      const r = (i / 300) * Math.min(cx, cy) * 0.9;
      return { r, angle, speed: 0.0005 + (1 - i / 300) * 0.001, size: Math.random() * 1.5 + 0.3 };
    });
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.angle += p.speed;
        const x = cx + Math.cos(p.angle) * p.r;
        const y = cy + Math.sin(p.angle) * p.r * 0.4;
        const hue = 200 + (p.r / Math.min(cx, cy)) * 100;
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},80%,70%,0.5)`; ctx.fill();
      });
    }, 33);
  },

  aurora_sky: (canvas) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    let t = 0;
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.008;
      for (let band = 0; band < 4; band++) {
        const y = canvas.height * (0.2 + band * 0.18) + Math.sin(t + band) * 30;
        const grad = ctx.createLinearGradient(0, y - 40, 0, y + 40);
        const colors = ['rgba(0,200,150,', 'rgba(100,100,255,', 'rgba(0,200,255,', 'rgba(150,0,255,'];
        grad.addColorStop(0, colors[band] + '0)');
        grad.addColorStop(0.5, colors[band] + `${0.08 + Math.sin(t * 0.5 + band) * 0.04})`);
        grad.addColorStop(1, colors[band] + '0)');
        ctx.fillStyle = grad;
        for (let x = 0; x < canvas.width; x += 4) {
          const wave = Math.sin(t * 2 + x * 0.01 + band) * 20;
          ctx.fillRect(x, y + wave - 40, 4, 80);
        }
      }
    }, 50);
  },

  rain: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const n = Math.floor(80 * density);
    const drops = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      speed: 4 + Math.random() * 6, len: 10 + Math.random() * 20, alpha: Math.random() * 0.4 + 0.1,
    }));
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drops.forEach(d => {
        d.y += d.speed;
        if (d.y > canvas.height) { d.y = -d.len; d.x = Math.random() * canvas.width; }
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 1, d.y + d.len);
        ctx.strokeStyle = `rgba(150,200,255,${d.alpha})`; ctx.lineWidth = 0.8; ctx.stroke();
      });
    }, 30);
  },

  snow: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const n = Math.floor(100 * density);
    const flakes = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 2.5 + 0.5, speed: 0.5 + Math.random() * 1.5, drift: Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    }));
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      flakes.forEach(f => {
        f.y += f.speed; f.phase += 0.02; f.x += Math.sin(f.phase) * f.drift;
        if (f.y > canvas.height) { f.y = -5; f.x = Math.random() * canvas.width; }
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,240,255,0.7)`; ctx.fill();
      });
    }, 33);
  },

  particles: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const n = Math.floor(60 * density);
    const pts = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: Math.random() * 2 + 0.5,
    }));
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,230,118,0.5)'; ctx.fill();
      });
      pts.forEach((a, i) => pts.slice(i + 1).forEach(b => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 100) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(0,230,118,${0.15 * (1 - d / 100)})`; ctx.stroke();
        }
      }));
    }, 33);
  },

  fire: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const n = Math.floor(50 * density);
    const embers = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width, y: canvas.height + 10,
      vx: (Math.random() - 0.5) * 1.5, vy: -(1 + Math.random() * 3),
      life: 1, decay: 0.008 + Math.random() * 0.01, r: 1.5 + Math.random() * 2.5,
    }));
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      embers.forEach(e => {
        e.x += e.vx; e.y += e.vy; e.life -= e.decay;
        if (e.life <= 0) {
          e.x = Math.random() * canvas.width; e.y = canvas.height + 10;
          e.life = 1; e.vy = -(1 + Math.random() * 3);
        }
        const hue = 20 + e.life * 30;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * e.life, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},100%,60%,${e.life * 0.6})`; ctx.fill();
      });
    }, 33);
  },

  magma_flow: (canvas) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    let t = 0;
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.01;
      for (let y = canvas.height - 1; y >= canvas.height * 0.6; y -= 3) {
        for (let x = 0; x < canvas.width; x += 4) {
          const wave = Math.sin(t + x * 0.02 + y * 0.01) * 0.5 + 0.5;
          const hue = 10 + wave * 25;
          const alpha = ((y - canvas.height * 0.6) / (canvas.height * 0.4)) * 0.15 * wave;
          ctx.fillStyle = `hsla(${hue},100%,50%,${alpha})`;
          ctx.fillRect(x, y, 4, 3);
        }
      }
    }, 50);
  },

  lightning_storm: (canvas) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    let bolt = null, boltTimer = 0;
    const drawBolt = (x1, y1, x2, y2, depth) => {
      if (depth === 0) return;
      const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 40;
      const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 20;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(mx, my); ctx.lineTo(x2, y2);
      ctx.strokeStyle = `rgba(200,200,255,${0.6 * depth / 3})`; ctx.lineWidth = depth; ctx.stroke();
      if (Math.random() > 0.7) drawBolt(mx, my, mx + (Math.random() - 0.5) * 80, my + 50, depth - 1);
      drawBolt(x1, y1, mx, my, depth - 1); drawBolt(mx, my, x2, y2, depth - 1);
    };
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      boltTimer--;
      if (boltTimer <= 0) {
        bolt = { x: Math.random() * canvas.width, life: 8 };
        boltTimer = 20 + Math.random() * 40;
      }
      if (bolt && bolt.life > 0) {
        drawBolt(bolt.x, 0, bolt.x + (Math.random() - 0.5) * 40, canvas.height, 3);
        bolt.life--;
      }
    }, 60);
  },

  sacred_geometry: (canvas) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    let t = 0;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const drawPoly = (x, y, r, sides, rot, alpha) => {
      ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2 + rot;
        i === 0 ? ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
                : ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.strokeStyle = `rgba(200,180,100,${alpha})`; ctx.lineWidth = 0.5; ctx.stroke();
    };
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.005;
      [3,4,5,6,7,8].forEach((sides, i) => {
        const r = 30 + i * 22;
        drawPoly(cx, cy, r, sides, t * (i % 2 === 0 ? 1 : -1), 0.25 - i * 0.02);
      });
      // Flower of life circles
      for (let ring = 0; ring < 3; ring++) {
        for (let a = 0; a < 6; a++) {
          const angle = (a / 6) * Math.PI * 2 + t * 0.2;
          const r = ring * 35;
          const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r;
          ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(180,160,80,${0.08 - ring * 0.02})`; ctx.stroke();
        }
      }
    }, 50);
  },

  crystal_lattice: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    let t = 0;
    const n = Math.floor(20 * density);
    const nodes = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
    }));
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.01;
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      });
      nodes.forEach((a, i) => nodes.slice(i + 1).forEach(b => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 150) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(150,230,255,${0.3 * (1 - d / 150)})`; ctx.lineWidth = 0.5; ctx.stroke();
          ctx.beginPath(); ctx.arc(a.x, a.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(150,230,255,0.6)'; ctx.fill();
        }
      }));
    }, 40);
  },

  jade_void_bg: (canvas) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    let t = 0;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.006;
      for (let i = 0; i < 6; i++) {
        const r = 40 + i * 30 + Math.sin(t + i) * 10;
        const x = cx + Math.cos(t * 0.3 + i * 1.05) * 60;
        const y = cy + Math.sin(t * 0.2 + i * 0.9) * 40;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(0,200,100,${0.06 + Math.sin(t + i) * 0.02})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }, 50);
  },

  none: () => null,
};

export default function AnimatedBackground({ type, opacity: opacityProp }) {
  const themeCtx = useTheme();
  const resolvedType = type ?? themeCtx?.bg ?? 'none';
  const resolvedOpacity = opacityProp ?? themeCtx?.bgOpacity ?? 0.4;
  const density = themeCtx?.particleDensity ?? 1;
  const lowPower = themeCtx?.lowPowerMode ?? false;
  const canvasRef = useRef(null);

  const effectiveType = lowPower ? 'none' : resolvedType;

  useEffect(() => {
    if (effectiveType === 'none' || !canvasRef.current) return;
    const fn = ENGINES[effectiveType];
    if (!fn) return;
    const interval = fn(canvasRef.current, density);
    return () => { if (interval) clearInterval(interval); };
  }, [effectiveType, density]);

  if (effectiveType === 'none') return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: resolvedOpacity, width: '100%', height: '100%' }}
    />
  );
}