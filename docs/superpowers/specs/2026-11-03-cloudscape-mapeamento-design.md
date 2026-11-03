# Cloudscape UI e mapeamento sem perda de trabalho

Proposta aprovada na conversa de 03/11/2026: integrar o design system próprio e corrigir a preservação das decisões após validação.

## Entrega
- Consumir Cloudscape UI 1.1.0 como pacote versionado no repositório; nenhuma dependência de caminhos absolutos.
- Uma fronteira de componentes cliente integra os componentes React ao Next.js. Tokens e CSS são importados globalmente.
- Estrutura de empresa com navegação ativa e identidade Cloudscape. A primeira tela inteiramente adaptada é Mapeamento.
- Decisões por conta, níveis ausentes e motivo são controlados e preservados em erro. Cada envio válido continua criando uma versão e reapurando uma vez.
- Mensagens acessíveis, campos nomeados por conta, estado de processamento e modo leitor.
- Teste real de navegador com PGlite isolado, sessão Auth.js real e importação pela interface.

## Abordagem escolhida
Pacote compilado distribuído em vendor/cloudscape-ui-1.1.0.tgz. Instalação por pasta externa dependeria da máquina; copiar componentes perderia o vínculo com a versão do design system.
A tabela contábil usa tokens e composição própria: FileTable é específica para arquivos.
Temas claro/escuro/sistema serão habilitados na área adaptada; telas legadas permanecem em migração gradual e mantêm aparência clara quando necessário.

## Limites
Não acrescentar cenários, MRP, convites, auto-cadastro ou integrar o engine financeiro neste corte.
Preservar a autenticação, DAL, RLS, dinheiro bigint e distinções de ausência. Não modificar o repositório do design system.
Não garantir rascunho após fechar/recarregar a página. Preservação é durante erros e atualizações da mesma sessão de edição.

## Aceite
Erro por PP ausente e ainda mapeado preserva decisões, caixas marcadas e motivo; não grava versão.
Corrigir e salvar cria uma versão; reload confirma persistência e reapuração.
Um novo erro após um salvamento também preserva o rascunho.
Leitor não altera o formulário nem grava; empresa alheia permanece invisível.
Tema e navegação funcionam em desktop e tela estreita sem perda dos dados.
