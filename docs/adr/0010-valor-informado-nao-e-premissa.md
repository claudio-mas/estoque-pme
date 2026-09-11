# Valor informado não é premissa

O custo de materiais digitado pelo gestor (`CustoDeMateriais.informado`, ADR-0006) **não fica na linha do
lançamento**. Ele é entrada humana, cai na convenção de auditoria do projeto, e vai para tabela própria
`(empresa, competência, campo, valor)`, append-only, com `campo` como união fechada — hoje com um membro só.

Chamá-lo de **premissa** seria erro de vocabulário. O `CONTEXT.md` define premissa como *"a entrada do gestor
sobre o futuro, distinta do lançamento, que é passado realizado"*, e ela existe para ser comparada lado a lado
entre cenários. O custo de materiais de agosto não é comparável entre cenários: ele é um só, e ou está certo
ou está errado. Alargar *premissa* para cobrir os dois apagaria a distinção que faz o `Cenário` existir.

O termo novo é **valor informado**: número que o gestor digita sobre um período já realizado, quando o arquivo
não o traz.

## O bug que isto evita

O RF-05 manda a reimportação **substituir** pela chave `período + nível`. Com o valor informado morando na
linha do lançamento, reimportar agosto apagaria o que o gestor digitou — ou obrigaria cada importação a
preservar seletivamente certas colunas, que é a regra que alguém esquece na segunda vez que mexe no código.

Separado, a idempotência fica trivial: **a importação só toca no que veio do arquivo.** O lançamento resolve
razão e digitado na hora de materializar (ADR-0009), e carrega a origem dentro do próprio `CustoDeMateriais`.

## Consequências

A tabela genérica por `campo` custa quase nada agora e evita uma tabela nova a cada número que o gestor puder
informar depois. `campo` é união fechada e não `text` livre pelo mesmo motivo que os códigos de motivo o são
(ADR-0008): nomeia grandeza de domínio, e conjunto fechado é o que faz o compilador cobrar tratamento quando
entrar a segunda — enquanto `text` livre transforma erro de digitação em linha órfã que ninguém vê.

O valor informado é uma das dependências que o lançamento versiona (ADR-0009): editá-lo defasa **um** período,
não o histórico inteiro.
