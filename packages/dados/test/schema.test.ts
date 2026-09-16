/**
 * O que o banco recusa.
 *
 * Estes testes não exercitam consulta — exercitam **invariante**. Cada um
 * tenta gravar uma linha que o ADR-0008 diz ser irrepresentável, e passa
 * quando o banco recusa. Sem eles, o `CHECK` bicondicional seria uma intenção
 * escrita em TypeScript, e a linha `ausente` com saldo órfão entraria calada.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoDeTeste, semearEmpresa, type Banco } from './banco';

let banco: Banco;
let empresaId: string;
let escopo: { empresaId: string; usuarioId: string };

beforeAll(async () => {
  banco = await bancoDeTeste();
  escopo = await semearEmpresa(banco, 'Alimentos Boa Safra Ltda');
  empresaId = escopo.empresaId;
});

afterAll(async () => {
  await banco.fechar();
});

const gravarNivel = (campos: Readonly<Record<string, unknown>>) =>
  banco.comoEmpresa(escopo, async (pg) => {
    const base: Record<string, unknown> = {
      empresa_id: empresaId,
      ano: 2025,
      mes: 8,
      nivel: 'MP',
      estoque_estado: 'lido',
      estoque_fechamento: 1_200_000n,
      consumo_estado: 'indefinido',
      consumo_motivo_codigo: 'sem-razao',
      consumo_motivo_ancora_tipo: 'nivel',
      consumo_motivo_ancora_nivel: 'MP',
      perdas_estado: 'naoMedido',
      ...campos,
    };
    const nomes = Object.keys(base);
    const marcas = nomes.map((_, i) => `$${i + 1}`).join(', ');
    await pg.query(
      `insert into lancamento_nivel (${nomes.join(', ')}) values (${marcas})`,
      Object.values(base),
    );
  });

describe('a união com estado é bicondicional', () => {
  it('aceita a linha coerente', async () => {
    await expect(gravarNivel({ mes: 1 })).resolves.toBeUndefined();
  });

  it('recusa `lido` sem saldo de fechamento', async () => {
    await expect(gravarNivel({ mes: 2, estoque_fechamento: null })).rejects.toThrow();
  });

  it('recusa `ausente` com saldo órfão pendurado', async () => {
    // É o caso que o CHECK unidirecional deixaria passar: payload
    // contradizendo o estado, as duas fontes de verdade que o ADR-0008 recusa.
    await expect(
      gravarNivel({ mes: 3, estoque_estado: 'ausente', estoque_fechamento: 3_200_000n }),
    ).rejects.toThrow();
  });

  it('recusa `indefinido` sem motivo', async () => {
    await expect(
      gravarNivel({ mes: 4, estoque_estado: 'indefinido', estoque_fechamento: null }),
    ).rejects.toThrow();
  });

  it('recusa perda `naoMedido` com valor', async () => {
    await expect(gravarNivel({ mes: 5, perdas_valor: 60_864n })).rejects.toThrow();
  });

  it('recusa nível fora de MP, PP e PA', async () => {
    await expect(gravarNivel({ mes: 6, nivel: 'XX' })).rejects.toThrow();
  });
});

describe('a âncora recebe o mesmo tratamento', () => {
  it('recusa âncora de conta sem conta', async () => {
    await expect(
      gravarNivel({
        mes: 7,
        consumo_motivo_ancora_tipo: 'conta',
        consumo_motivo_ancora_nivel: null,
      }),
    ).rejects.toThrow();
  });

  it('recusa âncora de nível com linha pendurada', async () => {
    await expect(gravarNivel({ mes: 8, consumo_motivo_ancora_linha: 42 })).rejects.toThrow();
  });

  it('aceita a âncora de lançamento, que é a única com conta e linha juntas', async () => {
    await expect(
      gravarNivel({
        mes: 9,
        consumo_motivo_codigo: 'contrapartida-ausente',
        consumo_motivo_ancora_tipo: 'lancamento',
        consumo_motivo_ancora_conta: '1.1.3.01',
        consumo_motivo_ancora_linha: 42,
        consumo_motivo_ancora_nivel: null,
      }),
    ).resolves.toBeUndefined();
  });

  it('recusa código de motivo sem âncora', async () => {
    await expect(
      gravarNivel({
        mes: 10,
        consumo_motivo_ancora_tipo: null,
        consumo_motivo_ancora_nivel: null,
      }),
    ).rejects.toThrow();
  });
});

describe('período', () => {
  const gravarPeriodo = (campos: Readonly<Record<string, unknown>>) =>
    banco.comoEmpresa(escopo, async (pg) => {
      const base: Record<string, unknown> = {
        empresa_id: empresaId,
        ano: 2025,
        mes: 8,
        estado: 'importado',
        ...campos,
      };
      const nomes = Object.keys(base);
      const marcas = nomes.map((_, i) => `$${i + 1}`).join(', ');
      await pg.query(
        `insert into periodo (${nomes.join(', ')}) values (${marcas})`,
        Object.values(base),
      );
    });

  it('aceita importado sem lançamento — é o estado da primeira importação', async () => {
    await expect(gravarPeriodo({ mes: 1 })).resolves.toBeUndefined();
  });

  it('recusa apurado sem CMV: a validação garante que ele existe', async () => {
    await expect(gravarPeriodo({ mes: 2, estado: 'apurado' })).rejects.toThrow();
  });

  it('calcula a divergência do custo de materiais como coluna gerada', async () => {
    await gravarPeriodo({
      mes: 3,
      estado: 'apurado',
      cmv: 2_450_000n,
      custo_materiais_origem: 'conferido',
      custo_materiais_valor: 1_850_000n,
      custo_materiais_informado: 1_600_000n,
    });

    const divergencia = await banco.comoEmpresa(escopo, async (pg) => {
      const { rows } = await pg.query<{ d: number }>(
        'select custo_materiais_divergencia as d from periodo where mes = 3',
      );
      return rows[0]?.d;
    });
    expect(divergencia).toBeCloseTo(0.135, 3);
  });

  it('recusa conferido sem o valor informado ao lado', async () => {
    await expect(
      gravarPeriodo({
        mes: 4,
        estado: 'apurado',
        cmv: 2_450_000n,
        custo_materiais_origem: 'conferido',
        custo_materiais_valor: 1_850_000n,
      }),
    ).rejects.toThrow();
  });

  it('recusa competência fora de 1..12', async () => {
    await expect(gravarPeriodo({ mes: 13 })).rejects.toThrow();
  });
});
