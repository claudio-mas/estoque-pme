/**
 * Linha ↔ união, por `switch` exaustivo.
 *
 * É a metade que o `CHECK` não cobre. O banco garante que a linha é
 * representável; o codec garante que ela vira a união certa e volta igual. Os
 * dois juntos são o que torna a coluna de estado superior ao padrão de nulos:
 * sem o codec exaustivo restaria uma função de inferência escrita à mão, que é
 * onde um bug mora para sempre (ADR-0008).
 *
 * Nenhuma função aqui lança por dado ruim de domínio — lança por dado
 * **impossível**, que é defeito de programação ou linha gravada por um caminho
 * que furou o `CHECK`.
 */
import type {
  Ancora,
  CodigoDeMotivo,
  ConsumoDeNivel,
  CustoDeMateriais,
  Motivo,
  Nivel,
  Perda,
  SaldoDeNivel,
} from '@estoque-pme/motor-calculo';

/** A âncora em colunas, com o prefixo que a tabela usa. */
export interface LinhaDeAncora {
  readonly tipo: string | null;
  readonly linha: number | null;
  readonly coluna: string | null;
  readonly conta: string | null;
  readonly nivel: string | null;
}

export interface LinhaDeMotivo extends LinhaDeAncora {
  readonly codigo: string | null;
}

const ANCORA_VAZIA: LinhaDeAncora = {
  tipo: null,
  linha: null,
  coluna: null,
  conta: null,
  nivel: null,
};

export function ancoraParaLinha(ancora: Ancora): LinhaDeAncora {
  switch (ancora.tipo) {
    case 'arquivo':
    case 'mapeamento':
      return { ...ANCORA_VAZIA, tipo: ancora.tipo };
    case 'linha':
      return {
        ...ANCORA_VAZIA,
        tipo: 'linha',
        linha: ancora.linha,
        coluna: ancora.coluna ?? null,
      };
    case 'conta':
      return {
        ...ANCORA_VAZIA,
        tipo: 'conta',
        conta: ancora.conta,
        nivel: ancora.nivel ?? null,
      };
    case 'nivel':
      return { ...ANCORA_VAZIA, tipo: 'nivel', nivel: ancora.nivel };
    case 'lancamento':
      return { ...ANCORA_VAZIA, tipo: 'lancamento', conta: ancora.conta, linha: ancora.linha };
  }
}

function impossivel(o_que: string, valor: unknown): never {
  throw new Error(`Linha impossível: ${o_que} = ${JSON.stringify(valor)}.`);
}

function exigir<T>(valor: T | null, campo: string): T {
  if (valor === null) impossivel(`${campo} nulo onde o estado exige valor`, valor);
  return valor;
}

export function ancoraDeLinha(linha: LinhaDeAncora): Ancora {
  switch (linha.tipo) {
    case 'arquivo':
      return { tipo: 'arquivo' };
    case 'mapeamento':
      return { tipo: 'mapeamento' };
    case 'linha': {
      const numero = exigir(linha.linha, 'ancora_linha');
      return linha.coluna === null
        ? { tipo: 'linha', linha: numero }
        : { tipo: 'linha', linha: numero, coluna: linha.coluna };
    }
    case 'conta': {
      const conta = exigir(linha.conta, 'ancora_conta');
      return linha.nivel === null
        ? { tipo: 'conta', conta }
        : { tipo: 'conta', conta, nivel: linha.nivel as Nivel };
    }
    case 'nivel':
      return { tipo: 'nivel', nivel: exigir(linha.nivel, 'ancora_nivel') as Nivel };
    case 'lancamento':
      return {
        tipo: 'lancamento',
        conta: exigir(linha.conta, 'ancora_conta'),
        linha: exigir(linha.linha, 'ancora_linha'),
      };
    default:
      return impossivel('ancora_tipo', linha.tipo);
  }
}

export function motivoParaLinha(motivo: Motivo | null): LinhaDeMotivo {
  if (motivo === null) return { ...ANCORA_VAZIA, codigo: null };
  return { codigo: motivo.codigo, ...ancoraParaLinha(motivo.ancora) };
}

export function motivoDeLinha(linha: LinhaDeMotivo): Motivo | null {
  if (linha.codigo === null) return null;
  return { codigo: linha.codigo as CodigoDeMotivo, ancora: ancoraDeLinha(linha) };
}

/** O saldo de um nível, em colunas. */
export interface LinhaDeSaldo {
  readonly estado: string;
  readonly abertura: bigint | null;
  readonly fechamento: bigint | null;
  readonly motivo: LinhaDeMotivo;
}

export function saldoParaLinha(saldo: SaldoDeNivel): LinhaDeSaldo {
  switch (saldo.estado) {
    case 'lido':
      return {
        estado: 'lido',
        abertura: saldo.abertura,
        fechamento: saldo.fechamento,
        motivo: motivoParaLinha(null),
      };
    case 'ausente':
      return { estado: 'ausente', abertura: null, fechamento: null, motivo: motivoParaLinha(null) };
    case 'indefinido':
      return {
        estado: 'indefinido',
        abertura: null,
        fechamento: null,
        motivo: motivoParaLinha(saldo.motivo),
      };
  }
}

export function saldoDeLinha(linha: LinhaDeSaldo): SaldoDeNivel {
  switch (linha.estado) {
    case 'lido':
      return {
        estado: 'lido',
        abertura: linha.abertura,
        fechamento: exigir(linha.fechamento, 'estoque_fechamento'),
      };
    case 'ausente':
      return { estado: 'ausente' };
    case 'indefinido':
      return {
        estado: 'indefinido',
        motivo: exigir(motivoDeLinha(linha.motivo), 'estoque_motivo_codigo'),
      };
    default:
      return impossivel('estoque_estado', linha.estado);
  }
}

export interface LinhaDeConsumo {
  readonly estado: string;
  readonly valor: bigint | null;
  readonly motivo: LinhaDeMotivo;
}

export function consumoParaLinha(consumo: ConsumoDeNivel): LinhaDeConsumo {
  return consumo.estado === 'lido'
    ? { estado: 'lido', valor: consumo.valor, motivo: motivoParaLinha(null) }
    : { estado: 'indefinido', valor: null, motivo: motivoParaLinha(consumo.motivo) };
}

export function consumoDeLinha(linha: LinhaDeConsumo): ConsumoDeNivel {
  switch (linha.estado) {
    case 'lido':
      return { estado: 'lido', valor: exigir(linha.valor, 'consumo_valor') };
    case 'indefinido':
      return {
        estado: 'indefinido',
        motivo: exigir(motivoDeLinha(linha.motivo), 'consumo_motivo_codigo'),
      };
    default:
      return impossivel('consumo_estado', linha.estado);
  }
}

/**
 * A perda, que no `Lancamento` é `Centavos | null` e no banco é união.
 *
 * O nulo ali carrega **não medido** (D7), um estado com nome no domínio, e por
 * isso ganha coluna em vez de continuar achatado.
 */
export interface LinhaDePerda {
  readonly estado: string;
  readonly valor: bigint | null;
}

export function perdaParaLinha(perdas: bigint | null): LinhaDePerda {
  return perdas === null
    ? { estado: 'naoMedido', valor: null }
    : { estado: 'medido', valor: perdas };
}

export function perdaDeLinha(linha: LinhaDePerda): bigint | null {
  switch (linha.estado) {
    case 'medido':
      return exigir(linha.valor, 'perdas_valor');
    case 'naoMedido':
      return null;
    default:
      return impossivel('perdas_estado', linha.estado);
  }
}

/** `Perda` do motor a partir da linha, para quem quiser o tipo e não o número. */
export function perdaMedidaDeLinha(linha: LinhaDePerda, consumo: bigint): Perda {
  const valor = perdaDeLinha(linha);
  return valor === null ? { estado: 'naoMedido' } : { estado: 'medido', taxa: Number(valor) / Number(consumo) };
}

export interface LinhaDeCustoMateriais {
  readonly origem: string | null;
  readonly valor: bigint | null;
  readonly informado: bigint | null;
  readonly motivo: LinhaDeMotivo;
}

export function custoMateriaisParaLinha(custo: CustoDeMateriais): LinhaDeCustoMateriais {
  switch (custo.origem) {
    case 'derivado':
    case 'informado':
      return {
        origem: custo.origem,
        valor: custo.valor,
        informado: null,
        motivo: motivoParaLinha(null),
      };
    case 'conferido':
      // `divergencia` não entra: é coluna gerada de `valor` e `informado`, e
      // dois campos paralelos divergem.
      return {
        origem: 'conferido',
        valor: custo.valor,
        informado: custo.informado,
        motivo: motivoParaLinha(null),
      };
    case 'indefinido':
      return {
        origem: 'indefinido',
        valor: null,
        informado: null,
        motivo: motivoParaLinha(custo.motivo),
      };
  }
}

export function custoMateriaisDeLinha(linha: LinhaDeCustoMateriais): CustoDeMateriais {
  switch (linha.origem) {
    case 'derivado':
      return { origem: 'derivado', valor: exigir(linha.valor, 'custo_materiais_valor') };
    case 'informado':
      return { origem: 'informado', valor: exigir(linha.valor, 'custo_materiais_valor') };
    case 'conferido': {
      const valor = exigir(linha.valor, 'custo_materiais_valor');
      const informado = exigir(linha.informado, 'custo_materiais_informado');
      const diferenca = valor > informado ? valor - informado : informado - valor;
      // Recalculada na leitura em vez de lida da coluna gerada: o banco a
      // calcula para quem consulta em SQL, e o tipo a exige aqui — não há
      // caminho em que as duas discordem.
      const divergencia =
        valor === 0n ? Number.POSITIVE_INFINITY : Number(diferenca) / Math.abs(Number(valor));
      return { origem: 'conferido', valor, informado, divergencia };
    }
    case 'indefinido':
      return {
        origem: 'indefinido',
        motivo: exigir(motivoDeLinha(linha.motivo), 'custo_materiais_motivo_codigo'),
      };
    default:
      return impossivel('custo_materiais_origem', linha.origem);
  }
}
