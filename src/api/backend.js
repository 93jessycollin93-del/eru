/**
 * backend — the app's single client for data, sign-in, server functions and
 * AI/file helpers. Every page and lib module goes through this file.
 *
 * No backend service is connected. Nothing leaves the device from here:
 * - reads (`list`, `filter`) return no records,
 * - live subscriptions never fire,
 * - anything that would store, send, sign in or call a server function
 *   fails with a BackendNotConnectedError.
 *
 * To connect a real backend later, replace the internals of this file; the
 * call sites (`backend.entities.X.list()`, `backend.functions.invoke()`, …)
 * do not need to change.
 */

export class BackendNotConnectedError extends Error {
  constructor(what, status = 503) {
    super(`No backend is connected (${what}).`);
    this.name = 'BackendNotConnectedError';
    this.status = status;
  }
}

const reject = (what, status) => Promise.reject(new BackendNotConnectedError(what, status));

// Any property read returns a function that rejects, so unknown methods fail
// cleanly instead of crashing with "is not a function". `then` stays undefined
// so these objects are never mistaken for promises.
function failingNamespace(label) {
  return new Proxy({}, {
    get(_target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      return () => reject(`${label}.${prop}`);
    },
  });
}

function entityClient(name) {
  return new Proxy({}, {
    get(_target, method) {
      if (typeof method !== 'string' || method === 'then') return undefined;
      if (method === 'list' || method === 'filter') return () => Promise.resolve([]);
      if (method === 'subscribe') return () => () => {};
      return () => reject(`${name}.${method}`);
    },
  });
}

const entities = new Proxy({}, {
  get(_target, name) {
    if (typeof name !== 'string' || name === 'then') return undefined;
    return entityClient(name);
  },
});

const auth = new Proxy({
  me: () => reject('auth.me', 401),
  isAuthenticated: () => Promise.resolve(false),
  setToken: () => {},
  logout: (redirectUrl) => {
    if (typeof window !== 'undefined' && redirectUrl) window.location.assign(redirectUrl);
  },
  redirectToLogin: () => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  },
}, {
  get(target, prop) {
    if (prop in target) return target[prop];
    if (typeof prop !== 'string' || prop === 'then') return undefined;
    return () => reject(`auth.${prop}`);
  },
});

export const backend = {
  entities,
  auth,
  functions: {
    invoke: (name) => reject(`function ${name}`),
  },
  integrations: new Proxy({}, {
    get(_target, group) {
      if (typeof group !== 'string' || group === 'then') return undefined;
      return failingNamespace(`integrations.${group}`);
    },
  }),
  connectors: failingNamespace('connectors'),
};
