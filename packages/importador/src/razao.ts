/**
 * Leitura do razão: bytes entram, contas com seus lançamentos saem.
 *
 * Mesmo contrato do balancete — nada aqui lança exceção por dado ruim, linha
 * ilegível vira diagnóstico e a leitura segue —, e a mesma recusa: **o que uma
 * conta significa não é problema deste arquivo.** A contrapartida sai daqui
 * como o código que estava escrito; dizer que ela é PP, perda ou fornecedor é
 * o mapeamento (RF-28).
 *
 * O resultado vem agrupado por conta porque é assim que o arquivo vem —
 * cabeçalho de conta, saldo anterior, lançamentos, saldo atual. Desmanchar esse
 * agrupamento para remontá-lo depois seria desfazer estrutura já dada.
 */
import type { Centavos } from '@estoque-pme/motor-calculo';
import { lerCsv, vazio, type RegistroCsv } from './csv';
import { detectarDialeto } from './dialeto';
import { detectarCompetencia } from './competencia';
import { reconhecerCabecalhoDeRazao } from './colunas-razao';
import { decodificar, normalizar } from './texto';
import { lerValor } from './numero';
import type {
  ColunasRazao,
  Competencia,
  ContaRazao,
  DelimitacaoDeRazao,
  Diagnostico,
  LancamentoRazao,
  PerfilImportacao,
  ResultadoRazao,
  SeparadorDecimal,
} from './tipos';

/** Até onde procurar o cabeçalho antes de desistir. Preâmbulo de ERP é curto. */
const LINHAS_ATE_O_CABECALHO = 40;

const INICIOS_DE_SALDO_ANTERIOR = ['saldo anterior', 'saldo inicial', 'saldo anter'];
const INICIOS_DE_SALDO_ATUAL = ['saldo atual', 'saldo final', 'saldo do periodo', 'saldo em'];
const INICIOS_DE_TOTAL = ['total', 'totais', 'soma', 'subtotal', 'transporte'];

/** Um código de conta: dígitos, possivelmente separados por ponto, hífen ou barra. */
const CODIGO_DE_CONTA = /^(?:conta\s*:?\s*)?([0-9][0-9.\-/]*[0-9]|[0-9])\s*[-–—:]?\s*(.*)$/i;

export interface OpcoesRazao {
  /** Layout já conhecido deste ERP (RF-24). Quando vem, a detecção é pulada. */
  readonly perfil?: PerfilImportacao;
  /** Competência informada pelo gestor, para quando o arquivo não a traz. */
  readonly competencia?: Competencia;
}

export function lerRazao(bytes: Uint8Array, opcoes: OpcoesRazao = {}): ResultadoRazao {
  const diagnosticos: Diagnostico[] = [];
  const { perfil } = opcoes;

  const { texto, codificacao } = decodificar(bytes, perfil?.dialeto.codificacao);
  const dialeto =
    perfil !== undefined
      ? {
          delimitador: perfil.dialeto.delimitador,
          separadorDecimal: perfil.dialeto.separadorDecimal,
        }
      : detectarDialeto(texto);

  const registros = lerCsv(texto, dialeto.delimitador);
  const cabecalho = localizarCabecalho(registros, perfil);

  if (cabecalho === null) {
    diagnosticos.push({
      severidade: 'erro',
      codigo: 'cabecalho-de-razao-nao-encontrado',
      mensagem:
        'Não foi possível identificar as colunas de valor do razão. Confira se o arquivo é o ' +
        'razão das contas de estoque e não outro relatório.',
      linha: null,
    });
    return { competencia: opcoes.competencia ?? null, contas: [], diagnosticos, perfil: null };
  }

  const { indice, colunas } = cabecalho;
  // A detecção do formato cai direto da detecção de colunas: código de conta em
  // coluna própria só existe no razão plano; no razão em bloco ele mora na
  // linha de cabeçalho de cada conta.
  const delimitacao: DelimitacaoDeRazao = colunas.conta !== null ? 'plano' : 'bloco';

  const preambulo = registros.slice(0, indice).map((registro) => registro.campos.join(' '));
  const competencia = opcoes.competencia ?? detectarCompetencia(preambulo);
  if (competencia === null) {
    diagnosticos.push({
      severidade: 'aviso',
      codigo: 'competencia-nao-encontrada',
      mensagem:
        'A competência não foi encontrada no cabeçalho do arquivo e precisa ser informada — ' +
        'sem ela não há chave de período para importar sem duplicar (RF-05).',
      linha: null,
    });
  }

  const corpo = registros.slice(indice + 1);
  const contas =
    delimitacao === 'plano'
      ? extrairPlano(corpo, colunas, dialeto.separadorDecimal, diagnosticos)
      : extrairBlocos(corpo, colunas, dialeto.separadorDecimal, diagnosticos);

  if (contas.length === 0) {
    diagnosticos.push({
      severidade: 'erro',
      codigo: 'nenhuma-conta-lida',
      mensagem: 'O cabeçalho foi reconhecido, mas nenhuma conta pôde ser lida.',
      linha: null,
    });
  }

  conferirIdentidade(contas, diagnosticos);

  return {
    competencia,
    contas,
    diagnosticos,
    perfil: {
      dialeto: {
        codificacao,
        delimitador: dialeto.delimitador,
        separadorDecimal: dialeto.separadorDecimal,
      },
      balancete: null,
      razao: { linhaCabecalho: indice, delimitacao, colunas },
    },
  };
}

interface Cabecalho {
  readonly indice: number;
  readonly colunas: ColunasRazao;
}

function localizarCabecalho(
  registros: readonly RegistroCsv[],
  perfil: PerfilImportacao | undefined,
): Cabecalho | null {
  const layout = perfil?.razao;
  if (layout != null) {
    return registros[layout.linhaCabecalho] === undefined
      ? null
      : { indice: layout.linhaCabecalho, colunas: layout.colunas };
  }

  let melhor: Cabecalho | null = null;
  let melhorNota = 0;
  const ate = Math.min(registros.length, LINHAS_ATE_O_CABECALHO);

  for (let i = 0; i < ate; i += 1) {
    const registro = registros[i] as RegistroCsv;
    if (vazio(registro)) continue;
    const reconhecido = reconhecerCabecalhoDeRazao(registro.campos);
    if (reconhecido !== null && reconhecido.nota > melhorNota) {
      melhor = { indice: i, colunas: reconhecido.colunas };
      melhorNota = reconhecido.nota;
    }
  }
  return melhor;
}

function celula(registro: RegistroCsv, indice: number | null): string {
  if (indice === null) return '';
  return registro.campos[indice]?.trim() ?? '';
}

function valorOuZero(bruto: string, decimal: SeparadorDecimal): Centavos | null {
  if (bruto === '') return 0n;
  const lido = lerValor(bruto, decimal);
  if (lido.estado === 'vazio') return 0n;
  if (lido.estado === 'invalido') return null;
  return lido.valor;
}

function magnitude(valor: Centavos): Centavos {
  return valor < 0n ? -valor : valor;
}

/**
 * O movimento de uma linha, nas duas formas em que o ERP o escreve.
 *
 * Com colunas separadas o sinal é **preservado como veio**: estorno lançado
 * como débito negativo existe, e apagá-lo quebraria a identidade
 * `saldo_anterior + Σdébitos − Σcréditos = saldo_atual`, que é a conferência de
 * que o RF-29 inteiro depende. Com coluna única a natureza D/C é que carrega o
 * lado, e aí o valor entra em módulo.
 */
function lerMovimento(
  registro: RegistroCsv,
  colunas: ColunasRazao,
  decimal: SeparadorDecimal,
): { readonly debito: Centavos; readonly credito: Centavos } | null {
  if (colunas.debito !== null || colunas.credito !== null) {
    const bruteDebito = celula(registro, colunas.debito);
    const bruteCredito = celula(registro, colunas.credito);
    if (bruteDebito === '' && bruteCredito === '') return null;
    const debito = valorOuZero(bruteDebito, decimal);
    const credito = valorOuZero(bruteCredito, decimal);
    if (debito === null || credito === null) return null;
    if (debito === 0n && credito === 0n) return null;
    return { debito, credito };
  }

  const bruto = celula(registro, colunas.valor);
  if (bruto === '') return null;
  const lido = lerValor(bruto, decimal);
  if (lido.estado !== 'lido' || lido.valor === 0n) return null;

  const escrita = normalizar(celula(registro, colunas.natureza));
  const credor = escrita === 'c' || escrita.startsWith('cred') || lido.natureza === 'C';
  const bruta = magnitude(lido.valor);
  return credor ? { debito: 0n, credito: bruta } : { debito: bruta, credito: 0n };
}

/** O saldo escrito numa linha de "saldo anterior" ou "saldo atual". */
function lerSaldo(
  registro: RegistroCsv,
  colunas: ColunasRazao,
  decimal: SeparadorDecimal,
): Centavos | null {
  const preferida = celula(registro, colunas.saldo);
  if (preferida !== '') {
    const lido = lerValor(preferida, decimal);
    if (lido.estado === 'lido') return lido.valor;
  }
  // Sem coluna de saldo, o número está na linha em algum lugar: o ERP costuma
  // escrevê-lo à direita, então vale a última célula legível.
  for (let i = registro.campos.length - 1; i >= 0; i -= 1) {
    const bruto = registro.campos[i]?.trim() ?? '';
    if (bruto === '') continue;
    const lido = lerValor(bruto, decimal);
    if (lido.estado === 'lido') return lido.valor;
  }
  return null;
}

function comecaCom(texto: string, inicios: readonly string[]): boolean {
  return inicios.some((inicio) => texto === inicio || texto.startsWith(`${inicio} `));
}

function lancamentoDe(
  registro: RegistroCsv,
  colunas: ColunasRazao,
  movimento: { readonly debito: Centavos; readonly credito: Centavos },
): LancamentoRazao {
  const contrapartida = celula(registro, colunas.contrapartida);
  const data = celula(registro, colunas.data);
  return {
    linha: registro.linha,
    data: data === '' ? null : data,
    historico: celula(registro, colunas.historico),
    debito: movimento.debito,
    credito: movimento.credito,
    contrapartida: contrapartida === '' ? null : contrapartida,
  };
}

/** Razão plano: o código da conta se repete em toda linha. */
function extrairPlano(
  registros: readonly RegistroCsv[],
  colunas: ColunasRazao,
  decimal: SeparadorDecimal,
  diagnosticos: Diagnostico[],
): ContaRazao[] {
  const porConta = new Map<string, { descricao: string; lancamentos: LancamentoRazao[] }>();

  for (const registro of registros) {
    if (vazio(registro)) continue;
    const texto = normalizar(registro.campos.join(' '));
    if (comecaCom(texto, INICIOS_DE_TOTAL)) continue;

    const codigo = celula(registro, colunas.conta);
    if (codigo === '') continue;

    const movimento = lerMovimento(registro, colunas, decimal);
    if (movimento === null) {
      diagnosticos.push({
        severidade: 'aviso',
        codigo: 'lancamento-sem-valor',
        mensagem: `Linha da conta ${codigo} sem valor legível; não entrou no movimento.`,
        linha: registro.linha,
      });
      continue;
    }

    const atual = porConta.get(codigo) ?? {
      descricao: celula(registro, colunas.historico),
      lancamentos: [],
    };
    atual.lancamentos.push(lancamentoDe(registro, colunas, movimento));
    porConta.set(codigo, atual);
  }

  // Sem cabeçalho de conta não há saldo anterior nem atual escritos: o formato
  // plano não os traz. Ficam `null`, e a conferência de identidade é pulada —
  // dizer que não se sabe é o comportamento correto, não inventar zero.
  return [...porConta.entries()].map(([codigo, { descricao, lancamentos }]) => ({
    codigo,
    descricao,
    saldoAnterior: null,
    saldoAtual: null,
    lancamentos,
  }));
}

/** Razão em bloco: cabeçalho de conta, saldo anterior, lançamentos, saldo atual. */
function extrairBlocos(
  registros: readonly RegistroCsv[],
  colunas: ColunasRazao,
  decimal: SeparadorDecimal,
  diagnosticos: Diagnostico[],
): ContaRazao[] {
  const contas: ContaRazao[] = [];
  let aberta: {
    codigo: string;
    descricao: string;
    saldoAnterior: Centavos | null;
    saldoAtual: Centavos | null;
    lancamentos: LancamentoRazao[];
  } | null = null;

  const fechar = (): void => {
    if (aberta !== null) contas.push({ ...aberta, lancamentos: aberta.lancamentos });
    aberta = null;
  };

  for (const registro of registros) {
    if (vazio(registro)) continue;
    const texto = normalizar(registro.campos.join(' '));

    if (comecaCom(texto, INICIOS_DE_SALDO_ANTERIOR)) {
      if (aberta !== null) aberta.saldoAnterior = lerSaldo(registro, colunas, decimal);
      continue;
    }
    if (comecaCom(texto, INICIOS_DE_SALDO_ATUAL)) {
      if (aberta !== null) aberta.saldoAtual = lerSaldo(registro, colunas, decimal);
      continue;
    }
    if (comecaCom(texto, INICIOS_DE_TOTAL)) continue;

    // Lançamento antes de cabeçalho de conta: só a linha com valor é
    // lançamento, e é essa ordem que impede a data "01/08/2025" de ser lida
    // como código de conta.
    const movimento = lerMovimento(registro, colunas, decimal);
    if (movimento !== null) {
      if (aberta === null) {
        diagnosticos.push({
          severidade: 'aviso',
          codigo: 'lancamento-sem-conta',
          mensagem: 'Lançamento antes de qualquer cabeçalho de conta; ignorado.',
          linha: registro.linha,
        });
        continue;
      }
      aberta.lancamentos.push(lancamentoDe(registro, colunas, movimento));
      continue;
    }

    const conta = extrairCabecalhoDeConta(registro);
    if (conta !== null) {
      fechar();
      aberta = { ...conta, saldoAnterior: null, saldoAtual: null, lancamentos: [] };
    }
  }

  fechar();
  return contas;
}

/** Lê "CONTA: 1.1.3.01 - MATÉRIAS-PRIMAS", em um campo ou espalhado em dois. */
function extrairCabecalhoDeConta(
  registro: RegistroCsv,
): { readonly codigo: string; readonly descricao: string } | null {
  const campos = registro.campos.map((campo) => campo.trim());

  for (let i = 0; i < campos.length; i += 1) {
    const campo = campos[i] as string;
    if (campo === '') continue;
    const casado = CODIGO_DE_CONTA.exec(campo);
    if (casado === null) continue;

    const codigo = casado[1] as string;
    if (!/[0-9]/.test(codigo)) continue;

    const resto = (casado[2] ?? '').trim();
    if (resto !== '') return { codigo, descricao: resto };

    const seguinte = campos.slice(i + 1).find((outro) => outro !== '');
    return { codigo, descricao: seguinte ?? '' };
  }
  return null;
}

/**
 * `saldo_anterior + Σdébitos − Σcréditos` tem de dar `saldo_atual`.
 *
 * Se não fecha, o consumo derivado daquela conta é ficção — e derivar assim
 * mesmo produziria o número plausível e falso que o RF-29 existe para impedir.
 * Erro por conta, não pelo arquivo: uma conta torta não invalida as outras.
 */
function conferirIdentidade(contas: readonly ContaRazao[], diagnosticos: Diagnostico[]): void {
  for (const conta of contas) {
    if (conta.saldoAnterior === null || conta.saldoAtual === null) continue;
    const movimento = conta.lancamentos.reduce(
      (soma, lancamento) => soma + lancamento.debito - lancamento.credito,
      0n,
    );
    const esperado = conta.saldoAnterior + movimento;
    if (esperado === conta.saldoAtual) continue;
    diagnosticos.push({
      severidade: 'erro',
      codigo: 'razao-nao-fecha',
      mensagem:
        `Na conta ${conta.codigo}, saldo anterior mais débitos menos créditos não dá o saldo ` +
        'atual. Faltam lançamentos no arquivo ou algum valor foi lido errado.',
      linha: null,
    });
  }
}
