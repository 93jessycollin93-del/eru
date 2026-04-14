import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const mediaUrls = Array.isArray(payload.mediaUrls) ? payload.mediaUrls.filter(Boolean) : [];
    const fiatCurrency = payload.fiatCurrency || 'USD';
    const cryptoCurrency = payload.cryptoCurrency || 'TON';
    const conditionScore = Number(payload.conditionScore || 5);
    const marketTrend = payload.marketTrend || 'stable';

    const conversionRates = {
      USD: { TON: 0.19, ETH: 0.00011, BTC: 0.000015 },
      CAD: { TON: 0.14, ETH: 0.00008, BTC: 0.000011 },
      EUR: { TON: 0.21, ETH: 0.00012, BTC: 0.000016 },
    };

    const trendMultiplier = {
      bearish: 0.94,
      stable: 1,
      bullish: 1.08,
    }[marketTrend] || 1;

    const conditionMultiplier = 0.7 + (Math.min(Math.max(conditionScore, 1), 10) / 10) * 0.5;
    const anchorByType = {
      nft: 220,
      jade: 480,
      card: 140,
      bot: 320,
      item: 120,
      collectible: 160,
    };

    const baseAnchor = anchorByType[payload.assetType || 'collectible'] || 150;
    const suggestedFiat = Number((baseAnchor * conditionMultiplier * trendMultiplier).toFixed(2));
    const cryptoRate = conversionRates[fiatCurrency]?.[cryptoCurrency] || conversionRates.USD.TON;
    const suggestedCrypto = Number((suggestedFiat * cryptoRate).toFixed(4));

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a marketplace listing assistant.
Create truthful, buyer-friendly listing content and tag suggestions.
Also return pricing guidance that fits the supplied market context.
Follow these rules strictly:
- Do not invent specs, brand claims, certifications, rarity, authenticity, or condition details not provided.
- Avoid prohibited language like guaranteed profit, best ever, #1, perfect, or misleading urgency.
- Keep copy compliant for general online marketplaces.
- Emphasize clarity, buyer trust, condition transparency, and search relevance.
- If details are missing, keep wording specific but cautious.
- Generate concise, searchable tags.
- Use the provided pricing anchors as guidance, not as external facts.

Listing context:
- Asset type: ${payload.assetType || 'item'}
- Sale mode: ${payload.saleMode || 'sell'}
- Condition score: ${conditionScore} / 10
- Existing title: ${payload.existingTitle || ''}
- Existing description: ${payload.existingDescription || ''}
- Existing tags: ${payload.existingTags || ''}
- User prompt: ${payload.prompt || ''}
- Requested fiat currency: ${fiatCurrency}
- Requested crypto currency: ${cryptoCurrency}
- Market trend: ${marketTrend}
- Suggested pricing anchor in ${fiatCurrency}: ${suggestedFiat}
- Suggested pricing anchor in ${cryptoCurrency}: ${suggestedCrypto}

If media is attached, use it only to describe clearly visible details. Do not guess hidden facts.`,
      file_urls: mediaUrls.length ? mediaUrls : undefined,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          suggested_fiat_price: { type: 'number' },
          suggested_crypto_value: { type: 'number' },
          pricing_notes: { type: 'string' },
          compliance_notes: { type: 'string' }
        },
        required: ['title', 'description', 'tags', 'suggested_fiat_price', 'suggested_crypto_value', 'pricing_notes', 'compliance_notes']
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});