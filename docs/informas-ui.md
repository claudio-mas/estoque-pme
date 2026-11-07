# informas-ui no Estoque PME

O app usa os tokens do [informas-ui](https://github.com/claudio-mas/informas-ui) — a base neutra de design system — com Tailwind CSS v4, instalados pelo registro shadcn. Não há biblioteca de componentes: os poucos componentes de interface são locais, em `apps/web/src/components/ui/`.

## Como está ligado

O informas-ui é um **registro shadcn**: os itens são copiados para o projeto, e não há dependência npm.

- `apps/web/components.json` declara o registro `@informas`, fixado na versão: `https://github.com/claudio-mas/informas-ui/releases/download/v2.0.0-alpha.1/{name}.json`.
- `@informas/tema` escreveu em `src/app/globals.css` a variante `dark`, o `@theme inline`, o `:root`, o `.dark` (primitivas `--informas-*` e tokens semânticos) e o `@layer base`. Isso gera os utilitários `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `border-input`, `bg-primary`/`text-primary-foreground`, `text-warning-subtle-foreground`, `bg-warning-subtle`, `text-destructive-subtle-foreground`, `text-success-subtle-foreground`, `text-info-subtle-foreground` e afins.
- `@informas/contraste` copiou `scripts/informas-contrast.mjs`. `npm run contraste --workspace @estoque-pme/web` verifica os 78 pares no `globals.css`, e o `npm test` do app já roda essa verificação: contraste abaixo do mínimo reprova os testes.
- Os cinzas são os neutros do informas-ui. Ainda não há marca. Quando houver, ela entra como um bloco `:root`/`.dark` **no fim** do `globals.css` (ver o README do informas-ui). Por ficar por último, vence na cascata e sobrevive às atualizações do tema.
- O `@theme inline` tem linhas `--x: var(--x)` acrescentadas pelo CLI do shadcn. São inofensivas; não as "conserte" à mão, porque a próxima atualização as recria.

## Atualizar o tema

Troque a tag na URL do `components.json` e, em `apps/web`:

```sh
npx shadcn@latest add @informas/tema @informas/contraste --overwrite
```

Revise o diff do `globals.css`, consulte o CHANGELOG do informas-ui e rode `npm run typecheck`, `npm test`, o build e os testes de navegador.

## Regras

- **Cor só por token semântico.** Nada de `stone-*`, `amber-*`, `red-*`, `white` etc. O token diz o papel (texto secundário, campo, aviso), e o tema escuro e a marca funcionam sem tocar nas telas. A única exceção é o véu da gaveta móvel (`bg-black/40`), escuro de propósito nos dois temas.
- Texto secundário é `text-muted-foreground`, que passa em 4,5:1. O antigo `text-stone-400` (≈2,5:1) não volta.
- Borda de campo é `border-input` (3:1); divisórias e contornos de cartão são `border-border`.
- Classes do Tailwind têm de aparecer por extenso no código. Não monte nomes de classe com interpolação (`text-${tom}`): o Tailwind não os gera.

## Componentes locais (`src/components/ui/`)

| Arquivo | Uso |
|---|---|
| `botao.tsx` | `Botao` (`primario`/`secundario`, ícone opcional). Sem hooks: serve em Server Components e formulários de Server Action. |
| `aviso.tsx` | `Aviso` em bloco com `tom` info/sucesso/aviso/erro. `role="alert"`/`"status"` fica com quem chama. |
| `vazio.tsx` | Estado vazio. |
| `icone.tsx` | Ícones de traço decorativos (`aria-hidden`). |
| `tema.ts` + `seletor-de-tema.tsx` | Tema Claro/Escuro/Sistema. |

O shell da empresa (`src/components/estrutura-empresa.tsx`) tem topo, navegação lateral e, abaixo de 768 px, gaveta modal com foco preso, Escape e retorno do foco ao botão.

## Tema

`.dark` no `<html>`, padrão do informas-ui e do shadcn/ui. O script de `src/components/ui/tema.ts` entra no layout raiz com `next/script` (`beforeInteractive`): aplica a preferência antes da pintura, acompanha o sistema operacional no modo Sistema e sincroniza abas. A preferência fica em `localStorage`, chave `estoque-pme.aparencia`, valores `light`, `dark` ou `system`. São a chave e os valores da versão anterior, então a escolha de quem já usava o app foi mantida.

## Rascunho de mapeamento

Decisões por conta, níveis ausentes e motivo são controlados. O reset nativo solicitado após a Server Action é cancelado: em selects ele pode restaurar a primeira opção mesmo com value controlado. Após erro, nenhuma versão é criada e o rascunho permanece. Após sucesso, o formulário espera a versão salva chegar nas props, atualiza a base e limpa o motivo. Campos ficam bloqueados durante envio e atualização e em modo leitor; a autorização efetiva continua no servidor. O rascunho não persiste após sair da página; nenhuma classificação financeira vai para o `localStorage`.

## Testes de navegador

```powershell
npx playwright install chromium
npm run test:e2e --workspace @estoque-pme/web
```

Cada execução provisiona um PGlite novo em `apps/web/.e2e/run-*/dados`, com usuários, empresas e sessões de teste; a autenticação Auth.js e o DAL são os reais. Cobrem: preservação do rascunho após erro, versões e reapuração, reimportação idempotente, leitor e 404 para outra empresa, redirecionamento sem sessão, tema persistido e tema do sistema, navegação móvel sem rolagem horizontal e contraste AA do botão primário nos dois temas. Capturas claro/escuro/celular ficam na pasta da execução.

As capturas usam `caret: 'initial'`. Sem isso, o Playwright injeta `caret-color: transparent` nos campos antes da hidratação, o Next acusa uma divergência e o selo de aviso dele cobre o seletor de tema no celular.
