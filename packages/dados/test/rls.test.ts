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

import type { Escopo } from '../src/banco';
import { comEmpresa, comUsuario } from '../src/banco';
import { empresasDoUsuario, vinculoDe } from '../src/acesso';
import { vincular, type Semeado } from '../src/semente';

let banco: Banco;
let safra: Semeado;
let concorrente: Semeado;
let leitor: Semeado;

beforeAll(async () => {
  banco = await bancoDeTeste();
  safra = await semearEmpresa(banco, 'Alimentos Boa Safra Ltda');
  concorrente = await semearEmpresa(banco, 'Laticínios Vale Verde Ltda');

  // Um leitor na Boa Safra: vê, mas não escreve (RF-23).
  leitor = await banco.comoDono((db) =>
    vincular(db, { email: 'socio@boasafra.com.br', empresaId: safra.empresaId, papel: 'leitor' }),
  );

  for (const escopo of [safra, concorrente]) {
    await banco.comoEmpresa(escopo, async (pg) => {
      await pg.query('insert into periodo (empresa_id, ano, mes, estado) values ($1, 2025, 8, $2)', [
        escopo.empresaId,
        'importado',
      ]);
    });
  }
});

afterAll(async () => {
  await banco.fechar();
});

const contarPeriodos = (escopo: Escopo | null) =>
  banco.comoEmpresa(escopo, async (pg) => {
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
          [concorrente.empresaId, 'importado'],
        );
      }),
    ).rejects.toThrow();
  });

  it('o leitor vê a empresa dele e não escreve nela (RF-23)', async () => {
    expect(await contarPeriodos(leitor)).toBe(1);
    // A policy recusa, não a tela: é o que vale contra uma action chamada por fora.
    await expect(
      banco.comoEmpresa(leitor, async (pg) => {
        await pg.query(
          'insert into periodo (empresa_id, ano, mes, estado) values ($1, 2025, 10, $2)',
          [leitor.empresaId, 'importado'],
        );
      }),
    ).rejects.toThrow();
  });

  it('sem usuário declarado, nem o editor escreve — a ausência fecha', async () => {
    await expect(
      banco.comoEmpresa({ empresaId: safra.empresaId }, async (pg) => {
        await pg.query(
          'insert into periodo (empresa_id, ano, mes, estado) values ($1, 2025, 11, $2)',
          [safra.empresaId, 'importado'],
        );
      }),
    ).rejects.toThrow();
  });

  it('a empresa de outro é invisível mesmo pedindo pelo id', async () => {
    const achou = await banco.comoEmpresa(safra, async (pg) => {
      const { rows } = await pg.query<{ n: number }>(
        'select count(*)::int as n from empresa where id = $1',
        [concorrente.empresaId],
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
        [idDaImportacao, concorrente.empresaId],
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

describe('a troca de contexto (RF-23)', () => {
  it('o usuário lista as próprias empresas sem declarar nenhuma', async () => {
    const minhas = await comUsuario(banco.db, safra.usuarioId, (tx) =>
      empresasDoUsuario(tx, safra.usuarioId),
    );
    expect(minhas.map((v) => v.nome)).toEqual(['Alimentos Boa Safra Ltda']);
    expect(minhas[0]?.papel).toBe('editor');
  });

  it('e não vê as dos outros por essa porta', async () => {
    const doLeitor = await comUsuario(banco.db, leitor.usuarioId, (tx) =>
      empresasDoUsuario(tx, leitor.usuarioId),
    );
    // O sócio leitor está só na Boa Safra; o Vale Verde não aparece.
    expect(doLeitor.map((v) => v.nome)).toEqual(['Alimentos Boa Safra Ltda']);
  });

  it('o vínculo conferido dentro da empresa devolve o papel, e fora dela nada', async () => {
    const papel = await comEmpresa(banco.db, leitor, (tx) =>
      vinculoDe(tx, leitor.empresaId, leitor.usuarioId),
    );
    expect(papel).toBe('leitor');

    // Empresa trocada no formulário: a policy esconde a linha e o vínculo "não existe".
    const forjado = await comEmpresa(
      banco.db,
      { empresaId: concorrente.empresaId, usuarioId: leitor.usuarioId },
      (tx) => vinculoDe(tx, concorrente.empresaId, leitor.usuarioId),
    );
    expect(forjado).toBeNull();
  });
});
