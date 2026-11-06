# informas-ui no Estoque PME

O app usa os tokens do [informas-ui](https://github.com/claudio-mas/informas-ui) — a base neutra de design system — com Tailwind CSS v4. Não há biblioteca de componentes: os poucos componentes de interface são locais, em `apps/web/src/components/ui/`.

## Como está ligado

- Dependência de `@estoque-pme/web`, instalada do release no GitHub (`informas-ui-2.0.0-alpha.0.tgz`). `npm ci` baixa o arquivo; a integridade fica no `package-lock.json`.
- `src/app/globals.css` importa `tailwindcss` e `informas-ui/theme.css`. Isso gera os utilitários dos tokens semânticos: `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `border-input`, `bg-primary`/`text-primary-foreground`, `text-warning-subtle-foreground`, `bg-warning-subtle`, `text-destructive-subtle-foreground`, `text-success-subtle-foreground`, `text-info-subtle-foreground`…
- Os cinzas são os neutros do informas-ui. Não há `brand.css` ainda; quando houver marca, ela entra num arquivo importado depois do tema e é validada com `npx informas-contrast src/app/brand.css`.

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

`.dark` no `<html>`, padrão do informas-ui e do shadcn/ui. O script de `tema.ts` entra no layout raiz com `next/script` (`beforeInteractive`): aplica a preferência antes da pintura, acompanha o sistema operacional no modo Sistema e sincroniza abas. A preferência fica em `localStorage`, chave `estoque-pme.aparencia`, valores `light`, `dark` ou `system`. São a chave e os valores da versão anterior, então a escolha de quem já usava o app foi mantida.

## Rascunho de mapeamento

Decisões por conta, níveis ausentes e motivo são controlados. O reset nativo solicitado após a Server Action é cancelado: em selects ele pode restaurar a primeira opção mesmo com value controlado. Após erro, nenhuma versão é criada e o rascunho permanece. Após sucesso, o formulário espera a versão salva chegar nas props, atualiza a base e limpa o motivo. Campos ficam bloqueados durante envio e atualização e em modo leitor; a autorização efetiva continua no servidor. O rascunho não persiste após sair da página; nenhuma classificação financeira vai para o `localStorage`.

## Testes de navegador

```powershell
npx playwright install chromium
npm run test:e2e --workspace @estoque-pme/web
```

Cada execução provisiona um PGlite novo em `apps/web/.e2e/run-*/dados`, com usuários, empresas e sessões de teste; a autenticação Auth.js e o DAL são os reais. Cobrem: preservação do rascunho após erro, versões e reapuração, reimportação idempotente, leitor e 404 para outra empresa, redirecionamento sem sessão, tema persistido e tema do sistema, navegação móvel sem rolagem horizontal e contraste AA do botão primário nos dois temas. Capturas claro/escuro/celular ficam na pasta da execução.

Uma captura tirada logo após `goto` pode gerar um aviso de hidratação em desenvolvimento: o Playwright injeta `caret-color: transparent` nos campos antes de o React hidratar. É artefato do teste, não do app.

## Atualizar o informas-ui

Troque a URL da dependência em `apps/web/package.json` pela do novo release, rode `npm install`, `npm run typecheck`, `npm test`, `npm run build --workspace @estoque-pme/web` e os testes de navegador. Mudanças de versão maior podem renomear tokens; consulte o CHANGELOG do informas-ui.
