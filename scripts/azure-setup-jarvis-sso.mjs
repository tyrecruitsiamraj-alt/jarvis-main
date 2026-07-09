#!/usr/bin/env node
/**
 * ตั้งค่า Azure AD สำหรับ Jarvis SSO (ต้อง login เป็น Entra admin ครั้งเดียว)
 * รัน: node scripts/azure-setup-jarvis-sso.mjs
 */
import { DeviceCodeCredential } from '@azure/identity';

const TENANT_ID = process.env.AZURE_AD_TENANT_ID || '9e055566-b6f4-44ee-9e2d-bde98513834c';
const APP_ID = process.env.AZURE_AD_CLIENT_ID || '372834ab-d3c0-4ef6-9c3d-9cb08fa07535';
const PUBLIC_URL = (process.env.APP_PUBLIC_URL || 'https://jarvis.siamrajathanee.dev').replace(/\/$/, '');

const REDIRECT_URIS = [
  `${PUBLIC_URL}/api/auth/azure-ad/callback`,
  `${PUBLIC_URL}/api/auth/callback/azure-ad`,
];

const SCOPES = [
  'https://graph.microsoft.com/Application.ReadWrite.All',
  'https://graph.microsoft.com/AppRoleAssignment.ReadWrite.All',
];

/** Microsoft Azure PowerShell — public client สำหรับ device code */
const DEVICE_CLIENT_ID = '14d82eec-204b-4c3b-b371-5b73342e9a4b';

async function graph(token, path, init = {}) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`Graph ${path} ${res.status}: ${text}`);
  }
  return data;
}

console.log('Jarvis Azure SSO setup');
console.log('Redirect URIs to ensure:', REDIRECT_URIS.join(', '));
console.log('');

const credential = new DeviceCodeCredential({
  tenantId: TENANT_ID,
  clientId: DEVICE_CLIENT_ID,
  userPromptCallback: (info) => {
    console.log(info.message);
  },
});

const tokenResponse = await credential.getToken(SCOPES);
const token = tokenResponse.token;

const apps = await graph(
  token,
  `/applications?$filter=appId eq '${APP_ID}'&$select=id,appId,displayName,web`,
);
const app = apps.value?.[0];
if (!app) {
  console.error(`App registration not found for appId ${APP_ID}`);
  process.exit(1);
}

const existing = new Set(app.web?.redirectUris || []);
for (const uri of REDIRECT_URIS) existing.add(uri);
const redirectUris = [...existing];

await graph(token, `/applications/${app.id}`, {
  method: 'PATCH',
  body: JSON.stringify({
    web: {
      ...app.web,
      redirectUris,
      implicitGrantSettings: {
        enableIdTokenIssuance: false,
        enableAccessTokenIssuance: false,
      },
    },
  }),
});
console.log('Updated application redirect URIs.');

const sps = await graph(
  token,
  `/servicePrincipals?$filter=appId eq '${APP_ID}'&$select=id,appRoleAssignmentRequired,displayName`,
);
const sp = sps.value?.[0];
if (sp) {
  if (sp.appRoleAssignmentRequired) {
    await graph(token, `/servicePrincipals/${sp.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ appRoleAssignmentRequired: false }),
    });
    console.log('Disabled "user assignment required" on enterprise app.');
  } else {
    console.log('Enterprise app already allows all tenant users.');
  }
} else {
  console.log('Service principal not found — may appear after first login.');
}

console.log('');
console.log('Done. Test: https://jarvis.siamrajathanee.dev/login');
