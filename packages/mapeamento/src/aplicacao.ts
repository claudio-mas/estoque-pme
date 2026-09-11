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
import type {
  LinhaBalancete,
  ResultadoBalancete,
  ResultadoRazao,
} from '@estoque-pme/importador';
import { normalizar } from '@estoque-pme/importador';
import {
  LIMITE_DIVERGENCIA_CUSTO_MATERIAIS,
  confrontarCustoMateriais,
  mensagemDoMotivo,
  motivoDaConta,
  motivoDoNivel,
} from '@estoque-pme/motor-calculo';
import type {
  Centavos,
  ConsumoDeNivel,
  CustoDeMateriais,
  Lancamento,
  Motivo,
  Nivel,
  SaldoDeNivel,
} from '@estoque-pme/motor-calculo';
import { comprasDeMp, consumoDoNivel } from './consumo';
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

export interface OpcoesAplicacao {
  /**
   * O razão das contas de estoque do mesmo período.
   *
   * Opcional: exigi-lo empurraria contra a meta de 30 minutos de onboarding, e
   * o cliente que não consegue exportá-lo no primeiro dia perderia MP inteiro.
   * Sem ele, o custo de materiais só existe se for digitado — e aí carrega
   * aviso permanente (ADR-0006).
   */
  readonly razao?: ResultadoRazao;
  /** Custo de materiais digitado pelo gestor, quando houver. */
  readonly custoMateriaisInformado?: Centavos;
  /** Divergência tolerada entre derivado e informado (RF-29, padrão 2%). */
  readonly limiteDivergencia?: number;
}

const SEM_RAZAO: Motivo = motivoDoNivel('sem-razao-nem-informado', 'MP');

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
          codigo: 'movimento-indisponivel',
          mensagem: `A conta ${linha.codigo} está mapeada mas o arquivo não traz movimento nem os dois saldos; ela não entrou na soma.`,
          ancora: { tipo: 'conta', conta: linha.codigo },
        });
        continue;
      }
      if (divergente) {
        diagnosticos.push({
          severidade: 'aviso',
          codigo: 'movimento-divergente',
          mensagem: `Na conta ${linha.codigo}, débito menos crédito não bate com a diferença dos saldos. Prevaleceu débito menos crédito.`,
          ancora: { tipo: 'conta', conta: linha.codigo },
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
      ancora: { tipo: 'mapeamento' },
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
): ReadonlyMap<Nivel, Motivo> {
  const duvidas = new Map<Nivel, Motivo>();

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
        motivoDaConta('nivel-incompleto', pendente.codigo, pendente.sugestao.papel.nivel),
      );
    }

    const pai = paiDe(pendente.codigo);
    if (pai === null) continue;
    for (const nivel of NIVEIS) {
      if (duvidas.has(nivel)) continue;
      if (paisPorNivel.get(nivel)?.has(pai) === true) {
        duvidas.set(nivel, motivoDaConta('nivel-incompleto', pendente.codigo, nivel));
      }
    }
  }

  return duvidas;
}

function saldoDoNivel(
  nivel: Nivel,
  mapeamento: Mapeamento,
  linhas: readonly LinhaBalancete[],
  duvidas: ReadonlyMap<Nivel, Motivo>,
  diagnosticos: DiagnosticoDeMapeamento[],
): SaldoDeNivel {
  const entradas = mapeamento.entradas.filter(
    (entrada) =>
      entrada.decisao.estado === 'classificada' &&
      entrada.decisao.papel.papel === 'estoque' &&
      entrada.decisao.papel.nivel === nivel,
  );

  const duvida = duvidas.get(nivel);
  if (duvida !== undefined) return { estado: 'indefinido', motivo: duvida };

  if (entradas.length === 0) {
    if (mapeamento.niveisAusentes.includes(nivel)) return { estado: 'ausente' };
    return { estado: 'indefinido', motivo: motivoDoNivel('nivel-nao-mapeado', nivel) };
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
          ancora: { tipo: 'conta', conta: linha.codigo },
        });
        return {
          estado: 'indefinido',
          motivo: motivoDaConta('saldo-de-fechamento-ausente', linha.codigo, nivel),
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
      ancora: { tipo: 'conta', conta: entrada.codigo },
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
  opcoes: OpcoesAplicacao = {},
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
      ancora: { tipo: 'conta', conta: pendente.codigo },
    });
  }

  if (balancete.competencia === null) {
    diagnosticos.push({
      severidade: 'erro',
      codigo: 'sem-competencia',
      mensagem:
        'O arquivo não diz a que competência se refere, e sem ela o lançamento não tem chave (RF-05).',
      ancora: { tipo: 'mapeamento' },
    });
  }

  const colunasDoBalancete = balancete.perfil?.balancete?.colunas ?? null;
  const temColunasDeMovimento =
    colunasDoBalancete !== null &&
    colunasDoBalancete.debito !== null &&
    colunasDoBalancete.credito !== null;

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

  const razao = conferirRazao(opcoes.razao, balancete, diagnosticos);
  const consumo = {
    MP: consumoDe('MP', mapeamento, razao, diagnosticos),
    PP: consumoDe('PP', mapeamento, razao, diagnosticos),
    PA: consumoDe('PA', mapeamento, razao, diagnosticos),
  } as const;

  const custoMateriais = decidirCustoMateriais(consumo.MP, opcoes, diagnosticos);
  const compras = razao === null ? null : comprasDeMp(mapeamento, razao);

  if (
    diagnosticos.some(({ severidade }) => severidade === 'erro') ||
    balancete.competencia === null
  ) {
    return { lancamento: null, diagnosticos, pendentes };
  }

  return {
    lancamento: {
      competencia: balancete.competencia,
      estoque,
      cmv,
      receita,
      perdas,
      consumo,
      custoMateriais,
      compras,
    },
    diagnosticos,
    pendentes,
  };
}

/**
 * O razão só serve se for do mesmo período do balancete.
 *
 * Herdar a competência sem conferir é a saída que parece simplificar e é a
 * pior: o arquivo errado passa a ser lido como se fosse o certo, e o resultado
 * é um `PME_MP` plausível, defensável e falso.
 */
function conferirRazao(
  razao: ResultadoRazao | undefined,
  balancete: ResultadoBalancete,
  diagnosticos: DiagnosticoDeMapeamento[],
): ResultadoRazao | null {
  if (razao === undefined) return null;
  const doRazao = razao.competencia;
  const doBalancete = balancete.competencia;

  if (doRazao === null || doBalancete === null) {
    diagnosticos.push({
      severidade: 'erro',
      codigo: 'competencia-indeterminada',
      mensagem: 'Balancete e razão precisam dizer a que competência pertencem para serem cruzados.',
      ancora: { tipo: 'mapeamento' },
    });
    return null;
  }
  if (doRazao.ano !== doBalancete.ano || doRazao.mes !== doBalancete.mes) {
    diagnosticos.push({
      severidade: 'erro',
      codigo: 'competencias-diferentes',
      mensagem: `O balancete é de ${doBalancete.mes}/${doBalancete.ano} e o razão de ${doRazao.mes}/${doRazao.ano}.`,
      ancora: { tipo: 'mapeamento' },
    });
    return null;
  }
  return razao;
}

function consumoDe(
  nivel: Nivel,
  mapeamento: Mapeamento,
  razao: ResultadoRazao | null,
  diagnosticos: DiagnosticoDeMapeamento[],
): ConsumoDeNivel {
  if (razao === null) {
    return { estado: 'indefinido', motivo: motivoDoNivel('sem-razao', nivel) };
  }
  return consumoDoNivel(nivel, mapeamento, razao, diagnosticos);
}

/**
 * Escolhe o custo de materiais e avisa quando ele é digitado.
 *
 * O RF-29 diz que o valor digitado à mão *"erra o PME de MP e contamina o teto
 * de compra sem que nada acuse"*. Se o caminho manual é aceito — e é (ADR-0006)
 * —, o "sem nada acusar" tem de deixar de ser verdade: daí o aviso permanente,
 * que não é decoração, é o preço de aceitar o caminho.
 */
function decidirCustoMateriais(
  consumoMp: ConsumoDeNivel,
  opcoes: OpcoesAplicacao,
  diagnosticos: DiagnosticoDeMapeamento[],
): CustoDeMateriais {
  const derivado = consumoMp.estado === 'lido' ? consumoMp.valor : null;
  const informado = opcoes.custoMateriaisInformado ?? null;
  const custo = confrontarCustoMateriais(derivado, informado, SEM_RAZAO);

  if (custo.origem === 'informado') {
    diagnosticos.push({
      severidade: 'aviso',
      codigo: 'custo-materiais-digitado',
      mensagem:
        'O custo de materiais foi digitado, não derivado do razão. Ele alimenta o PME de MP e o ' +
        'teto de compras, e nada no balancete confirma esse número.',
      ancora: { tipo: 'mapeamento' },
    });
  }

  if (custo.origem === 'conferido') {
    const limite = opcoes.limiteDivergencia ?? LIMITE_DIVERGENCIA_CUSTO_MATERIAIS;
    if (custo.divergencia > limite) {
      diagnosticos.push({
        severidade: 'aviso',
        codigo: 'custo-materiais-divergente',
        mensagem: `O custo de materiais digitado diverge ${(custo.divergencia * 100).toFixed(1)}% do derivado do razão; prevaleceu o derivado.`,
        ancora: { tipo: 'mapeamento' },
      });
    }
  }

  return custo;
}

