/**
 * Leitura do balancete: bytes entram, contas saem.
 *
 * O contrato do RF-01 governa o arquivo inteiro: **nada aqui lança exceção por
 * causa de dado ruim**. Linha ilegível vira diagnóstico com número e motivo, e
 * a leitura segue — um arquivo com trinta contas boas e uma torta importa as
 * trinta. Abortar o lote transformaria o produto naquilo que ele existe para
 * substituir: transcrição à mão.
 */
import type { Centavos } from '@estoque-pme/motor-calculo';
import { lerCsv, vazio, type RegistroCsv } from './csv';
import { detectarDialeto } from './dialeto';
import { detectarCompetencia } from './competencia';
import { reconhecerCabecalho } from './colunas';
import { decodificar, normalizar } from './texto';
import { CASAS_DECIMAIS_ESPERADAS, casasDecimais, lerValor } from './numero';
import type {
  ColunasBalancete,
  Competencia,
  Diagnostico,
  LinhaBalancete,
  PerfilImportacao,
  ResultadoBalancete,
  SeparadorDecimal,
} from './tipos';

/** Até onde procurar o cabeçalho antes de desistir. Preâmbulo de ERP é curto. */
const LINHAS_ATE_O_CABECALHO = 40;

/** Separadores de nível usados em plano de contas brasileiro. */
const SEPARADORES_DE_GRAU = /[.\-/]/;

const INICIOS_DE_TOTAL = ['total', 'totais', 'soma', 'subtotal', 'transporte'];

export interface OpcoesBalancete {
  /** Layout já conhecido deste ERP (RF-24). Quando vem, a detecção é pulada. */
  readonly perfil?: PerfilImportacao;
  /** Competência informada pelo gestor, para quando o arquivo não a traz. */
  readonly competencia?: Competencia;
}

export function lerBalancete(bytes: Uint8Array, opcoes: OpcoesBalancete = {}): ResultadoBalancete {
  const diagnosticos: Diagnostico[] = [];
  const { perfil } = opcoes;

  const { texto, codificacao } = decodificar(bytes, perfil?.codificacao);
  if (codificacao !== 'utf-8' && perfil === undefined) {
    diagnosticos.push({
      severidade: 'info',
      codigo: 'codificacao-detectada',
      mensagem: `Arquivo lido como ${codificacao}; confira a acentuação na descrição das contas.`,
      linha: null,
    });
  }

  const dialeto =
    perfil !== undefined
      ? { delimitador: perfil.delimitador, separadorDecimal: perfil.separadorDecimal }
      : detectarDialeto(texto);

  const registros = lerCsv(texto, dialeto.delimitador);
  const cabecalho = localizarCabecalho(registros, perfil);

  if (cabecalho === null) {
    diagnosticos.push({
      severidade: 'erro',
      codigo: 'cabecalho-nao-encontrado',
      mensagem:
        'Não foi possível identificar a linha de cabeçalho com as colunas de conta e saldo. ' +
        'Confira se o arquivo é um balancete e não outro relatório.',
      linha: null,
    });
    return { competencia: opcoes.competencia ?? null, linhas: [], diagnosticos, perfil: null };
  }

  const { indice, colunas } = cabecalho;
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

  const linhas = extrairLinhas(
    registros.slice(indice + 1),
    registros[indice] as RegistroCsv,
    colunas,
    dialeto.separadorDecimal,
    diagnosticos,
  );

  if (linhas.length === 0) {
    diagnosticos.push({
      severidade: 'erro',
      codigo: 'nenhuma-conta-lida',
      mensagem: 'O cabeçalho foi reconhecido, mas nenhuma linha de conta pôde ser lida.',
      linha: null,
    });
  }

  return {
    competencia,
    linhas: marcarSinteticas(linhas),
    diagnosticos,
    perfil: {
      codificacao,
      delimitador: dialeto.delimitador,
      separadorDecimal: dialeto.separadorDecimal,
      linhaCabecalho: indice,
      colunas,
    },
  };
}

interface Cabecalho {
  readonly indice: number;
  readonly colunas: ColunasBalancete;
}

/**
 * Acha a linha de cabeçalho pela melhor nota, não pela primeira que serve.
 *
 * Uma linha de preâmbulo com a palavra "Conta" no meio passa num teste frouxo;
 * a linha verdadeira reconhece mais papéis que qualquer outra. Varrer as
 * candidatas e ficar com a melhor é mais barato que qualquer heurística de
 * posição, e não quebra quando o ERP muda o tamanho do preâmbulo.
 */
function localizarCabecalho(
  registros: readonly RegistroCsv[],
  perfil: PerfilImportacao | undefined,
): Cabecalho | null {
  if (perfil !== undefined) {
    return registros[perfil.linhaCabecalho] === undefined
      ? null
      : { indice: perfil.linhaCabecalho, colunas: perfil.colunas };
  }

  let melhor: Cabecalho | null = null;
  let melhorNota = 0;
  const ate = Math.min(registros.length, LINHAS_ATE_O_CABECALHO);

  for (let i = 0; i < ate; i += 1) {
    const registro = registros[i] as RegistroCsv;
    if (vazio(registro)) continue;
    const reconhecido = reconhecerCabecalho(registro.campos);
    if (reconhecido !== null && reconhecido.nota > melhorNota) {
      melhorNota = reconhecido.nota;
      melhor = { indice: i, colunas: reconhecido.colunas };
    }
  }
  return melhor;
}

function extrairLinhas(
  registros: readonly RegistroCsv[],
  cabecalho: RegistroCsv,
  colunas: ColunasBalancete,
  decimal: SeparadorDecimal,
  diagnosticos: Diagnostico[],
): LinhaBalancete[] {
  const assinaturaCabecalho = assinatura(cabecalho.campos);
  const ultimaColuna = Math.max(
    colunas.codigo,
    colunas.descricao,
    colunas.saldoAtual,
    colunas.saldoAnterior ?? 0,
    colunas.debito ?? 0,
    colunas.credito ?? 0,
  );
  const linhas: LinhaBalancete[] = [];
  let avisouCasasDecimais = false;

  for (const registro of registros) {
    if (vazio(registro)) continue;

    // Relatório de ERP repete o cabeçalho a cada quebra de página.
    if (assinatura(registro.campos) === assinaturaCabecalho) continue;

    const codigo = celula(registro, colunas.codigo).trim();
    const descricao = celula(registro, colunas.descricao).trim();

    if (ehTotal(codigo, descricao)) continue;
    if (codigo === '' && descricao === '') continue;

    if (registro.campos.length <= ultimaColuna) {
      diagnosticos.push({
        severidade: 'erro',
        codigo: 'colunas-insuficientes',
        mensagem:
          `A linha tem ${registro.campos.length} coluna(s) e o cabeçalho declara ` +
          `${ultimaColuna + 1}. Linha ignorada.`,
        linha: registro.linha,
      });
      continue;
    }

    const valores = lerColunasDeValor(registro, colunas, decimal, diagnosticos);
    if (valores === null) continue;

    if (!avisouCasasDecimais && excedeCasasDecimais(registro, colunas, decimal)) {
      avisouCasasDecimais = true;
      diagnosticos.push({
        severidade: 'aviso',
        codigo: 'casas-decimais-inesperadas',
        mensagem:
          `Há valores com mais de ${CASAS_DECIMAIS_ESPERADAS} casas decimais, arredondados ao ` +
          'centavo. Confira se o arquivo é um balancete e não um relatório de custo unitário.',
        linha: registro.linha,
      });
    }

    if (codigo === '') {
      diagnosticos.push({
        severidade: 'aviso',
        codigo: 'conta-sem-codigo',
        mensagem: `A conta "${descricao}" não tem código e não poderá ser mapeada por código (RF-28).`,
        linha: registro.linha,
      });
    }

    linhas.push({
      linha: registro.linha,
      codigo,
      descricao,
      saldoAnterior: valores.saldoAnterior,
      debito: valores.debito,
      credito: valores.credito,
      saldoAtual: valores.saldoAtual,
      grau: grauDe(codigo),
      sintetica: false,
    });
  }

  return linhas;
}

interface ValoresDaLinha {
  readonly saldoAnterior: Centavos | null;
  readonly debito: Centavos;
  readonly credito: Centavos;
  readonly saldoAtual: Centavos | null;
}

/**
 * Lê as colunas de valor, devolvendo `null` quando a linha é imprestável.
 *
 * Saldo ilegível derruba a linha — é o número de que o cálculo do PME depende.
 * Débito e crédito ilegíveis não derrubam: são conferência, e o PME não os usa.
 */
function lerColunasDeValor(
  registro: RegistroCsv,
  colunas: ColunasBalancete,
  decimal: SeparadorDecimal,
  diagnosticos: Diagnostico[],
): ValoresDaLinha | null {
  const atual = lerValor(celula(registro, colunas.saldoAtual), decimal);
  if (atual.estado === 'invalido') {
    diagnosticos.push({
      severidade: 'erro',
      codigo: 'saldo-ilegivel',
      mensagem: `Saldo atual ilegível: ${atual.motivo}. Linha ignorada.`,
      linha: registro.linha,
      coluna: 'saldo atual',
    });
    return null;
  }

  const anterior =
    colunas.saldoAnterior === null
      ? ({ estado: 'vazio' } as const)
      : lerValor(celula(registro, colunas.saldoAnterior), decimal);
  if (anterior.estado === 'invalido') {
    diagnosticos.push({
      severidade: 'erro',
      codigo: 'saldo-ilegivel',
      mensagem: `Saldo anterior ilegível: ${anterior.motivo}. Linha ignorada.`,
      linha: registro.linha,
      coluna: 'saldo anterior',
    });
    return null;
  }

  return {
    saldoAnterior: anterior.estado === 'lido' ? anterior.valor : null,
    saldoAtual: atual.estado === 'lido' ? atual.valor : null,
    debito: movimento(registro, colunas.debito, decimal, 'débito', diagnosticos),
    credito: movimento(registro, colunas.credito, decimal, 'crédito', diagnosticos),
  };
}

/**
 * Movimento do período. Coluna ausente ou em branco é `0n`, não `null`.
 *
 * Aqui zero é a resposta certa e não uma lacuna: em balancete, coluna de
 * movimento vazia significa que não houve movimento. É o oposto do saldo, e a
 * diferença é o motivo de os dois seguirem por caminhos separados.
 */
function movimento(
  registro: RegistroCsv,
  indice: number | null,
  decimal: SeparadorDecimal,
  nome: string,
  diagnosticos: Diagnostico[],
): Centavos {
  if (indice === null) return 0n;
  const lido = lerValor(celula(registro, indice), decimal);
  if (lido.estado === 'invalido') {
    diagnosticos.push({
      severidade: 'aviso',
      codigo: 'movimento-ilegivel',
      mensagem: `Movimento de ${nome} ilegível: ${lido.motivo}. Considerado zero.`,
      linha: registro.linha,
      coluna: nome,
    });
    return 0n;
  }
  // O sentido do movimento é dado pela coluna em que ele está, não pela letra
  // que o ERP escreveu ao lado: débito é a coluna de débito.
  return lido.estado === 'lido' ? absoluto(lido.valor) : 0n;
}

/**
 * Marca como sintética toda conta que tem outra descendendo dela.
 *
 * Sem isto, mapear o grupo "1.1.3 Estoques" e também as suas filhas soma o
 * mesmo dinheiro duas vezes. O importador não decide o que entra — isso é do
 * mapeamento (RF-28) —, mas entrega a informação sem a qual a decisão não tem
 * como ser tomada.
 */
function marcarSinteticas(linhas: readonly LinhaBalancete[]): LinhaBalancete[] {
  const codigos = linhas.map((linha) => linha.codigo).filter((codigo) => codigo !== '');
  return linhas.map((linha) => {
    if (linha.codigo === '') return linha;
    const temFilha = codigos.some(
      (outro) =>
        outro.length > linha.codigo.length &&
        outro.startsWith(linha.codigo) &&
        SEPARADORES_DE_GRAU.test(outro.charAt(linha.codigo.length)),
    );
    return temFilha ? { ...linha, sintetica: true } : linha;
  });
}

function grauDe(codigo: string): number {
  const partes = codigo.split(SEPARADORES_DE_GRAU).filter((parte) => parte !== '');
  return Math.max(partes.length, 1);
}

function ehTotal(codigo: string, descricao: string): boolean {
  if (codigo !== '' && /\d/.test(codigo)) return false;
  const texto = normalizar(descricao);
  return INICIOS_DE_TOTAL.some((inicio) => texto === inicio || texto.startsWith(`${inicio} `));
}

function excedeCasasDecimais(
  registro: RegistroCsv,
  colunas: ColunasBalancete,
  decimal: SeparadorDecimal,
): boolean {
  const indices = [colunas.saldoAtual, colunas.saldoAnterior, colunas.debito, colunas.credito];
  return indices.some(
    (indice) =>
      indice !== null && casasDecimais(celula(registro, indice), decimal) > CASAS_DECIMAIS_ESPERADAS,
  );
}

function celula(registro: RegistroCsv, indice: number): string {
  return registro.campos[indice] ?? '';
}

function assinatura(campos: readonly string[]): string {
  return campos.map(normalizar).join('|');
}

function absoluto(valor: Centavos): Centavos {
  return valor < 0n ? -valor : valor;
}
