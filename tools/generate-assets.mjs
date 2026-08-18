// 用法: node tools/generate-assets.mjs <输出文件名.png> <prompt...>
// 环境变量: OPENAI_API_KEY (必填), OPENAI_BASE_URL (可选，默认官方)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// 手动解析 .env，避免额外依赖
try {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* .env 不存在时依赖外部环境变量 */ }

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error('缺少 OPENAI_API_KEY'); process.exit(1); }
const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '');

const [outName, ...promptParts] = process.argv.slice(2);
const prompt = promptParts.join(' ');
if (!outName || !prompt) {
  console.error('用法: node tools/generate-assets.mjs <输出文件名.png> <prompt...>');
  process.exit(1);
}

const outPath = join(root, 'assets', outName);
mkdirSync(dirname(outPath), { recursive: true });

console.log(`生成中 → ${outPath}`);
const res = await fetch(`${baseUrl}/v1/images/generations`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    model: process.env.IMAGE_MODEL || 'gpt-image-2',
    prompt,
    size: process.env.IMAGE_SIZE || '1024x1024',
    quality: process.env.IMAGE_QUALITY || 'medium',
    n: 1,
  }),
});

if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const data = await res.json();
const b64 = data.data?.[0]?.b64_json;
if (!b64) { console.error('响应中没有 b64_json:', JSON.stringify(data).slice(0, 500)); process.exit(1); }
writeFileSync(outPath, Buffer.from(b64, 'base64'));
console.log(`完成: ${outPath}`);
