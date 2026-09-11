# O lançamento é projeção materializada da fonte

O `Lancamento` não é dado de entrada: é o resultado de aplicar o mapeamento ao balancete e ao razão. Isso tem
uma consequência que o RF-28 torna obrigatória — **a fonte parseada é persistida**, em tabelas próprias para
as linhas do balancete e para as contas e lançamentos do razão. Sem ela, "alterar o mapeamento recalcula o
histórico afetado" não tem sobre o que recalcular.

E o lançamento, mesmo sendo derivável, **também é materializado**, com uma coluna de versão por dependência
para que defasagem seja consulta e não esperança.

## Por que materializar o que é derivável

Calcular na leitura elimina por construção a classe inteira de bug "cache velho", e foi considerado a sério:
o dado é minúsculo — uma empresa são 24 períodos × 3 níveis — e o motor é puro e rápido. Mas mata dois
requisitos de uma vez: a consulta por estado de que o ADR-0008 depende (`where estado = 'indefinido'`, para o
aviso navegável e para o filtro do backtesting) e qualquer agregação em SQL para a série do RF-13 e para o
giro de doze meses.

Reprocessar os **bytes** originais em vez das linhas parseadas foi recusado por um motivo específico: depende
de o perfil de importação continuar correto, e o perfil é justamente a coisa que pode ter sido corrigida no
meio do caminho — o recálculo passaria a depender de duas variáveis em vez de uma. Guardar os bytes tem
argumento próprio, como original defensável diante de um contador, e traz superfície de LGPD e de
armazenamento: é decisão separada, não carona nesta.

## Defasagem é uma coluna por dependência

O lançamento depende de três coisas: fonte, mapeamento e valor informado (ADR-0010). A linha grava **uma
coluna de versão por dependência**, não um hash agregado: o hash responde *"está defasado"* e não responde
*"por quê"*, e o porquê decide o escopo — mapeamento alterado atinge o histórico inteiro da empresa, valor
informado alterado atinge um período.

A fonte não precisa de coluna, e isso é um compromisso explícito e não um esquecimento: **importar escreve
fonte e lançamento na mesma transação.**

## O recálculo é síncrono

Editar o mapeamento recalcula o histórico afetado **na mesma transação**. Uma empresa são 24 períodos × 3
níveis, dentro do orçamento de 2 s do RNF com folga. Fila de job é infraestrutura que a seção "deliberadamente
excluído" do `CLAUDE.md` proíbe antes do primeiro cliente, e recalcular sob demanda na primeira leitura faria
o gestor pagar a conta no fechamento, entre o 5º e o 10º dia útil — o pior momento possível.

Com o recálculo síncrono, as colunas de versão deixam de ser mecanismo operacional e viram **detector**: se
alguma linha aparecer defasada, houve bug, e é melhor descobrir por query do que por número errado no
relatório.

## A tabela `periodo` existe para ausência ter um significado só

A primeira importação de uma empresa necessariamente não tem mapeamento — ele é construído a partir das contas
que aquele arquivo revelou —, e o pacote puro recusa produzir `Lancamento` quando a validação dá erro. Logo
existe um estado real: fonte gravada, lançamento inexistente.

Uma linha por `(empresa, competência)` carrega o estado desse funil, e é também onde moram os campos por
período (`cmv`, `receita`, `compras`, `custoMateriais`), nulos até haver lançamento. Com ela, ausência de linha
volta a significar uma coisa só — período nunca importado — e "importado sem mapeamento" é valor que se
consulta, não silêncio que se interpreta.

Escrever linhas de lançamento `indefinido` nesse caso foi recusado: produzir número onde o motor se recusou a
produzir reintroduz pela persistência exatamente o que a pureza protege.

## Consequências

**A fonte tem chaves diferentes por artefato.** O balancete tem chave natural, `(empresa, competência, conta)`,
e é upsert. O **razão não tem**: dois lançamentos idênticos no mesmo dia, mesma conta, mesmo valor e mesmo
histórico são legítimos e indistinguíveis. Ele é apagado-e-inserido por `(empresa, competência)`. Chave
sintética por número de linha foi recusada porque amarraria a identidade do dado ao layout do arquivo — o ERP
muda o preâmbulo e a reimportação duplica tudo. O custo assumido: para o razão não se relata "criadas *versus*
atualizadas", e o resumo do RF-05 fala de linhas de lançamento, que continuam com chave.

**Existe uma tabela `importacao`**, com origem (obrigatória na primeira importação da empresa, D8), perfil
usado, usuário e timestamp. A origem não pode viver na empresa nem no perfil: a empresa troca de ERP, e o que
o D8 quer medir é a distribuição de **importações**. É também onde nasce o resumo do RF-05.

**Diagnóstico tem dois lugares, por natureza.** O diagnóstico **do arquivo** — codificação detectada, linha 42
ilegível — é fato histórico sobre bytes que não mudam mais, e pertence à importação. O diagnóstico **do
mapeamento** — conta pendente, contrapartida ausente — é consequência de uma decisão que o gestor pode rever
hoje à tarde, e pertence ao período, reescrito junto com o lançamento. No mesmo lugar, o recálculo ou apagaria
história de importação, ou deixaria aviso velho de conta já classificada.

**Auditoria é append-only.** A convenção do projeto exige usuário, timestamp e valor anterior em toda mudança
de premissa ou entrada; com linhas versionadas, "valor anterior" é a linha anterior, não um campo que alguém
precisa lembrar de preencher, e não existe caminho de escrita que perca o histórico. Trilha gravada por
mecanismo paralelo ao da escrita some no dia em que alguém escrever pelo caminho errado. O custo é a leitura
corrente precisar de `DISTINCT ON … ORDER BY versao DESC`, que é uma view.

**O mapeamento é versionado com cabeçalho e entradas.** `mapeamento_versao` guarda usuário, timestamp e motivo
da edição; `mapeamento_entrada` aponta para a versão, e cada versão copia as entradas. Copiar vinte entradas
não é custo, e o cabeçalho evita repetir os três campos de auditoria em cada uma. Vigência por entrada foi
recusada no ADR-0001, pelo motivo que continua valendo.
