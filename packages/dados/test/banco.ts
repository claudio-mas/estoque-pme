/**
 * Um Postgres por teste, no processo.
 *
 * PGlite é Postgres de verdade compilado para wasm: `CHECK`, policies e
 * `ON CONFLICT` se comportam igual, e roda no Vitest sem Docker — que neste
 * projeto, em Windows, não é detalhe pequeno.
 *
 * **A conexão é superusuário, e superusuário ignora RLS incondicionalmente** —
 * `FORCE ROW LEVEL SECURITY` não muda isso: o `FORCE` age sobre o *dono* da
 * tabela, não sobre quem tem `BYPASSRLS`. Sem cuidado, este arquivo passaria
 * inteiro dizendo que tudo está protegido enquanto nada estaria.
 *
 * Daí o `set local role`: as transações rodam como `aplicacao`, um papel comum
 * — que é como o app se conecta em produção. É o `FORCE` que faz a policy valer
 * mesmo quando esse papel for dono das tabelas, e é o papel comum que faz o
 * teste medir alguma coisa.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const AQUI = dirname(fileURLToPath(import.meta.url));

/**
 * As migrações **como elas serão aplicadas em produção**, lidas do disco.
 *
 * Ler o arquivo em vez de chamar `sqlDeRls()` não é preciosismo: o que se quer
 * provar é que o banco de produção tem as policies, e chamar a função testaria
 * a função. Se `migracoes/0001_rls.sql` sair de sincronia com `src/rls.ts`, é
 * aqui que se descobre.
 */
function migracoes(): string {
  const ler = (nome: string) => readFileSync(join(AQUI, '..', 'migracoes', nome), 'utf8');
  // O drizzle-kit separa statements com `--> statement-breakpoint`.
  const inicial = ler('0000_inicial.sql').split('--> statement-breakpoint').join('\n');
  return `${inicial}\n${ler('0001_rls.sql')}`;
}

export interface Banco {
  readonly pg: PGlite;
  /** Executa dentro de uma transação com a empresa declarada, como a aplicação faz. */
  comoEmpresa<T>(empresaId: string | null, corpo: (pg: PGlite) => Promise<T>): Promise<T>;
  fechar(): Promise<void>;
}

export async function bancoDeTeste(): Promise<Banco> {
  const pg = new PGlite();
  await pg.exec(migracoes());
  await pg.exec(`
    create role aplicacao nologin;
    grant usage on schema public to aplicacao;
    grant select, insert, update, delete on all tables in schema public to aplicacao;
  `);

  return {
    pg,
    async comoEmpresa(empresaId, corpo) {
      await pg.exec('begin');
      try {
        // Papel comum: superusuário ignoraria toda policy, e o teste não mediria nada.
        await pg.exec('set local role aplicacao');
        // `SET LOCAL` é por transação: não vaza entre requisições num pool.
        await pg.query('select set_config($1, $2, true)', ['app.empresa_id', empresaId ?? '']);
        const resultado = await corpo(pg);
        await pg.exec('commit');
        return resultado;
      } catch (erro) {
        await pg.exec('rollback');
        throw erro;
      }
    },
    async fechar() {
      await pg.close();
    },
  };
}

/**
 * Cria uma empresa como a aplicação criará.
 *
 * O id vem de fora, e não do `default gen_random_uuid()`, por uma razão que a
 * RLS impõe: `insert ... returning` também passa pela policy de `select`, e a
 * linha recém-criada só seria legível se a empresa corrente já fosse ela. Gerar
 * o id antes resolve isso e é o que o app terá de fazer de qualquer forma.
 */
export async function semearEmpresa(banco: Banco, nome: string): Promise<string> {
  const id = crypto.randomUUID();
  await banco.comoEmpresa(id, async (pg) => {
    await pg.query('insert into empresa (id, nome) values ($1, $2)', [id, nome]);
  });
  return id;
}
