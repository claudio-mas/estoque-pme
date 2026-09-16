/**
 * Balancete ou razão? Decide-se pelo cabeçalho, por pontuação.
 *
 * Primeiro acerto não serve: o reconhecedor de balancete aceita um cabeçalho de
 * razão — "Histórico" cai em descrição, "Saldo" em saldo atual — e o de razão
 * aceita um de balancete, que também tem débito e crédito. Cada um pontua
 * quantos papéis reconheceu; o artefato é o que reconhece **mais**. Sobre um
 * cabeçalho de balancete típico, o balancete faz 6 e o razão 4; sobre um de
 * razão, o inverso.
 *
 * É a promessa do D3 aplicada mais uma vez: o gestor não escolhe o que o
 * produto responde melhor. E é a mesma pergunta que já decidiu delimitador,
 * decimal e formato do razão.
 */
import { reconhecerCabecalho } from './colunas';
import { reconhecerCabecalhoDeRazao } from './colunas-razao';
import { vazio, type RegistroCsv } from './csv';

export type Artefato = 'balancete' | 'razao';

/** Até onde procurar o cabeçalho antes de desistir. Preâmbulo de ERP é curto. */
const LINHAS_ATE_O_CABECALHO = 40;

export interface ArtefatoDetectado {
  readonly artefato: Artefato;
  /** Papéis reconhecidos pelo vencedor — quanto maior, menos ambíguo. */
  readonly nota: number;
  readonly notaDoOutro: number;
}

/**
 * O artefato de um arquivo já lido em registros, ou `null` se nenhum
 * reconhecedor aceita cabeçalho algum — arquivo que não é nem um nem outro.
 * Empate favorece o balancete: é o artefato obrigatório e o mais comum.
 */
export function detectarArtefato(registros: readonly RegistroCsv[]): ArtefatoDetectado | null {
  let balancete = 0;
  let razao = 0;
  const ate = Math.min(registros.length, LINHAS_ATE_O_CABECALHO);

  for (let i = 0; i < ate; i += 1) {
    const registro = registros[i] as RegistroCsv;
    if (vazio(registro)) continue;
    balancete = Math.max(balancete, reconhecerCabecalho(registro.campos)?.nota ?? 0);
    razao = Math.max(razao, reconhecerCabecalhoDeRazao(registro.campos)?.nota ?? 0);
  }

  if (balancete === 0 && razao === 0) return null;
  return balancete >= razao
    ? { artefato: 'balancete', nota: balancete, notaDoOutro: razao }
    : { artefato: 'razao', nota: razao, notaDoOutro: balancete };
}
