import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Detect suspicious activity on connected wallets
 * Triggered by scheduled automation or after holdings update
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { walletId, userEmail } = body;

    if (!walletId || !userEmail) {
      return Response.json({ error: 'Missing walletId or userEmail' }, { status: 400 });
    }

    const wallet = await base44.asServiceRole.entities.ConnectedWallet.filter(
      { id: walletId },
      null,
      1
    );

    if (!wallet || wallet.length === 0) {
      return Response.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const w = wallet[0];

    // Get current holdings
    const holdings = await base44.asServiceRole.entities.WalletHolding.filter(
      { wallet_id: walletId },
      '-value_usd',
      100
    );

    const alerts = [];

    // Check 1: Unusual balance changes
    if (w.last_synced) {
      const lastSync = new Date(w.last_synced);
      const now = new Date();
      const hoursSinceSync = (now - lastSync) / (1000 * 60 * 60);

      // If holdings changed significantly in short time
      const currentTotal = holdings.reduce((sum, h) => sum + (h.value_usd || 0), 0);
      const previousTotal = w.total_value_usd || 0;
      const changePercent = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

      if (Math.abs(changePercent) > 50 && hoursSinceSync < 1) {
        alerts.push({
          alert_type: 'unusual_balance_change',
          severity: changePercent < -30 ? 'high' : 'medium',
          title: `Large balance change detected (${changePercent.toFixed(1)}%)`,
          description: `Your wallet balance changed by ${Math.abs(changePercent).toFixed(1)}% in less than an hour.`,
          metadata: {
            change_percent: changePercent,
            previous_value: previousTotal,
            current_value: currentTotal,
            hours_elapsed: hoursSinceSync,
          },
        });
      }
    }

    // Check 2: Token diversity changes
    const topTokens = holdings.slice(0, 5).map((h) => h.token_symbol);
    if (topTokens.length > 0 && !topTokens.includes('ETH') && !topTokens.includes('USDC')) {
      // Suspicious if no stable assets
      alerts.push({
        alert_type: 'unexpected_transaction',
        severity: 'low',
        title: 'Unusual token composition',
        description: 'Your wallet contains mostly volatile tokens with no stablecoins.',
        metadata: { top_tokens: topTokens },
      });
    }

    // Check 3: Multiple chains detected
    const chains = [...new Set(holdings.map((h) => h.chain_id))];
    if (chains.length > 3) {
      alerts.push({
        alert_type: 'new_chain_detected',
        severity: 'low',
        title: `Wallet active on ${chains.length} different chains`,
        description: 'Your connected wallet has holdings across multiple blockchain networks.',
        metadata: { chains },
      });
    }

    // Create security alerts
    for (const alert of alerts) {
      await base44.asServiceRole.entities.SecurityAlert.create({
        user_email: userEmail,
        wallet_id: walletId,
        wallet_address: w.wallet_address,
        ...alert,
      });
    }

    return Response.json({
      success: true,
      alerts_created: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error('Suspicious activity detection error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});