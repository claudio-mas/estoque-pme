-- Gerado por gerar-rls.mjs a partir de src/rls.ts. Não edite à mão.
--
-- Não é migração numerada: é o estado que as policies devem ter, idempotente,
-- reaplicado depois de TODA execução de migrações. O drizzle-kit não modela
-- policies; sem este arquivo o schema de produção divergiria do que os testes
-- exercitam, e o pior caso é a RLS existir no teste e não no banco.

alter table "empresa" enable row level security;
alter table "empresa" force row level security;
drop policy if exists "empresa_leitura" on "empresa";
drop policy if exists "empresa_criacao" on "empresa";
drop policy if exists "empresa_alteracao" on "empresa";
drop policy if exists "empresa_remocao" on "empresa";
create policy "empresa_leitura" on "empresa" for select using (id = nullif(current_setting('app.empresa_id', true), '')::uuid or exists (
        select 1 from "usuario_empresa" ue
         where ue.empresa_id = "empresa".id and ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')));
create policy "empresa_criacao" on "empresa" for insert with check (true);
create policy "empresa_alteracao" on "empresa" for update using (id = nullif(current_setting('app.empresa_id', true), '')::uuid or exists (
        select 1 from "usuario_empresa" ue
         where ue.empresa_id = "empresa".id and ue.usuario_id = nullif(current_setting('app.usuario_id', true), ''))) with check (id = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "empresa_remocao" on "empresa" for delete using (id = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));

alter table "usuario_empresa" enable row level security;
alter table "usuario_empresa" force row level security;
drop policy if exists "usuario_empresa_leitura" on "usuario_empresa";
drop policy if exists "usuario_empresa_criacao" on "usuario_empresa";
drop policy if exists "usuario_empresa_alteracao" on "usuario_empresa";
drop policy if exists "usuario_empresa_remocao" on "usuario_empresa";
create policy "usuario_empresa_leitura" on "usuario_empresa" for select using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or "usuario_id" = nullif(current_setting('app.usuario_id', true), ''));
create policy "usuario_empresa_criacao" on "usuario_empresa" for insert with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "usuario_empresa_alteracao" on "usuario_empresa" for update using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or "usuario_id" = nullif(current_setting('app.usuario_id', true), '')) with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "usuario_empresa_remocao" on "usuario_empresa" for delete using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));

alter table "importacao" enable row level security;
alter table "importacao" force row level security;
drop policy if exists "importacao_leitura" on "importacao";
drop policy if exists "importacao_criacao" on "importacao";
drop policy if exists "importacao_alteracao" on "importacao";
drop policy if exists "importacao_remocao" on "importacao";
create policy "importacao_leitura" on "importacao" for select using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
create policy "importacao_criacao" on "importacao" for insert with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "importacao_alteracao" on "importacao" for update using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid) with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "importacao_remocao" on "importacao" for delete using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));

alter table "mapeamento_versao" enable row level security;
alter table "mapeamento_versao" force row level security;
drop policy if exists "mapeamento_versao_leitura" on "mapeamento_versao";
drop policy if exists "mapeamento_versao_criacao" on "mapeamento_versao";
drop policy if exists "mapeamento_versao_alteracao" on "mapeamento_versao";
drop policy if exists "mapeamento_versao_remocao" on "mapeamento_versao";
create policy "mapeamento_versao_leitura" on "mapeamento_versao" for select using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
create policy "mapeamento_versao_criacao" on "mapeamento_versao" for insert with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "mapeamento_versao_alteracao" on "mapeamento_versao" for update using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid) with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "mapeamento_versao_remocao" on "mapeamento_versao" for delete using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));

alter table "valor_informado" enable row level security;
alter table "valor_informado" force row level security;
drop policy if exists "valor_informado_leitura" on "valor_informado";
drop policy if exists "valor_informado_criacao" on "valor_informado";
drop policy if exists "valor_informado_alteracao" on "valor_informado";
drop policy if exists "valor_informado_remocao" on "valor_informado";
create policy "valor_informado_leitura" on "valor_informado" for select using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
create policy "valor_informado_criacao" on "valor_informado" for insert with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "valor_informado_alteracao" on "valor_informado" for update using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid) with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "valor_informado_remocao" on "valor_informado" for delete using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));

alter table "balancete_linha" enable row level security;
alter table "balancete_linha" force row level security;
drop policy if exists "balancete_linha_leitura" on "balancete_linha";
drop policy if exists "balancete_linha_criacao" on "balancete_linha";
drop policy if exists "balancete_linha_alteracao" on "balancete_linha";
drop policy if exists "balancete_linha_remocao" on "balancete_linha";
create policy "balancete_linha_leitura" on "balancete_linha" for select using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
create policy "balancete_linha_criacao" on "balancete_linha" for insert with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "balancete_linha_alteracao" on "balancete_linha" for update using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid) with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "balancete_linha_remocao" on "balancete_linha" for delete using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));

alter table "razao_conta" enable row level security;
alter table "razao_conta" force row level security;
drop policy if exists "razao_conta_leitura" on "razao_conta";
drop policy if exists "razao_conta_criacao" on "razao_conta";
drop policy if exists "razao_conta_alteracao" on "razao_conta";
drop policy if exists "razao_conta_remocao" on "razao_conta";
create policy "razao_conta_leitura" on "razao_conta" for select using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
create policy "razao_conta_criacao" on "razao_conta" for insert with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "razao_conta_alteracao" on "razao_conta" for update using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid) with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "razao_conta_remocao" on "razao_conta" for delete using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));

alter table "razao_lancamento" enable row level security;
alter table "razao_lancamento" force row level security;
drop policy if exists "razao_lancamento_leitura" on "razao_lancamento";
drop policy if exists "razao_lancamento_criacao" on "razao_lancamento";
drop policy if exists "razao_lancamento_alteracao" on "razao_lancamento";
drop policy if exists "razao_lancamento_remocao" on "razao_lancamento";
create policy "razao_lancamento_leitura" on "razao_lancamento" for select using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
create policy "razao_lancamento_criacao" on "razao_lancamento" for insert with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "razao_lancamento_alteracao" on "razao_lancamento" for update using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid) with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "razao_lancamento_remocao" on "razao_lancamento" for delete using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));

alter table "periodo" enable row level security;
alter table "periodo" force row level security;
drop policy if exists "periodo_leitura" on "periodo";
drop policy if exists "periodo_criacao" on "periodo";
drop policy if exists "periodo_alteracao" on "periodo";
drop policy if exists "periodo_remocao" on "periodo";
create policy "periodo_leitura" on "periodo" for select using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
create policy "periodo_criacao" on "periodo" for insert with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "periodo_alteracao" on "periodo" for update using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid) with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "periodo_remocao" on "periodo" for delete using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));

alter table "lancamento_nivel" enable row level security;
alter table "lancamento_nivel" force row level security;
drop policy if exists "lancamento_nivel_leitura" on "lancamento_nivel";
drop policy if exists "lancamento_nivel_criacao" on "lancamento_nivel";
drop policy if exists "lancamento_nivel_alteracao" on "lancamento_nivel";
drop policy if exists "lancamento_nivel_remocao" on "lancamento_nivel";
create policy "lancamento_nivel_leitura" on "lancamento_nivel" for select using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
create policy "lancamento_nivel_criacao" on "lancamento_nivel" for insert with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "lancamento_nivel_alteracao" on "lancamento_nivel" for update using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid) with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "lancamento_nivel_remocao" on "lancamento_nivel" for delete using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));

alter table "diagnostico_periodo" enable row level security;
alter table "diagnostico_periodo" force row level security;
drop policy if exists "diagnostico_periodo_leitura" on "diagnostico_periodo";
drop policy if exists "diagnostico_periodo_criacao" on "diagnostico_periodo";
drop policy if exists "diagnostico_periodo_alteracao" on "diagnostico_periodo";
drop policy if exists "diagnostico_periodo_remocao" on "diagnostico_periodo";
create policy "diagnostico_periodo_leitura" on "diagnostico_periodo" for select using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
create policy "diagnostico_periodo_criacao" on "diagnostico_periodo" for insert with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "diagnostico_periodo_alteracao" on "diagnostico_periodo" for update using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid) with check ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "diagnostico_periodo_remocao" on "diagnostico_periodo" for delete using ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));

alter table "diagnostico_importacao" enable row level security;
alter table "diagnostico_importacao" force row level security;
drop policy if exists "diagnostico_importacao_leitura" on "diagnostico_importacao";
drop policy if exists "diagnostico_importacao_criacao" on "diagnostico_importacao";
drop policy if exists "diagnostico_importacao_alteracao" on "diagnostico_importacao";
drop policy if exists "diagnostico_importacao_remocao" on "diagnostico_importacao";
create policy "diagnostico_importacao_leitura" on "diagnostico_importacao" for select using (exists (
    select 1 from "importacao" i
     where i.id = "diagnostico_importacao".importacao_id
       and i.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid));
create policy "diagnostico_importacao_criacao" on "diagnostico_importacao" for insert with check (exists (
    select 1 from "importacao" i
     where i.id = "diagnostico_importacao".importacao_id
       and i.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "diagnostico_importacao_alteracao" on "diagnostico_importacao" for update using (exists (
    select 1 from "importacao" i
     where i.id = "diagnostico_importacao".importacao_id
       and i.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid)) with check (exists (
    select 1 from "importacao" i
     where i.id = "diagnostico_importacao".importacao_id
       and i.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
create policy "diagnostico_importacao_remocao" on "diagnostico_importacao" for delete using (exists (
    select 1 from "importacao" i
     where i.id = "diagnostico_importacao".importacao_id
       and i.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) and exists (
    select 1 from "usuario_empresa" ue
     where ue.usuario_id = nullif(current_setting('app.usuario_id', true), '')
       and ue.empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
       and ue.papel = 'editor'));
