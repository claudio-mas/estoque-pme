# O estado da união é coluna, não padrão de nulos

As três uniões com estado do `Lancamento` — `SaldoDeNivel`, `ConsumoDeNivel` e `CustoDeMateriais` — são
gravadas como **coluna de estado em `text`, mais uma coluna anulável por campo de payload, mais um `CHECK` que
amarra as duas coisas**. O estado nunca é inferido de quais colunas estão nulas.

O `CHECK` não é acabamento: é o que torna esta forma superior à alternativa. Sem ele há duas fontes de verdade
— a coluna de estado e a ocupação das colunas de valor — livres para divergir, e aí gravar o estado é pior do
que não gravar. Ele amarra nos **dois sentidos**: `estado = 'lido'` exige o payload presente, `estado <>
'lido'` exige o payload nulo, e `estado = 'indefinido'` exige motivo. Unidirecional, deixaria representável a
linha `ausente` com um saldo órfão pendurado — o payload contradizendo o estado é exatamente a divergência que
este ADR existe para impedir.

## Por que não o estado implícito

Com o estado inferido do padrão de nulos, `ausente` e `indefinido` passam a diferir **apenas** por o `motivo`
estar preenchido. Um motivo perdido numa migração, ou uma string vazia vinda de um caminho descuidado,
converte em silêncio o nível que a empresa não movimenta (D6) no nível cuja conta ninguém classificou. É a
distinção que `tipos.ts` existe para tornar impossível, reintroduzida na fronteira de armazenamento — e o
banco é onde ela fica, porque o histórico sobrevive ao processo que o escreveu.

`SaldoDeNivel` agrava o caso sozinho: dentro de `lido`, `abertura` é legitimamente nula no primeiro período
(D5). "Nulo porque não há período anterior" e "nulo porque a variante não tem esse campo" caem na mesma
coluna, e só a coluna de estado os separa.

Some-se a isso o que o produto mais pergunta ao banco: **quais períodos e níveis estão indefinidos** — para o
aviso navegável, para o recálculo do RF-28 depois de editar o mapeamento, para o filtro do backtesting.
`where estado = 'indefinido'` é direto e indexável; o predicado composto equivalente tem de ser reescrito
igual em toda query e desanda na primeira que esquecer um termo. E o codec `linha → união` vira um `switch`
exaustivo que o compilador confere, em vez de uma função de inferência escrita à mão, que é onde um bug mora
para sempre. Essa consulta só existe porque o lançamento é materializado — ver ADR-0009.

Ganhar uma quarta variante também é assimétrico: com estado explícito é uma linha de `CHECK`; com estado
implícito, uma variante que ocupe as mesmas colunas de outra é irrepresentável, e só entra com backfill sobre
o histórico. Era esse o custo que fazia a decisão ser cara de reverter.

## `motivo` é código estruturado, não frase

Hoje `motivo` é `string` montada por interpolação — *"Em MP, o lançamento da linha 42, na conta 1.1.3.01, não
traz contrapartida."* Gravar isso faz o histórico carregar para sempre a redação de hoje, e deixa o **aviso
navegável** que o RF-28 e o RF-29 pedem sem para onde navegar: a conta está dentro da frase, não num campo.

`motivo` passa a ser **código mais campos** — `codigo`, `conta`, `nivel`, `linha` —, com os códigos numa união
fechada declarada no `motor-calculo`. O vocabulário é de domínio, não de importação: os códigos dizem *por que
um cálculo não tem resposta*, e nenhum deles fala de arquivo, coluna ou codificação. A frase em pt-BR é montada
no próprio motor, por `switch` exaustivo sobre a união — o que faz o compilador cobrar a tradução de todo
código novo.

Gravar frase **e** código seria duas fontes de verdade para o mesmo fato, dentro de uma coluna em vez de entre
duas. É o defeito que este ADR recusa, e vale recusá-lo também aqui.

## Onde a regra para: os outros anuláveis

O `Lancamento` tem quatro campos anuláveis que não são união em `tipos.ts`. Aplicar o princípio a todos seria
uniforme; aplicar a nenhum seria incoerente. A linha fica **onde o nulo carrega um estado com nome no
domínio**:

- **`perdas`** ganha coluna de estado. O nulo significa **não medido** (D7), um dos três estados que o
  `CONTEXT.md` nomeia, e `perdaMedida` já devolve `Perda = {medido} | {naoMedido}`: ele *é* união, achatada no
  armazenamento por acidente de como o `Lancamento` a guarda.
- **`cmv`** vira `NOT NULL`. A validação recusa produzir `Lancamento` sem CMV mapeado, então em linha gravada
  ele nunca é nulo — e o banco passa a registrar a invariante em vez de confiar nela.
- **`receita`** e **`compras`** ficam anuláveis simples. Cada um tem exatamente uma leitura, sem nome no
  glossário, e inventar estado para elas seria cerimônia.

## Alternativas recusadas

**JSONB com a união inteira.** Mata a consulta por estado, não ajuda a RLS em nada, e serializa `Centavos`
como número JSON — que é float, o oposto exato da regra de dinheiro em `bigint`.

**`enum` do Postgres em vez de `text` + `CHECK`.** São conjuntos pequenos, fechados e espelhados de uniões
TypeScript, que podem ganhar variante: `alter type … add value` carrega atrito de migração que o `CHECK` não
tem, e remover um valor de enum simplesmente não existe.

**Colapsar `ConsumoDeNivel`**, que tem só duas variantes, em "`valor` nulo é indefinido". Perde o `motivo`,
que é o ADR-0005 inteiro — a razão de não saber é o que o aviso mostra —, e quebra o padrão único de codec das
três uniões em troca de uma coluna.

## Consequências

**Dinheiro é `bigint` (int8), com Drizzle em `mode: 'bigint'`.** O `mode: 'number'` é a armadilha silenciosa:
devolve `number`, e a regra de centavos morre na fronteira onde ninguém olha. `numeric` funciona e acrescenta
uma conversão a mais para errar.

**Nível ausente é linha explícita.** Toda competência importada grava os três níveis. Ausência de linha
significaria três coisas ao mesmo tempo — nível ausente, período não importado, importação interrompida — e a
chave do RF-05 deixaria de distinguir "reimportei e agora tem menos linhas" de "apaguei sem querer".

**A divisão em tabelas cai da chave do RF-05.** `estoque`, `consumo` e `perdas` são `Record<Nivel, …>`: são a
linha por `(empresa, competência, nível)`, que é a chave idempotente. `cmv`, `receita`, `compras` e
`custoMateriais` são por período e moram na tabela `periodo` (ADR-0009). A união com estado ocupa três ou
quatro colunas com prefixo em cada caso.

**`divergencia` do `CustoDeMateriais` não se grava** — ou é coluna gerada a partir de `valor` e `informado`,
ou não existe. O comentário do próprio tipo diz por quê: dois campos paralelos divergem.

**`Pme`, `Perda` e `Cobertura` não se persistem.** São derivados do **lançamento**, e recalculá-los é barato.
O lançamento, por outro lado, é derivado do **arquivo** e é persistido — a distinção está no ADR-0009.
