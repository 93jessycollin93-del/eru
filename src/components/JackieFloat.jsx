import { useState } from 'react';
import { Bot, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function JackieFloat() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Don't show on Jackie's own page
  if (pathname === '/jackie') return null;

  return (
    <button
      onClick={() => navigate('/jackie')}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-12 h-12 rounded-full bg-primary shadow-lg flex items-center justify-center glow-green transition-transform hover:scale-110 active:scale-95"
      title="Open Jackie AI"
    >
      <Bot className="w-5 h-5 text-primary-foreground" />
    </button>
  );
}