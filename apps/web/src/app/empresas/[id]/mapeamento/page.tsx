import { contasDaEmpresa, mapeamentoCorrente } from '@estoque-pme/dados';
import { MAPEAMENTO_VAZIO, proporMapeamento } from '@estoque-pme/mapeamento';
import { naEmpresaOu404 } from '@/servidor/acesso';
import { paraFormulario } from './decisoes';
import type { ContaNaTela } from './decisoes';
import { Formulario } from './formulario';

/**
 * A tela do RF-28: o produto propõe, o gestor confirma.
 *
 * Toda conta aparece com um `<select>`. Pendente vem com a sugestão
 * pré-selecionada — mas é pendente até o gestor salvar, e "ignorar esta conta"
 * está na lista de todas, porque é a única saída de um nível `indefinido` por
 * conta com a cara dele (ADR-0011).
 */
export default async function Mapeamento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { contas, ausentes, versao, papel } = await naEmpresaOu404(id, async ({ tx, papel }) => {
    const linhas = await contasDaEmpresa(tx, id);
    const corrente = await mapeamentoCorrente(tx, id);
    const mapeamento = corrente?.mapeamento ?? MAPEAMENTO_VAZIO;
    const pendentes = proporMapeamento(linhas, mapeamento);
    const pendentePorCodigo = new Map(pendentes.map((p) => [p.codigo, p]));
    const entradaPorCodigo = new Map(mapeamento.entradas.map((e) => [e.codigo, e]));

    const contas: ContaNaTela[] = linhas.map((l) => {
      const entrada = entradaPorCodigo.get(l.codigo);
      const pendente = pendentePorCodigo.get(l.codigo);
      const sugestao =
        pendente?.sugestao.estado === 'sugerido'
          ? {
              decisao: paraFormulario({ estado: 'classificada', papel: pendente.sugestao.papel }),
              motivo: pendente.sugestao.motivo,
            }
          : null;
      return {
        codigo: l.codigo,
        descricao: l.descricao,
        grau: l.grau,
        sintetica: l.sintetica,
        atual: entrada ? paraFormulario(entrada.decisao) : (sugestao?.decisao ?? 'pendente'),
        sugestao,
        incoerente: pendente?.sugestao.estado === 'incoerente' ? pendente.sugestao.motivo : null,
        coberta: entrada === undefined && pendente === undefined,
      };
    });

    return { contas, ausentes: mapeamento.niveisAusentes, versao: corrente?.versao ?? null, papel };
  });

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-medium">Mapeamento de contas</h2>
        <span className="text-xs text-stone-500">
          {versao === null ? 'nenhuma versão ainda' : `versão ${versao}`}
        </span>
      </div>
      {contas.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          Nenhuma conta conhecida ainda. Importe um balancete primeiro — o mapeamento nasce das contas que
          o arquivo revela.
        </p>
      ) : (
        <Formulario
          empresaId={id}
          contas={contas}
          ausentes={ausentes}
          podeEscrever={papel === 'editor'}
        />
      )}
    </section>
  );
}
