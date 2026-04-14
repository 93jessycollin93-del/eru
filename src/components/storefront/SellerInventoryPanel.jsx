export default function SellerInventoryPanel({ listings = [] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Inventory adjustment</p>
        <p className="text-[11px] text-muted-foreground">Quick view of listing health, stock state, and exposure.</p>
      </div>
      {listings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">No inventory listings found.</div>
      ) : (
        <div className="space-y-2">
          {listings.map((listing) => (
            <div key={listing.id} className="rounded-xl border border-border bg-secondary/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{listing.title}</p>
                  <p className="text-[11px] text-muted-foreground">{listing.asset_type} · {listing.sale_mode?.replaceAll('_', ' ')}</p>
                </div>
                <span className="rounded-full bg-secondary px-2 py-1 text-[10px] capitalize text-muted-foreground">{listing.status}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span>{listing.base_price} {listing.currency}</span>
                <span>{listing.view_count || 0} views</span>
                <span>{(listing.external_syndications || []).length} channels</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}