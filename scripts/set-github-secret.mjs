#!/usr/bin/env node
/**
 * Set a GitHub Actions repository secret (encrypted).
 * Usage: GITHUB_TOKEN=... node scripts/set-github-secret.mjs NAME "value"
 */
import { Buffer } from 'node:buffer';
import sodium from 'tweetsodium';

const [name, value] = process.argv.slice(2);
const token = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER || 'tyrecruitsiamraj-alt';
const repo = process.env.GITHUB_REPO || 'jarvis-main';

if (!token || !name || value === undefined) {
  console.error('Usage: GITHUB_TOKEN=... node scripts/set-github-secret.mjs NAME "value"');
  process.exit(1);
}

function encryptSecret(publicKey, secretValue) {
  const keyBytes = Buffer.from(publicKey, 'base64');
  const messageBytes = Buffer.from(secretValue, 'utf8');
  const encryptedBytes = sodium.seal(messageBytes, keyBytes);
  return Buffer.from(encryptedBytes).toString('base64');
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

const keyRes = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`,
  { headers },
);
if (!keyRes.ok) {
  console.error(`public-key failed: ${keyRes.status} ${await keyRes.text()}`);
  process.exit(1);
}
const { key, key_id } = await keyRes.json();

const putRes = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${encodeURIComponent(name)}`,
  {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      encrypted_value: encryptSecret(key, value),
      key_id,
    }),
  },
);

if (!putRes.ok) {
  console.error(`set secret failed: ${putRes.status} ${await putRes.text()}`);
  process.exit(1);
}

console.log(`ok ${name}`);
