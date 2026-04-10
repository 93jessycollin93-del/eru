import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Calculate rebalance and send email summary to user
 * Triggered by scheduled automation daily
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { userEmail } = body;

    if (!userEmail) {
      return Response.json({ error: 'Missing userEmail' }, { status: 400 });
    }

    // Get user's wallets
    const wallets = await base44.asServiceRole.entities.ConnectedWallet.filter(
      { user_email: userEmail },
      '-total_value_usd',
      10
    );

    if (!wallets || wallets.length === 0) {
      return Response.json({ success: true, skipped: 'No wallets' }, { status: 200 });
    }

    const primaryWallet = wallets.find((w) => w.is_primary) || wallets[0];

    // Get holdings for primary wallet
    const holdings = await base44.asServiceRole.entities.WalletHolding.filter(
      { wallet_id: primaryWallet.id },
      '-value_usd',
      100
    );

    if (!holdings || holdings.length === 0) {
      return Response.json({ success: true, skipped: 'No holdings' }, { status: 200 });
    }

    // Default target allocation (60/20/20 = BTC/ETH/Stables)
    const targetAllocation = {
      BTC: 30,
      ETH: 40,
      USDC: 20,
      DAI: 10,
    };

    // Calculate current allocation
    const totalValue = holdings.reduce((sum, h) => sum + (h.value_usd || 0), 0);
    const currentAllocation = {};

    holdings.forEach((h) => {
      const percent = totalValue > 0 ? (h.value_usd / totalValue) * 100 : 0;
      currentAllocation[h.token_symbol] = { value: h.value_usd, percent };
    });

    // Generate recommendations
    const recommendations = [];
    const allTokens = new Set([
      ...Object.keys(currentAllocation),
      ...Object.keys(targetAllocation),
    ]);

    for (const token of allTokens) {
      const currentPercent = currentAllocation[token]?.percent || 0;
      const targetPercent = targetAllocation[token] || 0;
      const delta = targetPercent - currentPercent;

      if (Math.abs(delta) > 1) {
        const targetValue = (totalValue * targetPercent) / 100;
        const currentValue = currentAllocation[token]?.value || 0;
        const netChange = targetValue - currentValue;

        recommendations.push({
          token,
          action: delta > 0 ? 'BUY' : 'SELL',
          amount: Math.abs(netChange).toFixed(2),
          delta: Math.abs(delta).toFixed(1),
          priority: Math.abs(delta) > 10 ? 'HIGH' : 'MEDIUM',
        });
      }
    }

    // Build email body
    const recommendationsList = recommendations
      .sort((a, b) => parseFloat(b.delta) - parseFloat(a.delta))
      .map(
        (r) =>
          `• ${r.action} $${r.amount} of ${r.token} (${r.delta}% deviation) - Priority: ${r.priority}`
      )
      .join('\n');

    const emailBody = `
Daily Portfolio Rebalance Summary

Portfolio Value: $${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
Primary Wallet: ${primaryWallet.wallet_address}

Recommended Actions:
${recommendationsList || 'Your portfolio is well-balanced. No action needed.'}

Connected Wallets: ${wallets.length}
Last Updated: ${new Date().toISOString()}

Log in to review detailed recommendations and manage your portfolio.
    `;

    // Send email via Core integration
    await base44.integrations.Core.SendEmail({
      to: userEmail,
      subject: `Portfolio Rebalance Summary - ${new Date().toLocaleDateString()}`,
      body: emailBody,
      from_name: 'Portfolio Manager',
    });

    return Response.json({
      success: true,
      user_email: userEmail,
      wallet_id: primaryWallet.id,
      portfolio_value: totalValue.toFixed(2),
      recommendations: recommendations.length,
      email_sent: true,
    });
  } catch (error) {
    console.error('Email rebalance summary error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});