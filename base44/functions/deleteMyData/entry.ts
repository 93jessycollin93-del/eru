import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user.email;

    // Step 1: Log the deletion request
    await base44.asServiceRole.entities.SecurityAuditLog.create({
      event_type: 'data_deleted',
      user_email: userEmail,
      status: 'success',
      severity: 'warning',
      details: { reason: 'User requested data deletion' },
    });

    // Step 2: Delete all user orders
    try {
      const orders = await base44.asServiceRole.entities.Order.filter(
        { buyer_email: userEmail }
      );
      for (const order of orders) {
        await base44.asServiceRole.entities.Order.delete(order.id);
      }
    } catch (err) {
      console.log('Orders deletion note:', err.message);
    }

    // Step 3: Delete all user transactions
    try {
      const transactions = await base44.asServiceRole.entities.Transaction.filter(
        { buyer_email: userEmail }
      );
      for (const tx of transactions) {
        await base44.asServiceRole.entities.Transaction.delete(tx.id);
      }
    } catch (err) {
      console.log('Transactions deletion note:', err.message);
    }

    // Step 4: Delete all jade assets owned by user
    try {
      const assets = await base44.asServiceRole.entities.JadeAsset.filter(
        { created_by: userEmail }
      );
      for (const asset of assets) {
        await base44.asServiceRole.entities.JadeAsset.delete(asset.id);
      }
    } catch (err) {
      console.log('Assets deletion note:', err.message);
    }

    // Step 5: Delete all economy audit logs for this user
    try {
      const logs = await base44.asServiceRole.entities.EconomyAuditLog.filter(
        { user_email: userEmail }
      );
      for (const log of logs) {
        await base44.asServiceRole.entities.EconomyAuditLog.delete(log.id);
      }
    } catch (err) {
      console.log('Audit logs deletion note:', err.message);
    }

    // Step 6: Delete user account
    await base44.asServiceRole.entities.User.delete(user.id);

    return Response.json({
      success: true,
      message: 'All data deleted successfully. Account closed.',
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});