import { Vazio } from '@/components/ui/vazio';
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
      <div className="mb-7 flex items-start justify-between gap-5 max-md:mb-5 max-md:flex-wrap max-md:gap-2.5">
        <div>
          <span className="block text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Dados / Mapeamento</span>
          <h2 className="mb-2 mt-1.5 text-[28px] font-semibold leading-tight tracking-[-0.025em] max-md:text-2xl">Mapeamento de contas</h2>
          <p className="max-w-[65ch] text-muted-foreground">Conecte seu plano de contas ao modelo de estoque. Revise as propostas e confirme a classificação.</p>
        </div>
        <span className="mt-[22px] inline-flex items-center whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground max-md:mt-0">
          {versao === null ? 'nenhuma versão ainda' : `versão ${versao}`}
        </span>
      </div>
      {contas.length === 0 ? (
        <Vazio titulo="Nenhuma conta conhecida ainda" descricao="Importe um balancete primeiro. O mapeamento nasce das contas que o arquivo revela." />
      ) : (
        <Formulario
          key={id}
          versaoAtual={versao}
          empresaId={id}
          contas={contas}
          ausentes={ausentes}
          podeEscrever={papel === 'editor'}
        />
      )}
    </section>
  );
}
