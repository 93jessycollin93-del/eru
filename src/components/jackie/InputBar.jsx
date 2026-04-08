import { useRef, useState, useEffect } from 'react';
import { Send, Zap, Mic, MicOff, ImagePlus, Video, FileCode, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import VoiceSelector from './VoiceSelector';

export default function InputBar({ input, setInput, onSend, loading, mode, onToggleCommands, showCommands, voice, setVoice, onFilesReady }) {
  const [listening, setListening] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const recognitionRef = useRef(null);
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  const placeholders = {
    chat: 'Ask Jackie anything...',
    code: 'Describe what to build or paste code...',
    visual: 'Describe a layout, flow or system...',
    builder: 'What system should we build?',
  };

  // Speech to text
  const toggleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported in this browser'); return; }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = 'en-US';
    r.onresult = (e) => { setInput(prev => prev + ' ' + e.results[0][0].transcript); };
    r.onend = () => setListening(false);
    r.start();
    recognitionRef.current = r;
    setListening(true);
  };

  const uploadFile = async (file) => {
    const tempId = Date.now() + Math.random();
    setUploadingFiles(prev => [...prev, { id: tempId, name: file.name, uploading: true }]);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploadingFiles(prev => prev.filter(f => f.id !== tempId));
    const attachment = { name: file.name, url: file_url, type: file.type };
    setAttachments(prev => [...prev, attachment]);
    onFilesReady([...attachments, attachment]);
  };

  const handleFiles = (files) => {
    Array.from(files).forEach(uploadFile);
  };

  const removeAttachment = (url) => {
    const updated = attachments.filter(a => a.url !== url);
    setAttachments(updated);
    onFilesReady(updated);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSend = () => {
    onSend(attachments);
    setAttachments([]);
  };

  return (
    <div
      className={`fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur border-t border-border z-20 transition-all ${dragOver ? 'border-primary/50 bg-primary/5' : ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
    >
      <div className="max-w-md mx-auto px-4 pt-2 pb-2">
        {/* Voice + quick cmd row */}
        <div className="flex items-center justify-between mb-2">
          <VoiceSelector voice={voice} setVoice={setVoice} />
          <button onClick={onToggleCommands}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs transition-all ${showCommands ? 'bg-primary/10 text-primary border-primary/30' : 'bg-secondary text-muted-foreground border-border'}`}>
            <Zap className="w-3 h-3" /> Commands
          </button>
        </div>

        {/* Attachments */}
        {(attachments.length > 0 || uploadingFiles.length > 0) && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {uploadingFiles.map(f => (
              <div key={f.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="max-w-[100px] truncate">{f.name}</span>
              </div>
            ))}
            {attachments.map(a => (
              <div key={a.url} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-xs text-primary">
                {a.type?.startsWith('video') ? <Video className="w-3 h-3" /> : a.type?.startsWith('image') ? <ImagePlus className="w-3 h-3" /> : <FileCode className="w-3 h-3" />}
                <span className="max-w-[100px] truncate">{a.name}</span>
                <button onClick={() => removeAttachment(a.url)}><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}

        {dragOver && (
          <div className="border-2 border-dashed border-primary/50 rounded-xl p-4 text-center text-xs text-primary mb-2">
            Drop files here
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2">
          {/* File buttons */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button onClick={() => imageRef.current?.click()} className="p-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-primary transition-colors">
              <ImagePlus className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => videoRef.current?.click()} className="p-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-primary transition-colors">
              <Video className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => fileRef.current?.click()} className="p-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-primary transition-colors">
              <FileCode className="w-3.5 h-3.5" />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={dragOver ? 'Drop files here...' : placeholders[mode]}
            rows={2}
            className="flex-1 bg-secondary border border-border rounded-2xl px-4 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground resize-none max-h-28"
          />

          <div className="flex flex-col gap-1 flex-shrink-0">
            <button onClick={toggleMic}
              className={`p-2 rounded-xl border transition-all ${listening ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse' : 'bg-secondary border-border text-muted-foreground hover:text-primary'}`}>
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button onClick={handleSend} disabled={(!input?.trim() && attachments.length === 0) || loading}
              className="bg-primary text-primary-foreground rounded-xl p-2 disabled:opacity-40 transition-opacity">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={imageRef} type="file" accept="image/*" className="hidden" capture="environment" onChange={e => handleFiles(e.target.files)} />
      <input ref={videoRef} type="file" accept="video/*" className="hidden" capture="environment" onChange={e => handleFiles(e.target.files)} />
      <input ref={fileRef} type="file" accept=".js,.ts,.jsx,.tsx,.py,.json,.md,.txt,.html,.css,.zip" className="hidden" onChange={e => handleFiles(e.target.files)} multiple />
    </div>
  );
}