CREATE TABLE "balancete_linha" (
	"empresa_id" uuid NOT NULL,
	"ano" integer NOT NULL,
	"mes" integer NOT NULL,
	"conta" text NOT NULL,
	"descricao" text NOT NULL,
	"saldo_anterior" bigint,
	"debito" bigint NOT NULL,
	"credito" bigint NOT NULL,
	"saldo_atual" bigint,
	"grau" integer NOT NULL,
	"sintetica" boolean NOT NULL,
	"linha" integer NOT NULL,
	"importacao_id" uuid,
	CONSTRAINT "balancete_linha_empresa_id_ano_mes_conta_pk" PRIMARY KEY("empresa_id","ano","mes","conta"),
	CONSTRAINT "balancete_linha_competencia" CHECK (mes between 1 and 12 and ano between 1900 and 2999)
);
--> statement-breakpoint
CREATE TABLE "diagnostico_importacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importacao_id" uuid NOT NULL,
	"severidade" text NOT NULL,
	"codigo" text NOT NULL,
	"mensagem" text NOT NULL,
	"ancora_tipo" text,
	"ancora_linha" integer,
	"ancora_coluna" text,
	"ancora_conta" text,
	"ancora_nivel" text,
	CONSTRAINT "diagnostico_importacao_severidade" CHECK ("diagnostico_importacao"."severidade" in ('erro', 'aviso', 'info')),
	CONSTRAINT "diagnostico_importacao_ancora" CHECK ((ancora_tipo in ('arquivo', 'mapeamento') and ancora_linha is null and ancora_coluna is null and ancora_conta is null and ancora_nivel is null)
    or (ancora_tipo = 'linha' and ancora_linha is not null and ancora_conta is null and ancora_nivel is null)
    or (ancora_tipo = 'conta' and ancora_conta is not null and ancora_linha is null and ancora_coluna is null)
    or (ancora_tipo = 'nivel' and ancora_nivel is not null and ancora_linha is null and ancora_coluna is null and ancora_conta is null)
    or (ancora_tipo = 'lancamento' and ancora_conta is not null and ancora_linha is not null and ancora_coluna is null and ancora_nivel is null))
);
--> statement-breakpoint
CREATE TABLE "diagnostico_periodo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"ano" integer NOT NULL,
	"mes" integer NOT NULL,
	"severidade" text NOT NULL,
	"codigo" text NOT NULL,
	"mensagem" text NOT NULL,
	"ancora_tipo" text,
	"ancora_linha" integer,
	"ancora_coluna" text,
	"ancora_conta" text,
	"ancora_nivel" text,
	CONSTRAINT "diagnostico_periodo_competencia" CHECK (mes between 1 and 12 and ano between 1900 and 2999),
	CONSTRAINT "diagnostico_periodo_severidade" CHECK ("diagnostico_periodo"."severidade" in ('erro', 'aviso', 'info')),
	CONSTRAINT "diagnostico_periodo_ancora" CHECK ((ancora_tipo in ('arquivo', 'mapeamento') and ancora_linha is null and ancora_coluna is null and ancora_conta is null and ancora_nivel is null)
    or (ancora_tipo = 'linha' and ancora_linha is not null and ancora_conta is null and ancora_nivel is null)
    or (ancora_tipo = 'conta' and ancora_conta is not null and ancora_linha is null and ancora_coluna is null)
    or (ancora_tipo = 'nivel' and ancora_nivel is not null and ancora_linha is null and ancora_coluna is null and ancora_conta is null)
    or (ancora_tipo = 'lancamento' and ancora_conta is not null and ancora_linha is not null and ancora_coluna is null and ancora_nivel is null))
);
--> statement-breakpoint
CREATE TABLE "empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "importacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"origem" text NOT NULL,
	"artefato" text NOT NULL,
	"ano" integer NOT NULL,
	"mes" integer NOT NULL,
	"perfil" jsonb,
	"linhas_criadas" integer DEFAULT 0 NOT NULL,
	"linhas_atualizadas" integer DEFAULT 0 NOT NULL,
	"importado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "importacao_competencia" CHECK (mes between 1 and 12 and ano between 1900 and 2999),
	CONSTRAINT "importacao_artefato" CHECK ("importacao"."artefato" in ('balancete', 'razao'))
);
--> statement-breakpoint
CREATE TABLE "lancamento_nivel" (
	"empresa_id" uuid NOT NULL,
	"ano" integer NOT NULL,
	"mes" integer NOT NULL,
	"nivel" text NOT NULL,
	"estoque_estado" text NOT NULL,
	"estoque_abertura" bigint,
	"estoque_fechamento" bigint,
	"estoque_motivo_codigo" text,
	"estoque_motivo_ancora_tipo" text,
	"estoque_motivo_ancora_linha" integer,
	"estoque_motivo_ancora_coluna" text,
	"estoque_motivo_ancora_conta" text,
	"estoque_motivo_ancora_nivel" text,
	"consumo_estado" text NOT NULL,
	"consumo_valor" bigint,
	"consumo_motivo_codigo" text,
	"consumo_motivo_ancora_tipo" text,
	"consumo_motivo_ancora_linha" integer,
	"consumo_motivo_ancora_coluna" text,
	"consumo_motivo_ancora_conta" text,
	"consumo_motivo_ancora_nivel" text,
	"perdas_estado" text NOT NULL,
	"perdas_valor" bigint,
	CONSTRAINT "lancamento_nivel_empresa_id_ano_mes_nivel_pk" PRIMARY KEY("empresa_id","ano","mes","nivel"),
	CONSTRAINT "lancamento_competencia" CHECK (mes between 1 and 12 and ano between 1900 and 2999),
	CONSTRAINT "lancamento_nivel_valido" CHECK ("lancamento_nivel"."nivel" in ('MP', 'PP', 'PA')),
	CONSTRAINT "lancamento_estoque" CHECK (("lancamento_nivel"."estoque_estado" = 'lido' and "lancamento_nivel"."estoque_fechamento" is not null and estoque_motivo_codigo is null)
        or ("lancamento_nivel"."estoque_estado" = 'ausente' and "lancamento_nivel"."estoque_abertura" is null and "lancamento_nivel"."estoque_fechamento" is null and estoque_motivo_codigo is null)
        or ("lancamento_nivel"."estoque_estado" = 'indefinido' and "lancamento_nivel"."estoque_abertura" is null and "lancamento_nivel"."estoque_fechamento" is null and estoque_motivo_codigo is not null)),
	CONSTRAINT "lancamento_estoque_motivo" CHECK (((estoque_motivo_codigo is null and estoque_motivo_ancora_tipo is null) or (estoque_motivo_codigo is not null and estoque_motivo_ancora_tipo is not null))
    and ((estoque_motivo_ancora_tipo is null and estoque_motivo_ancora_linha is null and estoque_motivo_ancora_coluna is null and estoque_motivo_ancora_conta is null and estoque_motivo_ancora_nivel is null) or (estoque_motivo_ancora_tipo in ('arquivo', 'mapeamento') and estoque_motivo_ancora_linha is null and estoque_motivo_ancora_coluna is null and estoque_motivo_ancora_conta is null and estoque_motivo_ancora_nivel is null)
    or (estoque_motivo_ancora_tipo = 'linha' and estoque_motivo_ancora_linha is not null and estoque_motivo_ancora_conta is null and estoque_motivo_ancora_nivel is null)
    or (estoque_motivo_ancora_tipo = 'conta' and estoque_motivo_ancora_conta is not null and estoque_motivo_ancora_linha is null and estoque_motivo_ancora_coluna is null)
    or (estoque_motivo_ancora_tipo = 'nivel' and estoque_motivo_ancora_nivel is not null and estoque_motivo_ancora_linha is null and estoque_motivo_ancora_coluna is null and estoque_motivo_ancora_conta is null)
    or (estoque_motivo_ancora_tipo = 'lancamento' and estoque_motivo_ancora_conta is not null and estoque_motivo_ancora_linha is not null and estoque_motivo_ancora_coluna is null and estoque_motivo_ancora_nivel is null))),
	CONSTRAINT "lancamento_consumo" CHECK (("lancamento_nivel"."consumo_estado" = 'lido' and "lancamento_nivel"."consumo_valor" is not null and consumo_motivo_codigo is null)
        or ("lancamento_nivel"."consumo_estado" = 'indefinido' and "lancamento_nivel"."consumo_valor" is null and consumo_motivo_codigo is not null)),
	CONSTRAINT "lancamento_consumo_motivo" CHECK (((consumo_motivo_codigo is null and consumo_motivo_ancora_tipo is null) or (consumo_motivo_codigo is not null and consumo_motivo_ancora_tipo is not null))
    and ((consumo_motivo_ancora_tipo is null and consumo_motivo_ancora_linha is null and consumo_motivo_ancora_coluna is null and consumo_motivo_ancora_conta is null and consumo_motivo_ancora_nivel is null) or (consumo_motivo_ancora_tipo in ('arquivo', 'mapeamento') and consumo_motivo_ancora_linha is null and consumo_motivo_ancora_coluna is null and consumo_motivo_ancora_conta is null and consumo_motivo_ancora_nivel is null)
    or (consumo_motivo_ancora_tipo = 'linha' and consumo_motivo_ancora_linha is not null and consumo_motivo_ancora_conta is null and consumo_motivo_ancora_nivel is null)
    or (consumo_motivo_ancora_tipo = 'conta' and consumo_motivo_ancora_conta is not null and consumo_motivo_ancora_linha is null and consumo_motivo_ancora_coluna is null)
    or (consumo_motivo_ancora_tipo = 'nivel' and consumo_motivo_ancora_nivel is not null and consumo_motivo_ancora_linha is null and consumo_motivo_ancora_coluna is null and consumo_motivo_ancora_conta is null)
    or (consumo_motivo_ancora_tipo = 'lancamento' and consumo_motivo_ancora_conta is not null and consumo_motivo_ancora_linha is not null and consumo_motivo_ancora_coluna is null and consumo_motivo_ancora_nivel is null))),
	CONSTRAINT "lancamento_perdas" CHECK (("lancamento_nivel"."perdas_estado" = 'medido' and "lancamento_nivel"."perdas_valor" is not null)
        or ("lancamento_nivel"."perdas_estado" = 'naoMedido' and "lancamento_nivel"."perdas_valor" is null))
);
--> statement-breakpoint
CREATE TABLE "mapeamento_entrada" (
	"versao_id" uuid NOT NULL,
	"conta" text NOT NULL,
	"descricao" text NOT NULL,
	"decisao" text NOT NULL,
	"papel" text,
	"nivel" text,
	CONSTRAINT "mapeamento_entrada_versao_id_conta_pk" PRIMARY KEY("versao_id","conta"),
	CONSTRAINT "mapeamento_entrada_decisao" CHECK ("mapeamento_entrada"."decisao" in ('classificada', 'ignorada')),
	CONSTRAINT "mapeamento_entrada_papel" CHECK (("mapeamento_entrada"."decisao" = 'ignorada' and "mapeamento_entrada"."papel" is null and "mapeamento_entrada"."nivel" is null)
        or ("mapeamento_entrada"."decisao" = 'classificada' and "mapeamento_entrada"."papel" in ('estoque', 'baixa') and "mapeamento_entrada"."nivel" in ('MP', 'PP', 'PA'))
        or ("mapeamento_entrada"."decisao" = 'classificada' and "mapeamento_entrada"."papel" in ('cmv', 'receita') and "mapeamento_entrada"."nivel" is null))
);
--> statement-breakpoint
CREATE TABLE "mapeamento_versao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	"niveis_ausentes" text[] DEFAULT '{}' NOT NULL,
	"motivo_da_edicao" text,
	"criado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mapeamento_versao_positiva" CHECK ("mapeamento_versao"."versao" > 0)
);
--> statement-breakpoint
CREATE TABLE "periodo" (
	"empresa_id" uuid NOT NULL,
	"ano" integer NOT NULL,
	"mes" integer NOT NULL,
	"estado" text NOT NULL,
	"cmv" bigint,
	"receita" bigint,
	"compras" bigint,
	"custo_materiais_origem" text,
	"custo_materiais_valor" bigint,
	"custo_materiais_informado" bigint,
	"custo_materiais_divergencia" double precision GENERATED ALWAYS AS (case
        when custo_materiais_valor is null or custo_materiais_informado is null or custo_materiais_valor = 0
        then null
        else abs(custo_materiais_valor - custo_materiais_informado)::double precision / abs(custo_materiais_valor)
      end) STORED,
	"custo_materiais_motivo_codigo" text,
	"custo_materiais_motivo_ancora_tipo" text,
	"custo_materiais_motivo_ancora_linha" integer,
	"custo_materiais_motivo_ancora_coluna" text,
	"custo_materiais_motivo_ancora_conta" text,
	"custo_materiais_motivo_ancora_nivel" text,
	"versao_mapeamento" integer,
	"versao_valor_informado" integer,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "periodo_empresa_id_ano_mes_pk" PRIMARY KEY("empresa_id","ano","mes"),
	CONSTRAINT "periodo_competencia" CHECK (mes between 1 and 12 and ano between 1900 and 2999),
	CONSTRAINT "periodo_estado" CHECK ("periodo"."estado" in ('importado', 'apurado')),
	CONSTRAINT "periodo_cmv" CHECK ("periodo"."estado" <> 'apurado' or "periodo"."cmv" is not null),
	CONSTRAINT "periodo_custo_materiais" CHECK (("periodo"."custo_materiais_origem" is null and "periodo"."custo_materiais_valor" is null and "periodo"."custo_materiais_informado" is null)
        or ("periodo"."custo_materiais_origem" in ('derivado', 'informado') and "periodo"."custo_materiais_valor" is not null and "periodo"."custo_materiais_informado" is null)
        or ("periodo"."custo_materiais_origem" = 'conferido' and "periodo"."custo_materiais_valor" is not null and "periodo"."custo_materiais_informado" is not null)
        or ("periodo"."custo_materiais_origem" = 'indefinido' and "periodo"."custo_materiais_valor" is null and "periodo"."custo_materiais_informado" is null and custo_materiais_motivo_codigo is not null)),
	CONSTRAINT "periodo_custo_materiais_motivo" CHECK (((custo_materiais_motivo_codigo is null and custo_materiais_motivo_ancora_tipo is null) or (custo_materiais_motivo_codigo is not null and custo_materiais_motivo_ancora_tipo is not null))
    and ((custo_materiais_motivo_ancora_tipo is null and custo_materiais_motivo_ancora_linha is null and custo_materiais_motivo_ancora_coluna is null and custo_materiais_motivo_ancora_conta is null and custo_materiais_motivo_ancora_nivel is null) or (custo_materiais_motivo_ancora_tipo in ('arquivo', 'mapeamento') and custo_materiais_motivo_ancora_linha is null and custo_materiais_motivo_ancora_coluna is null and custo_materiais_motivo_ancora_conta is null and custo_materiais_motivo_ancora_nivel is null)
    or (custo_materiais_motivo_ancora_tipo = 'linha' and custo_materiais_motivo_ancora_linha is not null and custo_materiais_motivo_ancora_conta is null and custo_materiais_motivo_ancora_nivel is null)
    or (custo_materiais_motivo_ancora_tipo = 'conta' and custo_materiais_motivo_ancora_conta is not null and custo_materiais_motivo_ancora_linha is null and custo_materiais_motivo_ancora_coluna is null)
    or (custo_materiais_motivo_ancora_tipo = 'nivel' and custo_materiais_motivo_ancora_nivel is not null and custo_materiais_motivo_ancora_linha is null and custo_materiais_motivo_ancora_coluna is null and custo_materiais_motivo_ancora_conta is null)
    or (custo_materiais_motivo_ancora_tipo = 'lancamento' and custo_materiais_motivo_ancora_conta is not null and custo_materiais_motivo_ancora_linha is not null and custo_materiais_motivo_ancora_coluna is null and custo_materiais_motivo_ancora_nivel is null)))
);
--> statement-breakpoint
CREATE TABLE "razao_conta" (
	"empresa_id" uuid NOT NULL,
	"ano" integer NOT NULL,
	"mes" integer NOT NULL,
	"conta" text NOT NULL,
	"descricao" text NOT NULL,
	"saldo_anterior" bigint,
	"saldo_atual" bigint,
	"importacao_id" uuid,
	CONSTRAINT "razao_conta_empresa_id_ano_mes_conta_pk" PRIMARY KEY("empresa_id","ano","mes","conta"),
	CONSTRAINT "razao_conta_competencia" CHECK (mes between 1 and 12 and ano between 1900 and 2999)
);
--> statement-breakpoint
CREATE TABLE "razao_lancamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"ano" integer NOT NULL,
	"mes" integer NOT NULL,
	"conta" text NOT NULL,
	"linha" integer NOT NULL,
	"data" text,
	"historico" text NOT NULL,
	"debito" bigint NOT NULL,
	"credito" bigint NOT NULL,
	"contrapartida" text,
	CONSTRAINT "razao_lancamento_competencia" CHECK (mes between 1 and 12 and ano between 1900 and 2999)
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp with time zone,
	"image" text
);
--> statement-breakpoint
CREATE TABLE "usuario_empresa" (
	"usuario_id" text NOT NULL,
	"empresa_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_empresa_usuario_id_empresa_id_pk" PRIMARY KEY("usuario_id","empresa_id")
);
--> statement-breakpoint
CREATE TABLE "valor_informado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"ano" integer NOT NULL,
	"mes" integer NOT NULL,
	"campo" text NOT NULL,
	"valor" bigint NOT NULL,
	"versao" integer NOT NULL,
	"criado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valor_informado_competencia" CHECK (mes between 1 and 12 and ano between 1900 and 2999),
	CONSTRAINT "valor_informado_campo" CHECK ("valor_informado"."campo" in ('custoMateriais'))
);
--> statement-breakpoint
ALTER TABLE "balancete_linha" ADD CONSTRAINT "balancete_linha_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balancete_linha" ADD CONSTRAINT "balancete_linha_importacao_id_importacao_id_fk" FOREIGN KEY ("importacao_id") REFERENCES "public"."importacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostico_importacao" ADD CONSTRAINT "diagnostico_importacao_importacao_id_importacao_id_fk" FOREIGN KEY ("importacao_id") REFERENCES "public"."importacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostico_periodo" ADD CONSTRAINT "diagnostico_periodo_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_importado_por_user_id_fk" FOREIGN KEY ("importado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_nivel" ADD CONSTRAINT "lancamento_nivel_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapeamento_entrada" ADD CONSTRAINT "mapeamento_entrada_versao_id_mapeamento_versao_id_fk" FOREIGN KEY ("versao_id") REFERENCES "public"."mapeamento_versao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapeamento_versao" ADD CONSTRAINT "mapeamento_versao_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapeamento_versao" ADD CONSTRAINT "mapeamento_versao_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodo" ADD CONSTRAINT "periodo_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "razao_conta" ADD CONSTRAINT "razao_conta_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "razao_conta" ADD CONSTRAINT "razao_conta_importacao_id_importacao_id_fk" FOREIGN KEY ("importacao_id") REFERENCES "public"."importacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "razao_lancamento" ADD CONSTRAINT "razao_lancamento_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_empresa" ADD CONSTRAINT "usuario_empresa_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_empresa" ADD CONSTRAINT "usuario_empresa_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valor_informado" ADD CONSTRAINT "valor_informado_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valor_informado" ADD CONSTRAINT "valor_informado_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;