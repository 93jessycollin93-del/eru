import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function computeEffectivePrice(listing, sync) {
  const base = Number(sync?.custom_price ?? listing?.base_price ?? 0);
  const adjustmentType = sync?.price_adjustment_type || 'none';
  const adjustmentValue = Number(sync?.price_adjustment_value ?? 0);

  if (adjustmentType === 'percent') {
    return Number((base * (1 + adjustmentValue / 100)).toFixed(4));
  }

  if (adjustmentType === 'fixed') {
    return Number((base + adjustmentValue).toFixed(4));
  }

  return Number(base.toFixed(4));
}

function simulateExternalResult(connector, listing, sync) {
  const effectivePrice = computeEffectivePrice(listing, sync);
  const marketSlug = connector.external_market_slug || connector.connector_type || 'external';
  return {
    status: connector.is_enabled ? 'synced' : 'not_connected',
    external_listing_id: `${marketSlug}-${listing.id}`,
    effective_price: effectivePrice,
    last_sync_note: connector.simulation_mode
      ? `Simulated sync to ${connector.name}`
      : `Prepared sync payload for ${connector.name}`,
    error_message: connector.is_enabled ? '' : 'Connector disabled',
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const connectorId = body.connectorId || null;
    const listingId = body.listingId || null;

    const [connectors, listings] = await Promise.all([
      base44.asServiceRole.entities.MarketConnector.list('-updated_date', 100),
      base44.asServiceRole.entities.StorefrontListing.list('-updated_date', 200),
    ]);

    const eligibleConnectors = connectors.filter((connector) => {
      if (!connector.is_enabled) return false;
      if (connectorId && connector.id !== connectorId) return false;
      return true;
    });

    const eligibleListings = listings.filter((listing) => {
      if (listingId && listing.id !== listingId) return false;
      if (!listing.internal_listed) return false;
      if (!['active', 'draft', 'paused'].includes(listing.status)) return false;
      return true;
    });

    let updatedListings = 0;
    let syncedTargets = 0;

    for (const listing of eligibleListings) {
      const currentSyncs = Array.isArray(listing.external_syndications) ? listing.external_syndications : [];
      let changed = false;

      const nextSyncs = currentSyncs.map((sync) => {
        const connector = eligibleConnectors.find((item) => item.id === sync.connector_id);
        if (!connector || !sync.enabled) return sync;
        if (!(connector.supported_asset_types || []).includes(listing.asset_type)) {
          return {
            ...sync,
            sync_status: 'failed',
            error_message: 'Asset type not supported by connector',
            last_synced_at: new Date().toISOString(),
          };
        }

        changed = true;
        syncedTargets += 1;
        const result = simulateExternalResult(connector, listing, sync);
        return {
          ...sync,
          sync_status: result.status,
          external_listing_id: result.external_listing_id,
          effective_price: result.effective_price,
          last_sync_note: result.last_sync_note,
          error_message: result.error_message,
          last_synced_at: new Date().toISOString(),
        };
      });

      const autoPublishSyncs = eligibleConnectors
        .filter((connector) => connector.auto_publish && (connector.supported_asset_types || []).includes(listing.asset_type))
        .filter((connector) => !nextSyncs.find((sync) => sync.connector_id === connector.id))
        .map((connector) => {
          changed = true;
          syncedTargets += 1;
          const seeded = {
            connector_id: connector.id,
            connector_name: connector.name,
            enabled: true,
            custom_price: null,
            external_listing_id: '',
            sync_status: 'pending',
            last_synced_at: '',
            error_message: '',
            price_adjustment_type: connector.price_adjustment_type || 'none',
            price_adjustment_value: Number(connector.price_adjustment_value || 0),
            effective_price: Number(listing.base_price || 0),
            last_sync_note: 'Queued by auto-publish',
          };
          const result = simulateExternalResult(connector, listing, seeded);
          return {
            ...seeded,
            sync_status: result.status,
            external_listing_id: result.external_listing_id,
            effective_price: result.effective_price,
            last_sync_note: result.last_sync_note,
            error_message: result.error_message,
            last_synced_at: new Date().toISOString(),
          };
        });

      const finalSyncs = [...nextSyncs, ...autoPublishSyncs];

      if (changed) {
        updatedListings += 1;
        await base44.asServiceRole.entities.StorefrontListing.update(listing.id, {
          external_syndications: finalSyncs,
        });
      }
    }

    for (const connector of eligibleConnectors) {
      const connectorTouches = eligibleListings.filter((listing) =>
        (Array.isArray(listing.external_syndications) ? listing.external_syndications : []).some((sync) => sync.connector_id === connector.id)
        || (connector.auto_publish && (connector.supported_asset_types || []).includes(listing.asset_type))
      ).length;

      await base44.asServiceRole.entities.MarketConnector.update(connector.id, {
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success',
        total_listings_synced: Number(connector.total_listings_synced || 0) + connectorTouches,
        status: connector.simulation_mode ? 'active' : connector.status,
      });
    }

    return Response.json({
      success: true,
      updatedListings,
      syncedTargets,
      connectorsProcessed: eligibleConnectors.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});