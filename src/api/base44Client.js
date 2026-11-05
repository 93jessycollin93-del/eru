import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { withOfflineGate } from '@/lib/onlineFeatures';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
// Outside services (cloud AI, email, linked accounts) stay off unless the owner
// turns them on in the ONLINE_FEATURES secret. See src/lib/onlineFeatures.js.
export const base44 = withOfflineGate(createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
}));
