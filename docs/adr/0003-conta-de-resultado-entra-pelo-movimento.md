# Conta de resultado entra pelo movimento, não pelo saldo

Contas de estoque entram no `Lançamento` pelos dois saldos, porque o PME quer a média entre abertura e
fechamento (D5). **CMV e receita entram pelo movimento do período — `débito − crédito` — e nunca pelo saldo.**

O saldo de uma conta de resultado no balancete depende de convenção do ERP: uns zeram a conta todo mês, outros
acumulam no exercício, e em setembro o saldo do segundo é janeiro a setembro. Não há como distinguir os dois
olhando um arquivo só. Ler o saldo de um ERP acumulador como se fosse o mês infla o CMV em cerca de nove vezes
e destrói o PME de PP e de PA, que têm o CMV como direcionador de custo — silenciosamente, porque o número
continua parecendo dinheiro.

Ler o movimento faz o problema **desaparecer** em vez de ser configurado: nas duas convenções, o movimento do
período é o movimento do período.

## Consequências

`ColunasBalancete` admite `debito` e `credito` nulos — há arquivo real sem colunas de movimento. Nesse caso a
leitura cai para `saldoAtual − saldoAnterior`, que é algebricamente a mesma coisa num balancete íntegro e
funciona nas duas convenções, inclusive na virada de exercício.

Quando as duas fontes existem e discordam, o arquivo está torto: prevalece `débito − crédito`, que é o número
que o contador escreveu, e a divergência vira diagnóstico. A queda para a diferença de saldos é caminho de
exceção, nunca preferência.

Esta decisão muda todo número já calculado a partir de um balancete, o que a torna cara de reverter depois de
haver histórico gravado.
