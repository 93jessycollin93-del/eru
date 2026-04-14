import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, ShoppingCart } from 'lucide-react';

export default function TradeNegotiationChatRoom({ chat, currentUserEmail }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);

  const handleSend = async () => {
    if (!draft.trim()) return;
    setSending(true);
    const nextMessages = [
      ...(chat.messages || []),
      {
        id: `m-${Date.now()}`,
        author: currentUserEmail === chat.seller_email ? 'Seller' : 'Buyer',
        author_email: currentUserEmail,
        text: draft.trim(),
        created_at: new Date().toISOString(),
      },
    ];
    await base44.entities.TradeNegotiationChat.update(chat.id, {
      messages: nextMessages,
      last_message: draft.trim(),
    });
    setDraft('');
    setSending(false);
  };

  const handleMoveToOrder = async () => {
    setCreatingOrder(true);
    const order = await base44.entities.Order.create({
      order_number: `NEG-${Date.now()}`,
      buyer_email: chat.buyer_email,
      asset_type: chat.asset_type === 'listing' ? 'item' : chat.asset_type,
      asset_id: chat.asset_id,
      quantity: 1,
      base_price: 0,
      currency: 'GOLD',
      status: 'pending',
      payment_method: 'wallet',
      metadata: {
        negotiation_chat_id: chat.id,
        negotiation_post_id: chat.post_id,
      },
    });
    await base44.entities.TradeNegotiationChat.update(chat.id, {
      status: 'moved_to_order',
      linked_order_id: order.id,
    });
    setCreatingOrder(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Negotiation: {chat.post_title}</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">Seller: {chat.seller_email} · Buyer: {chat.buyer_email}</p>
        </div>
        <button onClick={handleMoveToOrder} disabled={creatingOrder || chat.status === 'moved_to_order'} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          <ShoppingCart className="h-3.5 w-3.5" /> {chat.status === 'moved_to_order' ? 'Order created' : creatingOrder ? 'Creating...' : 'Move to order'}
        </button>
      </div>

      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {(chat.messages || []).map((message) => (
          <div key={message.id} className={`rounded-2xl px-4 py-3 ${message.author_email === currentUserEmail ? 'bg-primary text-primary-foreground ml-8' : 'bg-secondary/50 text-foreground mr-8'}`}>
            <p className={`text-[11px] mb-1 ${message.author_email === currentUserEmail ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{message.author}</p>
            <p className="text-sm leading-relaxed">{message.text}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Send private negotiation message..." className="flex-1 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none" />
        <button onClick={handleSend} disabled={sending} className="rounded-xl bg-primary p-2.5 text-primary-foreground disabled:opacity-50"><Send className="w-4 h-4" /></button>
      </div>
    </div>
  );
}