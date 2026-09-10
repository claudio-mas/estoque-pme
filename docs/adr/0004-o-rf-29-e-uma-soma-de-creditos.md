# O RF-29 é uma soma de créditos, não a fórmula que o PRD escreve

O RF-29 define `Custo_Materiais = MP_inicial + Compras − MP_final`. A implementação **não usa essa fórmula**,
e um leitor que compare os dois vai achar que o código está errado. Não está: as duas expressões são a mesma
coisa, e a segunda é mais curta.

A identidade de saldo de uma conta do ativo é `MP_final = MP_inicial + Σdébitos − Σcréditos`. Tomando
`Compras = Σdébitos` e substituindo:

```
Custo_Materiais = MP_inicial + Σdéb − (MP_inicial + Σdéb − Σcréd) = Σcréditos
```

Os saldos e as compras se cancelam. **A derivação inteira colapsa em "some os créditos da conta de MP"**, e
nem lê os saldos.

## Consequências

A dificuldade do RF-29 nunca esteve na aritmética — está em decidir **quais créditos contam**. Um crédito de
MP pode ser consumo para produção, baixa por perda, transferência interna ou devolução a fornecedor, e os
dois últimos não são consumo. É por isso que o trabalho real do requisito está na classificação por
contrapartida (`packages/mapeamento/src/consumo.ts`) e não numa fórmula.

Não escreva a fórmula do PRD no código para "bater com o requisito": ela exigiria ler `MP_inicial` e
`MP_final` do balancete e `Compras` do razão para chegar a um número que os créditos já dão sozinhos, e
introduziria três oportunidades de erro onde havia uma.

`Compras` continua sendo computada — mas para o NCG (D2), que a recebe como entrada, não para o custo de
materiais.
