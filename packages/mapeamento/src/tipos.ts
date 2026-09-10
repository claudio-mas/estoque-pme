/**
 * Tipos do mapeamento de contas.
 *
 * O que este pacote guarda é **decisão**, não estado derivado: cada entrada é
 * um gestor tendo dito o que uma conta significa, ou tendo dito que ela não
 * interessa. Conta pendente não aparece aqui — pendente é justamente a conta
 * sobre a qual não há entrada, e ela se descobre confrontando o mapeamento com
 * um arquivo, nunca lendo o mapeamento sozinho.
 */
import type { Nivel } from '@estoque-pme/motor-calculo';

/**
 * O que uma conta significa para o modelo.
 *
 * MP, PP e PA são o mesmo papel — saldo de estoque de um nível — e não três
 * papéis distintos: escrevê-los separados faria o `Nivel` do motor ganhar uma
 * string paralela. A união obriga o nível a existir onde ele importa e a não
 * existir onde não faz sentido; CMV não tem nível.
 *
 * `compras` não está aqui de propósito: é conta de movimento do razão, não
 * linha de balancete, e entra quando o leitor de razão existir (RF-29).
 */
export type PapelDeConta =
  | { readonly papel: 'estoque'; readonly nivel: Nivel }
  | { readonly papel: 'baixa'; readonly nivel: Nivel }
  | { readonly papel: 'cmv' }
  | { readonly papel: 'receita' };

/**
 * A decisão tomada sobre uma conta.
 *
 * `ignorada` é decisão, não lacuna: o gestor olhou caixa, fornecedores ou
 * imobilizado e disse que não interessam. Sem esse estado, a lista de
 * pendências de um plano de 300 contas nunca esvazia e o gestor para de olhar —
 * que é exatamente o que o aceite do RF-28 tenta evitar.
 */
export type Decisao =
  | { readonly estado: 'classificada'; readonly papel: PapelDeConta }
  | { readonly estado: 'ignorada' };

/**
 * Uma conta decidida.
 *
 * A chave é o **código**. A descrição é guardada como estava na confirmação,
 * para que descrição divergente no mesmo código gere aviso de conta renomeada
 * ou reaproveitada — é o alarme que dispensa vigência no mapeamento (ADR-0001).
 */
export interface EntradaDeMapeamento {
  readonly codigo: string;
  readonly descricao: string;
  readonly decisao: Decisao;
}

/**
 * O mapeamento de uma empresa.
 *
 * `niveisAusentes` é declaração, nunca inferência: só a empresa sabe que não
 * movimenta PP (D6), e não há conta para ignorar quando o nível não existe no
 * plano de contas. Sem essa declaração, "ninguém classificou ainda" e "esta
 * empresa não tem esse nível" seriam indistinguíveis — e o segundo viraria
 * silêncio no lugar de um número.
 */
export interface Mapeamento {
  readonly entradas: readonly EntradaDeMapeamento[];
  readonly niveisAusentes: readonly Nivel[];
}

export type SeveridadeDeMapeamento = 'erro' | 'aviso' | 'info';

/**
 * Um problema do mapeamento, sempre navegável até a conta.
 *
 * Tipo próprio, e não o `Diagnostico` do importador: lá a âncora é a linha
 * física do arquivo, aqui o problema é de uma **conta** e vale para todos os
 * arquivos em que ela aparecer. Um campo obrigatório permanentemente nulo seria
 * o tipo dizendo que não é esse tipo.
 */
export interface DiagnosticoDeMapeamento {
  readonly severidade: SeveridadeDeMapeamento;
  readonly codigo: string;
  readonly mensagem: string;
  /** Código da conta; `null` quando o problema é do mapeamento inteiro. */
  readonly conta: string | null;
}

/**
 * O que o produto propõe para uma conta ainda pendente.
 *
 * `incoerente` existe porque não propor é informação: quando a descrição diz
 * "MATÉRIAS-PRIMAS" e o código está no passivo, o silêncio útil é dizer que se
 * viu o conflito. E o motivo não é enfeite — a proposta pede confirmação de um
 * gestor que não quer ler, e "MP" sozinho é indistinguível de um palpite.
 */
export type Sugestao =
  | { readonly estado: 'sugerido'; readonly papel: PapelDeConta; readonly motivo: string }
  | { readonly estado: 'incoerente'; readonly motivo: string }
  | { readonly estado: 'semSugestao' };

/** Uma conta do arquivo sobre a qual não há decisão. */
export interface ContaPendente {
  readonly codigo: string;
  readonly descricao: string;
  readonly sugestao: Sugestao;
}
