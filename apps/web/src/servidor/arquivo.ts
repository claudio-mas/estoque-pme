/**
 * Um arquivo qualquer do ERP vira balancete ou razão lido — sem perguntar.
 *
 * O gestor sobe o que exportou; o produto decide se é CSV ou XLSX pelos bytes,
 * e se é balancete ou razão pelo cabeçalho, por pontuação. É a promessa do D3
 * mais uma vez, e a mesma pergunta que já decidiu delimitador, decimal e
 * formato do razão: o que o produto responde melhor, o gestor não escolhe.
 *
 * Puro no sentido que importa aqui: bytes entram, resultado sai. Nada de banco.
 */
import {
  decodificar,
  detectarArtefato,
  detectarDialeto,
  lerBalancete,
  lerBalanceteDeAba,
  lerCsv,
  lerPlanilha,
  lerRazao,
  lerRazaoDeAba,
} from '@estoque-pme/importador';
import type { Artefato, Planilha, ResultadoBalancete, ResultadoRazao } from '@estoque-pme/importador';

export type ArquivoLido =
  | { readonly artefato: 'balancete'; readonly resultado: ResultadoBalancete }
  | { readonly artefato: 'razao'; readonly resultado: ResultadoRazao }
  | { readonly artefato: null; readonly motivo: string };

/** XLSX é um ZIP: começa com `PK`. É o bastante para não tentar decodificar como texto. */
function ehZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/** A aba com o melhor cabeçalho decide o artefato da planilha inteira. */
function artefatoDaPlanilha(planilha: Planilha): Artefato | null {
  let melhor: { artefato: Artefato; nota: number } | null = null;
  for (const aba of planilha.abas) {
    const d = detectarArtefato(aba.registros);
    if (d !== null && (melhor === null || d.nota > melhor.nota)) melhor = d;
  }
  return melhor?.artefato ?? null;
}

const NENHUM = 'O arquivo não parece balancete nem razão: nenhum cabeçalho reconhecível.';

export async function lerArquivo(bytes: Uint8Array): Promise<ArquivoLido> {
  if (ehZip(bytes)) {
    const planilha = await lerPlanilha(bytes);
    const artefato = artefatoDaPlanilha(planilha);
    if (artefato === null) return { artefato: null, motivo: NENHUM };
    return artefato === 'balancete'
      ? { artefato, resultado: lerBalanceteDeAba(planilha) }
      : { artefato, resultado: lerRazaoDeAba(planilha) };
  }

  const { texto } = decodificar(bytes);
  const dialeto = detectarDialeto(texto);
  const artefato = detectarArtefato(lerCsv(texto, dialeto.delimitador))?.artefato ?? null;
  if (artefato === null) return { artefato: null, motivo: NENHUM };
  return artefato === 'balancete'
    ? { artefato, resultado: lerBalancete(bytes) }
    : { artefato, resultado: lerRazao(bytes) };
}
