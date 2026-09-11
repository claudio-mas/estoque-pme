/**
 * O que os créditos e débitos do razão significam (RF-29, RF-13).
 *
 * O leitor de razão devolve a contrapartida como o código que estava escrito;
 * dizer que 1.1.3.02 é PP e 2.1.1.01 é fornecedor é o mapeamento. É por isso
 * que esta classificação mora aqui e não no importador.
 *
 * A álgebra por trás disto está no ADR-0004: `Custo_Materiais = MP_inicial +
 * Compras − MP_final` colapsa em **"some os créditos"**, porque os saldos e as
 * compras se cancelam. A dificuldade nunca esteve na aritmética; está em
 * decidir quais créditos contam.
 */
import type { ContaRazao, LancamentoRazao, ResultadoRazao } from '@estoque-pme/importador';
import { mensagemDoMotivo, motivoDoNivel } from '@estoque-pme/motor-calculo';
import type { Centavos, ConsumoDeNivel, Motivo, Nivel } from '@estoque-pme/motor-calculo';
import { pertenceA } from './subarvore';
import type { DiagnosticoDeMapeamento, Mapeamento, PapelDeConta } from './tipos';

/** O que a conta do outro lado de um lançamento é, segundo o mapeamento. */
export type Contrapartida =
  | { readonly tipo: 'papel'; readonly papel: PapelDeConta }
  | { readonly tipo: 'ignorada' }
  | { readonly tipo: 'pendente' }
  | { readonly tipo: 'ausente' };

export function classificarContrapartida(
  codigo: string | null,
  mapeamento: Mapeamento,
): Contrapartida {
  if (codigo === null || codigo.trim() === '') return { tipo: 'ausente' };

  const entrada = mapeamento.entradas.find((candidata) => pertenceA(codigo, candidata.codigo));
  if (entrada === undefined) return { tipo: 'pendente' };
  if (entrada.decisao.estado === 'ignorada') return { tipo: 'ignorada' };
  return { tipo: 'papel', papel: entrada.decisao.papel };
}

/**
 * Um crédito do nível `N` é consumo quando sai de `N` para fora dele.
 *
 * Contrapartida em estoque de outro nível é o consumo em si — MP→PP é
 * exatamente matéria-prima consumida na produção. Conta de baixa também conta:
 * a D7 exige que a perda **permaneça** dentro do consumo, porque o consumo lido
 * do razão já a contém e tirá-la seria a dupla contagem que a decisão nomeia
 * como o defeito da formulação original. CMV conta porque há ERP que credita
 * estoque direto contra ele.
 *
 * Não conta: contrapartida no **mesmo** nível — transferência entre almoxarifados
 * não sai do nível — e qualquer outra coisa, tipicamente devolução a fornecedor.
 */
function creditoEhConsumo(contrapartida: Contrapartida, nivel: Nivel): boolean {
  if (contrapartida.tipo !== 'papel') return false;
  const { papel } = contrapartida;
  switch (papel.papel) {
    case 'estoque':
      return papel.nivel !== nivel;
    case 'baixa':
      return true;
    case 'cmv':
      return true;
    case 'receita':
      return false;
  }
}

/**
 * Um débito de MP é compra quando não vem de outro nível de estoque.
 *
 * Lista aberta, ao contrário da dos créditos, e a assimetria é deliberada:
 * fornecedores quase sempre estará `ignorada`, e exigir que ele fosse
 * classificado obrigaria o gestor a mapear contas que não interessam ao
 * modelo — o oposto do que o estado `ignorada` existe para fazer.
 */
function debitoEhCompra(contrapartida: Contrapartida): boolean {
  return !(contrapartida.tipo === 'papel' && contrapartida.papel.papel === 'estoque');
}

/** As contas do razão que as entradas de um nível respondem. */
function contasDoNivel(
  razao: ResultadoRazao,
  mapeamento: Mapeamento,
  nivel: Nivel,
): readonly ContaRazao[] {
  const codigos = mapeamento.entradas
    .filter(
      (entrada) =>
        entrada.decisao.estado === 'classificada' &&
        entrada.decisao.papel.papel === 'estoque' &&
        entrada.decisao.papel.nivel === nivel,
    )
    .map((entrada) => entrada.codigo);

  return razao.contas.filter((conta) =>
    codigos.some((codigo) => pertenceA(conta.codigo, codigo)),
  );
}

/**
 * O motivo de não derivar, ancorado no lançamento que impediu.
 *
 * A âncora é `lancamento` e não `conta` porque é esse o par que o gestor
 * precisa abrir: a conta diz onde procurar, a linha diz o que corrigir.
 */
function motivoDaContrapartida(
  contrapartida: Contrapartida,
  lancamento: LancamentoRazao,
  conta: ContaRazao,
): Motivo | null {
  if (contrapartida.tipo !== 'ausente' && contrapartida.tipo !== 'pendente') return null;
  return {
    codigo: contrapartida.tipo === 'ausente' ? 'contrapartida-ausente' : 'contrapartida-pendente',
    ancora: { tipo: 'lancamento', conta: conta.codigo, linha: lancamento.linha },
  };
}

/**
 * O consumo de um nível, somando os créditos que saem dele.
 *
 * Contrapartida ausente ou não mapeada torna o consumo **indefinido**, e não
 * um número aproximado: ela pode ser uma conta de baixa que ninguém mapeou
 * (deveria entrar) ou um fornecedor (não deveria), e escolher um dos dois
 * cometeria em silêncio o erro que o RF-29 existe para impedir. O valor
 * pendente é pequeno em reais exatamente quando é uma conta de perda — e
 * decisivo no indicador (ADR-0005).
 */
export function consumoDoNivel(
  nivel: Nivel,
  mapeamento: Mapeamento,
  razao: ResultadoRazao,
  diagnosticos: DiagnosticoDeMapeamento[],
): ConsumoDeNivel {
  const contas = contasDoNivel(razao, mapeamento, nivel);
  if (contas.length === 0) {
    return { estado: 'indefinido', motivo: motivoDoNivel('razao-sem-conta-do-nivel', nivel) };
  }

  let total: Centavos = 0n;

  for (const conta of contas) {
    for (const lancamento of conta.lancamentos) {
      if (lancamento.credito === 0n) continue;
      const contrapartida = classificarContrapartida(lancamento.contrapartida, mapeamento);

      const motivo = motivoDaContrapartida(contrapartida, lancamento, conta);
      if (motivo !== null) {
        diagnosticos.push({
          severidade: 'aviso',
          codigo: motivo.codigo,
          mensagem: `Consumo de ${nivel} não foi derivado. ${mensagemDoMotivo(motivo)}`,
          ancora: motivo.ancora,
        });
        return { estado: 'indefinido', motivo };
      }

      if (creditoEhConsumo(contrapartida, nivel)) total += lancamento.credito;
    }
  }

  return { estado: 'lido', valor: total };
}

/**
 * As compras de MP no período: entradas que não vieram de outro nível.
 *
 * Existe porque `ncg()` recebe `compras` e a D2 põe o NCG na v1 — hoje esse
 * número não vem de lugar nenhum. Sai do mesmo arquivo, pela mesma
 * contrapartida, e **não** precisa de papel próprio no mapeamento: compras não
 * é uma conta, é um movimento da conta de MP.
 *
 * Sem contrapartida no arquivo, todo débito é compra. É a assimetria do
 * ADR-0005 sendo consistente: a falta de contrapartida impede concluir sobre o
 * consumo, cuja lista é fechada, mas não sobre a compra, cuja lista é aberta.
 */
export function comprasDeMp(mapeamento: Mapeamento, razao: ResultadoRazao): Centavos | null {
  const contas = contasDoNivel(razao, mapeamento, 'MP');
  if (contas.length === 0) return null;

  let total: Centavos = 0n;
  for (const conta of contas) {
    for (const lancamento of conta.lancamentos) {
      if (lancamento.debito === 0n) continue;
      const contrapartida = classificarContrapartida(lancamento.contrapartida, mapeamento);
      if (debitoEhCompra(contrapartida)) total += lancamento.debito;
    }
  }
  return total;
}
