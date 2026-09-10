/**
 * XLSX como front-end do que já existe.
 *
 * Uma planilha não traz problema novo de semântica — traz outra forma de chegar
 * às células. Convertê-la nos mesmos `RegistroCsv` que o leitor de CSV produz
 * faz `localizarCabecalho`, `reconhecerCabecalho` e `extrairLinhas` funcionarem
 * sem alteração, para balancete e razão de uma vez, e mantém **uma**
 * implementação da parte difícil: reconhecer o layout do ERP.
 *
 * É o único módulo do pacote com dependência de runtime e com função `async`.
 * A fronteira é deliberada: o núcleo continua síncrono e puro, e quem quiser só
 * ler CSV não carrega o ExcelJS junto.
 *
 * **Por que ExcelJS e não SheetJS**, contra o que a tabela de stack do
 * CLAUDE.md dizia: o `xlsx` do npm está parado em 0.18.5 com CVE-2023-30533
 * (prototype pollution via arquivo criado para isso — o nosso modelo de ameaça,
 * já que ingerir arquivo do cliente é o que este produto faz) e CVE-2024-22363.
 * As correções nunca foram publicadas no npm. ExcelJS já estava na stack para
 * escrever XLSX, então é uma dependência em vez de duas.
 */
import { Workbook } from 'exceljs';
import { DECIMAL_DA_PLANILHA } from './aba';
import type { Aba, Planilha } from './aba';
import type { RegistroCsv } from './csv';

export type { Aba, Planilha } from './aba';
export { DECIMAL_DA_PLANILHA } from './aba';

/**
 * Converte uma célula no texto que ela teria num CSV.
 *
 * Número vira texto sem separador de milhar e com vírgula decimal — sem milhar
 * porque é ruído que `lerValor` teria de desfazer, e com vírgula pelo motivo
 * acima. Data vira `dd/mm/aaaa`: nenhum cálculo a usa, ela é rastro de
 * auditoria, e o formato é o que o gestor reconhece.
 */
function textoDaCelula(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'boolean') return valor ? 'true' : 'false';

  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? String(valor).replace('.', DECIMAL_DA_PLANILHA) : '';
  }

  if (valor instanceof Date) {
    const dia = String(valor.getUTCDate()).padStart(2, '0');
    const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${valor.getUTCFullYear()}`;
  }

  if (typeof valor === 'object') {
    const objeto = valor as Record<string, unknown>;

    // Fórmula: interessa o resultado, não a fórmula. Um arquivo com o resultado
    // em cache é o caso normal; sem cache, a célula fica vazia e vira
    // diagnóstico lá na frente, como qualquer célula ilegível.
    if ('result' in objeto) return textoDaCelula(objeto['result']);
    if ('richText' in objeto && Array.isArray(objeto['richText'])) {
      return (objeto['richText'] as readonly { text?: string }[])
        .map((parte) => parte.text ?? '')
        .join('');
    }
    if ('text' in objeto) return textoDaCelula(objeto['text']);
    // Célula de erro (#VALOR!, #REF!): o texto do erro atravessa e vira
    // diagnóstico de valor inválido, com número de linha, como no CSV.
    if ('error' in objeto) return String(objeto['error']);
  }

  return String(valor);
}

/**
 * Lê os bytes de um XLSX.
 *
 * Devolve todas as abas: qual delas é o balancete é decisão de quem chama, e
 * `lerBalanceteDeAba` sabe escolher pela nota do cabeçalho quando recebe a
 * planilha inteira.
 */
export async function lerPlanilha(bytes: Uint8Array): Promise<Planilha> {
  const workbook = new Workbook();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  await workbook.xlsx.load(buffer as ArrayBuffer);

  const abas: Aba[] = [];

  workbook.eachSheet((planilha) => {
    const registros: RegistroCsv[] = [];
    const colunas = planilha.columnCount;

    planilha.eachRow({ includeEmpty: true }, (linha, numero) => {
      const campos: string[] = [];
      for (let coluna = 1; coluna <= colunas; coluna += 1) {
        campos.push(textoDaCelula(linha.getCell(coluna).value).trim());
      }
      // O número da linha é o da planilha, 1-based: é o que o gestor vê ao
      // abrir o arquivo no Excel, e sem ele o aviso não serve para nada.
      registros.push({ linha: numero, campos });
    });

    abas.push({ nome: planilha.name, registros });
  });

  return { abas };
}
