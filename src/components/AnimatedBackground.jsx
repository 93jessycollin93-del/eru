import { useEffect, useRef } from 'react';

const ANIMATIONS = {
  matrix: (canvas) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const cols = Math.floor(canvas.width / 16);
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
  particles: (canvas) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const pts = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 2 + 1
    }));
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,230,118,0.6)';
        ctx.fill();
      });
      pts.forEach((a, i) => pts.slice(i + 1).forEach(b => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 100) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(0,230,118,${0.15 * (1 - d / 100)})`;
          ctx.stroke();
        }
      }));
    }, 30);
  },
  nebula: (canvas) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    let t = 0;
    return setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.005;
      for (let i = 0; i < 5; i++) {
        const x = canvas.width / 2 + Math.sin(t + i * 1.2) * canvas.width * 0.3;
        const y = canvas.height / 2 + Math.cos(t * 0.7 + i) * canvas.height * 0.3;
        const g = ctx.createRadialGradient(x, y, 0, x, y, canvas.width * 0.25);
        const colors = ['#00e67630', '#7c4dff30', '#ff525220', '#2196f325', '#ffeb3b20'];
        g.addColorStop(0, colors[i]); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }, 50);
  },
  none: () => null
};

export default function AnimatedBackground({ type = 'none', opacity = 0.4 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (type === 'none' || !canvasRef.current) return;
    const fn = ANIMATIONS[type];
    if (!fn) return;
    const interval = fn(canvasRef.current);
    return () => clearInterval(interval);
  }, [type]);

  if (type === 'none') return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity, width: '100%', height: '100%' }}
    />
  );
}