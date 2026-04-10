import { useState } from 'react';
import { Bot, Cpu } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function JackieFloat() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pos, setPos] = useState({ x: 16, y: 100 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  if (pathname === '/jackie') return null;

  const handleMouseDown = (e) => {
    setDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const newX = Math.max(0, Math.min(e.clientX - offset.x, window.innerWidth - 48));
    const newY = Math.max(0, Math.min(e.clientY - offset.y, window.innerHeight - 48));
    setPos({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
      }}
      className="z-50 flex flex-col gap-2"
    >
      <button
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => !dragging && navigate('/jackie')}
        className="w-12 h-12 rounded-full bg-primary shadow-lg flex items-center justify-center glow-green transition-transform hover:scale-110 active:scale-95 cursor-move"
        title="Drag to move · Click to open Jackie"
      >
        <Bot className="w-5 h-5 text-primary-foreground pointer-events-none" />
      </button>
      <button
        onClick={() => navigate('/bot-marketplace')}
        className="w-12 h-12 rounded-full bg-card border border-primary/30 shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        title="Open Bot Marketplace"
      >
        <Cpu className="w-5 h-5 text-primary pointer-events-none" />
      </button>
    </div>
  );
}