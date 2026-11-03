# Cloudscape UI no Estoque PME

O app consome o design system próprio `cloudscape-ui@1.1.0`, empacotado em `vendor/`.
A dependência é relativa ao workspace web. `npm ci` não precisa do clone externo nem de acesso ao repositório do design system.

## Desenvolvimento

Na raiz do repositório:

```powershell
npm ci
npm run typecheck
npm test
npm run build --workspace @estoque-pme/web
```

Para abrir o app, configure `apps/web/.env.local` usando `.env.example`.
É necessário `AUTH_SECRET`. Sem SMTP, o magic link é mostrado no terminal.
O provisionamento de desenvolvimento continua sendo feito com `semear`.

## Integração

- `src/components/cloudscape.tsx`: fronteira cliente para componentes de biblioteca que usam hooks/context.
- `src/components/provedores.tsx`: um ThemeProvider na raiz, com preferência em `estoque-pme.aparencia`.
- `src/components/estrutura-empresa.tsx`: AppShell, navegação ativa, troca de empresa e seletor Claro/Escuro/Sistema.
- `src/app/globals.css`: tokens, CSS da biblioteca na camada components e composições contábeis com prefixo pme.
- `FileTable` é específica para documentos. A tabela de contas usa composição HTML acessível, sem adaptar contas ao modelo de arquivos.
- Períodos, importação e detalhe do período ainda conservam sua apresentação anterior dentro de um contêiner claro; a navegação já usa Cloudscape. O mapeamento é a primeira tela adaptada integralmente.

Não importar o barrel React do pacote diretamente num Server Component. Usar a fronteira cliente, conforme a documentação instalada do Next.
Os dados e a autorização continuam nos Server Components e no DAL.

## Rascunho de mapeamento

Decisões por conta, níveis ausentes e motivo são controlados.
O reset nativo solicitado após a Server Action é cancelado: em selects ele pode restaurar a primeira opção mesmo com value controlado.
Após erro, nenhuma versão é criada e o rascunho permanece.
Após sucesso, o formulário espera a versão salva chegar nas props, atualiza a base e limpa o motivo. Campos ficam bloqueados durante envio e atualização.
Todos os controles são bloqueados no modo leitor. A autorização efetiva continua no servidor.
O rascunho não persiste após sair da página ou recarregar; nenhuma classificação financeira é guardada em localStorage.

## Testes de navegador

```powershell
npx playwright install chromium
npm run test:e2e --workspace @estoque-pme/web
```

O comando provisiona um PGlite novo em `apps/web/.e2e/run-*/dados`, com usuários, empresas e sessões de teste. A autenticação Auth.js e o DAL são os reais; não existe rota de teste nem desvio de autorização no app.
O banco de desenvolvimento e DATABASE_URL são ignorados nessa execução.
O servidor local usa a porta 3100 e é encerrado pelo Playwright.
As sessões provisionadas não testam o transporte de e-mail nem o aceite de magic link.

Os testes cobrem preservação após validação, erro depois de sucesso, versões e reapuração, reimportação idempotente, leitor e 404 para outra empresa, redirecionamento sem sessão, tema persistido, mudança do tema do sistema, navegação móvel e contraste das telas legadas.
Capturas claro/escuro/celular ficam na pasta da execução; traces de falhas ficam em test-results. Ambos são ignorados pelo Git.

## Atualizar o pacote

Gerar uma nova distribuição no repositório Cloudscape UI, copiar o novo .tgz para vendor, atualizar a dependência do workspace e executar as verificações acima.
O manifesto em vendor/README.md registra a origem e SHA-256. A fonte externa permanece independente do app.
