// 用法: node tools/generate-assets.mjs [--input <参考图.png>]... <相对于 assets/ 的输出路径.png> <prompt...>
// 环境变量: OpenAI 兼容接口使用 OPENAI_API_KEY/OPENAI_BASE_URL；Gemini 原生图片接口使用 GEMINI_API_KEY/GEMINI_BASE_URL
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

const model = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview';
const isGeminiImageModel = true;
const supportedGeminiImageModels = new Set(['gemini-3.1-flash-image', 'gemini-3-pro-image-preview']);
if (!supportedGeminiImageModels.has(model)) {
  console.error(`不支持的图片模型: ${model}；可选模型: ${[...supportedGeminiImageModels].join(', ')}`);
  process.exit(1);
}
const apiKey = process.env.GEMINI_API_KEY;
const configuredBaseUrl = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
const baseUrl = configuredBaseUrl.replace(/\/v1$/, '');
if (!apiKey) { console.error('缺少 GEMINI_API_KEY'); process.exit(1); }

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
const size = process.env.IMAGE_SIZE || '1024x1024';
const quality = process.env.IMAGE_QUALITY || 'medium';
mkdirSync(dirname(outPath), { recursive: true });

console.log(`生成中 → ${outPath}`);
console.log(`模型: ${model} | 尺寸: ${size} | 模式: ${inputPaths.length ? `参考图编辑 (${inputPaths.length} 张)` : '文字生成'}`);

let url;
let headers;
let body;

if (isGeminiImageModel) {
  url = `${baseUrl}/v1beta/models/${model}:generateContent`;
  headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
  const parts = [{ text: prompt }];
  for (const inputPath of inputPaths) {
    parts.push({ inline_data: { mime_type: 'image/png', data: readFileSync(inputPath).toString('base64') } });
  }
  body = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE'] },
  });
  console.log(`Gemini 原生端点 → ${url}`);
} else {
  url = `${baseUrl}/v1/images/generations`;
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
}

const res = await fetch(url, { method: 'POST', headers, body });

if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const data = await res.json();
const b64 = isGeminiImageModel
  ? data.candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.inlineData?.data ?? part.inline_data?.data)
      .find(Boolean)
  : data.data?.[0]?.b64_json;
if (!b64) { console.error('响应中没有图片数据:', JSON.stringify(data).slice(0, 500)); process.exit(1); }
writeFileSync(outPath, Buffer.from(b64, 'base64'));
console.log(`完成: ${outPath}`);
