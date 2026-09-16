/**
 * Tipos do mapeamento de contas.
 *
 * O que este pacote guarda é **decisão**, não estado derivado: cada entrada é
 * um gestor tendo dito o que uma conta significa, ou tendo dito que ela não
 * interessa. Conta pendente não aparece aqui — pendente é justamente a conta
 * sobre a qual não há entrada, e ela se descobre confrontando o mapeamento com
 * um arquivo, nunca lendo o mapeamento sozinho.
 */
import type { Ancora, CodigoDeMotivo, Nivel, Severidade } from '@estoque-pme/motor-calculo';

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

/**
 * Os códigos que só o mapeamento produz: validação e aviso.
 *
 * O conjunto completo é este mais os `CodigoDeMotivo` do motor — todo motivo é
 * um diagnóstico válido, o contrário não. A união é uma só porque vocabulário
 * duplicado diverge em silêncio: antes desta unificação, `conta-sem-codigo` e
 * `movimento-ilegivel` existiam aqui **e** no importador, com significados
 * diferentes em cada lado.
 */
export type CodigoDeValidacao =
  | 'entrada-sem-codigo'
  | 'conta-pendente'
  | 'conta-duplicada'
  | 'sobreposicao-de-subarvore'
  | 'nivel-ausente-e-mapeado'
  | 'mp-nao-mapeada'
  | 'mp-declarada-ausente'
  | 'cmv-nao-mapeado'
  | 'cmv-nao-veio-no-arquivo'
  | 'receita-nao-mapeada'
  | 'descricao-divergente'
  | 'movimento-indisponivel'
  | 'movimento-divergente'
  | 'sinal-invertido'
  | 'sem-competencia'
  | 'competencia-indeterminada'
  | 'competencias-diferentes'
  | 'custo-materiais-digitado'
  | 'custo-materiais-divergente';

export type CodigoDeDiagnostico = CodigoDeMotivo | CodigoDeValidacao;

/**
 * Um problema do mapeamento, sempre navegável até a origem.
 *
 * Usa a mesma `Ancora` do importador e do motor: um problema de mapeamento não
 * é de uma linha física — costuma ser de uma **conta**, e vale para todos os
 * arquivos em que ela aparecer —, mas o razão traz casos que apontam para um
 * lançamento, e o par `conta`/`linha` separado não sabia dizer isso.
 */
export interface DiagnosticoDeMapeamento {
  readonly severidade: Severidade;
  readonly codigo: CodigoDeDiagnostico;
  readonly mensagem: string;
  readonly ancora: Ancora;
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
