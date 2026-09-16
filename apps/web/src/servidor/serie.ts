/**
 * A série por período: o motor sobre os lançamentos.
 *
 * O `dados` devolve `Lançamento`; PME, cobertura e perda são calculados aqui,
 * no servidor — o motor é puro e roda igual nos dois lados (D11). É a linha
 * que o ADR-0009 traça: o banco guarda entrada e projeção materializada, nunca
 * o indicador.
 *
 * Nada aqui inventa número. Nível ausente é `ausente`, cálculo sem resposta é
 * `indefinido` com motivo, perda sem conta de baixa é `naoMedido` — e a tela
 * mostra cada um com o nome dele.
 */
import { lancamentosDaEmpresa } from '@estoque-pme/dados';
import type { PeriodoLido, Transacao } from '@estoque-pme/dados';
import { calcularPme, cobertura, perdaMedida } from '@estoque-pme/motor-calculo';
import type { Cobertura, Lancamento, Nivel, Perda, Pme } from '@estoque-pme/motor-calculo';

const NIVEIS: readonly Nivel[] = ['MP', 'PP', 'PA'];

export interface LinhaDaSerie {
  readonly competencia: { readonly ano: number; readonly mes: number };
  readonly estado: 'apurado' | 'importado';
  readonly pme: Readonly<Partial<Record<Nivel, Pme>>>;
  readonly cobertura: Cobertura | null;
  readonly perda: Readonly<Partial<Record<Nivel, Perda>>>;
  readonly lancamento: Lancamento | null;
}

/** O direcionador de custo de cada nível: custo de materiais para MP, CMV para o resto. */
function direcionador(lancamento: Lancamento, nivel: Nivel): bigint | null {
  if (nivel !== 'MP') return lancamento.cmv;
  const custo = lancamento.custoMateriais;
  return custo.origem === 'indefinido' ? null : custo.valor;
}

function pmeDoNivel(lancamento: Lancamento, nivel: Nivel): Pme {
  const saldo = lancamento.estoque[nivel];
  if (saldo.estado === 'ausente') return { estado: 'ausente' };
  if (saldo.estado === 'indefinido') return { estado: 'indefinido', motivo: saldo.motivo };

  const custo = direcionador(lancamento, nivel);
  if (custo === null) {
    // Sem custo de materiais não há PME de MP: o motivo é o do próprio custo.
    const cm = lancamento.custoMateriais;
    return cm.origem === 'indefinido'
      ? { estado: 'indefinido', motivo: cm.motivo }
      : { estado: 'indefinido', motivo: { codigo: 'sem-razao', ancora: { tipo: 'nivel', nivel } } };
  }

  return calcularPme({
    nivel,
    estoqueAbertura: saldo.abertura,
    estoqueFechamento: saldo.fechamento,
    custoDirecionador: custo,
  });
}

function perdaDoNivel(lancamento: Lancamento, nivel: Nivel): Perda {
  const consumo = lancamento.consumo[nivel];
  if (consumo.estado !== 'lido') return { estado: 'naoMedido' };
  return perdaMedida(lancamento.perdas[nivel], consumo.valor);
}

export function linhaDe(periodo: PeriodoLido): LinhaDaSerie {
  if (periodo.estado === 'importado') {
    return {
      competencia: periodo.competencia,
      estado: 'importado',
      pme: {},
      cobertura: null,
      perda: {},
      lancamento: null,
    };
  }

  const { lancamento } = periodo;
  const pme: Partial<Record<Nivel, Pme>> = {};
  const perda: Partial<Record<Nivel, Perda>> = {};
  for (const nivel of NIVEIS) {
    pme[nivel] = pmeDoNivel(lancamento, nivel);
    perda[nivel] = perdaDoNivel(lancamento, nivel);
  }

  return {
    competencia: lancamento.competencia,
    estado: 'apurado',
    pme,
    cobertura: cobertura(pme),
    perda,
    lancamento,
  };
}

/** A parte pura, para o teste: a série a partir dos períodos já lidos. */
export function serieDe(periodos: readonly PeriodoLido[]): readonly LinhaDaSerie[] {
  return periodos.map(linhaDe);
}

export async function serieDaEmpresa(
  tx: Transacao,
  empresaId: string,
): Promise<readonly LinhaDaSerie[]> {
  return serieDe(await lancamentosDaEmpresa(tx, empresaId));
}
