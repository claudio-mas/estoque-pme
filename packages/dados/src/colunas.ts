/**
 * Os grupos de colunas que repetem, e os `CHECK` que os amarram.
 *
 * Toda união com estado do domínio vira o mesmo desenho (ADR-0008): uma coluna
 * de estado em `text`, uma coluna anulável por campo de payload, e um `CHECK`
 * **bicondicional** — o estado exige o payload dele presente, e proíbe o dos
 * outros. Unidirecional deixaria representável a linha `ausente` com um saldo
 * órfão pendurado, que é a divergência que gravar o estado existe para impedir.
 *
 * Escrever isso à mão em cada tabela seria escrever a mesma regra cinco vezes,
 * e regra repetida diverge na primeira correção. Aqui ela é uma função.
 */
import { sql } from 'drizzle-orm';
import { bigint, integer, text } from 'drizzle-orm/pg-core';

/**
 * Dinheiro: `bigint` (int8) em centavos, nunca `numeric` nem float.
 *
 * `mode: 'bigint'` é o que mantém a regra viva na fronteira — `mode: 'number'`
 * devolveria `number` e a converteria em promessa.
 */
export const centavos = (nome: string) => bigint(nome, { mode: 'bigint' });

/** As colunas de uma `Ancora`, prefixadas. */
export function colunasDeAncora<P extends string>(p: P) {
  return {
    [`${p}_tipo`]: text(`${p}_tipo`),
    [`${p}_linha`]: integer(`${p}_linha`),
    [`${p}_coluna`]: text(`${p}_coluna`),
    [`${p}_conta`]: text(`${p}_conta`),
    [`${p}_nivel`]: text(`${p}_nivel`),
  } as const;
}

/**
 * O `CHECK` da âncora, bicondicional em todas as variantes.
 *
 * A âncora recebe o mesmo tratamento das uniões do `Lancamento` e não JSONB,
 * apesar de aparecer em toda linha de diagnóstico: o ADR-0008 recusou JSONB por
 * nome, e abrir exceção para o tipo que mais aparece esvaziaria a regra
 * justamente onde ela mais trabalha.
 *
 * `opcional` deixa a âncora inteira nula — é o caso do motivo de uma variante
 * que não tem motivo, onde a coluna de tipo também é nula.
 */
export function checkDeAncora(p: string, opcional = false) {
  const nulo = (c: string) => sql.raw(`${p}_${c} is null`);
  const naoNulo = (c: string) => sql.raw(`${p}_${c} is not null`);
  const tipo = sql.raw(`${p}_tipo`);

  const vazia = opcional
    ? sql`(${tipo} is null and ${nulo('linha')} and ${nulo('coluna')} and ${nulo('conta')} and ${nulo('nivel')}) or `
    : sql``;

  return sql`${vazia}(${tipo} in ('arquivo', 'mapeamento') and ${nulo('linha')} and ${nulo('coluna')} and ${nulo('conta')} and ${nulo('nivel')})
    or (${tipo} = 'linha' and ${naoNulo('linha')} and ${nulo('conta')} and ${nulo('nivel')})
    or (${tipo} = 'conta' and ${naoNulo('conta')} and ${nulo('linha')} and ${nulo('coluna')})
    or (${tipo} = 'nivel' and ${naoNulo('nivel')} and ${nulo('linha')} and ${nulo('coluna')} and ${nulo('conta')})
    or (${tipo} = 'lancamento' and ${naoNulo('conta')} and ${naoNulo('linha')} and ${nulo('coluna')} and ${nulo('nivel')})`;
}

/** As colunas de um `Motivo`: o código mais a âncora dele. */
export function colunasDeMotivo<P extends string>(p: P) {
  return {
    [`${p}_codigo`]: text(`${p}_codigo`),
    ...colunasDeAncora(`${p}_ancora`),
  } as const;
}

/**
 * O `CHECK` de um motivo opcional: ou há código **e** âncora, ou não há nada.
 *
 * Código sem âncora seria aviso sem para onde navegar — o defeito que o
 * ADR-0008 nomeia; âncora sem código seria payload órfão.
 */
export function checkDeMotivo(p: string) {
  const codigo = sql.raw(`${p}_codigo`);
  const tipo = sql.raw(`${p}_ancora_tipo`);
  return sql`((${codigo} is null and ${tipo} is null) or (${codigo} is not null and ${tipo} is not null))
    and (${checkDeAncora(`${p}_ancora`, true)})`;
}

/** Competência: o ano e o mês, nunca uma data — o modelo é mensal. */
export const colunasDeCompetencia = {
  ano: integer('ano').notNull(),
  mes: integer('mes').notNull(),
} as const;

export const checkDeCompetencia = sql`mes between 1 and 12 and ano between 1900 and 2999`;
