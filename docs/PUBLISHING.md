# Checklist de publicação (App Store, Google Play e web)

O app é gratuito para o usuário. **Publicar nas lojas tem custo para você** — não há alternativa
gratuita para isso:

| Item                      | Custo                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------- |
| Google Play Console       | US$ 25, pagamento único                                                             |
| Apple Developer Program   | US$ 99 por ano (obrigatório para App Store e para instalar builds iOS em aparelhos) |
| EAS Build / Submit (Expo) | Plano Free: builds limitados por mês e fila mais lenta — suficiente para lançar     |
| Supabase (sync opcional)  | Free                                                                                |
| Hospedagem do web         | Free (Cloudflare Pages ou Netlify)                                                  |

---

## 1. Decisões que só você pode tomar (antes do primeiro build de produção)

- [ ] **Identificador definitivo** (não muda depois de publicado). Definido: `com.raulgardini.habits` ✅
      Sugestão: `com.<seunome>.habits`. Troque em **todos** os lugares:
  - `app.json` → `ios.bundleIdentifier`, `android.package` e
    `ios.entitlements["com.apple.security.application-groups"]` (`group.<id>`)
  - `src/widgets/iosPayload.ts` → `APP_GROUP`
  - `targets/widget/Snapshot.swift` → `appGroup`
  - depois: `npx expo prebuild --clean`
- [x] **Nome na loja** (até 30 caracteres): "Duck Habits: Hábitos e Agenda" (embaixo do ícone: "Duck Habits").
- [x] Nome e e-mail de contato na política (`src/features/legal/privacy.pt.json` /
      `privacy.en.json`; depois de editar, `npm run legal`).
- [ ] Sync na nuvem: publicar **com** (configure o Supabase — `docs/SUPABASE.md`) ou **sem**
      (não defina as variáveis; a seção de conta some e a política continua correta).
- [ ] `ios.appleTeamId` no `app.json` (Apple Developer → Membership → Team ID). Necessário para o
      widget iOS.

## 2. Preparar o EAS

```bash
npx eas-cli@latest login
npx eas-cli@latest init          # cria o projeto na sua conta Expo e grava o projectId
```

Se usar sync, cadastre `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` nos
ambientes `preview` e `production` (comandos em `docs/SUPABASE.md`).

Perfis (`eas.json`):

- `development` — app de desenvolvimento (com dev client) para testar widgets com recarga de JS.
- `preview` — APK instalável para testar no seu Android / enviar para amigos.
- `production` — AAB (Play) e IPA (App Store), com número de build incrementado automaticamente.

## 3. Google Play

1. Crie a conta no [Play Console](https://play.google.com/console) (US$ 25) e o app
   (idioma padrão pt-BR, app gratuito).
2. `npx eas-cli@latest build -p android --profile production`
3. **O primeiro AAB é enviado manualmente** (Play Console → Testes → Teste interno).
   Depois disso, `npx eas-cli@latest submit -p android` funciona com uma chave de conta de serviço.
4. **Contas pessoais novas precisam de teste fechado com pelo menos 12 testadores por 14 dias**
   antes de liberar produção. Comece cedo (amigos, grupos de dev).
5. Formulários do Play Console (Conteúdo do app): respostas prontas na seção 9.
6. Ficha da loja: textos da seção 6, ícone 512×512 (use `assets/images/icon.png`), imagem de
   destaque 1024×500 e pelo menos 2 capturas de tela do celular.

## 4. App Store (passo a passo)

Já pronto no projeto: manifesto de privacidade do app e do widget (`ios.privacyManifests`,
`targets/widget/PrivacyInfo.xcprivacy`), texto do Face ID em pt/en,
`ITSAppUsesNonExemptEncryption` = false, HTTPS only, versão de runtime de loja
(`app.config.js`: `appVersion` nos builds, `sdkVersion` só no `npm run publish:go`), exclusão de
conta no app, página de suporte, política e página de exclusão de conta publicadas.

1. **App Store Connect → Business**: aceite o **Free Apps Agreement** (se ainda estiver
   pendente) e declare o **status de comerciante (DSA)** — pessoa física que não vende nada pode
   se declarar "não comerciante". Conta bancária e impostos não são necessários (app gratuito).
2. **Team ID** (developer.apple.com → Account → Membership details, 10 caracteres) em
   `ios.appleTeamId` no `app.json`.
3. **Build de produção** (no terminal do projeto; pede o login da Apple com 2FA):
   ```bash
   npx eas-cli@latest build -p ios --profile production
   ```
   Responda **sim** para: entrar na conta Apple, gerar o certificado de distribuição e os perfis
   do app **e** do widget (`com.raulgardini.habits.widget`). O EAS registra os bundle ids e o
   App Group `group.com.raulgardini.habits`. No plano grátis a fila pode levar ~30 min. Confira
   no log: Xcode 26+ e os dois alvos (Habits e HabitsWidget) assinados.
4. **Criar o app** no [App Store Connect](https://appstoreconnect.apple.com) → Apps → **+** →
   Novo app: iOS, nome (seção 6), idioma principal **Português (Brasil)**, bundle id
   **com.raulgardini.habits** (aparece na lista depois do passo 3), SKU `habits`.
5. **Enviar o build**:
   ```bash
   npx eas-cli@latest submit -p ios --latest
   ```
   Deixe o EAS criar a chave da API do App Store Connect. O build aparece no **TestFlight** após
   ~15 min de processamento. Adicione você como testador interno e instale pelo app TestFlight.
   Teste a seção 8 inteira, com atenção a: Face ID, widgets (adicionar os dois, marcar pelo
   widget com o app fechado), lembretes, instalação limpa com e sem conta, modo avião.
6. **Ficha** (App Store Connect → o app → versão 1.0):
   - Textos: seção 6 (pt-BR) e seção 6.1 (inglês — adicione o idioma "English (U.S.)").
   - **URL de suporte**: https://habits-raul.expo.app/suporte.html
   - **URL da política de privacidade**: https://habits-raul.expo.app/privacidade.html
   - **Categoria**: Produtividade (secundária: Saúde e fitness). **Copyright**: 2026 Raul Passos Gardini.
   - **Classificação etária** e **Privacidade do app**: respostas prontas na seção 9.
   - **Preço**: grátis; disponibilidade nos países desejados.
   - Capturas: iPhone 6,9" (1320×2868 ou 1290×2796). iPad não (`supportsTablet: false`).
7. **Informações para a revisão**: nome, telefone, e-mail, **conta de demonstração** (e-mail e
   senha de uma conta de teste já confirmada, com alguns hábitos e eventos) e as notas abaixo.
8. **Enviar para revisão** (liberação manual recomendada na primeira versão).

**Notas para o revisor** (em inglês — os revisores leem inglês):

> Duck Habits is a free habit tracker and agenda with no ads and no tracking. Everything works
> without an account and offline; the account (e-mail + password) is optional and only syncs
> data between the user's devices. A demo account with sample data is provided above.
> Account deletion: Settings > Account and sync > Delete account (deletes the account and all
> cloud data). Home screen widgets: "Today" (tap a habit to check it) and "Heatmap".
> Reminders are local notifications; Face ID is only used for the optional app lock
> (Settings > Privacy). The app is available in Portuguese and English (Settings > Language).

**Depois de publicado**: correções de JS vão por EAS Update (seção 11); o `npm run publish:go`
continua servindo só o Expo Go e não atinge o app da loja (versões de runtime diferentes).

## 5. Web

```bash
npx expo export -p web      # gera dist/
```

Publique `dist/` no Cloudflare Pages ou Netlify (arraste a pasta ou conecte o GitHub).
`public/_headers` (COOP/COEP, exigidos pelo banco no navegador) e `public/_redirects` (rotas da
SPA) já vão junto. Hoje a web está no EAS Hosting (`npx eas-cli@latest deploy --prod`), e a política fica em
https://habits-raul.expo.app/privacidade.html — é essa URL que vai nas lojas.

## 6. Textos da ficha (pt-BR)

**Nome (30):** Duck Habits: Hábitos e Agenda

**Subtítulo iOS (30):** Rotina, metas e agenda

**Descrição curta – Play (80):** Hábitos, agenda e metas grátis, sem anúncios e funcionando offline.

**Palavras-chave iOS (100):** habitos,rotina,agenda,metas,calendario,compromissos,produtividade,streak,lembrete

**Descrição completa:**

> Construa hábitos que ficam — sem anúncios, sem assinatura e sem precisar de conta.
>
> ✅ Hábitos do seu jeito: todo dia, dias da semana, X vezes por semana ou mês, ou a cada X dias.
> Marque com um toque, conte quantidades (como litros de água) ou use o cronômetro.
>
> 📅 Tela Hoje organizada por manhã, tarde e noite, com barra de progresso do dia.
>
> 🔥 Sequências que respeitam a sua frequência, taxa de conclusão, totais e o seu melhor dia da
> semana. Mapas de calor por semana, mês e ano, no estilo GitHub, com a cor de cada hábito.
>
> 🗓️ Agenda completa: visão de dia, semana, mês e próximos dias, compromissos que se
> repetem, dia inteiro, local, lembretes e aviso de conflito de horário. E metas do mês e do ano
> — inclusive ligadas aos seus hábitos.
>
> 🔔 Lembretes no horário que você escolher. Widgets na tela inicial para marcar hábitos sem
> abrir o app.
>
> 🔒 Seus dados ficam no seu aparelho. Backup em arquivo quando quiser e sincronização opcional
> entre aparelhos.
>
> Tema claro e escuro, feito com acessibilidade em mente. 100% gratuito.

## 6.1 Textos da ficha (English)

**Name (30):** Duck Habits: Habit Tracker

**Subtitle (30):** Routines, goals and agenda

**Keywords (100):** habits,routine,tracker,agenda,goals,calendar,streak,reminder,planner,productivity

**Promotional text (170):** Build habits that stick — free, no ads, no account needed. Check off
your day, see your streaks and plan your week, all on your device.

**Description:**

> Build habits that stick — no ads, no subscription and no account required.
>
> ✅ Habits your way: every day, on chosen weekdays, X times a week or month, or every X days.
> Check them with one tap, count amounts (like liters of water) or use the timer.
>
> 📅 A Today screen organized by morning, afternoon and evening, with your daily progress.
>
> 🔥 Streaks that respect your frequency, completion rates, totals and your best weekday.
> Heatmaps by week, month and year in each habit's color.
>
> 🗓️ A complete agenda: day, week, month and upcoming views, repeating events, all-day events,
> location, reminders and conflict warnings. Monthly and yearly goals — linked to your habits,
> too.
>
> 🔔 Reminders at the time you choose. Home screen widgets to check habits without opening the
> app.
>
> 🔒 Your data stays on your device, with an optional app lock (Face ID). Backups whenever you
> want and optional sync between your devices.
>
> Light and dark themes, built with accessibility in mind. 100% free.

## 7. Capturas de tela sugeridas

1. Tela Hoje com 4–5 hábitos coloridos (alguns marcados).
2. Estatísticas: mapa de calor do ano.
3. Estatísticas de um hábito (sequências e taxa).
4. Agenda do mês com compromissos.
5. Agenda do dia (linha do tempo) ou metas.
6. Widget na tela inicial.

Use um aparelho/emulador limpo, tema claro, dados de exemplo realistas e sem notificações
na barra de status.

## 8. Teste manual antes de enviar

- [ ] Instalação limpa → criar hábitos de todos os tipos e frequências → marcar/desmarcar.
- [ ] Fechar e reabrir: dados, timer em andamento e tema preservados.
- [ ] Lembrete dispara no horário (permissão concedida e negada).
- [ ] Widgets: adicionar, marcar pelo widget, conferir no app; virada do dia.
- [ ] Backup: exportar → apagar tudo → importar.
- [ ] Sync (se ativo): criar conta, dois aparelhos, editar nos dois, sair, excluir conta.
- [ ] Tema escuro, fonte grande do sistema e leitor de tela (TalkBack/VoiceOver) nas telas principais.
- [ ] Modo avião: tudo funciona.
- [ ] `npm run check` verde e versão (`version` no `app.json`) atualizada.

## 9. Formulários de privacidade e classificação (respostas prontas)

Valem para o app **com** sync (o build de loja tem o Supabase configurado). Sem conta nada sai do
aparelho, mas as lojas perguntam pelo que o app _pode_ coletar, então declare o que a conta envia.
Se o app mudar o que coleta, atualize a política (`src/features/legal/privacy.*.json`,
`npm run legal`, publicar a web) **e** estes formulários.

URLs públicas (EAS Hosting):

- Política: https://habits-raul.expo.app/privacidade.html (inglês: `/privacy.html`)
- Exclusão de conta: https://habits-raul.expo.app/excluir-conta.html (inglês: `/delete-account.html`)

### Google Play — Segurança dos dados (Data safety)

- O app coleta ou compartilha dados? **Sim** (coleta; não compartilha).
- Todos os dados são criptografados em trânsito? **Sim** (só HTTPS).
- O usuário pode pedir a exclusão dos dados? **Sim** — no app e pela URL de exclusão acima.
- Conta: o app permite criar conta → **URL de exclusão de conta** = a de cima; "exclusão de
  dados sem excluir a conta": não é oferecida pelo servidor (no aparelho: Ajustes > Apagar dados).
- Tipos de dados (todos: **coletado**, **não compartilhado**, **não efêmero**, **opcional**
  — o usuário escolhe criar conta):

| Categoria → tipo                                      | Finalidades                                               |
| ----------------------------------------------------- | --------------------------------------------------------- |
| Informações pessoais → Endereço de e-mail             | Funcionalidade do app, Gerenciamento de conta             |
| Informações pessoais → Nome                           | Funcionalidade do app (nome da saudação, sincronizado)    |
| Informações pessoais → IDs do usuário                 | Funcionalidade do app, Gerenciamento de conta             |
| Atividade no app → Outro conteúdo gerado pelo usuário | Funcionalidade do app (hábitos, registros, agenda, metas) |

- **Não** declarar: localização, contatos, fotos, identificadores do dispositivo, diagnósticos,
  analytics, publicidade (nada disso é coletado). O IP e os horários de login que o Supabase
  registra por segurança não têm tipo próprio no formulário (não derivamos localização).
- Os hábitos são texto livre do usuário; não declaramos "Saúde e fitness" porque o app não pede
  nem calcula dado de saúde. Se um dia integrar Apple Saúde/Health Connect, isso muda.
- Outros itens de Conteúdo do app: **Anúncios**: não. **Acesso ao app**: tudo funciona sem
  login (a conta é opcional). **Público-alvo**: 13–15, 16–17 e 18+ (sem faixas abaixo de 13,
  para o app não entrar na política de Famílias/COPPA). **App de saúde**: não. **Governo /
  financeiro / notícias**: não.
- **Classificação de conteúdo (IARC)**: categoria "Todos os outros tipos de app"
  (produtividade); tudo "Não" (violência, sexo, linguagem, drogas, apostas, interação entre
  usuários, compartilhamento de localização, compras digitais) → **Livre / PEGI 3 / Everyone**.
- Permissões do Android (manifesto final): `INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE`,
  `POST_NOTIFICATIONS` e `RECEIVE_BOOT_COMPLETED` (lembretes locais), `USE_BIOMETRIC` /
  `USE_FINGERPRINT` (bloqueio opcional). Nenhuma exige declaração no Play Console (não usamos
  `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM`, localização, SMS, contatos nem armazenamento).

### Apple — Privacidade do app (App Privacy)

- Coleta dados? **Sim.** Rastreamento (tracking)? **Não** para todos os tipos.
- Tipos (todos **vinculados à identidade**, finalidade só **Funcionalidade do app**):
  - Informações de contato → **Endereço de e-mail**
  - Informações de contato → **Nome**
  - Identificadores → **ID do usuário**
  - Conteúdo do usuário → **Outro conteúdo do usuário**
- **Não** declarar: saúde/fitness, localização, contatos, dados de uso, diagnósticos,
  identificadores do dispositivo, compras (nada disso sai do aparelho). A biometria do bloqueio
  é verificada pelo sistema; o app não recebe dado biométrico.
- URL da política: a de cima. Textos de permissão no `Info.plist`: só Face ID
  (`NSFaceIDUsageDescription`, pt-BR e inglês via `locales` no `app.json`); notificações não
  pedem texto.

### Apple — Classificação etária (questionário de 2025)

Tudo **"Nenhum"/"Não"**: violência, temas adultos/sexuais, linguagem, drogas/álcool/tabaco,
terror, jogos de azar, concursos, temas médicos ou de tratamento, acesso irrestrito à web,
conteúdo gerado pelo usuário visível a outros, mensagens/chat, controles parentais, verificação
de idade → **4+**. Hábitos de bem-estar (beber água, exercício) não contam como informação médica.
Não marcar "Feito para crianças" (Kids Category).

## 10. Capacidade (muitos usuários)

O app é **local primeiro**: cada aparelho tem o próprio banco, então o número de usuários só pesa
no Supabase (sync e contas). Verificado:

- **As consultas do sync usam índice** mesmo com 90 mil linhas de 300 usuários
  (`npm run test:sql`, `EXPLAIN` com RLS): o custo por usuário não cresce com o total de usuários.
- **Tráfego**: uma rodada de sync = 8 consultas pequenas (só o que mudou) + os envios; ao abrir o
  app, ao voltar, ao reconectar e 4 s depois de mudanças. Falhas esperam 2 s, 4 s… até 5 min com
  variação aleatória (sem "manada" de pedidos quando o servidor volta).
- **Espaço** (o limite real do plano grátis, 500 MB): ~1,5 MB por usuário típico por ano (dados +
  3 backups internos) → **~350 usuários-ano no plano grátis**, ~5 mil no Pro (US$ 25/mês, 8 GB).
  Consulta para acompanhar em docs/SUPABASE.md; migre ao Pro ao passar de ~70%.
- **E-mails** (cadastro e senha): Brevo grátis = 300/dia; acima disso, plano pago do Brevo ou
  domínio próprio + outro provedor.
- **Se um limite estourar**, o app continua funcionando no aparelho; só o sync fica com erro e
  tenta de novo mais tarde. Nenhum dado local é perdido.
- **EAS**: o plano grátis do Expo tem limites de builds por mês e de usuários ativos por mês no
  EAS Update — confira em expo.dev/pricing antes de mandar atualizações para muitos usuários.

## 11. Plano de rollback

- **Bug de JS** (tela, regra, texto): corrija, rode `npm run check` e publique uma atualização para
  os apps da loja (chega na próxima abertura, sem revisão da Apple):
  ```bash
  npx eas-cli@latest update --channel production --environment production --platform ios --message "Correção"
  ```
  Voltar a uma versão anterior: `npx eas-cli@latest update:rollback` (ou republicar o commit
  anterior). Não use EAS Update para mudanças grandes de funcionalidade (regra da Apple).
- **Bug nativo** (biblioteca nativa, permissões, widget, `app.json`): aumente `version` no
  `app.json` (ex.: 1.0.1 — muda a versão de runtime), gere um build novo e envie para revisão
  (costuma levar 1–2 dias). Enquanto isso, se o bug for grave, desligue a função com uma
  atualização de JS.
- **Servidor** (Supabase): o app funciona offline; restaure o banco com `scripts/db-restore.sh` a
  partir do backup semanal criptografado (docs/SUPABASE.md).
- **Primeira semana**: acompanhe App Store Connect (TestFlight → Crashes, Avaliações) e o e-mail
  de suporte.
