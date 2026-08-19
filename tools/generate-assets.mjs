// 用法: node tools/generate-assets.mjs [--input <参考图.png>]... <相对于 assets/ 的输出路径.png> <prompt...>
// 环境变量: OPENAI_API_KEY (必填), OPENAI_BASE_URL (可选，默认官方)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, isAbsolute, join } from 'node:path';
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

const args = process.argv.slice(2);
const inputPaths = [];
while (args[0] === '--input') {
  args.shift();
  const inputPath = args.shift();
  if (!inputPath) {
    console.error('--input 后缺少参考图路径');
    process.exit(1);
  }
  inputPaths.push(isAbsolute(inputPath) ? inputPath : join(root, inputPath));
}

const [outName, ...promptParts] = args;
const prompt = promptParts.join(' ');
if (!outName || !prompt) {
  console.error('用法: node tools/generate-assets.mjs [--input <参考图.png>]... <相对于 assets/ 的输出路径.png> <prompt...>');
  process.exit(1);
}

const outPath = join(root, 'assets', outName);
const model = process.env.IMAGE_MODEL || 'gpt-image-2';
const size = process.env.IMAGE_SIZE || '1024x1024';
const quality = process.env.IMAGE_QUALITY || 'medium';
mkdirSync(dirname(outPath), { recursive: true });

console.log(`生成中 → ${outPath}`);
console.log(`模型: ${model} | 尺寸: ${size} | 模式: ${inputPaths.length ? `参考图编辑 (${inputPaths.length} 张)` : '文字生成'}`);

let url = `${baseUrl}/v1/images/generations`;
let headers;
let body;
if (inputPaths.length) {
  url = `${baseUrl}/v1/images/edits`;
  headers = { Authorization: `Bearer ${apiKey}` };
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('quality', quality);
  form.append('n', '1');
  for (const inputPath of inputPaths) {
    form.append('image', new Blob([readFileSync(inputPath)], { type: 'image/png' }), basename(inputPath));
  }
  body = form;
} else {
  headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
  body = JSON.stringify({ model, prompt, size, quality, n: 1 });
}

const res = await fetch(url, { method: 'POST', headers, body });

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
