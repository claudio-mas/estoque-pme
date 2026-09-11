# Conta pendente vence a declaração de ausência

Uma empresa pode declarar que não movimenta um nível (`niveisAusentes`, D6). Mas se houver no balancete uma
conta **pendente** que o produto proporia como aquele nível, **o pendente ganha**: o nível sai `indefinido`,
não `ausente`.

Um leitor de `niveisEmDuvida` vê a declaração explícita do gestor sendo sobrepujada por uma heurística de
léxico e conclui, razoavelmente, que é bug. Não é.

## Por quê

Declarar PP ausente **enquanto** uma conta chamada "PRODUTOS EM PROCESSO" está sem classificar não é uma
ausência — é uma contradição. As duas leituras possíveis são ambas plausíveis: o gestor pode ter esquecido de
classificar a conta, ou pode ter declarado a ausência antes de ela aparecer no plano de contas. Escolher a
declaração significaria reportar `ausente` — *"a empresa não movimenta PP"* — com dinheiro visível numa conta
de PP no mesmo arquivo.

Isso é o erro que a D6 nomeia ao contrário: nível ausente não é zero, e nível **contraditório** não é ausente.
`indefinido` carrega o motivo (`nivel-incompleto`, ancorado na conta), então a tela tem o que mostrar e o que
abrir. `ausente` não carrega nada — ele encerra o assunto.

A saída existe e não é contorno: **ignorar a conta**. Ignorar é o gestor dizendo que olhou e ela não
interessa, que é exatamente a informação que falta para a ausência deixar de ser ambígua. Uma tela que
apresente a declaração de ausência deve oferecer isso junto.

## Alternativa recusada

**A declaração vence.** É defensável — a declaração é explícita, a sugestão é heurística — e foi recusada
porque o custo dos dois erros é assimétrico. Errar para `indefinido` custa ao gestor um clique para ignorar a
conta. Errar para `ausente` esconde estoque, e o esconde de forma que nada no relatório acusa: o nível some da
cobertura como se não existisse.

## Consequências

Muda linhas gravadas: o lançamento é materializado, então inverter isto reescreve o estado do nível em todo
período afetado no próximo recálculo. Não é uma troca de `if`.

Afeta só o pendente que **sugere** aquele nível, ou que divide o pai imediato com contas classificadas dele.
Conta pendente sem relação com o nível — "CAIXA" pendente e PP declarado ausente — não o contamina.
