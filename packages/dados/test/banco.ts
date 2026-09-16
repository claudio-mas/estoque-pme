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
 * Daí os dois papéis, como em produção: a sessão roda como `aplicacao`, um
 * papel comum, e só `comoDono` volta ao superusuário — para semear, que é o que
 * o papel de migração faz em produção.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/schema';
import type { Banco as BancoDrizzle, Escopo } from '../src/banco';
import { semear, type Semeado } from '../src/semente';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA = join(AQUI, '..', 'migracoes');

/**
 * As migrações **como elas serão aplicadas em produção**, lidas do disco:
 * todas as numeradas, em ordem, e depois `rls.sql`.
 *
 * Ler os arquivos em vez de chamar `sqlDeRls()` não é preciosismo: o que se
 * quer provar é que o banco de produção tem as policies, e chamar a função
 * testaria a função. Se `rls.sql` sair de sincronia com `src/rls.ts`, é aqui
 * que se descobre.
 */
function migracoes(): string {
  const numeradas = readdirSync(PASTA)
    .filter((nome) => /^\d{4}_.*\.sql$/.test(nome))
    .sort();
  const ler = (nome: string) => readFileSync(join(PASTA, nome), 'utf8');
  // O drizzle-kit separa statements com `--> statement-breakpoint`.
  const ddl = numeradas.map((nome) => ler(nome).split('--> statement-breakpoint').join('\n'));
  return [...ddl, ler('rls.sql')].join('\n');
}

export interface Banco {
  readonly pg: PGlite;
  /** O mesmo banco pela API do Drizzle, que é como a escrita o consome. */
  readonly db: BancoDrizzle;
  /** Uma transação com empresa e usuário declarados, como a aplicação faz. */
  comoEmpresa<T>(escopo: Escopo | null, corpo: (pg: PGlite) => Promise<T>): Promise<T>;
  /** Volta ao superusuário só pelo tempo do corpo: é o papel de migração. */
  comoDono<T>(corpo: (db: BancoDrizzle) => Promise<T>): Promise<T>;
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
  const db = drizzle(pg, { schema }) as unknown as BancoDrizzle;

  // Daqui para a frente tudo roda como papel comum, que é o que faz a RLS
  // valer. PGlite tem uma conexão só, então `set role` basta.
  await pg.exec('set role aplicacao');

  return {
    pg,
    db,
    async comoEmpresa(escopo, corpo) {
      await pg.exec('begin');
      try {
        // `SET LOCAL` é por transação: não vaza entre requisições num pool.
        await pg.query('select set_config($1, $2, true)', [
          'app.empresa_id',
          escopo?.empresaId ?? '',
        ]);
        await pg.query('select set_config($1, $2, true)', [
          'app.usuario_id',
          escopo?.usuarioId ?? '',
        ]);
        const resultado = await corpo(pg);
        await pg.exec('commit');
        return resultado;
      } catch (erro) {
        await pg.exec('rollback');
        throw erro;
      }
    },
    async comoDono(corpo) {
      await pg.exec('reset role');
      try {
        return await corpo(db);
      } finally {
        await pg.exec('set role aplicacao');
      }
    },
    async fechar() {
      await pg.close();
    },
  };
}

/** Semeia usuário, empresa e vínculo como o papel de migração faria. */
export async function semearEmpresa(
  banco: Banco,
  nome: string,
  email = `controller@${nome.toLowerCase().replace(/[^a-z]+/g, '-')}.com.br`,
  papel: 'editor' | 'leitor' = 'editor',
): Promise<Semeado> {
  return banco.comoDono((db) => semear(db, { email, empresa: nome, papel }));
}
