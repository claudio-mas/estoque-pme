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

export type Papel = keyof ColunasBalancete;

/**
 * Sinônimos por papel, do mais específico para o menos.
 *
 * A ordem por comprimento é o que faz "saldo anterior" ganhar de "saldo" —
 * casar pelo rótulo curto primeiro classificaria a coluna de abertura como a de
 * fechamento, e o PME sairia calculado sobre o saldo errado sem nada acusar.
 */
const SINONIMOS: Readonly<Record<Papel, readonly string[]>> = {
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

/** Pares (papel, sinônimo) ordenados do rótulo mais longo para o mais curto. */
const PARES: readonly (readonly [Papel, string])[] = Object.entries(SINONIMOS)
  .flatMap(([papel, rotulos]) => rotulos.map((rotulo) => [papel as Papel, rotulo] as const))
  .sort((a, b) => b[1].length - a[1].length);

/** Papéis que uma célula de cabeçalho pode ter, do mais provável para o menos. */
function papeisDe(celula: string): Papel[] {
  const texto = normalizar(celula);
  if (texto === '') return [];

  const encontrados: Papel[] = [];
  for (const [papel, rotulo] of PARES) {
    if (encontrados.includes(papel)) continue;
    if (texto === rotulo || texto.startsWith(`${rotulo} `) || texto.endsWith(` ${rotulo}`)) {
      encontrados.push(papel);
    }
  }
  if (encontrados.length === 0) {
    for (const [papel, rotulo] of PARES) {
      if (!encontrados.includes(papel) && texto.includes(rotulo)) encontrados.push(papel);
    }
  }
  return encontrados;
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
  const atribuido = new Map<Papel, number>();

  campos.forEach((celula, indice) => {
    for (const papel of papeisDe(celula)) {
      if (!atribuido.has(papel)) {
        atribuido.set(papel, indice);
        return;
      }
    }
  });

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
