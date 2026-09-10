/**
 * Validação do mapeamento.
 *
 * Roda duas vezes de propósito (ADR-0002): quando o gestor salva, que é onde a
 * mensagem boa é dada, e de novo na aplicação, porque o mapeamento volta do
 * banco a cada importação e pode ter sido gravado por uma versão anterior do
 * código. A duplicação é barata e se paga na primeira vez que salva alguém.
 */
import type { Nivel } from '@estoque-pme/motor-calculo';
import { descendeDe } from './subarvore';
import type { DiagnosticoDeMapeamento, Mapeamento, PapelDeConta } from './tipos';

const NIVEIS: readonly Nivel[] = ['MP', 'PP', 'PA'];

function classificadas(mapeamento: Mapeamento): { codigo: string; papel: PapelDeConta }[] {
  return mapeamento.entradas.flatMap((entrada) =>
    entrada.decisao.estado === 'classificada'
      ? [{ codigo: entrada.codigo, papel: entrada.decisao.papel }]
      : [],
  );
}

function temEstoqueDe(mapeamento: Mapeamento, nivel: Nivel): boolean {
  return classificadas(mapeamento).some(
    ({ papel }) => papel.papel === 'estoque' && papel.nivel === nivel,
  );
}

/**
 * Confere as invariantes do mapeamento.
 *
 * Erro é o que impede produzir um `Lancamento` confiável; aviso é o que o
 * gestor precisa saber sem que o número fique errado por causa disso.
 */
export function validarMapeamento(mapeamento: Mapeamento): readonly DiagnosticoDeMapeamento[] {
  const diagnosticos: DiagnosticoDeMapeamento[] = [];
  const vistos = new Set<string>();

  for (const entrada of mapeamento.entradas) {
    if (entrada.codigo.trim() === '') {
      diagnosticos.push({
        severidade: 'erro',
        codigo: 'conta-sem-codigo',
        mensagem: 'Entrada de mapeamento sem código de conta.',
        conta: null,
      });
      continue;
    }

    if (vistos.has(entrada.codigo)) {
      diagnosticos.push({
        severidade: 'erro',
        codigo: 'conta-duplicada',
        mensagem: `A conta ${entrada.codigo} aparece mais de uma vez no mapeamento.`,
        conta: entrada.codigo,
      });
    }
    vistos.add(entrada.codigo);

    // Posse de subárvore: mapear um descendente de conta já mapeada contaria o
    // mesmo dinheiro duas vezes. É erro, nunca aviso.
    for (const outra of mapeamento.entradas) {
      if (descendeDe(entrada.codigo, outra.codigo)) {
        diagnosticos.push({
          severidade: 'erro',
          codigo: 'sobreposicao-de-subarvore',
          mensagem: `A conta ${entrada.codigo} está mapeada e a conta ${outra.codigo}, acima dela, também. Cada real do balancete tem de ser contado por exatamente um mapeamento.`,
          conta: entrada.codigo,
        });
      }
    }
  }

  for (const nivel of NIVEIS) {
    const ausente = mapeamento.niveisAusentes.includes(nivel);
    const mapeado = temEstoqueDe(mapeamento, nivel);

    if (ausente && mapeado) {
      diagnosticos.push({
        severidade: 'erro',
        codigo: 'nivel-ausente-e-mapeado',
        mensagem: `O nível ${nivel} está declarado ausente e ao mesmo tempo tem conta classificada.`,
        conta: null,
      });
    }
  }

  if (!temEstoqueDe(mapeamento, 'MP') && !mapeamento.niveisAusentes.includes('MP')) {
    diagnosticos.push({
      severidade: 'erro',
      codigo: 'mp-nao-mapeada',
      mensagem:
        'Nenhuma conta classificada como estoque de MP. Sem MP não há PME de matéria-prima, custo de materiais nem teto de compras — classifique a conta ou declare o nível ausente.',
      conta: null,
    });
  }

  // MP declarada ausente é permitido e estranho: numa indústria de alimentos
  // significa que a matéria-prima está dentro de outro nível, inflando o PME
  // dele. É a mesma armadilha que o D6 descreve para PP, e o relatório não pode
  // deixar isso passar como ciclo curto.
  if (mapeamento.niveisAusentes.includes('MP')) {
    diagnosticos.push({
      severidade: 'aviso',
      codigo: 'mp-declarada-ausente',
      mensagem:
        'MP declarada ausente. A matéria-prima provavelmente está dentro de outro nível, inflando o PME dele.',
      conta: null,
    });
  }

  if (!classificadas(mapeamento).some(({ papel }) => papel.papel === 'cmv')) {
    diagnosticos.push({
      severidade: 'erro',
      codigo: 'cmv-nao-mapeado',
      mensagem:
        'Nenhuma conta classificada como CMV. O CMV é o direcionador de custo de PP e de PA — sem ele nenhum dos dois tem PME.',
      conta: null,
    });
  }

  if (!classificadas(mapeamento).some(({ papel }) => papel.papel === 'receita')) {
    diagnosticos.push({
      severidade: 'aviso',
      codigo: 'receita-nao-mapeada',
      mensagem:
        'Nenhuma conta classificada como receita. NCG e ciclo financeiro sairão indefinidos (D2).',
      conta: null,
    });
  }

  return diagnosticos;
}
