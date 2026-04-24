import { useEffect, useRef } from 'react';
import { useTheme, BG_ENVS } from '../context/ThemeContext';

// ─── ANIMATION ENGINES ──────────────────────────────────────────────────────
// Pattern: every engine MUST return a cleanup fn. All use a `cancelled` flag so
// the RAF loop halts immediately on the same tick as cancelAnimationFrame.
const ENGINES = {

  neural_mesh: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;
    const n = Math.floor(35 * density);
    const pts = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
    }));
    let frame = 0, raf, cancelled = false;
    const draw = () => {
      if (cancelled) return;
      frame++;
      if (frame % 2 === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pts.forEach(p => {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
          ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(100,200,255,0.7)'; ctx.fill();
        });
        pts.forEach((a, i) => pts.slice(i + 1).forEach(b => {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 120) {
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(100,200,255,${0.2 * (1 - d / 120)})`; ctx.stroke();
          }
        }));
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelled = true; cancelAnimationFrame(raf); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  },

  stars: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;
    const n = Math.floor(180 * density);
    const stars = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3, twinkle: Math.random() * Math.PI * 2,
    }));
    let frame = 0, raf, cancelled = false;
    const draw = () => {
      if (cancelled) return;
      frame++;
      if (frame % 2 === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        stars.forEach(s => {
          s.twinkle += 0.03;
          const alpha = 0.4 + Math.sin(s.twinkle) * 0.4;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200,220,255,${alpha})`; ctx.fill();
        });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelled = true; cancelAnimationFrame(raf); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  },

  nebula: (canvas) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;
    let t = 0, frame = 0, raf, cancelled = false;
    const draw = () => {
      if (cancelled) return;
      frame++;
      if (frame % 3 === 0) {
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
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelled = true; cancelAnimationFrame(raf); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  },

  aurora_sky: (canvas) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;
    let t = 0, frame = 0, raf, cancelled = false;
    const draw = () => {
      if (cancelled) return;
      frame++;
      if (frame % 3 === 0) {
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
          for (let x = 0; x < canvas.width; x += 6) {
            const wave = Math.sin(t * 2 + x * 0.01 + band) * 20;
            ctx.fillRect(x, y + wave - 40, 6, 80);
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelled = true; cancelAnimationFrame(raf); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  },

  particles: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;
    const n = Math.floor(50 * density);
    const pts = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: Math.random() * 2 + 0.5,
    }));
    let frame = 0, raf, cancelled = false;
    const draw = () => {
      if (cancelled) return;
      frame++;
      if (frame % 2 === 0) {
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
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelled = true; cancelAnimationFrame(raf); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  },

  fire: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;
    const n = Math.floor(50 * density);
    const embers = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width, y: canvas.height + 10,
      vx: (Math.random() - 0.5) * 1.5, vy: -(1 + Math.random() * 3),
      life: Math.random(), decay: 0.008 + Math.random() * 0.01, r: 1.5 + Math.random() * 2.5,
    }));
    let frame = 0, raf, cancelled = false;
    const draw = () => {
      if (cancelled) return;
      frame++;
      if (frame % 2 === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        embers.forEach(e => {
          e.x += e.vx; e.y += e.vy; e.life -= e.decay;
          if (e.life <= 0) { e.x = Math.random() * canvas.width; e.y = canvas.height + 10; e.life = 1; e.vy = -(1 + Math.random() * 3); }
          const hue = 20 + e.life * 30;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r * e.life, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue},100%,60%,${e.life * 0.6})`; ctx.fill();
        });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelled = true; cancelAnimationFrame(raf); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  },

  crystal_lattice: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;
    const n = Math.floor(20 * density);
    const nodes = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
    }));
    let frame = 0, raf, cancelled = false;
    const draw = () => {
      if (cancelled) return;
      frame++;
      if (frame % 2 === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        nodes.forEach(nd => {
          nd.x += nd.vx; nd.y += nd.vy;
          if (nd.x < 0 || nd.x > canvas.width) nd.vx *= -1;
          if (nd.y < 0 || nd.y > canvas.height) nd.vy *= -1;
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
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelled = true; cancelAnimationFrame(raf); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  },

  neutron_star: (canvas, density = 1) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;

    const stars = Array.from({ length: Math.floor(180 * density) }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.2,
      a: 0.2 + Math.random() * 0.6,
      twinkle: Math.random() * Math.PI * 2,
    }));

    let raf;
    let cancelled = false;
    let t = 0;

    const draw = () => {
      if (cancelled) return;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w * 0.5;
      const cy = h * 0.42;
      const pulse = (Math.sin(t * 1.5) + 1) * 0.5;

      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.9);
      bg.addColorStop(0, 'rgba(40, 70, 180, 0.18)');
      bg.addColorStop(0.3, 'rgba(12, 24, 68, 0.22)');
      bg.addColorStop(0.7, 'rgba(5, 8, 20, 0.14)');
      bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      stars.forEach((star) => {
        star.twinkle += 0.01;
        const alpha = star.a + Math.sin(star.twinkle) * 0.15;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,235,255,${Math.max(0.08, alpha)})`;
        ctx.fill();
      });

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.18);

      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate((Math.PI / 3) * i);
        const beam = ctx.createLinearGradient(-w * 0.35, 0, w * 0.35, 0);
        beam.addColorStop(0, 'rgba(0,0,0,0)');
        beam.addColorStop(0.2, `rgba(80,160,255,${0.05 + pulse * 0.04})`);
        beam.addColorStop(0.5, `rgba(210,240,255,${0.24 + pulse * 0.16})`);
        beam.addColorStop(0.8, `rgba(80,160,255,${0.05 + pulse * 0.04})`);
        beam.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.42, 8 + pulse * 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(t * 0.35 + i * (Math.PI / 2));
        const arcGradient = ctx.createRadialGradient(0, 0, w * 0.04, 0, 0, w * 0.22);
        arcGradient.addColorStop(0, 'rgba(120,200,255,0)');
        arcGradient.addColorStop(0.6, `rgba(90,170,255,${0.1 + pulse * 0.06})`);
        arcGradient.addColorStop(1, 'rgba(120,200,255,0)');
        ctx.strokeStyle = arcGradient;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, w * 0.16 + i * 10, -0.8, 0.8);
        ctx.stroke();
        ctx.restore();
      }

      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 120 + pulse * 20);
      halo.addColorStop(0, `rgba(230,245,255,${0.85 + pulse * 0.1})`);
      halo.addColorStop(0.2, `rgba(160,220,255,${0.5 + pulse * 0.08})`);
      halo.addColorStop(0.45, 'rgba(90,140,255,0.18)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, 120 + pulse * 20, 0, Math.PI * 2);
      ctx.fill();

      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 26 + pulse * 4);
      core.addColorStop(0, 'rgba(255,255,255,1)');
      core.addColorStop(0.4, 'rgba(210,235,255,0.98)');
      core.addColorStop(0.7, 'rgba(120,180,255,0.92)');
      core.addColorStop(1, 'rgba(20,40,110,0.25)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, 26 + pulse * 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      t += 0.01;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
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

  // Check if this bg has a url (still image) — works for any prefix
  const envConfig = BG_ENVS[effectiveType];
  const isStill = !!envConfig?.url;
  const stillUrl = isStill ? envConfig.url : null;

  useEffect(() => {
    if (isStill) return; // still images don't use canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (effectiveType === 'none') return;
    const fn = ENGINES[effectiveType];
    if (!fn) return;
    const cleanup = fn(canvas, density);
    return () => {
      if (cleanup) cleanup();
      const c = canvasRef.current;
      if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    };
  }, [effectiveType, density, isStill]);

  if (effectiveType === 'none') return null;

  if (isStill && stillUrl) {
    return (
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          backgroundImage: `url(${stillUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: resolvedOpacity,
          width: '100vw',
          height: '100vh',
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: resolvedOpacity, width: '100vw', height: '100vh' }}
    />
  );
}