# Sincronização na nuvem (Supabase — plano gratuito)

A sincronização é **opcional**. Sem configurar nada, o app funciona 100% offline e a seção
"Conta e sincronização" apenas explica que o recurso não está disponível.

## Como funciona

- Login com e-mail e senha (Supabase Auth).
- Cada tabela local tem uma cópia no Postgres do Supabase (`supabase/schema.sql`), protegida por
  **Row Level Security**: cada usuário só enxerga e altera as próprias linhas.
- O app sincroniza ao abrir, ao voltar para o primeiro plano, alguns segundos após qualquer
  alteração e pelo botão "Sincronizar agora".
- Conflitos: **vence a última alteração a chegar ao servidor** (`server_updated_at`, relógio do
  servidor). O relógio do celular não decide nada: um aparelho com a hora errada não "ganha"
  para sempre nem perde alterações. Alterações locais ainda não enviadas ficam numa fila no
  próprio banco (`sync_outbox`), sobrevivem ao app ser fechado e são enviadas na próxima rodada.
- Falhas de rede: nova tentativa com espera exponencial (2 s, 4 s, 8 s… até 5 min).
- **Depois de atualizar o app**, rode de novo o `supabase/schema.sql` no SQL Editor (o gatilho
  `lww_guard` mudou para a regra acima).
- Exclusões são sincronizadas (soft delete). "Apagar todos os dados" com conta conectada apaga
  também a nuvem. "Excluir conta" apaga a conta e todos os dados da nuvem (exigência da App Store).

## Configurar (uma vez, ~10 minutos)

1. Crie uma conta e um projeto em <https://supabase.com> (plano Free). Escolha a região
   **South America (São Paulo)** para menor latência.
2. No projeto, abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
   (Pode rodar de novo sem problema.)
3. **Authentication → Sign In / Providers → Email**: deixe habilitado.
   - "Confirm email" ligado (recomendado): o usuário confirma pelo link enviado por e-mail.
     O envio de e-mails do plano gratuito é limitado (poucos por hora) — para produção,
     configure um SMTP próprio (ex.: Resend ou Brevo têm planos gratuitos).
4. **Project Settings → API**: copie a **Project URL** e a **Publishable key**.
5. Na raiz do projeto crie `.env.local` (já está no `.gitignore`), a partir de `.env.example`:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

6. Reinicie o servidor (`npm run web` / `npm start`). A seção de conta aparece nos Ajustes.
7. Para builds na nuvem (EAS), cadastre as mesmas variáveis:

   ```bash
   npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://SEU-PROJETO.supabase.co --environment production --visibility plaintext
   npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_... --environment production --visibility plaintext
   ```

A publishable key é pública por natureza (vai dentro do app); a segurança vem do RLS.
**Nunca** coloque a `service_role`/secret key no app.

## Segurança do login (configurar no painel)

O app já faz a parte dele: sessão no Keychain/Keystore (`expo-secure-store`), fluxo **PKCE**
nos links de e-mail, bloqueio progressivo após 3 senhas erradas, 1 e-mail por minuto, senha nova
com no mínimo 8 caracteres e verificação de senhas vazadas (Have I Been Pwned, k-anonimato).
O resto é configuração do projeto:

1. **Authentication → URL Configuration → Redirect URLs** — os links de confirmação e de nova
   senha voltam para a rota `/auth/callback` do app. Adicione:
   - `habits://auth/callback**` (builds do app, esquema próprio `habits`);
   - `exp://**` (Expo Go — o endereço muda com o canal/projeto);
   - `http://localhost:8081/auth/callback**` (web em desenvolvimento);
   - `https://SEU-SITE/auth/callback**` (web publicada).

   Em **Site URL** use o endereço da web publicada. Qualquer destino fora da lista é recusado.
2. **Authentication → Sign In / Providers → Email**: "Confirm email" **ligado** (verificado:
   `mailer_autoconfirm: false`). "Minimum password length": **8**. "Password requirements":
   letras e números. ("Prevent use of leaked passwords" é só no plano Pro — por isso o app checa.)
3. **Authentication → Sessions / Refresh tokens**: "Detect and revoke potentially compromised
   refresh tokens" **ligado** (rotação: cada refresh gera um token novo e o antigo reusado
   derruba a sessão). Mantenha o "Refresh token reuse interval" em 10 s.
4. **E-mails: configure um SMTP próprio** (Authentication → Emails → SMTP Settings). O remetente
   padrão do Supabase envia **só 2 e-mails por hora para o projeto inteiro** — cadastro,
   "Esqueci minha senha" e reenvio de confirmação somam no mesmo limite, e o app mostra
   "O servidor atingiu o limite de e-mails por hora". Resend (3.000/mês) e Brevo (300/dia) têm
   plano gratuito: crie a conta, verifique um domínio (ou use o de teste) e cole host, porta,
   usuário e senha SMTP. Além disso, o mesmo e-mail só pode pedir um novo link a cada 60 s.
5. **Authentication → Rate Limits**: com o SMTP próprio o limite de e-mails passa a ser
   ajustável (algo como 30/hora basta); confira também os limites de login/cadastro por IP.
6. **Authentication → Emails → Templates**: os modelos padrão já usam `{{ .ConfirmationURL }}`,
   que respeita o `redirectTo` enviado pelo app.

Para conferir o básico sem entrar no painel:
`curl "$EXPO_PUBLIC_SUPABASE_URL/auth/v1/settings" -H "apikey: $EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"`
(`mailer_autoconfirm` deve ser `false`).

## Limites do plano gratuito (2026)

500 MB de banco, 50 mil usuários ativos/mês e pausa do projeto após 7 dias sem uso (reativa pelo
painel). Para um app de hábitos (linhas pequenas) isso comporta muitos usuários.

## Testes

- `npm run test:sql` roda `supabase/schema.sql` num Postgres real (PGlite) e verifica
  "mais recente vence", isolamento entre usuários e exclusão de conta.
- `src/sync/engine.test.ts` simula dois aparelhos sincronizando por um servidor falso com as
  mesmas regras.
