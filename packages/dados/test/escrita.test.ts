/**
 * Importar duas vezes tem de dar o mesmo resultado que importar uma.
 *
 * É o RF-05 inteiro, e é a espécie de bug que só aparece no segundo mês de uso:
 * quem testa uma importação nunca vê. Aqui o mesmo arquivo entra duas vezes, o
 * mapeamento muda, o gestor digita um valor — e a pergunta é sempre a mesma:
 * sobrou lixo da vez anterior?
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lerBalancete, lerRazao } from '@estoque-pme/importador';
import type { EntradaDeMapeamento, Mapeamento } from '@estoque-pme/mapeamento';
import {
  comEmpresa,
  importarBalancete,
  importarRazao,
  periodosDefasados,
  salvarMapeamento,
  salvarValorInformado,
} from '../src/index';
import { bancoDeTeste, semearEmpresa, type Banco } from './banco';

const latin1 = (texto: string): Uint8Array =>
  Uint8Array.from([...texto].map((c) => c.charCodeAt(0)));

const balanceteDe = (mp: string) =>
  latin1(
    [
      'BALANCETE DE VERIFICAÇÃO',
      'Período: 01/08/2025 a 31/08/2025',
      '',
      'Classificação;Descrição;Saldo Anterior;Débito;Crédito;Saldo Atual',
      '1.1.3;ESTOQUES;29.350,00;49.200,00;46.550,00;32.000,00',
      `1.1.3.01;MATÉRIAS-PRIMAS;11.000,00;19.500,00;18.500,00;${mp}`,
      '1.1.3.02;PRODUTOS EM PROCESSO;4.500,00;5.200,00;4.700,00;5.000,00',
      '1.1.3.03;PRODUTOS ACABADOS;13.850,00;24.500,00;23.350,00;15.000,00',
      '1.1.3.09;PERDAS E QUEBRAS DE MATÉRIA-PRIMA;0,00;608,64;0,00;608,64',
      '4.1.1.01;CUSTO DAS MERCADORIAS VENDIDAS;0,00;24.500,00;0,00;24.500,00 D',
    ].join('\r\n'),
  );

const RAZAO = latin1(
  [
    'RAZÃO ANALÍTICO',
    'Período: 01/08/2025 a 31/08/2025',
    '',
    'Data;Histórico;Contrapartida;Débito;Crédito;Saldo',
    'CONTA: 1.1.3.01 - MATÉRIAS-PRIMAS',
    'Saldo anterior;;;;;11.000,00',
    '05/08/2025;COMPRA NF 4471;2.1.1.01;19.500,00;;30.500,00',
    '18/08/2025;REQUISIÇÃO OP-220;1.1.3.02;;17.891,36;12.608,64',
    '31/08/2025;QUEBRA DE ESTOQUE;1.1.3.09;;608,64;12.000,00',
    'Saldo atual;;;;;12.000,00',
  ].join('\r\n'),
);

const classificada = (
  codigo: string,
  descricao: string,
  papel: Extract<EntradaDeMapeamento['decisao'], { estado: 'classificada' }>['papel'],
): EntradaDeMapeamento => ({ codigo, descricao, decisao: { estado: 'classificada', papel } });

const MAPEAMENTO: Mapeamento = {
  entradas: [
    classificada('1.1.3.01', 'MATÉRIAS-PRIMAS', { papel: 'estoque', nivel: 'MP' }),
    classificada('1.1.3.02', 'PRODUTOS EM PROCESSO', { papel: 'estoque', nivel: 'PP' }),
    classificada('1.1.3.03', 'PRODUTOS ACABADOS', { papel: 'estoque', nivel: 'PA' }),
    classificada('1.1.3.09', 'PERDAS E QUEBRAS DE MATÉRIA-PRIMA', { papel: 'baixa', nivel: 'MP' }),
    classificada('4.1.1.01', 'CUSTO DAS MERCADORIAS VENDIDAS', { papel: 'cmv' }),
  ],
  niveisAusentes: [],
};

const AGOSTO = { ano: 2025, mes: 8 } as const;

let banco: Banco;
let empresaId: string;

beforeAll(async () => {
  banco = await bancoDeTeste();
  empresaId = await semearEmpresa(banco, 'Alimentos Boa Safra Ltda');
});

afterAll(async () => {
  await banco.fechar();
});

const contar = (tabela: string) =>
  banco.comoEmpresa(empresaId, async (pg) => {
    const { rows } = await pg.query<{ n: number }>(`select count(*)::int as n from ${tabela}`);
    return rows[0]?.n ?? -1;
  });

describe('importar e apurar', () => {
  it('a primeira importação fica `importado`: o mapeamento ainda não existe', async () => {
    const resumo = await comEmpresa(banco.db, empresaId, (tx) =>
      importarBalancete(tx, { empresaId, origem: 'Sistema Contábil XYZ' }, lerBalancete(balanceteDe('12.000,00'))),
    );
    expect(resumo.criadas).toBe(6);
    expect(resumo.atualizadas).toBe(0);
    // É o estado real de toda primeira importação, e ter nome é o que impede
    // que ele seja lido como "período nunca importado".
    expect(resumo.apuracao.estado).toBe('importado');
    expect(await contar('lancamento_nivel')).toBe(0);
  });

  it('salvar o mapeamento apura o histórico na mesma transação', async () => {
    const resultado = await comEmpresa(banco.db, empresaId, (tx) =>
      salvarMapeamento(tx, { empresaId, motivo: 'primeira classificação' }, MAPEAMENTO),
    );
    expect(resultado.versao).toBe(1);
    expect(resultado.periodosReapurados).toBe(1);
    // Os três níveis sempre têm linha, seja qual for o estado (ADR-0008).
    expect(await contar('lancamento_nivel')).toBe(3);
  });

  it('não deixa período defasado para trás', async () => {
    const defasados = await comEmpresa(banco.db, empresaId, (tx) =>
      periodosDefasados(tx, empresaId),
    );
    expect(defasados).toEqual([]);
  });
});

describe('reimportar substitui, nunca soma (RF-05)', () => {
  it('o mesmo arquivo de novo não duplica, e o resumo diz que atualizou', async () => {
    const antes = await contar('balancete_linha');
    const resumo = await comEmpresa(banco.db, empresaId, (tx) =>
      importarBalancete(tx, { empresaId, origem: 'Sistema Contábil XYZ' }, lerBalancete(balanceteDe('12.000,00'))),
    );
    expect(resumo.criadas).toBe(0);
    expect(resumo.atualizadas).toBe(6);
    expect(await contar('balancete_linha')).toBe(antes);
  });

  it('o saldo corrigido substitui o antigo e o lançamento reapura junto', async () => {
    await comEmpresa(banco.db, empresaId, (tx) =>
      importarBalancete(tx, { empresaId, origem: 'Sistema Contábil XYZ' }, lerBalancete(balanceteDe('12.047,00'))),
    );
    const fechamento = await banco.comoEmpresa(empresaId, async (pg) => {
      const { rows } = await pg.query<{ v: string }>(
        `select estoque_fechamento as v from lancamento_nivel where nivel = 'MP'`,
      );
      return BigInt(rows[0]?.v ?? '0');
    });
    expect(fechamento).toBe(1_204_700n);
  });

  it('reimportar o razão apaga o bloco anterior em vez de somar', async () => {
    for (const _ of [1, 2]) {
      await comEmpresa(banco.db, empresaId, (tx) =>
        importarRazao(tx, { empresaId, origem: 'Sistema Contábil XYZ' }, lerRazao(RAZAO)),
      );
    }
    expect(await contar('razao_lancamento')).toBe(3);
    expect(await contar('razao_conta')).toBe(1);
  });

  it('com o razão, o consumo e o custo de materiais passam a existir', async () => {
    const linha = await banco.comoEmpresa(empresaId, async (pg) => {
      const { rows } = await pg.query<{ origem: string; valor: string }>(
        'select custo_materiais_origem as origem, custo_materiais_valor as valor from periodo',
      );
      return rows[0];
    });
    expect(linha?.origem).toBe('derivado');
    // 17.891,36 para PP mais 608,64 de quebra: a perda fica dentro do consumo.
    expect(BigInt(linha?.valor ?? '0')).toBe(1_850_000n);
  });
});

describe('o valor informado não é apagado pela reimportação (ADR-0010)', () => {
  it('digitar o custo de materiais reapura só aquele período', async () => {
    const resultado = await comEmpresa(banco.db, empresaId, (tx) =>
      salvarValorInformado(tx, { empresaId }, AGOSTO, 'custoMateriais', 1_600_000n),
    );
    expect(resultado.periodosReapurados).toBe(1);

    const origem = await banco.comoEmpresa(empresaId, async (pg) => {
      const { rows } = await pg.query<{ o: string; d: number }>(
        'select custo_materiais_origem as o, custo_materiais_divergencia as d from periodo',
      );
      return rows[0];
    });
    expect(origem?.o).toBe('conferido');
    expect(origem?.d).toBeCloseTo(0.135, 3);
  });

  it('reimportar o balancete depois disso não apaga o que foi digitado', async () => {
    // É o bug que o ADR-0010 evita: a chave do RF-05 substitui, e o digitado
    // moraria na mesma linha se não tivesse tabela própria.
    await comEmpresa(banco.db, empresaId, (tx) =>
      importarBalancete(tx, { empresaId, origem: 'Sistema Contábil XYZ' }, lerBalancete(balanceteDe('12.047,00'))),
    );
    const origem = await banco.comoEmpresa(empresaId, async (pg) => {
      const { rows } = await pg.query<{ o: string }>(
        'select custo_materiais_origem as o from periodo',
      );
      return rows[0]?.o;
    });
    expect(origem).toBe('conferido');
    expect(await contar('valor_informado')).toBe(1);
  });

  it('editar de novo versiona em vez de sobrescrever', async () => {
    const resultado = await comEmpresa(banco.db, empresaId, (tx) =>
      salvarValorInformado(tx, { empresaId }, AGOSTO, 'custoMateriais', 1_840_000n),
    );
    expect(resultado.versao).toBe(2);
    // Append-only: "valor anterior" é a linha anterior, não um campo.
    expect(await contar('valor_informado')).toBe(2);
  });
});

describe('o mapeamento versiona e recalcula', () => {
  it('mudar o mapeamento gera versão nova e reapura tudo', async () => {
    const semPa: Mapeamento = {
      entradas: [
        ...MAPEAMENTO.entradas.filter((e) => e.codigo !== '1.1.3.03'),
        // Ignorar, não apenas remover: uma conta chamada "PRODUTOS ACABADOS"
        // deixada pendente torna PA **indefinido**, não ausente — e está certo,
        // porque declarar o nível ausente com ela sem classificar é ambíguo.
        { codigo: '1.1.3.03', descricao: 'PRODUTOS ACABADOS', decisao: { estado: 'ignorada' } },
      ],
      niveisAusentes: ['PA'],
    };
    const resultado = await comEmpresa(banco.db, empresaId, (tx) =>
      salvarMapeamento(tx, { empresaId, motivo: 'PA passou a ser controlado fora' }, semPa),
    );
    expect(resultado.versao).toBe(2);
    expect(resultado.periodosReapurados).toBe(1);

    const pa = await banco.comoEmpresa(empresaId, async (pg) => {
      const { rows } = await pg.query<{ e: string }>(
        `select estoque_estado as e from lancamento_nivel where nivel = 'PA'`,
      );
      return rows[0]?.e;
    });
    // Declarado ausente, não indefinido: é decisão da empresa, não lacuna.
    expect(pa).toBe('ausente');
    expect(await contar('mapeamento_versao')).toBe(2);
  });

  it('e continua sem deixar período defasado', async () => {
    const defasados = await comEmpresa(banco.db, empresaId, (tx) =>
      periodosDefasados(tx, empresaId),
    );
    expect(defasados).toEqual([]);
  });
});
