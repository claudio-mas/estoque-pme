/**
 * Row-Level Security: o isolamento por empresa, no banco.
 *
 * O D11 escolheu Postgres com RLS justamente por **não** confiar cada query. A
 * aplicação declara empresa e usuário por transação com `SET LOCAL`, e as
 * policies leem `current_setting`. `SET LOCAL` é por transação, então não vaza
 * entre requisições num pool.
 *
 * Duas policies por tabela, e não uma: **ler** exige a empresa; **escrever**
 * exige a empresa e que o usuário corrente seja `editor` nela (RF-23). A
 * distinção mora aqui e não na tela porque tela esconde botão, e policy recusa
 * — só a segunda vale contra uma action chamada por fora.
 *
 * **`FORCE ROW LEVEL SECURITY` não é detalhe**: o dono da tabela ignora RLS por
 * padrão, e a aplicação é dona das tabelas. Sem o `FORCE`, a policy existiria e
 * não valeria.
 *
 * E o `FORCE` **não** contém superusuário: quem tem `BYPASSRLS` ignora a RLS
 * incondicionalmente. A aplicação tem de se conectar como papel comum, e é isso
 * que o teste faz com `set local role` — sem esse cuidado ele passaria inteiro
 * dizendo que tudo está protegido enquanto nada estaria.
 *
 * O SQL gerado é **idempotente e reaplicado depois de toda migração**: não é
 * uma migração numerada, é o estado que as policies devem ter. Assim uma tabela
 * nova ou uma regra nova não exigem lembrar de "migrar a RLS".
 */

/** As tabelas que a RLS protege, e por qual coluna cada uma se liga à empresa. */
export const ISOLAMENTO: Readonly<Record<string, string>> = {
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
 * A empresa e o usuário correntes da transação.
 *
 * `current_setting(..., true)` devolve `null` em vez de erro quando ninguém
 * definiu — e `null` não casa com nada, então a ausência do `SET LOCAL` **fecha**
 * o acesso em vez de abri-lo. Errar para o lado de não ver dado é o único lado
 * aceitável aqui.
 */
export const EMPRESA_CORRENTE = `nullif(current_setting('app.empresa_id', true), '')::uuid`;
export const USUARIO_CORRENTE = `nullif(current_setting('app.usuario_id', true), '')`;

/** O usuário corrente é editor da empresa corrente. */
export const EH_EDITOR = `exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = ${USUARIO_CORRENTE}
       and ue.empresa_id = ${EMPRESA_CORRENTE}
       and ue.papel = 'editor')`;

function policies(tabela: string, leitura: string, escrita: string): string {
  const nomes = ['leitura', 'criacao', 'alteracao', 'remocao'].map((n) => `${tabela}_${n}`);
  return [
    `alter table "${tabela}" enable row level security;`,
    `alter table "${tabela}" force row level security;`,
    ...nomes.map((n) => `drop policy if exists "${n}" on "${tabela}";`),
    `create policy "${nomes[0]}" on "${tabela}" for select using (${leitura});`,
    `create policy "${nomes[1]}" on "${tabela}" for insert with check (${escrita});`,
    `create policy "${nomes[2]}" on "${tabela}" for update using (${leitura}) with check (${escrita});`,
    `create policy "${nomes[3]}" on "${tabela}" for delete using (${escrita});`,
  ].join('\n');
}

/** O SQL que liga a RLS. Idempotente; roda depois de toda migração. */
export function sqlDeRls(): string {
  const blocos: string[] = [];

  // `empresa` é a exceção, e tem de ser: no `insert` a linha ainda não existe
  // para ninguém, então exigir que ela case com a empresa corrente tornaria
  // impossível criar a primeira. Criar é liberado — não vaza dado de ninguém —
  // e fica como dívida com data: reabrir quando existir auto-cadastro.
  blocos.push(
    policies(
      'empresa',
      `id = ${EMPRESA_CORRENTE} or exists (
        select 1 from "usuario_empresa" ue
         where ue.empresa_id = "empresa".id and ue.usuario_id = ${USUARIO_CORRENTE})`,
      `id = ${EMPRESA_CORRENTE} and ${EH_EDITOR}`,
    ).replace(
      /create policy "empresa_criacao"[^;]*;/,
      'create policy "empresa_criacao" on "empresa" for insert with check (true);',
    ),
  );

  // `usuario_empresa` tem uma porta a mais na leitura: o usuário vê os próprios
  // vínculos mesmo sem empresa declarada. É o que a tela de troca de contexto
  // (RF-23) precisa — listar "minhas empresas" antes de escolher uma. A escrita
  // continua exigindo empresa e editor.
  blocos.push(
    policies(
      'usuario_empresa',
      `"empresa_id" = ${EMPRESA_CORRENTE} or "usuario_id" = ${USUARIO_CORRENTE}`,
      `"empresa_id" = ${EMPRESA_CORRENTE} and ${EH_EDITOR}`,
    ),
  );

  for (const [tabela, coluna] of Object.entries(ISOLAMENTO)) {
    blocos.push(
      policies(
        tabela,
        `"${coluna}" = ${EMPRESA_CORRENTE}`,
        `"${coluna}" = ${EMPRESA_CORRENTE} and ${EH_EDITOR}`,
      ),
    );
  }

  // `diagnostico_importacao` não tem empresa própria: ela vem da importação.
  const daImportacao = (extra: string) => `exists (
    select 1 from "importacao" i
     where i.id = "diagnostico_importacao".importacao_id
       and i.empresa_id = ${EMPRESA_CORRENTE}${extra})`;
  blocos.push(
    policies('diagnostico_importacao', daImportacao(''), `${daImportacao('')} and ${EH_EDITOR}`),
  );

  return `${blocos.join('\n\n')}\n`;
}
