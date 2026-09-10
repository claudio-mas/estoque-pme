/**
 * Reconhecimento das colunas do razão.
 *
 * Mesma regra do balancete — ordem por comprimento do rótulo e atribuição
 * gulosa —, sinônimos diferentes. O que muda de verdade é o mínimo aceitável:
 * o balancete não existe sem código e saldo atual; o razão não existe sem
 * **valor**, e valor pode chegar de duas formas, débito e crédito separados ou
 * uma coluna só com a natureza D/C ao lado.
 */
import { atribuirPapeis, paresDe } from './colunas';
import type { ColunasRazao } from './tipos';

export type PapelDeColunaRazao = keyof ColunasRazao;

const SINONIMOS: Readonly<Record<PapelDeColunaRazao, readonly string[]>> = {
  conta: ['codigo da conta', 'codigo conta', 'classificacao', 'conta', 'cta', 'reduzido'],
  data: ['data do lancamento', 'data lancamento', 'data', 'dt'],
  historico: ['historico completo', 'complemento', 'historico', 'descricao', 'hist'],
  debito: ['valor debito', 'debitos', 'debito', 'deb'],
  credito: ['valor credito', 'creditos', 'credito', 'cred'],
  valor: ['valor do lancamento', 'vl lancamento', 'valor', 'montante'],
  natureza: ['natureza', 'd c', 'dc', 'tipo'],
  contrapartida: [
    'conta contrapartida',
    'contra partida',
    'contrapartida',
    'conta contra',
    'partida',
  ],
  saldo: ['saldo acumulado', 'saldo corrente', 'saldo atual', 'saldo'],
};

const PARES = paresDe(SINONIMOS);

export interface CabecalhoDeRazaoReconhecido {
  readonly colunas: ColunasRazao;
  readonly nota: number;
}

/**
 * Tenta ler uma linha como cabeçalho de razão.
 *
 * Devolve `null` quando não há como extrair valor da linha — e é só isso que
 * torna um razão ilegível. Faltar contrapartida, data ou histórico não impede
 * ler: impede concluir, que é outra camada (RF-29, ADR-0005).
 */
export function reconhecerCabecalhoDeRazao(
  campos: readonly string[],
): CabecalhoDeRazaoReconhecido | null {
  const atribuido = atribuirPapeis(campos, PARES);

  const debito = atribuido.get('debito') ?? null;
  const credito = atribuido.get('credito') ?? null;
  const valor = atribuido.get('valor') ?? null;

  const temParDebitoCredito = debito !== null && credito !== null;
  const temValorUnico = valor !== null;
  if (!temParDebitoCredito && !temValorUnico) return null;

  return {
    colunas: {
      conta: atribuido.get('conta') ?? null,
      data: atribuido.get('data') ?? null,
      historico: atribuido.get('historico') ?? null,
      debito,
      credito,
      valor,
      natureza: atribuido.get('natureza') ?? null,
      contrapartida: atribuido.get('contrapartida') ?? null,
      saldo: atribuido.get('saldo') ?? null,
    },
    nota: atribuido.size,
  };
}
