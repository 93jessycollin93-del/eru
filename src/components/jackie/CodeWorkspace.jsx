import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, MousePointerClick, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AIEditBar from './AIEditBar';
import CodeDiffPanel from './CodeDiffPanel';
import CodePreviewPanel from './CodePreviewPanel';
import EditorSwitcher from './EditorSwitcher';

const TEMPLATES = {
  explain: ({ code }) => `Explain what this code does in simple terms:\n\n${code}`,
  refactor: ({ code }) => `Refactor the following code for clarity and maintainability:\n\n${code}`,
  regenerate: ({ code }) => `Rewrite this code from scratch while preserving functionality:\n\n${code}`,
  insert: ({ code, instruction }) => `Modify the code according to this instruction: ${instruction}\n\n${code}`,
  preview: ({ code }) => `Describe the expected UI preview for this code:\n\n${code}`,
  styles: ({ code, instruction }) => `Modify the styles in this code according to this instruction: ${instruction}\n\n${code}`,
  layout: ({ code, instruction }) => `Change the layout in this code according to this instruction: ${instruction}\n\n${code}`,
  logic: ({ code, instruction }) => `Add logic to this code according to this instruction: ${instruction}\n\n${code}`,
};

export default function CodeWorkspace({ content = '', onInject, onSave }) {
  const [code, setCode] = useState(content);
  const [editor, setEditor] = useState('monaco');
  const [instruction, setInstruction] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [updatedCode, setUpdatedCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef(null);

  const activeCode = useMemo(() => selectedCode || code, [selectedCode, code]);

  useEffect(() => {
    setCode(content || '');
  }, [content]);

  const detectSelection = () => {
    const selection = window.getSelection?.()?.toString()?.trim() || '';
    setSelectedCode(selection);
  };

  const handleAction = async (action) => {
    const targetCode = activeCode || code;
    if (!targetCode) return;
    setBusy(true);
    const response = await base44.functions.invoke('jackieCodeEdit', {
      action,
      instruction,
      code: targetCode,
      fullCode: code,
      prompt: TEMPLATES[action]?.({ code: targetCode, instruction }) || `Modify this code: ${instruction}\n\n${targetCode}`,
    });

    if (action === 'explain' || action === 'preview') {
      setExplanation(response.data?.content || '');
    } else {
      const nextCode = response.data?.updatedCode || '';
      setUpdatedCode(nextCode);
      setCode(nextCode);
      onInject?.(nextCode);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">Code editor</p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <button onClick={detectSelection} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1">
              <MousePointerClick className="w-3 h-3" /> Detect selected code
            </button>
            <button onClick={() => onSave?.(code)} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1">
              <Save className="w-3 h-3" /> Save file
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {['monaco', 'codemirror', 'ace'].map((item) => (
            <button
              key={item}
              onClick={() => setEditor(item)}
              className={`rounded-lg border px-2 py-1 capitalize ${editor === item ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-background'}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div ref={textareaRef} onMouseUp={detectSelection} onKeyUp={detectSelection}>
          <EditorSwitcher editor={editor} code={code} onChange={setCode} />
        </div>
        {selectedCode && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-primary">
            <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> Selected code detected</span>
          </div>
        )}
      </div>

      <AIEditBar instruction={instruction} onInstructionChange={setInstruction} onAction={handleAction} busy={busy} />
      <CodePreviewPanel code={updatedCode || code} />
      <CodeDiffPanel originalCode={content} updatedCode={updatedCode} />
      {explanation && <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground whitespace-pre-wrap">{explanation}</div>}
    </div>
  );
}