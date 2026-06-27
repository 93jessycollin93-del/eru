import { useState, useEffect, useRef } from 'react';
import { X, RotateCcw, Pipette, Download, Upload } from 'lucide-react';
import JackieOrbit from '@/components/animations/JackieOrbit';
import PaintBucketTool from '@/components/jackie/PaintBucketTool';
import { JACKIE_THEMES, saveTheme, loadTheme, saveCustomTheme, loadCustomTheme, exportTheme, importTheme } from '@/lib/themes';
import { getBackgroundNames, ANIMATED_BACKGROUNDS } from '@/lib/animatedBackgrounds';

/**
 * JackieCustomizer — Modal to edit brightness, colors, glow, and theme.
 * Live preview updates the animation in real-time.
 */
export default function JackieCustomizer({ open, onClose }) {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [theme, setTheme] = useState(() => loadTheme());
  const [custom, setCustom] = useState(() => loadCustomTheme() || {});
  const [paintMode, setPaintMode] = useState(false);
  const [elementColors, setElementColors] = useState(custom.elementColors || {});
  const [bgPattern, setBgPattern] = useState(custom.backgroundPattern || null);
  const [localBrightness, setLocalBrightness] = useState(custom.brightness ?? 1);
  const [localGlow, setLocalGlow] = useState(custom.glowIntensity ?? 1);
  const [localSpeed, setLocalSpeed] = useState(custom.rotationSpeed ?? 1);
  const [triangleColor, setTriangleColor] = useState(elementColors.triangle || custom.triangleColor || JACKIE_THEMES[theme].triangleColor);
  const [backgroundColor, setBackgroundColor] = useState(elementColors.background || custom.backgroundColor || JACKIE_THEMES[theme].backgroundColor);
  const [error, setError] = useState(null);

  // Sync theme changes
  useEffect(() => {
    const baseTheme = JACKIE_THEMES[theme] || JACKIE_THEMES.dark;
    setTriangleColor(baseTheme.triangleColor);
    setBackgroundColor(baseTheme.backgroundColor);
    setLocalBrightness(baseTheme.brightness);
    setLocalGlow(baseTheme.glowIntensity);
    setLocalSpeed(baseTheme.rotationSpeed);
    saveTheme(theme);
  }, [theme]);

  // Persist custom changes
  const updateCustom = (updates) => {
    const newCustom = { ...custom, ...updates, elementColors, backgroundPattern: bgPattern };
    setCustom(newCustom);
    saveCustomTheme(newCustom);
  };

  // Handle paint bucket coloring
  const handleColorElement = (element, color) => {
    const newColors = { ...elementColors, [element]: color };
    setElementColors(newColors);

    // Update preview colors
    if (element === 'triangle') setTriangleColor(color);
    if (element === 'background') setBackgroundColor(color);

    // Persist
    const newCustom = { ...custom, elementColors: newColors };
    setCustom(newCustom);
    saveCustomTheme(newCustom);
  };

  // Reset element colors to theme
  const resetElementColors = () => {
    setElementColors({});
    const baseTheme = JACKIE_THEMES[theme] || JACKIE_THEMES.dark;
    setTriangleColor(baseTheme.triangleColor);
    setBackgroundColor(baseTheme.backgroundColor);

    const newCustom = { ...custom, elementColors: {} };
    setCustom(newCustom);
    saveCustomTheme(newCustom);
  };

  const handleBrightnessChange = (e) => {
    const val = parseFloat(e.target.value);
    setLocalBrightness(val);
    updateCustom({ brightness: val });
  };

  const handleGlowChange = (e) => {
    const val = parseFloat(e.target.value);
    setLocalGlow(val);
    updateCustom({ glowIntensity: val });
  };

  const handleSpeedChange = (e) => {
    const val = parseFloat(e.target.value);
    setLocalSpeed(val);
    updateCustom({ rotationSpeed: val });
  };

  const handleTriangleColorChange = (e) => {
    setTriangleColor(e.target.value);
    updateCustom({ triangleColor: e.target.value });
  };

  const handleBackgroundColorChange = (e) => {
    setBackgroundColor(e.target.value);
    updateCustom({ backgroundColor: e.target.value });
  };

  const handleReset = () => {
    const baseTheme = JACKIE_THEMES[theme];
    setLocalBrightness(baseTheme.brightness);
    setLocalGlow(baseTheme.glowIntensity);
    setLocalSpeed(baseTheme.rotationSpeed);
    setTriangleColor(baseTheme.triangleColor);
    setBackgroundColor(baseTheme.backgroundColor);
    setCustom({});
    saveCustomTheme({});
    setError(null);
  };

  const handleExport = () => {
    try {
      const json = exportTheme(theme, custom);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jackie-theme-${theme}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setError(null);
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonString = event.target?.result;
        if (typeof jsonString !== 'string') throw new Error('Invalid file content');

        const result = importTheme(jsonString);
        if (!result.success) {
          setError(result.error || 'Import failed');
          return;
        }

        setCustom(result.data);
        setLocalBrightness(result.data.brightness ?? 1);
        setLocalGlow(result.data.glowIntensity ?? 1);
        setLocalSpeed(result.data.rotationSpeed ?? 1);
        setElementColors(result.data.elementColors || {});
        setBgPattern(result.data.backgroundPattern || null);
        if (result.data.elementColors?.triangle) setTriangleColor(result.data.elementColors.triangle);
        if (result.data.elementColors?.background) setBackgroundColor(result.data.elementColors.background);

        saveCustomTheme(result.data);
        setError(null);
      } catch (err) {
        setError(`Import failed: ${err.message}`);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center sm:items-center px-4">
      <div className="w-full max-w-2xl bg-card border border-border rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <p className="font-semibold text-sm">Customize Jackie</p>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Live Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Preview</p>
              <button
                onClick={() => setPaintMode(!paintMode)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                  paintMode
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                <Pipette className="w-3.5 h-3.5" /> Paint
              </button>
            </div>
            <div className="flex justify-center relative">
              <JackieOrbit
                ref={canvasRef}
                brightness={localBrightness}
                glowIntensity={localGlow}
                rotationSpeed={localSpeed}
                triangleColor={triangleColor}
                backgroundColor={backgroundColor}
                backgroundPattern={bgPattern}
              />
              <PaintBucketTool
                canvasRef={canvasRef}
                isActive={paintMode}
                onColorElement={handleColorElement}
                onReset={resetElementColors}
              />
            </div>
          </div>

          {/* Theme Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Theme</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(JACKIE_THEMES).map(([key, themeData]) => (
                <button
                  key={key}
                  onClick={() => setTheme(key)}
                  className={`p-2 rounded-lg border text-sm font-medium transition-all ${
                    theme === key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:border-primary/40'
                  }`}
                >
                  {themeData.name}
                </button>
              ))}
            </div>
          </div>

          {/* Background Pattern Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Background</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setBgPattern(null); updateCustom({}); }}
                className={`p-2 rounded-lg border text-sm font-medium transition-all ${
                  !bgPattern
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-foreground hover:border-primary/40'
                }`}
              >
                Solid
              </button>
              {getBackgroundNames().map((bgName) => {
                const bgData = ANIMATED_BACKGROUNDS[bgName];
                return (
                  <button
                    key={bgName}
                    onClick={() => { setBgPattern(bgName); updateCustom({}); }}
                    className={`p-2 rounded-lg border text-sm font-medium transition-all ${
                      bgPattern === bgName
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-foreground hover:border-primary/40'
                    }`}
                  >
                    {bgData.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brightness */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Brightness</label>
              <span className="text-xs text-muted-foreground">{(localBrightness * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={localBrightness}
              onChange={handleBrightnessChange}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Glow */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Glow Intensity</label>
              <span className="text-xs text-muted-foreground">{(localGlow * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1.5"
              step="0.05"
              value={localGlow}
              onChange={handleGlowChange}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Speed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Rotation Speed</label>
              <span className="text-xs text-muted-foreground">{(localSpeed * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={localSpeed}
              onChange={handleSpeedChange}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Triangle Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={triangleColor}
                  onChange={handleTriangleColorChange}
                  className="w-10 h-10 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={triangleColor}
                  onChange={(e) => handleTriangleColorChange({ target: { value: e.target.value } })}
                  className="flex-1 px-2 py-1 text-xs bg-secondary border border-border rounded-lg text-foreground"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Background</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={handleBackgroundColorChange}
                  className="w-10 h-10 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => handleBackgroundColorChange({ target: { value: e.target.value } })}
                  className="flex-1 px-2 py-1 text-xs bg-secondary border border-border rounded-lg text-foreground"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border flex-shrink-0 bg-secondary/30">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button
            onClick={handleImport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/60 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Import theme file"
          />
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
