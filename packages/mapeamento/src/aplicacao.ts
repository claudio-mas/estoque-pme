/**
 * Aplicar o mapeamento a um balancete lido, produzindo o lançamento do período.
 *
 * Três regras carregam este arquivo, e as três já foram decididas em outro
 * lugar. Conta de estoque entra pelos **saldos**, porque o PME quer a média
 * (D5); conta de resultado entra pelo **movimento**, nunca pelo saldo, porque o
 * saldo depende de o ERP zerar ou acumular no exercício (ADR-0003); e cada real
 * é contado por exatamente um mapeamento (ADR-0002).
 *
 * A quarta regra é a que distingue silêncio de zero: nível sem conta é
 * `ausente` só quando a empresa declarou que não o movimenta, e é `indefinido`
 * quando há conta pendente que possa pertencer a ele. Somar zero em qualquer um
 * dos dois é o erro que o CLAUDE.md proíbe em três lugares diferentes.
 */
import type { LinhaBalancete, ResultadoBalancete } from '@estoque-pme/importador';
import { normalizar } from '@estoque-pme/importador';
import type { Centavos, Lancamento, Nivel, SaldoDeNivel } from '@estoque-pme/motor-calculo';
import { proporMapeamento } from './proposta';
import { paiDe, pertenceA, topos } from './subarvore';
import type {
  ContaPendente,
  DiagnosticoDeMapeamento,
  EntradaDeMapeamento,
  Mapeamento,
  PapelDeConta,
} from './tipos';
import { validarMapeamento } from './validacao';

const NIVEIS: readonly Nivel[] = ['MP', 'PP', 'PA'];

export interface ResultadoAplicacao {
  /** `null` quando algum diagnóstico de erro impede produzir número confiável. */
  readonly lancamento: Lancamento | null;
  readonly diagnosticos: readonly DiagnosticoDeMapeamento[];
  readonly pendentes: readonly ContaPendente[];
}

/** O sentido em que o movimento de cada papel é positivo. */
function sentidoDe(papel: PapelDeConta['papel']): bigint {
  return papel === 'receita' ? -1n : 1n;
}

/**
 * As linhas do arquivo que uma entrada de mapeamento responde, sem dupla
 * contagem: a própria conta quando ela veio no arquivo, e os topos da subárvore
 * quando o ERP exportou só as analíticas.
 */
function linhasDe(
  entrada: EntradaDeMapeamento,
  linhas: readonly LinhaBalancete[],
): readonly LinhaBalancete[] {
  const candidatas = linhas.filter((linha) => pertenceA(linha.codigo, entrada.codigo));
  const codigosTopo = new Set(topos(candidatas.map((linha) => linha.codigo)));
  return candidatas.filter((linha) => codigosTopo.has(linha.codigo));
}

/**
 * O movimento do período de uma linha (ADR-0003).
 *
 * `débito − crédito` é o número que o contador escreveu e prevalece. A queda
 * para `saldoAtual − saldoAnterior` existe porque há arquivo real sem colunas
 * de movimento, e é algebricamente a mesma coisa num balancete íntegro — quando
 * as duas discordam, o arquivo está torto e isso vira diagnóstico.
 */
function movimentoDe(
  linha: LinhaBalancete,
  temColunasDeMovimento: boolean,
): { readonly valor: Centavos | null; readonly divergente: boolean } {
  const movimento = linha.debito - linha.credito;
  const delta =
    linha.saldoAtual !== null && linha.saldoAnterior !== null
      ? linha.saldoAtual - linha.saldoAnterior
      : null;

  if (!temColunasDeMovimento) return { valor: delta, divergente: false };
  return { valor: movimento, divergente: delta !== null && delta !== movimento };
}

/** Soma o movimento das contas de um papel, já com o sinal do papel aplicado. */
function somarMovimento(
  entradas: readonly EntradaDeMapeamento[],
  papel: PapelDeConta['papel'],
  linhas: readonly LinhaBalancete[],
  temColunasDeMovimento: boolean,
  diagnosticos: DiagnosticoDeMapeamento[],
): Centavos | null {
  let total: Centavos | null = null;

  for (const entrada of entradas) {
    for (const linha of linhasDe(entrada, linhas)) {
      const { valor, divergente } = movimentoDe(linha, temColunasDeMovimento);
      if (valor === null) {
        diagnosticos.push({
          severidade: 'aviso',
          codigo: 'movimento-ilegivel',
          mensagem: `A conta ${linha.codigo} está mapeada mas o arquivo não traz movimento nem os dois saldos; ela não entrou na soma.`,
          conta: linha.codigo,
        });
        continue;
      }
      if (divergente) {
        diagnosticos.push({
          severidade: 'aviso',
          codigo: 'movimento-divergente',
          mensagem: `Na conta ${linha.codigo}, débito menos crédito não bate com a diferença dos saldos. Prevaleceu débito menos crédito.`,
          conta: linha.codigo,
        });
      }
      total = (total ?? 0n) + valor;
    }
  }

  if (total === null) return null;

  const normalizado = sentidoDe(papel) * total;
  if (normalizado < 0n) {
    diagnosticos.push({
      severidade: 'aviso',
      codigo: 'sinal-invertido',
      mensagem: `O movimento de ${papel} veio no sentido contrário ao esperado no período; o valor foi normalizado.`,
      conta: null,
    });
    return -normalizado;
  }
  return normalizado;
}

/**
 * Os níveis que uma conta pendente deixa em dúvida.
 *
 * Duas portas, porque uma só não basta. A sugestão pega "1.1.3.04 MATÉRIAS
 * PRIMAS IMPORTADAS" ainda não classificada. O pai em comum pega o caso que a
 * sugestão perde — "1.1.3.04 INSUMOS DIVERSOS" ao lado de contas de MP já
 * classificadas —, porque uma conta não classificada dentro do grupo de
 * estoques significa que aquele estoque não é conhecido por inteiro.
 */
function niveisEmDuvida(
  pendentes: readonly ContaPendente[],
  entradas: readonly EntradaDeMapeamento[],
): ReadonlyMap<Nivel, string> {
  const duvidas = new Map<Nivel, string>();

  const paisPorNivel = new Map<Nivel, Set<string>>();
  for (const entrada of entradas) {
    if (entrada.decisao.estado !== 'classificada') continue;
    const { papel } = entrada.decisao;
    if (papel.papel !== 'estoque') continue;
    const pai = paiDe(entrada.codigo);
    if (pai === null) continue;
    const conjunto = paisPorNivel.get(papel.nivel) ?? new Set<string>();
    conjunto.add(pai);
    paisPorNivel.set(papel.nivel, conjunto);
  }

  for (const pendente of pendentes) {
    if (
      pendente.sugestao.estado === 'sugerido' &&
      pendente.sugestao.papel.papel === 'estoque' &&
      !duvidas.has(pendente.sugestao.papel.nivel)
    ) {
      duvidas.set(
        pendente.sugestao.papel.nivel,
        `a conta ${pendente.codigo} está pendente e o produto a propõe como estoque desse nível`,
      );
    }

    const pai = paiDe(pendente.codigo);
    if (pai === null) continue;
    for (const nivel of NIVEIS) {
      if (duvidas.has(nivel)) continue;
      if (paisPorNivel.get(nivel)?.has(pai) === true) {
        duvidas.set(
          nivel,
          `a conta ${pendente.codigo} está pendente no mesmo grupo das contas classificadas desse nível`,
        );
      }
    }
  }

  return duvidas;
}

function saldoDoNivel(
  nivel: Nivel,
  mapeamento: Mapeamento,
  linhas: readonly LinhaBalancete[],
  duvidas: ReadonlyMap<Nivel, string>,
  diagnosticos: DiagnosticoDeMapeamento[],
): SaldoDeNivel {
  const entradas = mapeamento.entradas.filter(
    (entrada) =>
      entrada.decisao.estado === 'classificada' &&
      entrada.decisao.papel.papel === 'estoque' &&
      entrada.decisao.papel.nivel === nivel,
  );

  const duvida = duvidas.get(nivel);
  if (duvida !== undefined) {
    return { estado: 'indefinido', motivo: `${nivel} não é conhecido por inteiro: ${duvida}.` };
  }

  if (entradas.length === 0) {
    if (mapeamento.niveisAusentes.includes(nivel)) return { estado: 'ausente' };
    return {
      estado: 'indefinido',
      motivo: `Nenhuma conta classificada como estoque de ${nivel}, e o nível não foi declarado ausente.`,
    };
  }

  let fechamento: Centavos = 0n;
  let abertura: Centavos | null = 0n;

  for (const entrada of entradas) {
    for (const linha of linhasDe(entrada, linhas)) {
      if (linha.saldoAtual === null) {
        diagnosticos.push({
          severidade: 'erro',
          codigo: 'saldo-de-fechamento-ausente',
          mensagem: `A conta ${linha.codigo} está classificada como estoque de ${nivel} mas o arquivo não traz saldo de fechamento.`,
          conta: linha.codigo,
        });
        return {
          estado: 'indefinido',
          motivo: `A conta ${linha.codigo} não trouxe saldo de fechamento.`,
        };
      }
      fechamento += linha.saldoAtual;
      // Um saldo de abertura faltando derruba a média do nível inteiro para o
      // fechamento (D5): somar só parte das aberturas daria uma média entre
      // grandezas diferentes, que é pior do que degradar com o motivo dito.
      abertura = linha.saldoAnterior === null || abertura === null ? null : abertura + linha.saldoAnterior;
    }
  }

  return { estado: 'lido', abertura, fechamento };
}

function perdasDoNivel(
  nivel: Nivel,
  mapeamento: Mapeamento,
  linhas: readonly LinhaBalancete[],
  temColunasDeMovimento: boolean,
  diagnosticos: DiagnosticoDeMapeamento[],
): Centavos | null {
  const entradas = mapeamento.entradas.filter(
    (entrada) =>
      entrada.decisao.estado === 'classificada' &&
      entrada.decisao.papel.papel === 'baixa' &&
      entrada.decisao.papel.nivel === nivel,
  );
  if (entradas.length === 0) return null;
  return somarMovimento(entradas, 'baixa', linhas, temColunasDeMovimento, diagnosticos);
}

function entradasDe(mapeamento: Mapeamento, papel: 'cmv' | 'receita'): EntradaDeMapeamento[] {
  return mapeamento.entradas.filter(
    (entrada) => entrada.decisao.estado === 'classificada' && entrada.decisao.papel.papel === papel,
  );
}

/**
 * Confere a descrição guardada contra a que veio no arquivo.
 *
 * É o alarme que dispensa vigência no mapeamento (ADR-0001): descrição
 * divergente no mesmo código é conta renomeada — inofensivo — ou código
 * encerrado e reaproveitado para outra coisa, que é o único caso capaz de fazer
 * o mapeamento medir a conta errada em silêncio. Avisa, nunca invalida:
 * renomeação cosmética é frequente, e bloquear treina o gestor a confirmar sem
 * ler.
 */
function conferirDescricoes(
  mapeamento: Mapeamento,
  linhas: readonly LinhaBalancete[],
  diagnosticos: DiagnosticoDeMapeamento[],
): void {
  for (const entrada of mapeamento.entradas) {
    const linha = linhas.find((candidata) => candidata.codigo === entrada.codigo);
    if (linha === undefined) continue;
    if (normalizar(linha.descricao) === normalizar(entrada.descricao)) continue;
    diagnosticos.push({
      severidade: 'aviso',
      codigo: 'descricao-divergente',
      mensagem: `A conta ${entrada.codigo} foi mapeada como "${entrada.descricao}" e no arquivo veio como "${linha.descricao}". Conta renomeada ou código reaproveitado — confira antes de usar o histórico.`,
      conta: entrada.codigo,
    });
  }
}

/**
 * Resolve um balancete lido em lançamento do período.
 *
 * Revalida o mapeamento mesmo tendo sido validado no salvamento (ADR-0002), e
 * com erro de validação **não** produz lançamento: número errado é pior do que
 * número nenhum, e os diagnósticos continuam navegáveis conta a conta. Conta
 * pendente, ao contrário, não impede nada — deixa indefinido só o nível que ela
 * pode estar escondendo.
 */
export function aplicarMapeamento(
  mapeamento: Mapeamento,
  balancete: ResultadoBalancete,
): ResultadoAplicacao {
  const diagnosticos: DiagnosticoDeMapeamento[] = [...validarMapeamento(mapeamento)];
  const pendentes = proporMapeamento(balancete.linhas, mapeamento);
  const { linhas } = balancete;

  conferirDescricoes(mapeamento, linhas, diagnosticos);

  for (const pendente of pendentes) {
    diagnosticos.push({
      severidade: 'aviso',
      codigo: 'conta-pendente',
      mensagem: `A conta ${pendente.codigo} — "${pendente.descricao}" — não foi classificada nem ignorada.`,
      conta: pendente.codigo,
    });
  }

  if (balancete.competencia === null) {
    diagnosticos.push({
      severidade: 'erro',
      codigo: 'sem-competencia',
      mensagem:
        'O arquivo não diz a que competência se refere, e sem ela o lançamento não tem chave (RF-05).',
      conta: null,
    });
  }

  const temColunasDeMovimento =
    balancete.perfil !== null &&
    balancete.perfil.colunas.debito !== null &&
    balancete.perfil.colunas.credito !== null;

  const duvidas = niveisEmDuvida(pendentes, mapeamento.entradas);
  const estoque = {
    MP: saldoDoNivel('MP', mapeamento, linhas, duvidas, diagnosticos),
    PP: saldoDoNivel('PP', mapeamento, linhas, duvidas, diagnosticos),
    PA: saldoDoNivel('PA', mapeamento, linhas, duvidas, diagnosticos),
  } as const;

  const cmv = somarMovimento(
    entradasDe(mapeamento, 'cmv'),
    'cmv',
    linhas,
    temColunasDeMovimento,
    diagnosticos,
  );
  const receita = somarMovimento(
    entradasDe(mapeamento, 'receita'),
    'receita',
    linhas,
    temColunasDeMovimento,
    diagnosticos,
  );
  const perdas = {
    MP: perdasDoNivel('MP', mapeamento, linhas, temColunasDeMovimento, diagnosticos),
    PP: perdasDoNivel('PP', mapeamento, linhas, temColunasDeMovimento, diagnosticos),
    PA: perdasDoNivel('PA', mapeamento, linhas, temColunasDeMovimento, diagnosticos),
  } as const;

  if (diagnosticos.some(({ severidade }) => severidade === 'erro') || balancete.competencia === null) {
    return { lancamento: null, diagnosticos, pendentes };
  }

  return {
    lancamento: { competencia: balancete.competencia, estoque, cmv, receita, perdas },
    diagnosticos,
    pendentes,
  };
}

