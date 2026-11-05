/**
 * Offline by default, in the browser too.
 *
 * The owner turns outside services on by group in the ONLINE_FEATURES secret
 * (Base44 dashboard). The server functions enforce it; this wrapper makes the
 * browser stop before a request to cloud AI, email or a linked outside account
 * even leaves the page. If the app can't confirm a group is on, it stays off.
 */

// Core endpoints that only touch the app's own file storage.
const OWN_STORAGE = new Set(['UploadFile', 'UploadPrivateFile', 'CreateFileSignedUrl']);
const CORE_GROUPS = {
  InvokeLLM: 'cloud_ai',
  GenerateImage: 'cloud_ai',
  ExtractDataFromUploadedFile: 'cloud_ai',
  SendEmail: 'email',
};

export class OfflineModeError extends Error {
  constructor(group) {
    super(`Offline mode: "${group}" is turned off. The owner can add it to the ONLINE_FEATURES secret.`);
    this.name = 'OfflineModeError';
    this.group = group;
  }
}

/** Which ONLINE_FEATURES group an integration call needs; null = never leaves the app. */
export function groupForIntegration(pkg, endpoint) {
  if (pkg !== 'Core') return 'accounts';
  if (OWN_STORAGE.has(endpoint)) return null;
  return CORE_GROUPS[endpoint] || 'all';
}

export function isGroupOn(groups, group) {
  return groups.has('all') || groups.has(group);
}

let pending = null;

/** The groups the owner turned on. Failures count as offline and are retried on the next call. */
export function loadOnlineGroups(client) {
  if (!pending) {
    pending = client.functions
      .invoke('onlineFeatures', {})
      .then((res) => new Set((res?.data?.groups || []).map((g) => String(g).toLowerCase())))
      .catch(() => {
        pending = null;
        return new Set();
      });
  }
  return pending;
}

export async function requireOnline(client, group) {
  if (!isGroupOn(await loadOnlineGroups(client), group)) throw new OfflineModeError(group);
}

function gatePackage(client, pkg, real) {
  return new Proxy({}, {
    get(_, endpoint) {
      const fn = real[endpoint];
      if (typeof endpoint !== 'string' || typeof fn !== 'function') return fn;
      const group = groupForIntegration(pkg, endpoint);
      if (!group) return fn;
      return async (...args) => {
        await requireOnline(client, group);
        return fn.apply(real, args);
      };
    },
  });
}

/** Wraps a Base44 client so outside-reaching calls check ONLINE_FEATURES first. */
export function withOfflineGate(client) {
  const integrations = client.integrations;
  client.integrations = new Proxy({}, {
    get(_, pkg) {
      const real = integrations[pkg];
      if (typeof pkg !== 'string' || !real || typeof real !== 'object') return real;
      return gatePackage(client, pkg, real);
    },
  });

  const connectAppUser = client.connectors?.connectAppUser;
  if (typeof connectAppUser === 'function') {
    client.connectors.connectAppUser = async (...args) => {
      await requireOnline(client, 'accounts');
      return connectAppUser.apply(client.connectors, args);
    };
  }
  return client;
}
