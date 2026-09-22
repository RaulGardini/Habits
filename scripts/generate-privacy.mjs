// Builds public/privacidade.html (the URL required by the stores) from the same source as the
// in-app screen:  npm run legal
import { readFileSync, writeFileSync } from 'node:fs';

const policy = JSON.parse(
  readFileSync(new URL('../src/features/legal/privacy.json', import.meta.url), 'utf8'),
);
const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(policy.title)} — Habits</title>
<style>
  :root { color-scheme: light dark; --bg: #f5f5f7; --fg: #17171c; --muted: #5c5c66; --card: #fff; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0e0e11; --fg: #f2f2f5; --muted: #a3a3ad; --card: #1a1a1f; } }
  body { margin: 0; background: var(--bg); color: var(--fg);
    font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
  article { background: var(--card); border-radius: 16px; padding: 24px; }
  h1 { font-size: 28px; margin: 0 0 4px; } h2 { font-size: 19px; margin: 28px 0 8px; }
  .muted { color: var(--muted); margin: 0 0 8px; }
</style>
</head>
<body>
<main><article>
<h1>${escape(policy.title)}</h1>
<p class="muted">Atualizada em ${escape(policy.updatedAt)}</p>
${policy.sections
  .map(
    (s) => `<h2>${escape(s.title)}</h2>\n${s.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('\n')}`,
  )
  .join('\n')}
</article></main>
</body>
</html>
`;
writeFileSync(new URL('../public/privacidade.html', import.meta.url), html);
console.log('public/privacidade.html written');
