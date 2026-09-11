-- Gerado por gerar-rls.mjs a partir de src/rls.ts. Não edite à mão.
-- O drizzle-kit não modela policies; sem este arquivo o schema de produção
-- divergiria do que os testes exercitam, e o pior caso é a RLS existir no
-- teste e não no banco.

alter table "empresa" enable row level security;
alter table "empresa" force row level security;
drop policy if exists "empresa_leitura" on "empresa";
drop policy if exists "empresa_criacao" on "empresa";
drop policy if exists "empresa_alteracao" on "empresa";
drop policy if exists "empresa_remocao" on "empresa";
create policy "empresa_leitura" on "empresa" for select using (id = nullif(current_setting('app.empresa_id', true), '')::uuid);
create policy "empresa_criacao" on "empresa" for insert with check (true);
create policy "empresa_alteracao" on "empresa" for update using (id = nullif(current_setting('app.empresa_id', true), '')::uuid) with check (id = nullif(current_setting('app.empresa_id', true), '')::uuid);
create policy "empresa_remocao" on "empresa" for delete using (id = nullif(current_setting('app.empresa_id', true), '')::uuid);

alter table "usuario_empresa" enable row level security;
alter table "usuario_empresa" force row level security;
drop policy if exists "usuario_empresa_por_empresa" on "usuario_empresa";
create policy "usuario_empresa_por_empresa" on "usuario_empresa"
  using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);

alter table "importacao" enable row level security;
alter table "importacao" force row level security;
drop policy if exists "importacao_por_empresa" on "importacao";
create policy "importacao_por_empresa" on "importacao"
  using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);

alter table "mapeamento_versao" enable row level security;
alter table "mapeamento_versao" force row level security;
drop policy if exists "mapeamento_versao_por_empresa" on "mapeamento_versao";
create policy "mapeamento_versao_por_empresa" on "mapeamento_versao"
  using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);

alter table "valor_informado" enable row level security;
alter table "valor_informado" force row level security;
drop policy if exists "valor_informado_por_empresa" on "valor_informado";
create policy "valor_informado_por_empresa" on "valor_informado"
  using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);

alter table "balancete_linha" enable row level security;
alter table "balancete_linha" force row level security;
drop policy if exists "balancete_linha_por_empresa" on "balancete_linha";
create policy "balancete_linha_por_empresa" on "balancete_linha"
  using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);

alter table "razao_conta" enable row level security;
alter table "razao_conta" force row level security;
drop policy if exists "razao_conta_por_empresa" on "razao_conta";
create policy "razao_conta_por_empresa" on "razao_conta"
  using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);

alter table "razao_lancamento" enable row level security;
alter table "razao_lancamento" force row level security;
drop policy if exists "razao_lancamento_por_empresa" on "razao_lancamento";
create policy "razao_lancamento_por_empresa" on "razao_lancamento"
  using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);

alter table "periodo" enable row level security;
alter table "periodo" force row level security;
drop policy if exists "periodo_por_empresa" on "periodo";
create policy "periodo_por_empresa" on "periodo"
  using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);

alter table "lancamento_nivel" enable row level security;
alter table "lancamento_nivel" force row level security;
drop policy if exists "lancamento_nivel_por_empresa" on "lancamento_nivel";
create policy "lancamento_nivel_por_empresa" on "lancamento_nivel"
  using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);

alter table "diagnostico_periodo" enable row level security;
alter table "diagnostico_periodo" force row level security;
drop policy if exists "diagnostico_periodo_por_empresa" on "diagnostico_periodo";
create policy "diagnostico_periodo_por_empresa" on "diagnostico_periodo"
  using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
  with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);

alter table "diagnostico_importacao" enable row level security;
alter table "diagnostico_importacao" force row level security;
drop policy if exists "diagnostico_importacao_por_empresa" on "diagnostico_importacao";
create policy "diagnostico_importacao_por_empresa" on "diagnostico_importacao"
  using (exists (select 1 from "importacao" i
    where i.id = "diagnostico_importacao".importacao_id and i.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid))
  with check (exists (select 1 from "importacao" i
    where i.id = "diagnostico_importacao".importacao_id and i.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid));
