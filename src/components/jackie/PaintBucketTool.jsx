import { useRef, useState } from 'react';
import { Pipette, RotateCcw } from 'lucide-react';

/**
 * PaintBucketTool — Click elements in the animation preview to recolor them.
 * Sits over JackieOrbit canvas, captures clicks, and lets users paint individual parts.
 */
export default function PaintBucketTool({
  canvasRef,
  onColorElement,
  customColors = {},
  onReset,
  isActive = false,
}) {
  const [hoveredPart, setHoveredPart] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#00ff88');
  const overlayRef = useRef(null);

  // Define clickable regions on the canvas
  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 400;
  const CENTER_X = CANVAS_WIDTH / 2;
  const CENTER_Y = CANVAS_HEIGHT / 2;
  const TRIANGLE_SIZE = 150;
  const ORBIT_RADIUS_INNER = 80;
  const ORBIT_RADIUS_OUTER = 120;

  const getElementAtPoint = (x, y) => {
    const dx = x - CENTER_X;
    const dy = y - CENTER_Y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Triangle (distance from center < 75, roughly)
    if (dist < 75) return 'triangle';

    // Inner orbit (60–100px from center)
    if (dist >= 60 && dist <= 100) return 'orbit-inner';

    // Outer orbit (100–140px from center)
    if (dist >= 100 && dist <= 140) return 'orbit-outer';

    // Background
    return 'background';
  };

  const handleCanvasClick = (e) => {
    if (!isActive || !canvasRef?.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const element = getElementAtPoint(x, y);
    onColorElement(element, selectedColor);
  };

  const handleMouseMove = (e) => {
    if (!isActive || !canvasRef?.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const element = getElementAtPoint(x, y);
    setHoveredPart(element);
  };

  const handleMouseLeave = () => {
    setHoveredPart(null);
  };

  if (!isActive) return null;

  return (
    <>
      {/* Overlay canvas for click detection */}
      <div
        ref={overlayRef}
        className="absolute inset-0 rounded-2xl cursor-crosshair"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.01)',
          border: '2px dashed rgba(0, 255, 136, 0.3)',
          pointerEvents: 'auto',
        }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Hover hint */}
      {hoveredPart && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-primary/90 text-primary-foreground text-xs font-medium rounded-lg pointer-events-none">
          {hoveredPart === 'triangle' && '△ Triangle'}
          {hoveredPart === 'orbit-inner' && '◐ Inner Orbit'}
          {hoveredPart === 'orbit-outer' && '◎ Outer Orbit'}
          {hoveredPart === 'background' && '▭ Background'}
        </div>
      )}

      {/* Color picker toolbar */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 bg-card/95 border border-border rounded-lg p-2">
        <Pipette className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <input
          type="color"
          value={selectedColor}
          onChange={(e) => setSelectedColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer flex-shrink-0"
          title="Pick color"
        />
        <input
          type="text"
          value={selectedColor}
          onChange={(e) => setSelectedColor(e.target.value)}
          className="flex-1 px-2 py-1 text-xs bg-secondary border border-border rounded text-foreground"
          placeholder="#00ff88"
        />
        <button
          onClick={onReset}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded"
          title="Reset to theme"
          aria-label="Reset colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
