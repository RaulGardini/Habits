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
- [ ] **Nome na loja** (até 30 caracteres). Ex.: "Habits: Hábitos e Planner".
- [ ] Preencher `[NOME DO DESENVOLVEDOR]` e `[E-MAIL DE CONTATO]` em
      `src/features/legal/privacy.json` e rodar `npm run legal`.
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
5. Formulários do Play Console:
   - **Segurança dos dados** (Data safety):
     - Sem conta: "Não coleta dados" e "Não compartilha dados".
     - Com sync: coleta **E-mail** (gerenciamento de conta) e **Outro conteúdo gerado pelo
       usuário** (funcionalidade do app); criptografado em trânsito; o usuário pode pedir exclusão
       (no app: Excluir conta). Não compartilhado com terceiros.
   - **Classificação de conteúdo**: questionário → categoria "Utilitário/Produtividade", sem
     violência, sem interação entre usuários → Livre.
   - **Público-alvo**: 13+ (não direcionado a crianças).
   - **Anúncios**: não contém anúncios.
   - **Acesso ao app**: tudo disponível sem login (a conta é opcional).
   - **Exclusão de conta** (se usar sync): informe que é feita no app e o link da política.
   - **Política de privacidade**: `https://SEU-SITE/privacidade.html`
6. Ficha da loja: textos da seção 6, ícone 512×512 (use `assets/images/icon.png`), imagem de
   destaque 1024×500 e pelo menos 2 capturas de tela do celular.

## 4. App Store

1. Assine o Apple Developer Program (US$ 99/ano) e crie o app no
   [App Store Connect](https://appstoreconnect.apple.com) com o mesmo bundle id.
2. `npx eas-cli@latest build -p ios --profile production` (o EAS cria certificados, perfis e o
   App Group do widget automaticamente).
3. `npx eas-cli@latest submit -p ios` → o build aparece no **TestFlight**. Teste no iPhone,
   incluindo os widgets (primeira compilação do widget iOS — espere ajustes).
4. **Privacidade do app** (App Privacy):
   - Sem conta: "Dados não coletados".
   - Com sync: **Informações de contato → E-mail** e **Conteúdo do usuário → Outro conteúdo**,
     vinculados à identidade, usados só para "Funcionalidade do app", sem rastreamento.
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
SPA) já vão junto. A política fica em `https://SEU-SITE/privacidade.html` — é essa URL que vai
nas lojas.

## 6. Textos da ficha (pt-BR)

**Nome (30):** Habits: Hábitos e Planner

**Subtítulo iOS (30):** Rotina, metas e planner

**Descrição curta – Play (80):** Hábitos, planner e metas grátis, sem anúncios e funcionando offline.

**Palavras-chave iOS (100):** habitos,rotina,planner,metas,agenda,tarefas,diario,produtividade,streak,lembrete

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
> 🗓️ Planner diário, mensal e anual: tarefas com prioridade, eventos em linha do tempo, diário
> do dia e metas com progresso — inclusive metas ligadas aos seus hábitos.
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
4. Planner diário (tarefas + agenda).
5. Planner mensal com metas.
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
