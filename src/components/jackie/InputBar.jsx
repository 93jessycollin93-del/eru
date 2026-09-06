import { useRef, useState } from 'react';
import { Send, Mic, MicOff, Plus, X, Loader2, Image as ImageIcon, Video, FileCode, Zap, Cpu } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import VoiceSelector from './VoiceSelector.jsx';
import { isLocalProvider, LOCAL_PROVIDERS } from '@/lib/localModelProviders';

/**
 * InputBar — minimalist, near-invisible single-row input (Cursor/Lovable style).
 *
 * No heavy borders or backgrounds — the bar blends into the page. A subtle
 * model chip on the left opens the local-model connection layer. All prior
 * capabilities (attachments, voice, commands, drag-drop) are preserved.
 */
export default function InputBar({ input, setInput, onSend, loading, mode, onToggleCommands, showCommands, voice, setVoice, onFilesReady, modelProvider, modelName, onOpenModelConnector }) {
  const [listening, setListening] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const recognitionRef = useRef(null);
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  const placeholders = {
    chat: 'Ask Jackie anything…',
    code: 'Describe what to build or paste code…',
    visual: 'Describe a layout, flow or system…',
    builder: 'What system should we build?',
    conversion: 'Paste copy to rewrite…',
  };

  const speechSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const modelLabel = isLocalProvider(modelProvider)
    ? `${LOCAL_PROVIDERS[modelProvider]?.label || 'Local'}${modelName ? ' · ' + modelName : ''}`
    : 'Base44';

  const toggleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = 'en-US';
    r.onresult = (e) => setInput((prev) => prev + ' ' + e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.start();
    recognitionRef.current = r;
    setListening(true);
    setMenuOpen(false);
  };

  const uploadFile = async (file) => {
    const tempId = Date.now() + Math.random();
    setUploadingFiles((prev) => [...prev, { id: tempId, name: file.name }]);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploadingFiles((prev) => prev.filter((f) => f.id !== tempId));
    const attachment = { name: file.name, url: file_url, type: file.type };
    setAttachments((prev) => {
      const next = [...prev, attachment];
      onFilesReady(next);
      return next;
    });
  };

  const handleFiles = (files) => {
    Array.from(files).forEach(uploadFile);
    setMenuOpen(false);
  };

  const removeAttachment = (url) => {
    const updated = attachments.filter((a) => a.url !== url);
    setAttachments(updated);
    onFilesReady(updated);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSend = () => {
    if (uploadingFiles.length > 0) return;
    onSend(attachments);
    setAttachments([]);
    onFilesReady([]);
  };

  const busy = loading || uploadingFiles.length > 0;
  const canSend = (input?.trim() || attachments.length > 0) && !busy;

  return (
    <div
      className="jackie-input-bar fixed left-0 right-0 z-[90] transition-colors"
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
    >
      <div className="mx-auto max-w-3xl px-4 pt-2 pb-2">
        {/* Attachment / uploading chips */}
        {(attachments.length > 0 || uploadingFiles.length > 0) && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {uploadingFiles.map((f) => (
              <div key={f.id} className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2 py-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="max-w-[100px] truncate">{f.name}</span>
              </div>
            ))}
            {attachments.map((a) => (
              <div key={a.url} className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] text-primary">
                {a.type?.startsWith('video') ? <Video className="h-3 w-3" /> : a.type?.startsWith('image') ? <ImageIcon className="h-3 w-3" /> : <FileCode className="h-3 w-3" />}
                <span className="max-w-[100px] truncate">{a.name}</span>
                <button onClick={() => removeAttachment(a.url)} aria-label="Remove attachment" className="inline-control">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Minimal input row — borderless, blends into background */}
        <div className={`flex items-end gap-0.5 rounded-2xl bg-secondary/20 px-1.5 py-1.5 transition-colors ${dragOver ? 'bg-primary/10' : 'focus-within:bg-secondary/30'}`}>
          {/* Model chip — opens local model connection layer */}
          <button
            onClick={onOpenModelConnector}
            className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground flex-shrink-0 transition-colors"
          >
            <Cpu className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="max-w-[140px] truncate hidden sm:inline">{modelLabel}</span>
          </button>

          {/* Voice selector — subtle, no border */}
          <div className="flex-shrink-0">
            <VoiceSelector voice={voice} setVoice={setVoice} />
          </div>

          {/* + attachment / tools menu */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Attach or use tools"
            aria-expanded={menuOpen}
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground ${menuOpen ? 'text-primary' : ''}`}
          >
            <Plus className={`h-4 w-4 transition-transform ${menuOpen ? 'rotate-45' : ''}`} />
          </button>

          {/* Popover menu */}
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-0" onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-[calc(100%+0.5rem)] left-2 z-10 w-44 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
                <MenuItem icon={ImageIcon} label="Image" onClick={() => imageRef.current?.click()} />
                <MenuItem icon={Video} label="Video" onClick={() => videoRef.current?.click()} />
                <MenuItem icon={FileCode} label="File" onClick={() => fileRef.current?.click()} />
                {speechSupported && (
                  <MenuItem icon={listening ? MicOff : Mic} label={listening ? 'Stop voice' : 'Voice input'} onClick={toggleMic} accent={listening ? 'text-red-400' : ''} />
                )}
                <MenuItem icon={Zap} label="Commands" onClick={() => { onToggleCommands(); setMenuOpen(false); }} accent={showCommands ? 'text-primary' : ''} />
              </div>
            </>
          )}

          {/* Textarea — borderless, transparent */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={dragOver ? 'Drop files here…' : placeholders[mode]}
            rows={1}
            style={{ fontSize: '16px' }}
            className="min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-foreground outline-none placeholder:text-muted-foreground/70 max-h-32"
          />

          {/* Mic — borderless icon */}
          {speechSupported && (
            <button
              onClick={toggleMic}
              aria-label={listening ? 'Stop voice input' : 'Voice input'}
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-secondary/60 ${listening ? 'text-red-400 animate-pulse' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}

          {/* Send — subtle, only colored when active */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send"
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all ${canSend ? 'bg-primary text-primary-foreground' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={imageRef} type="file" accept="image/*" className="hidden" capture="environment" onChange={(e) => handleFiles(e.target.files)} />
      <input ref={videoRef} type="file" accept="video/*" className="hidden" capture="environment" onChange={(e) => handleFiles(e.target.files)} />
      <input ref={fileRef} type="file" accept=".js,.ts,.jsx,.tsx,.py,.json,.md,.txt,.html,.css,.zip" className="hidden" onChange={(e) => handleFiles(e.target.files)} multiple />
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, trailing, accent = '' }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-foreground hover:bg-accent ${accent}`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {trailing}
    </button>
  );
}