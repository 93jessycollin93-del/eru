/**
 * Animated background patterns for Jackie.
 * Each pattern renders SVG or gradient animations for the canvas background.
 */

export const ANIMATED_BACKGROUNDS = {
  stars: {
    name: 'Starfield',
    type: 'stars',
    description: 'Twinkling stars on dark void',
    draw: (ctx, w, h, t) => {
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, 0, w, h);
      const starCount = 100;
      for (let i = 0; i < starCount; i++) {
        const seed = i * 12.9898;
        const x = (Math.sin(seed) * 0.5 + 0.5) * w;
        const y = (Math.sin(seed * 78.233) * 0.5 + 0.5) * h;
        const brightness = (Math.sin(t * 0.001 + seed) * 0.5 + 0.5);
        ctx.fillStyle = `rgba(200, 200, 255, ${brightness * 0.6})`;
        ctx.fillRect(x, y, 1, 1);
      }
    },
  },
  grid: {
    name: 'Grid Lines',
    type: 'grid',
    description: 'Animated neon grid',
    draw: (ctx, w, h, t) => {
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.1)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // Scanning line
      const scanY = (t * 0.05) % h;
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(w, scanY);
      ctx.stroke();
    },
  },
  waves: {
    name: 'Waves',
    type: 'waves',
    description: 'Flowing wave patterns',
    draw: (ctx, w, h, t) => {
      ctx.fillStyle = '#0d0221';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255, 0, 110, 0.15)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let x = 0; x < w; x += 2) {
          const y = h / 2 + Math.sin((x + t * 0.02) / 30 + i) * 40 + i * 20;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
  },
  particles: {
    name: 'Particles',
    type: 'particles',
    description: 'Floating particle system',
    draw: (ctx, w, h, t) => {
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(0, 0, w, h);
      const particleCount = 50;
      for (let i = 0; i < particleCount; i++) {
        const seed = i * 15.456;
        const speed = 0.3 + (Math.sin(seed) * 0.5 + 0.5) * 0.2;
        const x = (Math.sin(seed) * 0.5 + 0.5) * w;
        const y = ((t * speed * 0.01 + Math.sin(seed * 78.233)) % 1) * h;
        const size = 1 + (Math.sin(seed * 45.164) * 0.5 + 0.5) * 1.5;
        const hue = 180 + (Math.sin(seed * 23.456) * 0.5 + 0.5) * 60;
        ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.3)`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  plasma: {
    name: 'Plasma',
    type: 'plasma',
    description: 'Animated plasma effect',
    draw: (ctx, w, h, t) => {
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, 0, w, h);
      const scale = 40;
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          const v1 = Math.sin((x + t * 0.01) / scale);
          const v2 = Math.sin((y + t * 0.015) / scale);
          const v3 = Math.sin((x + y + t * 0.01) / scale);
          const brightness = v1 * v2 * v3;
          const hue = 280 + brightness * 60;
          ctx.fillStyle = `hsla(${hue}, 100%, ${50 + brightness * 20}%, 0.4)`;
          ctx.fillRect(x, y, 2, 2);
        }
      }
    },
  },
  gradient: {
    name: 'Gradient Flow',
    type: 'gradient',
    description: 'Shifting color gradient',
    draw: (ctx, w, h, t) => {
      const hue = (t * 0.02) % 360;
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, `hsl(${hue}, 100%, 10%)`);
      gradient.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 100%, 5%)`);
      gradient.addColorStop(1, `hsl(${(hue + 120) % 360}, 100%, 10%)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
  },
};

/**
 * Get background by name.
 */
export function getBackground(bgName) {
  return ANIMATED_BACKGROUNDS[bgName] || ANIMATED_BACKGROUNDS.stars;
}

/**
 * Get all background names for selector.
 */
export function getBackgroundNames() {
  return Object.keys(ANIMATED_BACKGROUNDS);
}

/**
 * Render animated background to canvas.
 */
export function drawAnimatedBackground(ctx, bgName, w, h, timeMs) {
  const bg = getBackground(bgName);
  if (bg?.draw) {
    bg.draw(ctx, w, h, timeMs);
  }
}
