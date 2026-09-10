# Contrapartida ausente ou não mapeada não deriva consumo

Um crédito da conta de MP só é consumo dependendo do outro lado do lançamento: contrapartida em outro nível
de estoque é consumo, em conta de baixa também (a perda **fica** dentro do consumo, D7), em fornecedor é
devolução e não é. Quando a contrapartida não vem no arquivo, ou vem e não está mapeada, **o consumo do
nível fica indefinido com motivo** — não se deriva com o que há.

O RF-29 existe porque o custo de materiais digitado à mão *"erra o PME de MP e contamina o teto de compra sem
que nada acuse"*. A doença é o erro silencioso. Derivar com contrapartida desconhecida trocaria um erro
silencioso por outro: incluir tudo infla o consumo de quem tem devolução, excluir o desconhecido o subestima
quando a conta não mapeada era uma conta de perda. Os dois erros são invisíveis, e o consumo alimenta o
`PME_MP` e o teto de compras.

## Alternativas recusadas

**Um limiar** — indefinido só se o valor pendente passar de x% do movimento. É a mais tentadora e a pior:
transformaria uma invariante em heurística, e o valor pendente é pequeno em reais exatamente quando é uma
conta de perda — pequeno no total, decisivo no indicador.

**Classificar pelo histórico**, com um léxico como o do RF-28. O histórico de razão brasileiro é escrito por
humano e varia por lançamento; o léxico do mapeamento funciona porque descrição de conta é estável, e essa
premissa não se repete aqui.

## Consequências

A assimetria com as **compras** é deliberada. A lista dos créditos que contam é fechada, então não saber a
contrapartida impede concluir. A lista dos débitos que são compra é aberta — é compra tudo que não vem de
outro nível de estoque —, então a falta de contrapartida não impede nada: sem contrapartida, todo débito é
compra. Isso também evita exigir que fornecedores seja mapeado, quando ele quase sempre estará `ignorada`.

A conta cuja contrapartida não está mapeada entra na lista de pendências do RF-28 como qualquer outra. É a
mesma máquina, e o mesmo princípio de três lugares: pendente não é ausente, e ausente não é zero.
