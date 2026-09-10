# Estoque PME

Planejamento financeiro e orçamentário de estoque para indústrias de alimentos de pequeno e médio porte.
O vocabulário abaixo é o da controladoria brasileira — é o que o usuário fala, o que o contador entende e o
que aparece nos arquivos que o ERP exporta. Mantenha esses termos em português no modelo, no código e na
interface; não traduza para equivalentes em inglês.

## Language

### Entidades

**Empresa**:
A companhia cujo estoque se planeja. É a unidade de isolamento de dados e a unidade de cobrança.
_Avoid_: cliente, organização, tenant, conta

**Período**:
Um mês de competência de uma empresa, a unidade temporal de todo o modelo. O ciclo do produto é o
fechamento contábil mensal, não o dia.
_Avoid_: mês, exercício, ciclo

**Competência**:
O ano e o mês a que um dado pertence — o rótulo que identifica um período. No balancete ela vem no
cabeçalho do arquivo, não em cada linha.
_Avoid_: data de referência, período de apuração

**Lançamento**:
Os números realizados de uma empresa num período: saldo por nível, custo de materiais, CMV e receita. Não
confunda com o [[lançamento de razão]], que é uma linha do livro — este é o mês inteiro consolidado.
_Avoid_: registro, entrada, movimento

**Nível**:
A classificação contábil do estoque em MP, PP ou PA. Todo cálculo do modelo é feito por nível.
_Avoid_: categoria, tipo de estoque, estágio

**MP** (Matérias-Primas):
Material comprado e ainda não consumido na produção. Seu direcionador de custo é o custo de materiais.

**PP** (Produtos em Processo):
Produção em andamento. É opcional: muita indústria de alimentos tem processo curto e não registra PP —
o que não significa que não exista processo, apenas que ele está dentro de MP ou de PA.
_Avoid_: WIP, produto semiacabado, em elaboração

**PA** (Produtos Acabados):
Produto pronto aguardando venda ou expedição. Seu direcionador de custo é o CMV, igual ao de PP.

**Cenário**:
Um conjunto nomeado de premissas sobre o futuro de uma empresa, comparável a outros lado a lado.
_Avoid_: simulação, versão, hipótese

**Premissa**:
Um valor projetado que alimenta o cenário — PME estimado, método de projeção de custo, PMR, PMP, taxa de
perda. É a entrada do gestor sobre o futuro, distinta do lançamento, que é passado realizado.
_Avoid_: parâmetro, configuração, assumption

**Mapeamento de contas**:
A correspondência entre o plano de contas da empresa e os papéis do modelo — MP, PP, PA, CMV, receita,
contas de baixa. É por empresa e versionado, porque alterá-lo recalcula o histórico. Vale a **posse de
subárvore**: a conta mapeada responde por todos os seus descendentes, de modo que cada real do balancete é
contado por exatamente um mapeamento, ou por nenhum.
_Avoid_: de-para, classificação, tradução de contas

**Papel de conta**:
O que uma conta significa para o modelo: saldo de estoque de um nível, baixa de um nível, CMV ou receita.
Distinto do papel de coluna, que é o que o importador reconhece no cabeçalho do arquivo.
_Avoid_: tipo de conta, categoria, classificação

**Ignorada**:
A conta que o gestor olhou e declarou irrelevante — caixa, fornecedores, imobilizado. Leva a subárvore
junto, inclusive contas que apareçam nela depois.
_Avoid_: excluída, desativada, fora do escopo

**Sugestão**:
O papel que o produto propõe para uma conta ainda pendente, junto com o motivo que o sustenta. Proposta é
sempre proposta: nenhuma conta é classificada sem confirmação do gestor.
_Avoid_: palpite, classificação automática, sugestão automática

### Fontes de dados

**Balancete**:
O relatório contábil mensal com saldo anterior, movimento e saldo atual de cada conta. É a fonte dos saldos
de estoque, e o único artefato que toda PME brasileira produz todo mês, independentemente do ERP.
_Avoid_: extrato, relatório de estoque, fechamento

**Razão**:
O livro razão de uma conta: o detalhe dos lançamentos que compõem o movimento do período. É de onde sai o
consumo, e portanto o custo de materiais derivado — o balancete sozinho não os revela.
_Avoid_: extrato de conta, movimentação analítica

**Lançamento de razão**:
Uma linha do livro razão: data, histórico, valor a débito ou a crédito e, quando o ERP a exporta, a
contrapartida. Distinto do [[lançamento]], que é o mês consolidado de uma empresa.
_Avoid_: partida, movimento, item do razão

**Contrapartida**:
A conta do outro lado de um lançamento. É ela que separa consumo de devolução a fornecedor, e sem ela o
consumo não se deriva — nunca se aproxima.
_Avoid_: conta destino, conta de origem, contra-conta

**Conta sintética** / **Conta analítica**:
Sintética é a conta que agrega outras abaixo dela no plano de contas; analítica é a folha. Somar as duas
juntas conta o mesmo dinheiro duas vezes.
_Avoid_: conta pai / conta filha, totalizadora

**Perfil de importação**:
O layout de exportação já conhecido de um sistema de origem — codificação, delimitador, separador decimal,
posição do cabeçalho e papéis das colunas. Guardá-lo é o que faz o segundo cliente do mesmo ERP importar
sem configurar nada.
_Avoid_: template, mapeamento de arquivo, configuração de importação

**Diagnóstico**:
Um problema encontrado na leitura de um arquivo, sempre com o número da linha e o motivo. Linha inválida é
diagnosticada e listada, nunca aborta o lote nem é corrigida em silêncio.
_Avoid_: erro de validação, log, warning

### Medidas

**Estoque**:
O valor monetário do que está parado, por nível. Sempre em reais no nível agregado — o modelo não conhece
item, quantidade nem preço unitário.
_Avoid_: inventário, saldo de almoxarifado

**Estoque médio**:
A média entre o saldo de abertura e o de fechamento do período, degradando para o saldo de fechamento
quando não houver abertura. O relatório precisa dizer qual dos dois usou.
_Avoid_: saldo médio, média de estoque

**PME** (Prazo Médio de Estocagem):
Quantos dias de consumo o estoque de um nível representa. É a relação central do produto, usada nas duas
direções: apurada do histórico, e aplicada ao custo previsto para projetar o estoque futuro.
_Avoid_: giro em dias, prazo de estoque, cobertura de um nível, DIO

**CMV** (Custo das Mercadorias Vendidas):
O custo do que foi vendido no período. Direcionador de custo de PP e de PA.
_Avoid_: COGS, custo das vendas, custo de produção

**Consumo**:
O que saiu de um nível para fora dele no período, medido pelos créditos da conta no razão. Contém a perda,
e é assim que tem de ficar: o consumo lido do razão já a inclui, e descontá-la seria dupla contagem. É o
denominador do indicador de perda, e no caso de MP é o custo de materiais.
_Avoid_: saída, baixa, requisição, gasto

**Custo de materiais**:
O material consumido na produção no período. Não é linha de balancete nem de DRE: deriva-se do razão da
conta de MP pela identidade de saldo. Digitado à mão, corrompe o PME de MP sem que nada acuse.
_Avoid_: consumo de matéria-prima, custo de MP, gasto com material

**Compras**:
O que entrou em MP no período. Distinto do custo de materiais, que é o que saiu — confundir os dois inverte
o sinal da identidade de saldo.
_Avoid_: aquisições, entradas

**Produção**:
O que entrou em PA no período, ao custo da produção acabada. Sem quantidade e sem unidade.
_Avoid_: output, volume produzido

**Receita**:
O faturamento do período. Entra no modelo porque duas das perguntas do produto — estoque contra vendas e
necessidade de capital de giro — não se respondem só com custo e CMV.
_Avoid_: vendas, faturamento, revenue

**Cobertura**:
A soma dos PMEs dos níveis que a empresa movimenta: quantos dias o estoque total cobre. Nível ausente é
pulado, nunca somado como zero.
_Avoid_: PME total, dias de estoque

**Giro anualizado**:
Quantas vezes o estoque se renova em doze meses, medido como CMV de doze meses sobre estoque médio.
_Avoid_: rotatividade, turnover

**PMR** / **PMP**:
Prazo médio de recebimento e prazo médio de pagamento, em dias. São premissas informadas pelo gestor, não
apuração de contas a receber e a pagar.
_Avoid_: prazo de cobrança, prazo de fornecedor

**Ciclo financeiro**:
Cobertura mais PMR menos PMP: quantos dias o caixa fica descoberto entre pagar e receber.
_Avoid_: ciclo de caixa, cash conversion cycle

**NCG** (Necessidade de Capital de Giro):
Quanto dinheiro a operação exige parado para girar no ritmo atual.
_Avoid_: capital de giro, working capital

**Perda**:
A fração do consumo do período que virou baixa — avaria, quebra, validade. É medida das contas de baixa
mapeadas, nunca digitada, e nunca aplicada como correção sobre o consumo: o consumo lido do razão já a
contém. Como premissa de cenário, existe apenas como razão de rendimentos contra a perda medida da base.
_Avoid_: quebra, desperdício, shrinkage, índice de perda

**Teto de compras** / **Teto de produção**:
Quanto o caixa suporta comprar de material e produzir de acabado no período, em reais no nível agregado.
São limites financeiros: dizem **quanto**, nunca **o quê** nem **quando**, e o teto de produção não
verifica capacidade fabril.
_Avoid_: sugestão de compra, ordem de compra, pedido, plano de produção, necessidade de compra

**Backtesting**:
Reprojetar um período já realizado com os dados que existiam antes dele e comparar com o que aconteceu. É o
que mede se as premissas do produto funcionam para aquela empresa.
_Avoid_: validação, teste retroativo

### Estados que não são zero

Quatro ausências diferentes, que o modelo distingue de propósito porque informá-las como zero seria pior do
que não informar nada.

**Ausente**:
O nível que a empresa não movimenta — tipicamente PP. É decisão da empresa, não lacuna de dado.
_Avoid_: vazio, zerado, sem estoque

**Pendente**:
A conta que ninguém classificou ainda. Não é o mesmo que ignorada: nível com conta pendente sai
**indefinido**, nível sem conta alguma sai **ausente**, e confundir os dois esconde estoque atrás de uma
decisão que não foi tomada.
_Avoid_: não mapeada, sem classificação, nova

**Não medido**:
A perda de uma empresa sem conta de baixa mapeada. Ela deixa a quebra correr dentro do CMV; o produto não
sabe quanto foi.
_Avoid_: 0%, sem perdas, não informado

**Indefinido**:
O cálculo que não tem resposta neste período — PME com direcionador de custo zerado, por exemplo. Carrega
sempre o motivo.
_Avoid_: nulo, N/A, erro
