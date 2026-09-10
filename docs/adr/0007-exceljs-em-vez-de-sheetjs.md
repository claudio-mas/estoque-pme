# ExcelJS em vez de SheetJS para ler planilha

A tabela de stack do `CLAUDE.md` dizia "Read spreadsheets: SheetJS", com a ressalva de conferir canal de
distribuição e CVEs na instalação. A conferência foi feita e **inverteu a escolha**: lemos XLSX com
**ExcelJS**.

O pacote `xlsx` do npm está parado em **0.18.5** e carrega duas vulnerabilidades sem correção publicada lá:
[CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533) (prototype pollution *via arquivo criado
para isso*) e [CVE-2024-22363](https://cdn.sheetjs.com/advisories/CVE-2024-22363) (ReDoS). As correções
existem — 0.19.3 e 0.20.2 — mas só em `cdn.sheetjs.com`, fora do npm.

A primeira CVE é decisiva porque descreve **o nosso modelo de ameaça**: este produto existe para ingerir o
arquivo que o cliente exportou do ERP dele. "Arquivo hostil chega ao parser" não é hipótese remota aqui, é o
caso de uso.

## Alternativas recusadas

**Tarball de `cdn.sheetjs.com`** no `package.json`. Funciona, e prende a integridade do lockfile a um CDN
fora do registro — cada `npm ci` passa a depender de um host que não é o do ecossistema.

**Espelho de terceiro no npm** (`@e965/xlsx`). Troca uma cadeia de suprimento por outra, com um republicador
a mais no caminho.

**Ler XLSX à mão** com `fflate` mais parsing de XML. Uma dependência minúscula e mantida, mas trocaria um
advisory contido pela nossa própria superfície de bug em descompressão, XML e data serial — bugs no exato
caminho que processa arquivo não confiável.

## Consequências

ExcelJS já estava na stack para **escrever** XLSX (RF de exportação), então isto é **uma** dependência em vez
de duas, e um modelo mental só.

O custo: 98 pacotes transitivos, e `npm audit` acusa um advisory *moderate* em `uuid` — falta de checagem de
limites em `v3/v5/v6` quando `buf` é passado. ExcelJS usa `uuid` v4 na escrita e não passa `buf`, então o
caminho não é executado por nós. **Não aplique o `npm audit fix`**: a correção que ele propõe é rebaixar
ExcelJS para 3.4.0, um major para trás.

ExcelJS não lê `.xls` binário legado, e SheetJS lia. Aceito: o D3 manda ingerir o que o ERP exporta, e o ERP
que só produz `.xls` também produz CSV — o caminho é pedir CSV, não trocar de biblioteca.

`packages/importador/src/planilha.ts` é o **único** módulo do pacote com dependência de runtime e com função
`async`. Os tipos que ele produz moram em `aba.ts`, sem dependência, para que `balancete.ts` e `razao.ts` os
usem sem arrastar o ExcelJS junto: quem só lê CSV não carrega o leitor de XLSX.
