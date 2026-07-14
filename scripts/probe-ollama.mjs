import '../server/bootstrap-env.ts';
import { getOllamaConfig, ollamaChat } from '../api/_lib/ollamaClient.ts';

const cfg = getOllamaConfig();
console.log('config', cfg);

async function main() {
  if (!cfg) {
    console.error('Missing OLLAMA config');
    process.exit(1);
  }
  try {
    const tagsRes = await fetch(`${cfg.baseUrl}/api/tags`, { signal: AbortSignal.timeout(15000) });
    console.log('tags status', tagsRes.status);
    const tags = await tagsRes.json();
    const models = (tags.models || []).map((m) => m.name);
    console.log('models', models.slice(0, 10));
    const hasModel = models.some((n) => n === cfg.model || n.startsWith(`${cfg.model}:`));
    console.log('model found', hasModel, 'want', cfg.model);
  } catch (e) {
    console.error('tags failed', e instanceof Error ? e.message : e);
    process.exit(2);
  }

  try {
    const out = await ollamaChat({
      messages: [{ role: 'user', content: 'ตอบ JSON {"ok":true} เท่านั้น' }],
      format: 'json',
      timeoutMs: 60_000,
    });
    console.log('chat ok', out.slice(0, 120));
  } catch (e) {
    console.error('chat failed', e instanceof Error ? e.message : e);
    process.exit(3);
  }
}

main();
