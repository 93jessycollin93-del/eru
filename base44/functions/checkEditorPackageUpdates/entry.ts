import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PACKAGES = [
  { name: '@monaco-editor/react', current: '^4.6.0' },
  { name: '@uiw/react-codemirror', current: '^4.23.8' },
  { name: '@codemirror/lang-javascript', current: '^6.2.2' },
  { name: 'react-ace', current: '^12.0.0' },
  { name: 'ace-builds', current: '^1.36.0' },
];

const fetchLatestVersion = async (name) => {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name).replace('%40', '@')}/latest`);
  if (!response.ok) throw new Error(`Failed to fetch ${name}`);
  const data = await response.json();
  return data.version;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    // Reject any non-admin caller, including unauthenticated (user === null).
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-created_date', 100);
    const updates = [];

    for (const pkg of PACKAGES) {
      const latest = await fetchLatestVersion(pkg.name);
      if (latest && !pkg.current.includes(latest)) {
        updates.push({ ...pkg, latest });
      }
    }

    const message = updates.length > 0
      ? `Updates available for ${updates.map((item) => `${item.name} (${item.current} → ${item.latest})`).join(', ')}.`
      : 'No package updates needed for Monaco, CodeMirror, Ace, or related editor packages.';

    const storageRecommendation = 'For Jackie memory expansion, use cloud object storage with metadata indexing. Best fit: Supabase Storage for files plus entity records for searchable memory. Upgrade path: private file storage for code/context archives and chunked memory summaries.';

    for (const admin of admins) {
      const existing = await base44.asServiceRole.entities.AppNotification.filter({
        user_email: admin.email,
        type: 'project_status_changed',
        entity_id: 'editor-package-monitor',
      }, '-created_date', 1);

      const latestExisting = existing?.[0];
      const existingMessage = latestExisting?.message || '';
      if (existingMessage === `${message} ${storageRecommendation}`) continue;

      await base44.asServiceRole.entities.AppNotification.create({
        user_email: admin.email,
        type: 'project_status_changed',
        title: updates.length > 0 ? 'Editor package updates available' : 'Editor packages are up to date',
        message: `${message} ${storageRecommendation}`,
        entity_type: 'Project',
        entity_id: 'editor-package-monitor',
        metadata: {
          updates,
          checked_packages: PACKAGES,
          storage_recommendation: 'supabase_storage_plus_entities',
          checked_at: new Date().toISOString(),
        },
      });

      await base44.integrations.Core.SendEmail({
        to: admin.email,
        subject: updates.length > 0 ? 'Jackie editor update check: action needed' : 'Jackie editor update check: all stable',
        body: `${message}\n\n${storageRecommendation}`,
      });
    }

    return Response.json({ success: true, updates, storageRecommendation, adminsNotified: admins.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});