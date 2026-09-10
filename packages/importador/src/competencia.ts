/**
 * A competência do balancete vem do cabeçalho do relatório, não das linhas.
 *
 * Nenhuma linha de balancete traz data: o documento inteiro é de um mês. Se a
 * competência não for lida daqui, ela tem que ser perguntada — e não há chave
 * `período + nível` para a importação idempotente do RF-05 sem ela.
 */
import { normalizar } from './texto';
import type { Competencia } from './tipos';

const MESES: Readonly<Record<string, number>> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const ANO_MINIMO = 1990;
const ANO_MAXIMO = 2100;

/**
 * Extrai a competência do preâmbulo.
 *
 * Quando o cabeçalho traz um intervalo — "Período: 01/08/2025 a 31/08/2025" —
 * vale a data **final**. Um balancete de 01/08 a 31/08 é o balancete de agosto,
 * e usar a data inicial acerta nesse caso mas erra no fechamento que abre no
 * último dia do mês anterior.
 */
export function detectarCompetencia(preambulo: readonly string[]): Competencia | null {
  const texto = preambulo.join(' \n ');

  const datas = [...texto.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)];
  const ultima = datas.at(-1);
  if (ultima) {
    const mes = Number(ultima[2]);
    const ano = Number(ultima[3]);
    if (valida(ano, mes)) return { ano, mes };
  }

  const mesAno = [...texto.matchAll(/\b(\d{1,2})\/(\d{4})\b/g)].at(-1);
  if (mesAno) {
    const mes = Number(mesAno[1]);
    const ano = Number(mesAno[2]);
    if (valida(ano, mes)) return { ano, mes };
  }

  // `normalizar` já trocou acento e pontuação por espaço: "AGOSTO/2025" chega
  // aqui como "agosto 2025", e "Março de 2025" como "marco de 2025".
  const porNome = /\b([a-z]+)\s+(?:de\s+)?(\d{4})\b/.exec(normalizar(texto));
  if (porNome) {
    const mes = MESES[porNome[1] as string];
    const ano = Number(porNome[2]);
    if (mes !== undefined && valida(ano, mes)) return { ano, mes };
  }

  return null;
}

function valida(ano: number, mes: number): boolean {
  return mes >= 1 && mes <= 12 && ano >= ANO_MINIMO && ano <= ANO_MAXIMO;
}
