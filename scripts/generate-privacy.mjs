// Builds public/privacidade.html (the URL required by the stores) from the same source as the
// in-app screen, plus the account deletion page Google Play asks for:  npm run legal
import { readFileSync, writeFileSync } from 'node:fs';

const policies = [
  {
    file: 'privacidade.html',
    deletionFile: 'excluir-conta.html',
    source: 'privacy.pt.json',
    lang: 'pt-BR',
    updated: 'Atualizada em',
    fullPolicy: 'Política de privacidade completa',
  },
  {
    file: 'privacy.html',
    deletionFile: 'delete-account.html',
    source: 'privacy.en.json',
    lang: 'en',
    updated: 'Last updated',
    fullPolicy: 'Full privacy policy',
  },
];
const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const renderSection = (s) =>
  `<h2${s.id ? ` id="${s.id}"` : ''}>${escape(s.title)}</h2>\n${s.paragraphs
    .map((p) => `<p>${escape(p)}</p>`)
    .join('\n')}`;

const page = ({ lang, title, body }) => `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} — Habits</title>
<style>
  :root { color-scheme: light dark; --bg: #f5f5f7; --fg: #17171c; --muted: #5c5c66; --card: #fff; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0e0e11; --fg: #f2f2f5; --muted: #a3a3ad; --card: #1a1a1f; } }
  body { margin: 0; background: var(--bg); color: var(--fg);
    font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
  article { background: var(--card); border-radius: 16px; padding: 24px; }
  h1 { font-size: 28px; margin: 0 0 4px; } h2 { font-size: 19px; margin: 28px 0 8px; }
  a { color: inherit; }
  .muted { color: var(--muted); margin: 0 0 8px; }
</style>
</head>
<body>
<main><article>
${body}
</article></main>
</body>
</html>
`;

const write = (file, html) => {
  writeFileSync(new URL(`../public/${file}`, import.meta.url), html);
  console.log(`public/${file} written`);
};

for (const { file, deletionFile, source, lang, updated, fullPolicy } of policies) {
  const policy = JSON.parse(
    readFileSync(new URL(`../src/features/legal/${source}`, import.meta.url), 'utf8'),
  );
  const date = `<p class="muted">${updated} ${escape(policy.updatedAt)}</p>`;
  write(
    file,
    page({
      lang,
      title: policy.title,
      body: `<h1>${escape(policy.title)}</h1>\n${date}\n${policy.sections.map(renderSection).join('\n')}`,
    }),
  );

  const deletion = policy.sections.find((s) => s.id);
  write(
    deletionFile,
    page({
      lang,
      title: deletion.title,
      body: `<h1>Habits — ${escape(deletion.title)}</h1>\n${date}\n${deletion.paragraphs
        .map((p) => `<p>${escape(p)}</p>`)
        .join('\n')}\n<p><a href="${file}#${deletion.id}">${fullPolicy}</a></p>`,
    }),
  );
}
