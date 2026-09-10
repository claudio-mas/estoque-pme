# O razão é opcional, e o custo de materiais digitado carrega aviso permanente

Sem o razão da conta de MP, o custo de materiais não existe: não é linha de balancete nem de DRE. Com ele
vão junto o `PME_MP`, o teto de compras (RF-26) e metade do indicador de perda (RF-13). Ainda assim o razão
é **opcional**: o gestor pode digitar o custo de materiais, e o produto funciona.

Exigi-lo empurraria contra a meta de 30 minutos de onboarding, e o cliente que não consegue exportar o razão
no primeiro dia perderia o nível MP inteiro — não um indicador, o nível. O RF-29 já pressupõe o caminho
manual quando fala em *"confrontá-lo com o valor informado quando houver os dois"*.

**O preço de aceitar esse caminho é o aviso permanente.** O RF-29 diz que o número digitado à mão *"erra o
PME de MP e contamina o teto de compra sem que nada acuse"*; se o caminho manual é aceito, o "sem nada
acusar" tem de deixar de ser verdade. O aviso não é decoração — é o que paga pela decisão.

## Consequências

Quando existem os dois, prevalece o derivado e o digitado vira `conferido`, com a divergência à vista para
comparação com o limite do RF-29 (padrão 2%, constante nomeada e sobrescrevível). O derivado ganha porque sai
da identidade de saldo; o digitado sai da memória de alguém.

A origem viaja **dentro** do `CustoDeMateriais`, não num campo paralelo, pelo mesmo motivo que `Pme` carrega
`base`: o relatório precisa dizer qual origem usou, e dois campos separados podem divergir.

O `Lançamento` guarda `consumo.MP` e `custoMateriais` ao mesmo tempo, e a redundância é o ponto: o primeiro é
o que o razão disse, o segundo é o que o produto decidiu usar.
