# Posse de subárvore no mapeamento de contas

O balancete traz conta sintética e conta analítica na mesma lista, e somar as duas conta o mesmo dinheiro duas
vezes. Decidimos que **o gestor pode mapear em qualquer grau, e a conta mapeada possui toda a sua subárvore**:
mapear `1.1.3` exclui `1.1.3.01`, `1.1.3.02` e `1.1.3.03` da soma, e mapear um descendente de conta já mapeada
é erro de validação, não aviso. A regra vale igualmente para o estado `ignorada` — ignorar `1.1.1` ignora tudo
abaixo, inclusive conta nova que apareça lá depois.

A invariante numa frase: **cada real do balancete é contado por exatamente um mapeamento, ou por nenhum.**

## Alternativas recusadas

**Só conta analítica.** Mais limpo, e errado na prática por dois motivos: existe ERP que exporta o balancete
apenas até o grau sintético, o que tornaria a importação impossível, e existe empresa cujo grupo `1.1.3`
inteiro *é* matéria-prima, para a qual descer à folha inventa trabalho sem produzir informação.

**Qualquer grau, com aviso na sobreposição.** Transforma uma invariante em aviso, e aviso ignorado vira PME
errado sem nada acusar. A sobreposição é verificável a partir do código sozinho; não há razão para tolerá-la.

## Consequências

A regra governa quatro lugares — a validação do mapeamento, a aplicação sobre o balancete, a propagação do
estado `ignorada` e a entrada de conta nova — e é por estar espalhada que ela mora aqui e não num comentário.

A validação roda **duas vezes**: quando o gestor salva, que é onde a mensagem boa é dada, e de novo na
aplicação, porque o mapeamento volta do banco a cada importação e pode ter sido gravado por uma versão
anterior do código.
