/**
 * A RLS prova que separa, ou não serve.
 *
 * O teste roda como **superusuário** — PGlite não oferece outra coisa —, e é
 * justamente por isso que ele vale: sem `FORCE ROW LEVEL SECURITY`, o dono da
 * tabela ignora policy, e este arquivo passaria inteiro dizendo que tudo está
 * protegido enquanto nada estaria. Se alguém remover o `FORCE`, os testes
 * abaixo quebram.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoDeTeste, semearEmpresa, type Banco } from './banco';

let banco: Banco;
let safra: string;
let concorrente: string;

beforeAll(async () => {
  banco = await bancoDeTeste();
  safra = await semearEmpresa(banco, 'Alimentos Boa Safra Ltda');
  concorrente = await semearEmpresa(banco, 'Laticínios Vale Verde Ltda');

  for (const [empresa, mes] of [
    [safra, 8],
    [concorrente, 8],
  ] as const) {
    await banco.comoEmpresa(empresa, async (pg) => {
      await pg.query('insert into periodo (empresa_id, ano, mes, estado) values ($1, 2025, $2, $3)', [
        empresa,
        mes,
        'importado',
      ]);
    });
  }
});

afterAll(async () => {
  await banco.fechar();
});

const contarPeriodos = (empresa: string | null) =>
  banco.comoEmpresa(empresa, async (pg) => {
    const { rows } = await pg.query<{ n: number }>('select count(*)::int as n from periodo');
    return rows[0]?.n ?? -1;
  });

describe('isolamento por empresa', () => {
  it('cada empresa vê só o que é dela', async () => {
    expect(await contarPeriodos(safra)).toBe(1);
    expect(await contarPeriodos(concorrente)).toBe(1);
  });

  it('sem empresa declarada, não se vê nada — a ausência fecha, não abre', async () => {
    // `current_setting(..., true)` devolve null, e null não casa com nada.
    // Errar para o lado de não ver dado é o único lado aceitável aqui.
    expect(await contarPeriodos(null)).toBe(0);
  });

  it('não se grava linha na empresa de outro', async () => {
    await expect(
      banco.comoEmpresa(safra, async (pg) => {
        await pg.query(
          'insert into periodo (empresa_id, ano, mes, estado) values ($1, 2025, 9, $2)',
          [concorrente, 'importado'],
        );
      }),
    ).rejects.toThrow();
  });

  it('a empresa de outro é invisível mesmo pedindo pelo id', async () => {
    const achou = await banco.comoEmpresa(safra, async (pg) => {
      const { rows } = await pg.query<{ n: number }>(
        'select count(*)::int as n from empresa where id = $1',
        [concorrente],
      );
      return rows[0]?.n ?? -1;
    });
    expect(achou).toBe(0);
  });

  it('o diagnóstico de importação herda o isolamento da importação', async () => {
    const idDaImportacao = crypto.randomUUID();
    await banco.comoEmpresa(concorrente, async (pg) => {
      await pg.query(
        `insert into importacao (id, empresa_id, origem, artefato, ano, mes)
         values ($1, $2, 'ERP Desconhecido', 'balancete', 2025, 8)`,
        [idDaImportacao, concorrente],
      );
      await pg.query(
        `insert into diagnostico_importacao (importacao_id, severidade, codigo, mensagem, ancora_tipo)
         values ($1, 'info', 'codificacao-detectada', 'Arquivo lido como windows-1252.', 'arquivo')`,
        [idDaImportacao],
      );
    });

    const vistos = await banco.comoEmpresa(safra, async (pg) => {
      const { rows } = await pg.query<{ n: number }>(
        'select count(*)::int as n from diagnostico_importacao',
      );
      return rows[0]?.n ?? -1;
    });
    expect(vistos).toBe(0);
  });
});
