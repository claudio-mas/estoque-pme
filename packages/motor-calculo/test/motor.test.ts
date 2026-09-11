/**
 * Testes de unidade do motor.
 *
 * A ênfase está nas regras que o CLAUDE.md marca como fáceis de errar: ausência
 * não é zero, dinheiro não é float, e perda não se aplica ao consumo.
 */
import { describe, expect, it } from 'vitest';
import {
  DIAS_DO_PERIODO,
  LIMITE_DISPERSAO_PREMISSA,
  arredondarCentavos,
  calcularPme,
  cicloFinanceiro,
  cobertura,
  comprasTeto,
  custoMateriaisDerivado,
  custoSobPerdaDeCenario,
  dispersaoRelativa,
  giroAnualizado,
  media,
  mediaDosUltimos,
  mensagemDoMotivo,
  motivoDaConta,
  motivoDoNivel,
  ondeEsta,
  multiplicarPorTaxa,
  ncg,
  paraNumero,
  perdaMedida,
  porTaxaDeCrescimento,
  porTendenciaLinear,
  porUltimaObservacao,
  producaoTeto,
  projetarEstoque,
  quociente,
} from '../src/index';
import type { Centavos } from '../src/index';

const reais = (valor: number): Centavos => BigInt(Math.round(valor * 100));

describe('dinheiro', () => {
  it('arredonda meio para longe do zero, nos dois sentidos', () => {
    expect(arredondarCentavos(0.5)).toBe(1n);
    expect(arredondarCentavos(1.5)).toBe(2n);
    expect(arredondarCentavos(2.5)).toBe(3n);
    expect(arredondarCentavos(-0.5)).toBe(-1n);
    expect(arredondarCentavos(-2.5)).toBe(-3n);
  });

  it('recusa valores que sairiam da faixa de precisão exata', () => {
    expect(() => paraNumero(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
    expect(() => arredondarCentavos(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => arredondarCentavos(Number.NaN)).toThrow(RangeError);
  });

  it('recusa quociente com denominador zerado em vez de devolver infinito', () => {
    expect(() => quociente(reais(100), 0n)).toThrow(RangeError);
  });

  it('preserva centavos que um float perderia', () => {
    // 0,1 + 0,2 !== 0,3 em float; em centavos a soma é exata.
    expect(reais(0.1) + reais(0.2)).toBe(reais(0.3));
  });

  it('tira a média de valores monetários arredondando ao centavo', () => {
    expect(media([reais(10), reais(11)])).toBe(reais(10.5));
    expect(media([reais(10), reais(10.01)])).toBe(reais(10.01));
  });

  it('multiplica por taxa sem acumular erro visível', () => {
    expect(multiplicarPorTaxa(reais(19_500), 1.02)).toBe(reais(19_890));
  });
});

describe('PME', () => {
  it('devolve ausente para nível que a empresa não movimenta', () => {
    const pme = calcularPme({
      nivel: 'MP',
      estoqueAbertura: null,
      estoqueFechamento: null,
      custoDirecionador: reais(1_000),
    });
    // D6: ausência deliberada, nunca zero silencioso.
    expect(pme).toEqual({ estado: 'ausente' });
  });

  it('devolve indefinido com custo direcionador zerado ou negativo', () => {
    const zerado = calcularPme({
      nivel: 'MP',
      estoqueAbertura: null,
      estoqueFechamento: reais(500),
      custoDirecionador: 0n,
    });
    expect(zerado.estado).toBe('indefinido');

    const negativo = calcularPme({
      nivel: 'MP',
      estoqueAbertura: null,
      estoqueFechamento: reais(500),
      custoDirecionador: reais(-10),
    });
    expect(negativo.estado).toBe('indefinido');
  });

  it('é a inversa exata da projeção — o fator d se cancela', () => {
    const custo = reais(20_288);
    const pme = calcularPme({
      nivel: 'MP',
      estoqueAbertura: null,
      estoqueFechamento: reais(12_047),
      custoDirecionador: custo,
    });
    if (pme.estado !== 'calculado') throw new Error('esperado calculado');
    expect(projetarEstoque(custo, pme.dias)).toBe(reais(12_047));
  });

  it('mantém o estoque projetado invariante à escolha de d', () => {
    const custo = reais(20_288);
    const saldo = reais(12_047);
    const projetarCom = (dias: number): Centavos => {
      const pme = calcularPme({
        nivel: 'MP',
        estoqueAbertura: null,
        estoqueFechamento: saldo,
        custoDirecionador: custo,
        dias,
      });
      if (pme.estado !== 'calculado') throw new Error('esperado calculado');
      return projetarEstoque(custo, pme.dias, dias);
    };
    expect(projetarCom(30)).toBe(projetarCom(360));
    expect(projetarCom(30)).toBe(projetarCom(DIAS_DO_PERIODO));
  });

  it('recusa PME alvo negativo', () => {
    expect(() => projetarEstoque(reais(1_000), -1)).toThrow(RangeError);
  });
});

describe('cobertura', () => {
  const calculado = (dias: number) => ({ estado: 'calculado', dias, base: 'medio' }) as const;

  it('pula o nível ausente em vez de somá-lo como zero', () => {
    const total = cobertura({
      MP: calculado(17.8),
      PP: { estado: 'ausente' },
      PA: calculado(17.6),
    });
    expect(total).toMatchObject({ estado: 'calculado', niveis: ['MP', 'PA'] });
    // Dias é quociente, não dinheiro: comparar com tolerância, nunca por igualdade.
    if (total.estado !== 'calculado') return;
    expect(total.dias).toBeCloseTo(35.4, 10);
  });

  it('propaga o indefinido em vez de produzir um total parcial', () => {
    const total = cobertura({
      MP: { estado: 'indefinido', motivo: motivoDoNivel('custo-direcionador-zerado', 'MP') },
      PA: calculado(17.6),
    });
    expect(total.estado).toBe('indefinido');
    // O motivo aponta para o nível, não repete a frase do PME: quem quiser o
    // detalhe olha o PME de MP, que continua lá.
    if (total.estado !== 'indefinido') return;
    expect(total.motivo).toEqual({ codigo: 'pme-indefinido', ancora: { tipo: 'nivel', nivel: 'MP' } });
  });

  it('é indefinida quando nenhum nível foi movimentado', () => {
    const total = cobertura({ MP: { estado: 'ausente' }, PP: { estado: 'ausente' } });
    expect(total.estado).toBe('indefinido');
  });
});

describe('projeção da premissa', () => {
  it('reproduz a cadeia de 2% ao mês da planilha de referência', () => {
    const projetados = porTaxaDeCrescimento(reais(19_500), 0.02, 6);
    expect(projetados.map((c) => Number(c) / 100)).toEqual([
      19_890, 20_287.8, 20_693.56, 21_107.43, 21_529.58, 21_960.17,
    ]);
  });

  it('reproduz a cadeia de CMV a partir de agosto', () => {
    const [primeiro, segundo] = porTaxaDeCrescimento(reais(24_500), 0.02, 2);
    expect(Number(primeiro as Centavos) / 100).toBe(24_990);
    expect(Number(segundo as Centavos) / 100).toBe(25_489.8);
  });

  it('repete a última observação', () => {
    expect(porUltimaObservacao([17.1, 17.8, 18.5], 3)).toEqual([18.5, 18.5, 18.5]);
    expect(() => porUltimaObservacao([], 2)).toThrow(RangeError);
  });

  it('tira a média dos últimos N, usando o que houver quando a série é curta', () => {
    expect(mediaDosUltimos([10, 20, 30, 40], 3)).toBeCloseTo(30, 10);
    expect(mediaDosUltimos([10, 20], 3)).toBeCloseTo(15, 10);
  });

  it('projeta tendência linear e degrada para a última observação com um ponto', () => {
    expect(porTendenciaLinear([10, 12, 14], 2)).toEqual([16, 18]);
    expect(porTendenciaLinear([7], 2)).toEqual([7, 7]);
  });

  it('mede a dispersão que dispara o aviso de premissa instável', () => {
    expect(dispersaoRelativa([10, 10, 10])).toBe(0);
    expect(dispersaoRelativa([17.14, 17.84, 18.46])).toBeLessThan(LIMITE_DISPERSAO_PREMISSA);
    expect(dispersaoRelativa([10, 20, 30])).toBeGreaterThan(LIMITE_DISPERSAO_PREMISSA);
  });

  it('recusa horizonte e janela inválidos', () => {
    expect(() => porTaxaDeCrescimento(reais(100), 0.02, 0)).toThrow(RangeError);
    expect(() => porTaxaDeCrescimento(reais(100), -1, 3)).toThrow(RangeError);
    expect(() => mediaDosUltimos([1, 2], 0)).toThrow(RangeError);
  });
});

describe('tetos orçamentários', () => {
  it('cobre o consumo e ainda ajusta o saldo até o alvo', () => {
    // Consome 20.288, quer subir o estoque em 47: compra 20.335.
    expect(
      comprasTeto({
        mpAlvo: reais(12_047),
        mpInicial: reais(12_000),
        custoMateriais: reais(20_288),
      }),
    ).toBe(reais(20_335));
  });

  it('produz abaixo do CMV quando o alvo de acabados é menor que o saldo', () => {
    expect(
      producaoTeto({ paAlvo: reais(14_930), paInicial: reais(15_000), cmv: reais(25_490) }),
    ).toBe(reais(25_420));
  });

  it('fecha a identidade de saldo em qualquer direção', () => {
    const mpInicial = reais(12_000);
    const custo = reais(20_288);
    const mpAlvo = reais(12_047);
    const compras = comprasTeto({ mpAlvo, mpInicial, custoMateriais: custo });
    expect(mpInicial + compras - custo).toBe(mpAlvo);
  });
});

describe('indicadores', () => {
  it('deriva o custo de materiais do razão da conta de MP', () => {
    // A identidade do teto de compra lida ao contrário (RF-29).
    expect(custoMateriaisDerivado(reais(12_000), reais(20_335), reais(12_047))).toBe(
      reais(20_288),
    );
  });

  it('calcula giro e ciclo financeiro', () => {
    expect(giroAnualizado(reais(294_000), reais(29_400))).toBeCloseTo(10, 10);
    expect(cicloFinanceiro(41.2, 45, 30)).toBeCloseTo(56.2, 10);
  });

  it('calcula a necessidade de capital de giro', () => {
    const resultado = ncg({
      estoque: reais(32_000),
      receita: reais(30_000),
      compras: reais(20_000),
      pmr: 30,
      pmp: 30,
    });
    // Com PMR = PMP = d, recebíveis e fornecedores entram por um período cheio.
    expect(resultado).toBe(reais(42_000));
  });

  it('devolve não medido quando não há conta de perda mapeada', () => {
    // D7: informar 0% a quem deixa a quebra correr no CMV é pior que não informar.
    expect(perdaMedida(null, reais(20_288))).toEqual({ estado: 'naoMedido' });
    expect(perdaMedida(reais(600), 0n)).toEqual({ estado: 'naoMedido' });
  });

  it('mede a taxa de perda quando há conta mapeada', () => {
    const perda = perdaMedida(reais(608.64), reais(20_288));
    expect(perda.estado).toBe('medido');
    if (perda.estado !== 'medido') return;
    expect(perda.taxa).toBeCloseTo(0.03, 10);
  });

  it('vira no-op quando o cenário de perda iguala a base', () => {
    const custo = reais(20_288);
    expect(custoSobPerdaDeCenario(custo, 0.03, 0.03)).toBe(custo);
  });

  it('reduz o custo ao cair a perda de 3% para 1,5%', () => {
    const custo = reais(20_288);
    const cenario = custoSobPerdaDeCenario(custo, 0.03, 0.015);
    const queda = 1 - Number(cenario) / Number(custo);
    expect(queda).toBeCloseTo(0.0152, 4);
    // R$ 308 mil no setembro do exemplo trabalhado.
    expect(Math.round(Number(custo - cenario) / 100)).toBe(309);
  });

  it('aumenta o custo se a perda do cenário for maior que a base', () => {
    const custo = reais(20_288);
    expect(custoSobPerdaDeCenario(custo, 0.015, 0.03)).toBeGreaterThan(custo);
  });

  it('recusa taxa de perda fora de [0, 1)', () => {
    expect(() => custoSobPerdaDeCenario(reais(100), 0.03, 1)).toThrow(RangeError);
    expect(() => custoSobPerdaDeCenario(reais(100), -0.01, 0.03)).toThrow(RangeError);
  });
});

describe('motivo e âncora', () => {
  it('diz onde o problema está, em cada forma de âncora', () => {
    expect(ondeEsta({ tipo: 'arquivo' })).toBe('no arquivo');
    expect(ondeEsta({ tipo: 'conta', conta: '1.1.3.01' })).toBe('na conta 1.1.3.01');
    expect(ondeEsta({ tipo: 'conta', conta: '1.1.3.04', nivel: 'MP' })).toBe(
      'na conta 1.1.3.04, de MP',
    );
    expect(ondeEsta({ tipo: 'linha', linha: 42, coluna: 'saldo atual' })).toBe(
      'na linha 42, coluna saldo atual',
    );
    expect(ondeEsta({ tipo: 'lancamento', conta: '1.1.3.01', linha: 7 })).toBe(
      'no lançamento da linha 7, na conta 1.1.3.01',
    );
  });

  it('a frase é montada do código, e o código sobrevive a ela', () => {
    // É o ponto do ADR-0008: o histórico guarda o código, não a redação de hoje.
    const motivo = motivoDaConta('nivel-incompleto', '1.1.3.04', 'MP');
    expect(motivo).toEqual({
      codigo: 'nivel-incompleto',
      ancora: { tipo: 'conta', conta: '1.1.3.04', nivel: 'MP' },
    });
    expect(mensagemDoMotivo(motivo)).toContain('1.1.3.04');
  });

  it('o PME indefinido carrega o nível a que se refere', () => {
    const pme = calcularPme({
      nivel: 'PP',
      estoqueAbertura: null,
      estoqueFechamento: reais(500),
      custoDirecionador: 0n,
    });
    if (pme.estado !== 'indefinido') throw new Error('esperado indefinido');
    expect(pme.motivo).toEqual({
      codigo: 'custo-direcionador-zerado',
      ancora: { tipo: 'nivel', nivel: 'PP' },
    });
  });
});
