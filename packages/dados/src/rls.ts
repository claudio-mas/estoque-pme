/**
 * Row-Level Security: o isolamento por empresa, no banco.
 *
 * O D11 escolheu Postgres com RLS justamente por **não** confiar cada query. A
 * aplicação declara a empresa por transação com `SET LOCAL app.empresa_id`, e a
 * policy lê `current_setting`. `SET LOCAL` é por transação, então não vaza
 * entre requisições num pool.
 *
 * **`FORCE ROW LEVEL SECURITY` não é detalhe**: o dono da tabela ignora RLS por
 * padrão, e a aplicação é dona das tabelas. Sem o `FORCE`, a policy existiria e
 * não valeria.
 *
 * E o `FORCE` **não** contém superusuário: quem tem `BYPASSRLS` ignora a RLS
 * incondicionalmente. A aplicação tem de se conectar como papel comum, e é isso
 * que o teste faz com `set local role` — sem esse cuidado ele passaria inteiro
 * dizendo que tudo está protegido enquanto nada estaria.
 */

/** As tabelas que a RLS protege, e por qual coluna cada uma se liga à empresa. */
export const ISOLAMENTO: Readonly<Record<string, string>> = {
  usuario_empresa: 'empresa_id',
  importacao: 'empresa_id',
  mapeamento_versao: 'empresa_id',
  valor_informado: 'empresa_id',
  balancete_linha: 'empresa_id',
  razao_conta: 'empresa_id',
  razao_lancamento: 'empresa_id',
  periodo: 'empresa_id',
  lancamento_nivel: 'empresa_id',
  diagnostico_periodo: 'empresa_id',
};

/**
 * A empresa corrente da transação.
 *
 * `current_setting(..., true)` devolve `null` em vez de erro quando ninguém
 * definiu — e `null` não casa com nada, então a ausência do `SET LOCAL` **fecha**
 * o acesso em vez de abri-lo. Errar para o lado de não ver dado é o único lado
 * aceitável aqui.
 */
export const EMPRESA_CORRENTE = `nullif(current_setting('app.empresa_id', true), '')::uuid`;

/** O SQL que liga a RLS. Roda depois das migrações geradas pelo drizzle-kit. */
export function sqlDeRls(): string {
  const blocos = Object.entries(ISOLAMENTO).map(([tabela, coluna]) => {
    return [
      `alter table "${tabela}" enable row level security;`,
      `alter table "${tabela}" force row level security;`,
      `drop policy if exists "${tabela}_por_empresa" on "${tabela}";`,
      `create policy "${tabela}_por_empresa" on "${tabela}"`,
      `  using ("${coluna}" = ${EMPRESA_CORRENTE})`,
      `  with check ("${coluna}" = ${EMPRESA_CORRENTE});`,
    ].join('\n');
  });

  // `empresa` é a exceção, e tem de ser: no `insert` a linha ainda não existe
  // para ninguém, então exigir que ela case com a empresa corrente tornaria
  // impossível criar a primeira. Ler, alterar e remover continuam restritos —
  // criar uma linha de empresa não vaza dado de ninguém.
  blocos.unshift(
    [
      'alter table "empresa" enable row level security;',
      'alter table "empresa" force row level security;',
      'drop policy if exists "empresa_leitura" on "empresa";',
      'drop policy if exists "empresa_criacao" on "empresa";',
      'drop policy if exists "empresa_alteracao" on "empresa";',
      'drop policy if exists "empresa_remocao" on "empresa";',
      `create policy "empresa_leitura" on "empresa" for select using (id = ${EMPRESA_CORRENTE});`,
      'create policy "empresa_criacao" on "empresa" for insert with check (true);',
      `create policy "empresa_alteracao" on "empresa" for update using (id = ${EMPRESA_CORRENTE}) with check (id = ${EMPRESA_CORRENTE});`,
      `create policy "empresa_remocao" on "empresa" for delete using (id = ${EMPRESA_CORRENTE});`,
    ].join('\n'),
  );

  // `diagnostico_importacao` não tem empresa própria: ela vem da importação.
  blocos.push(
    [
      'alter table "diagnostico_importacao" enable row level security;',
      'alter table "diagnostico_importacao" force row level security;',
      'drop policy if exists "diagnostico_importacao_por_empresa" on "diagnostico_importacao";',
      'create policy "diagnostico_importacao_por_empresa" on "diagnostico_importacao"',
      '  using (exists (select 1 from "importacao" i',
      `    where i.id = "diagnostico_importacao".importacao_id and i.empresa_id = ${EMPRESA_CORRENTE}))`,
      '  with check (exists (select 1 from "importacao" i',
      `    where i.id = "diagnostico_importacao".importacao_id and i.empresa_id = ${EMPRESA_CORRENTE}));`,
    ].join('\n'),
  );

  return `${blocos.join('\n\n')}\n`;
}
