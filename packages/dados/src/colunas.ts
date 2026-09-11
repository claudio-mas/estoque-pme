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
import { bigint, integer } from 'drizzle-orm/pg-core';

/**
 * Dinheiro: `bigint` (int8) em centavos, nunca `numeric` nem float.
 *
 * `mode: 'bigint'` é o que mantém a regra viva na fronteira — `mode: 'number'`
 * devolveria `number` e a converteria em promessa.
 */
export const centavos = (nome: string) => bigint(nome, { mode: 'bigint' });

/**
 * As colunas de âncora e de motivo são escritas **explicitamente** em cada
 * tabela, e não geradas por helper.
 *
 * A tentação era óbvia — cinco colunas repetidas em cinco lugares —, mas um
 * helper com chave computada devolve `{ [x: string]: ... }`, e isso apaga o
 * tipo de inserção da tabela inteira: `.values()` passa a aceitar qualquer
 * coisa, e um nome de coluna errado compila. Trocar checagem de tipo por trinta
 * linhas a menos é mau negócio num pacote cuja razão de existir é o banco
 * registrar invariantes.
 *
 * O que **fica** em função é o `CHECK` — a regra que precisa ser a mesma em
 * todo lugar. As colunas são declaração; a regra é lógica.
 */

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
