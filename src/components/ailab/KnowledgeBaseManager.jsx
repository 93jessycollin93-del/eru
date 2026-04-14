import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { BookOpen, Upload, FileText, HelpCircle, Search, Trash2, Link2, Sparkles } from 'lucide-react';

const EMPTY_TEXT_FORM = { title: '', content: '', keywords: '', linked_bot_ids: [] };
const EMPTY_FAQ_FORM = { title: '', keywords: '', linked_bot_ids: [], items: [{ question: '', answer: '' }] };

const SOURCE_LABELS = {
  document: 'Document',
  faq: 'FAQ',
  text: 'Text',
};

function normalizeKeywords(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function buildSearchCorpus(document) {
  const faqText = (document.faq_items || []).map((item) => `${item.question} ${item.answer}`).join(' ');
  return [document.title, document.content, faqText, ...(document.keywords || [])].filter(Boolean).join(' ').toLowerCase();
}

export default function KnowledgeBaseManager({ bots = [] }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [textForm, setTextForm] = useState(EMPTY_TEXT_FORM);
  const [faqForm, setFaqForm] = useState(EMPTY_FAQ_FORM);
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState([]);
  const [semanticLoading, setSemanticLoading] = useState(false);

  const loadDocuments = async () => {
    setLoading(true);
    const rows = await base44.entities.KnowledgeBaseDocument.list('-updated_date', 200);
    setDocuments(rows || []);
    setLoading(false);
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const botNameMap = useMemo(() => Object.fromEntries(bots.map((bot) => [bot.id, bot.name])), [bots]);

  const toggleBot = (current, botId) => {
    return current.includes(botId) ? current.filter((id) => id !== botId) : [...current, botId];
  };

  const saveTextEntry = async () => {
    if (!textForm.title.trim() || !textForm.content.trim()) return;
    await base44.entities.KnowledgeBaseDocument.create({
      title: textForm.title,
      source_type: 'text',
      content: textForm.content,
      keywords: normalizeKeywords(textForm.keywords),
      linked_bot_ids: textForm.linked_bot_ids,
      status: 'active',
    });
    setTextForm(EMPTY_TEXT_FORM);
    loadDocuments();
  };

  const addFaqItem = () => {
    setFaqForm((prev) => ({ ...prev, items: [...prev.items, { question: '', answer: '' }] }));
  };

  const updateFaqItem = (index, patch) => {
    setFaqForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  };

  const saveFaqEntry = async () => {
    const cleanItems = faqForm.items.filter((item) => item.question.trim() && item.answer.trim());
    if (!faqForm.title.trim() || cleanItems.length === 0) return;
    await base44.entities.KnowledgeBaseDocument.create({
      title: faqForm.title,
      source_type: 'faq',
      faq_items: cleanItems,
      keywords: normalizeKeywords(faqForm.keywords),
      linked_bot_ids: faqForm.linked_bot_ids,
      status: 'active',
    });
    setFaqForm(EMPTY_FAQ_FORM);
    loadDocuments();
  };

  const handleDocumentUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.KnowledgeBaseDocument.create({
      title: file.name.replace(/\.[^.]+$/, ''),
      source_type: 'document',
      file_name: file.name,
      file_url,
      mime_type: file.type || 'application/octet-stream',
      keywords: [],
      linked_bot_ids: [],
      status: 'active',
    });
    setUploading(false);
    event.target.value = '';
    loadDocuments();
  };

  const deleteDocument = async (id) => {
    await base44.entities.KnowledgeBaseDocument.delete(id);
    loadDocuments();
  };

  const runSemanticPreview = async () => {
    if (!semanticQuery.trim()) return;
    setSemanticLoading(true);
    const ranked = documents
      .map((document) => {
        const corpus = buildSearchCorpus(document);
        const queryTerms = semanticQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const score = queryTerms.reduce((total, term) => total + (corpus.includes(term) ? 1 : 0), 0);
        return { document, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const preview = await Promise.all(ranked.map(async ({ document, score }) => {
      const sourceText = document.source_type === 'faq'
        ? (document.faq_items || []).map((item) => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n')
        : (document.content || document.file_name || document.title);

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are previewing retrieval for a bot knowledge base.\n\nUser query: ${semanticQuery}\n\nKnowledge source title: ${document.title}\nKnowledge source type: ${document.source_type}\nKnowledge source body:\n${sourceText.slice(0, 6000)}\n\nReturn a short JSON-like plain text summary with:\n1. why this source matches\n2. the best snippet or answer to show\n3. confidence as low, medium, or high.`,
      });

      return {
        id: document.id,
        title: document.title,
        source_type: document.source_type,
        score,
        preview: response,
      };
    }));

    setSemanticResults(preview);
    setSemanticLoading(false);
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Knowledge base manager</p>
            <p className="text-xs text-muted-foreground">Upload docs, add FAQs, and preview how bots will retrieve from your knowledge sources.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr,1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Upload document</p>
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-6 text-sm text-primary">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Choose a file'}
              <input type="file" accept=".pdf,.txt,.md,.doc,.docx,.csv,.json" className="hidden" onChange={handleDocumentUpload} />
            </label>
            <p className="text-[11px] text-muted-foreground">Great for policies, docs, notes, and reference files.</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Raw text entry</p>
            </div>
            <input value={textForm.title} onChange={(e) => setTextForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Title" className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
            <textarea value={textForm.content} onChange={(e) => setTextForm((prev) => ({ ...prev, content: e.target.value }))} placeholder="Paste reference text, process notes, product info, or instructions..." className="min-h-[120px] w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
            <input value={textForm.keywords} onChange={(e) => setTextForm((prev) => ({ ...prev, keywords: e.target.value }))} placeholder="Keywords, comma separated" className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-foreground flex items-center gap-2"><Link2 className="w-3.5 h-3.5 text-primary" /> Link bots</p>
              <div className="flex flex-wrap gap-2">{bots.map((bot) => <button key={bot.id} onClick={() => setTextForm((prev) => ({ ...prev, linked_bot_ids: toggleBot(prev.linked_bot_ids, bot.id) }))} className={`rounded-full border px-2 py-1 text-[10px] ${textForm.linked_bot_ids.includes(bot.id) ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground'}`}>{bot.name}</button>)}</div>
            </div>
            <button onClick={saveTextEntry} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Save text source</button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">FAQ entry</p>
            </div>
            <input value={faqForm.title} onChange={(e) => setFaqForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="FAQ collection title" className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
            <input value={faqForm.keywords} onChange={(e) => setFaqForm((prev) => ({ ...prev, keywords: e.target.value }))} placeholder="Keywords, comma separated" className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
            <div className="space-y-2">
              {faqForm.items.map((item, index) => (
                <div key={index} className="rounded-xl border border-border bg-background p-3 space-y-2">
                  <input value={item.question} onChange={(e) => updateFaqItem(index, { question: e.target.value })} placeholder="Question" className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
                  <textarea value={item.answer} onChange={(e) => updateFaqItem(index, { answer: e.target.value })} placeholder="Answer" className="min-h-[80px] w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
                </div>
              ))}
              <button onClick={addFaqItem} className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">Add FAQ item</button>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-foreground flex items-center gap-2"><Link2 className="w-3.5 h-3.5 text-primary" /> Link bots</p>
              <div className="flex flex-wrap gap-2">{bots.map((bot) => <button key={bot.id} onClick={() => setFaqForm((prev) => ({ ...prev, linked_bot_ids: toggleBot(prev.linked_bot_ids, bot.id) }))} className={`rounded-full border px-2 py-1 text-[10px] ${faqForm.linked_bot_ids.includes(bot.id) ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground'}`}>{bot.name}</button>)}</div>
            </div>
            <button onClick={saveFaqEntry} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Save FAQ source</button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Semantic retrieval preview</p>
            </div>
            <div className="flex gap-2">
              <input value={semanticQuery} onChange={(e) => setSemanticQuery(e.target.value)} placeholder="Ask what a bot might ask, e.g. refund policy or onboarding steps" className="flex-1 rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none" />
              <button onClick={runSemanticPreview} disabled={!semanticQuery.trim() || semanticLoading} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40">{semanticLoading ? 'Searching...' : 'Preview'}</button>
            </div>
            {semanticResults.length > 0 && (
              <div className="space-y-2">
                {semanticResults.map((result) => (
                  <div key={result.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-foreground">{result.title}</p>
                        <p className="text-[10px] text-muted-foreground">{SOURCE_LABELS[result.source_type]} · relevance score {result.score}</p>
                      </div>
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[11px] text-muted-foreground">{result.preview}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Saved knowledge sources</p>
            {loading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Loading knowledge base...</div>
            ) : documents.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No knowledge sources yet.</div>
            ) : documents.map((document) => (
              <div key={document.id} className="rounded-xl border border-border bg-background p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{document.title}</p>
                    <p className="text-[10px] text-muted-foreground">{SOURCE_LABELS[document.source_type]}{document.file_name ? ` · ${document.file_name}` : ''}</p>
                  </div>
                  <button onClick={() => deleteDocument(document.id)} className="rounded-lg border border-destructive/20 bg-destructive/10 p-1.5 text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {document.keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1">{document.keywords.map((keyword) => <span key={keyword} className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{keyword}</span>)}</div>
                )}
                {document.linked_bot_ids?.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">Linked bots: {document.linked_bot_ids.map((id) => botNameMap[id] || 'Unknown bot').join(', ')}</p>
                )}
                {document.content && <p className="line-clamp-3 whitespace-pre-wrap text-[11px] text-muted-foreground">{document.content}</p>}
                {document.faq_items?.length > 0 && <p className="text-[11px] text-muted-foreground">{document.faq_items.length} FAQ items</p>}
                {document.file_url && <a href={document.file_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline">Open file</a>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}