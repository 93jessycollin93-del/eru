import { useEffect, useRef } from 'react';

/**
 * JackieOrbit — Smooth rotating triangle with orbiting elements.
 * Mimics the JACKY v3 sci-fi interface: dark background, cyan-to-green
 * triangle, floating colored icons in orbital paths.
 */
export default function JackieOrbit({
  brightness = 1,
  glowIntensity = 1,
  rotationSpeed = 1,
  triangleColor = '#00ff88',
  backgroundColor = '#0a0e27',
  showOrbits = true,
  size = 300,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let angle = 0;

    const orbitElements = [
      { label: 'AI', color: '#ff006e', offset: 0 },
      { label: 'Code', color: '#00d9ff', offset: Math.PI * 0.33 },
      { label: 'Data', color: '#ffbe0b', offset: Math.PI * 0.66 },
      { label: 'Logic', color: '#8338ec', offset: Math.PI },
      { label: 'Flow', color: '#ff006e', offset: Math.PI * 1.33 },
      { label: 'Sync', color: '#00ff88', offset: Math.PI * 1.66 },
    ];

    const drawTriangle = (centerX, centerY, size, rotation, color) => {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);

      // Triangle path
      ctx.beginPath();
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(size / 2, size / 2);
      ctx.lineTo(-size / 2, size / 2);
      ctx.closePath();

      // Gradient fill
      const gradient = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, '#00d9ff');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Glow effect
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * glowIntensity;
      ctx.globalAlpha = 0.6 * glowIntensity;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.restore();
    };

    const drawOrbit = (centerX, centerY, radius) => {
      if (!showOrbits) return;
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    };

    const drawOrbitElement = (centerX, centerY, radius, angle, color, label) => {
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      // Icon circle
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.8 * brightness;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Glow ring
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4 * glowIntensity;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const animate = () => {
      // Clear with fade effect for motion blur
      ctx.fillStyle = `rgba(10, 14, 39, ${0.1 * brightness})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      angle += 0.01 * rotationSpeed;

      // Draw orbits
      drawOrbit(centerX, centerY, 80);
      drawOrbit(centerX, centerY, 120);

      // Draw triangle
      drawTriangle(centerX, centerY, size, angle, triangleColor);

      // Draw orbiting elements
      orbitElements.forEach((el, i) => {
        const orbitRadius = i < 3 ? 80 : 120;
        const elementAngle = angle + el.offset;
        drawOrbitElement(centerX, centerY, orbitRadius, elementAngle, el.color, el.label);
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationId);
  }, [brightness, glowIntensity, rotationSpeed, triangleColor, backgroundColor, showOrbits, size]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      className="rounded-2xl"
      style={{
        backgroundColor,
        filter: `brightness(${brightness})`,
        imageRendering: 'crisp-edges',
      }}
    />
  );
}
