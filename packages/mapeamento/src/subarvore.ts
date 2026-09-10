/**
 * Posse de subárvore (ADR-0002).
 *
 * A invariante inteira cabe numa frase: **cada real do balancete é contado por
 * exatamente um mapeamento, ou por nenhum.** A conta mapeada responde por todos
 * os seus descendentes, e mapear um descendente de conta já mapeada é erro, não
 * aviso — aviso ignorado vira PME errado sem nada acusar.
 */

/**
 * Os separadores de grau do plano de contas, iguais aos que o importador usa
 * para calcular `grau` e marcar `sintetica`. Divergir deles aqui faria o
 * mapeamento enxergar uma hierarquia diferente da que a leitura enxergou.
 */
const SEPARADORES_DE_GRAU = /[.\-/]/;

/**
 * Verdadeiro quando `codigo` desce de `ancestral` no plano de contas.
 *
 * A comparação exige separador logo depois do prefixo, e é isso que impede
 * `1.1.30` de ser lida como filha de `1.1.3` — prefixo de texto puro erraria,
 * e erraria justamente no caso em que o plano de contas tem mais de nove contas
 * num grupo, que é o caso comum.
 */
export function descendeDe(codigo: string, ancestral: string): boolean {
  if (ancestral === '' || codigo.length <= ancestral.length) return false;
  return codigo.startsWith(ancestral) && SEPARADORES_DE_GRAU.test(codigo.charAt(ancestral.length));
}

/** Verdadeiro quando `codigo` é o próprio `ancestral` ou desce dele. */
export function pertenceA(codigo: string, ancestral: string): boolean {
  return codigo === ancestral || descendeDe(codigo, ancestral);
}

/** O código do pai imediato, ou `null` na raiz. */
export function paiDe(codigo: string): string | null {
  const partes = codigo.split(SEPARADORES_DE_GRAU);
  if (partes.length <= 1) return null;
  return codigo.slice(0, codigo.length - (partes[partes.length - 1] as string).length - 1);
}

/**
 * Os códigos que não descendem de nenhum outro da mesma lista.
 *
 * É o que evita a dupla contagem quando o arquivo traz a sintética e as
 * analíticas: somar `1.1.3` junto de `1.1.3.01` contaria o mesmo dinheiro duas
 * vezes, e somar só as analíticas quebraria no ERP que exporta apenas até o
 * grau sintético. Ficar com os topos resolve os dois de uma vez.
 */
export function topos(codigos: readonly string[]): string[] {
  return codigos.filter(
    (codigo) => !codigos.some((outro) => outro !== codigo && descendeDe(codigo, outro)),
  );
}
