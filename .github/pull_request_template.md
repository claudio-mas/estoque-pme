<!--
Título: imperativo e concreto, no estilo dos commits do repo —
"Mapeamento de contas: a conta do cliente vira papel do modelo".
Seções que não se aplicam: apague a seção, não escreva "n/a".
-->

## O que muda, e por quê

<!-- Duas ou três frases. O "por quê" é a parte que a revisão não consegue reconstruir do diff. -->

## Decisões

<!--
- ADR novo? Link e a frase que o resume.
- Contradiz alguma decisão registrada (D1–D11 no CLAUDE.md, ou um ADR)? Diga qual e por quê vale reabrir.
- Escolha cara de reverter que ficou só no código? Provavelmente devia ser ADR.
Sem decisão nova: apague a seção.
-->

## O que ficou deliberadamente de fora

<!--
O que foi cortado do escopo e o motivo. Escopo reduzido em silêncio é o que
transforma revisão em arqueologia.
-->

## Vocabulário

<!--
Termo novo do domínio? Entrou no CONTEXT.md? Se um termo do glossário mudou de
sentido, diga — o glossário é contrato, não anotação.
-->

## Verificação

- [ ] `npm run typecheck` limpo
- [ ] `npm test` verde — **N** testes
- [ ] Ausência continua não sendo zero: nível ausente, não medido e indefinido seguem distintos
- [ ] Dinheiro continua `bigint` centavos, nunca float

<!-- Rodar do diretório raiz, e no Windows pelo PowerShell: npm chama cmd.exe, que não herda o PATH do Git Bash. -->

## O que olhar na revisão

<!--
Aponte o trecho que você mesmo revisaria duas vezes, e o que te deixou em
dúvida. É mais útil do que um resumo do diff.
-->
