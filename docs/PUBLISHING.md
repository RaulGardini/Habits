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
- [ ] **Nome na loja** (até 30 caracteres). Ex.: "Habits: Hábitos e Agenda".
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

## 4. App Store

1. Assine o Apple Developer Program (US$ 99/ano) e crie o app no
   [App Store Connect](https://appstoreconnect.apple.com) com o mesmo bundle id.
2. `npx eas-cli@latest build -p ios --profile production` (o EAS cria certificados, perfis e o
   App Group do widget automaticamente).
3. `npx eas-cli@latest submit -p ios` → o build aparece no **TestFlight**. Teste no iPhone,
   incluindo os widgets (primeira compilação do widget iOS — espere ajustes).
4. **Privacidade do app** (App Privacy) e **classificação etária**: respostas prontas na seção 9.
5. Revisão:
   - Exclusão de conta dentro do app: ✅ (Ajustes → Excluir conta).
   - "Sign in with Apple" **não** é exigido (o login é por e-mail, não por redes sociais).
   - Criptografia: `ITSAppUsesNonExemptEncryption = false` já está no `app.json`.
   - Notas para o revisor: "Todas as funções funcionam sem conta. A conta é opcional e serve só
     para sincronizar entre aparelhos."
6. Capturas: iPhone 6,9" (1320×2868 ou 1290×2796). iPad não é necessário
   (`supportsTablet: false` na primeira versão).

## 5. Web

```bash
npx expo export -p web      # gera dist/
```

Publique `dist/` no Cloudflare Pages ou Netlify (arraste a pasta ou conecte o GitHub).
`public/_headers` (COOP/COEP, exigidos pelo banco no navegador) e `public/_redirects` (rotas da
SPA) já vão junto. Hoje a web está no EAS Hosting (`npx eas-cli@latest deploy --prod`), e a política fica em
https://habits-raul.expo.app/privacidade.html — é essa URL que vai nas lojas.

## 6. Textos da ficha (pt-BR)

**Nome (30):** Habits: Hábitos e Agenda

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
