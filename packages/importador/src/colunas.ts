/**
 * Reconhecimento das colunas do balancete.
 *
 * Nenhum ERP escreve o cabeçalho igual ao outro, e o cabeçalho quase nunca está
 * na primeira linha: antes dele vêm razão social, CNPJ, título do relatório e
 * o período. Achar a linha de cabeçalho é o primeiro problema; dizer qual
 * coluna é qual é o segundo.
 */
import { normalizar } from './texto';
import type { ColunasBalancete } from './tipos';

export type PapelDeColuna = keyof ColunasBalancete;

/**
 * Sinônimos por papel, do mais específico para o menos.
 *
 * A ordem por comprimento é o que faz "saldo anterior" ganhar de "saldo" —
 * casar pelo rótulo curto primeiro classificaria a coluna de abertura como a de
 * fechamento, e o PME sairia calculado sobre o saldo errado sem nada acusar.
 */
const SINONIMOS: Readonly<Record<PapelDeColuna, readonly string[]>> = {
  saldoAnterior: [
    'saldo anterior',
    'saldo anter',
    'sld anterior',
    'saldo inicial',
    'anterior',
    'inicial',
  ],
  saldoAtual: [
    'saldo atual',
    'saldo final',
    'saldo do periodo',
    'sld atual',
    'saldo',
    'final',
    'atual',
  ],
  debito: ['movimento devedor', 'movimentacao devedora', 'valor debito', 'debitos', 'debito', 'deb'],
  credito: ['movimento credor', 'movimentacao credora', 'valor credito', 'creditos', 'credito', 'cred'],
  codigo: [
    'codigo da conta',
    'codigo conta',
    'classificacao',
    'classific',
    'reduzido',
    'codigo',
    'class',
    'conta',
    'cta',
    'cod',
  ],
  descricao: [
    'descricao da conta',
    'nome da conta',
    'especificacao',
    'descricao',
    'historico',
    'titulo',
    'nome',
    'conta',
  ],
};

/**
 * Pares (papel, sinônimo) ordenados do rótulo mais longo para o mais curto.
 *
 * Genérico porque o razão reconhece o cabeçalho dele pela mesma regra: a ordem
 * por comprimento e a atribuição gulosa são a parte difícil, e ter duas cópias
 * dela seria ter duas regras que divergem na primeira correção.
 */
export function paresDe<P extends string>(
  sinonimos: Readonly<Record<P, readonly string[]>>,
): readonly (readonly [P, string])[] {
  return Object.entries(sinonimos)
    .flatMap(([papel, rotulos]) =>
      (rotulos as readonly string[]).map((rotulo) => [papel as P, rotulo] as const),
    )
    .sort((a, b) => b[1].length - a[1].length);
}

const PARES = paresDe(SINONIMOS);

/** Papéis que uma célula de cabeçalho pode ter, do mais provável para o menos. */
export function papeisDaCelula<P extends string>(
  celula: string,
  pares: readonly (readonly [P, string])[],
): P[] {
  const texto = normalizar(celula);
  if (texto === '') return [];

  const encontrados: P[] = [];
  for (const [papel, rotulo] of pares) {
    if (encontrados.includes(papel)) continue;
    if (texto === rotulo || texto.startsWith(`${rotulo} `) || texto.endsWith(` ${rotulo}`)) {
      encontrados.push(papel);
    }
  }
  if (encontrados.length === 0) {
    for (const [papel, rotulo] of pares) {
      if (!encontrados.includes(papel) && texto.includes(rotulo)) encontrados.push(papel);
    }
  }
  return encontrados;
}

/**
 * Atribuição gulosa da esquerda para a direita: cada célula fica com o melhor
 * papel ainda livre.
 */
export function atribuirPapeis<P extends string>(
  campos: readonly string[],
  pares: readonly (readonly [P, string])[],
): Map<P, number> {
  const atribuido = new Map<P, number>();
  campos.forEach((celula, indice) => {
    for (const papel of papeisDaCelula(celula, pares)) {
      if (!atribuido.has(papel)) {
        atribuido.set(papel, indice);
        return;
      }
    }
  });
  return atribuido;
}

export interface CabecalhoReconhecido {
  readonly colunas: ColunasBalancete;
  readonly nota: number;
}

/**
 * Tenta ler uma linha como cabeçalho.
 *
 * Atribuição gulosa da esquerda para a direita: cada célula fica com o melhor
 * papel ainda livre. É o que resolve o balancete que traz "Conta" e "Descrição"
 * — "Conta" pega `codigo`, e "Descrição" pega `descricao` — e também o que traz
 * "Código" e "Conta", onde a segunda cai para `descricao` por já não haver
 * `codigo` disponível.
 */
export function reconhecerCabecalho(campos: readonly string[]): CabecalhoReconhecido | null {
  const atribuido = atribuirPapeis(campos, PARES);

  const codigo = atribuido.get('codigo');
  const descricao = atribuido.get('descricao');
  const saldoAtual = atribuido.get('saldoAtual');

  // Sem identificar a conta e o saldo de fechamento não há balancete: o saldo
  // final é a única coluna de que o cálculo do PME não abre mão.
  if (saldoAtual === undefined || (codigo === undefined && descricao === undefined)) {
    return null;
  }

  return {
    colunas: {
      codigo: codigo ?? (descricao as number),
      descricao: descricao ?? (codigo as number),
      saldoAnterior: atribuido.get('saldoAnterior') ?? null,
      debito: atribuido.get('debito') ?? null,
      credito: atribuido.get('credito') ?? null,
      saldoAtual,
    },
    nota: atribuido.size,
  };
}
