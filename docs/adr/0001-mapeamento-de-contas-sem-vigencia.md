# O mapeamento de contas não tem vigência

O RF-28 exige que o mapeamento seja editável, auditável e que alterá-lo recalcule o histórico afetado —
requisitos que num produto organizado por competência sugerem naturalmente um mapeamento com vigência, cada
versão valendo de um período em diante. **Decidimos não ter vigência**: existe um único mapeamento corrente
por empresa, versionado apenas como trilha de auditoria, e editá-lo recalcula todo o histórico.

O motivo é a forma do dado. O mapeamento é um conjunto de entradas `código → papel`, não uma configuração por
período. Quando a empresa reestrutura o plano de contas e `1.1.3.01` vira `1.1.03.001`, os códigos antigos
continuam existindo nos arquivos antigos e os novos entram como pendentes — **o mesmo mapeamento cobre as duas
eras simultaneamente**, sem precisar de eixo temporal. A vigência só seria necessária se um mesmo código
significasse coisas diferentes em épocas diferentes, isto é, no reaproveitamento de código encerrado.

## Consequências

O reaproveitamento de código é o único caso que esta decisão não cobre por construção, e é justamente por isso
que o mapeamento guarda a descrição da conta vista no momento da confirmação: descrição divergente para o mesmo
código gera aviso de "conta renomeada ou reaproveitada". Esse aviso é o alarme que substitui a vigência, e
custa um campo em vez de um eixo temporal atravessando o modelo inteiro.

Se o aviso começar a disparar por reaproveitamento real e não por renomeação cosmética, esta decisão deve ser
reaberta — a vigência passa a ser a resposta certa a partir daí.
