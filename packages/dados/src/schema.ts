/**
 * O schema.
 *
 * Não é puro, e isso não fere invariante nenhuma: a regra do D11 é sobre o
 * **motor de cálculo**, e ela continua valendo palavra por palavra. Aqui há
 * Drizzle e Postgres de propósito.
 *
 * Três formas se repetem e vêm de `colunas.ts`: união com estado (coluna de
 * estado + payload anulável + `CHECK` bicondicional, ADR-0008), motivo (código
 * + âncora) e competência (ano e mês, nunca uma data — o modelo é mensal).
 *
 * O que o `drizzle-kit` **não** gera e por isso mora em `migracoes/`: as
 * policies de RLS e estes `CHECK`. Se ficassem de fora, o schema de produção
 * divergiria do que os testes exercitam, e o pior caso é a RLS existir no teste
 * e não no banco.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  centavos,
  checkDeAncora,
  checkDeCompetencia,
  checkDeMotivo,
  colunasDeCompetencia,
} from './colunas';

const criadoEm = () => timestamp('criado_em', { withTimezone: true }).notNull().defaultNow();

/**
 * O usuário, no formato que o adapter Drizzle do Auth.js espera.
 *
 * Só esta tabela entra agora: é a que a trilha de auditoria aponta. `account`,
 * `session` e `verificationToken` vêm com a ligação do Auth.js, e não mudam
 * esta — acrescentar depois não migra o que já existe.
 */
export const usuario = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull(),
  emailVerified: timestamp('emailVerified', { withTimezone: true }),
  image: text('image'),
});

/**
 * As outras tabelas do adapter Drizzle do Auth.js, no schema canônico dele.
 *
 * Ficam **fora da RLS**, como `user`: são por usuário, não por empresa, e o
 * Auth.js as lê antes de existir empresa corrente — forçar policy aqui daria
 * resposta nula justamente no login. É o limite consciente da RLS neste
 * produto: ela isola empresas entre si, não usuários do próprio serviço
 * (ADR-0012).
 */
export const conta = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => usuario.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessao = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => usuario.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const tokenDeVerificacao = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const empresa = pgTable('empresa', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  criadoEm: criadoEm(),
});

/**
 * O vínculo que o RF-23 exige desde o primeiro dia.
 *
 * Mora no banco, e não num papel da aplicação, porque a policy de RLS depende
 * dele: `app.empresa_id` só pode ser definido depois de conferir o vínculo, e
 * se a conferência vivesse fora do banco seria promessa da aplicação — que é o
 * que a RLS existe para não precisar.
 */
export const usuarioEmpresa = pgTable(
  'usuario_empresa',
  {
    usuarioId: text('usuario_id')
      .notNull()
      .references(() => usuario.id, { onDelete: 'cascade' }),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'cascade' }),
    /**
     * `editor` escreve, `leitor` só lê (RF-23). É a policy de escrita que o
     * exige, não a tela: política de acesso retrofitada é a que embarca com
     * buraco, então ela entra junto com a coluna.
     */
    papel: text('papel').notNull().default('editor'),
    criadoEm: criadoEm(),
  },
  (t) => [
    primaryKey({ columns: [t.usuarioId, t.empresaId] }),
    check('usuario_empresa_papel', sql`${t.papel} in ('editor', 'leitor')`),
  ],
);

/**
 * Um arquivo processado (D8).
 *
 * A origem é por **importação** e não por empresa: a empresa troca de ERP, e o
 * que o D8 quer medir é a distribuição das importações — é ela que define a
 * fila de integrações da v2 por dado em vez de opinião.
 *
 * `perfil` é JSONB porque é configuração opaca de leitura, não união de
 * domínio: ninguém consulta por dentro dele. Quem se consulta é `origem`, que
 * é coluna.
 */
export const importacao = pgTable(
  'importacao',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'cascade' }),
    origem: text('origem').notNull(),
    artefato: text('artefato').notNull(),
    ...colunasDeCompetencia,
    perfil: jsonb('perfil'),
    linhasCriadas: integer('linhas_criadas').notNull().default(0),
    linhasAtualizadas: integer('linhas_atualizadas').notNull().default(0),
    importadoPor: text('importado_por').references(() => usuario.id),
    criadoEm: criadoEm(),
  },
  (t) => [
    check('importacao_competencia', checkDeCompetencia),
    check('importacao_artefato', sql`${t.artefato} in ('balancete', 'razao')`),
  ],
);

/**
 * O mapeamento, versionado append-only (ADR-0001, ADR-0009).
 *
 * O cabeçalho é onde moram usuário, timestamp e motivo da edição — sem ele, os
 * três campos de auditoria se repetiriam em cada entrada. Cada versão copia as
 * entradas; vinte linhas não são custo.
 */
export const mapeamentoVersao = pgTable(
  'mapeamento_versao',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'cascade' }),
    versao: integer('versao').notNull(),
    /** Níveis que a empresa declaradamente não movimenta (D6). Declaração, nunca inferência. */
    niveisAusentes: text('niveis_ausentes').array().notNull().default(sql`'{}'`),
    motivoDaEdicao: text('motivo_da_edicao'),
    criadoPor: text('criado_por').references(() => usuario.id),
    criadoEm: criadoEm(),
  },
  (t) => [check('mapeamento_versao_positiva', sql`${t.versao} > 0`)],
);

export const mapeamentoEntrada = pgTable(
  'mapeamento_entrada',
  {
    versaoId: uuid('versao_id')
      .notNull()
      .references(() => mapeamentoVersao.id, { onDelete: 'cascade' }),
    conta: text('conta').notNull(),
    /** A descrição vista na confirmação: é o alarme que dispensa vigência (ADR-0001). */
    descricao: text('descricao').notNull(),
    decisao: text('decisao').notNull(),
    papel: text('papel'),
    nivel: text('nivel'),
  },
  (t) => [
    primaryKey({ columns: [t.versaoId, t.conta] }),
    check('mapeamento_entrada_decisao', sql`${t.decisao} in ('classificada', 'ignorada')`),
    // Bicondicional: classificada exige papel, ignorada proíbe. E nível existe
    // exatamente nos papéis que têm nível — CMV e receita não têm.
    check(
      'mapeamento_entrada_papel',
      sql`(${t.decisao} = 'ignorada' and ${t.papel} is null and ${t.nivel} is null)
        or (${t.decisao} = 'classificada' and ${t.papel} in ('estoque', 'baixa') and ${t.nivel} in ('MP', 'PP', 'PA'))
        or (${t.decisao} = 'classificada' and ${t.papel} in ('cmv', 'receita') and ${t.nivel} is null)`,
    ),
  ],
);

/**
 * O que o gestor digitou sobre um período já realizado (ADR-0010).
 *
 * Append-only: "valor anterior" é a linha anterior, não um campo que alguém
 * precisa lembrar de preencher. Separado do lançamento para que a reimportação
 * do RF-05 — que substitui pela chave — não apague o que foi digitado.
 */
export const valorInformado = pgTable(
  'valor_informado',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'cascade' }),
    ...colunasDeCompetencia,
    campo: text('campo').notNull(),
    valor: centavos('valor').notNull(),
    versao: integer('versao').notNull(),
    criadoPor: text('criado_por').references(() => usuario.id),
    criadoEm: criadoEm(),
  },
  (t) => [
    check('valor_informado_competencia', checkDeCompetencia),
    check('valor_informado_campo', sql`${t.campo} in ('custoMateriais')`),
  ],
);

// ---------------------------------------------------------------------------
// Fonte: o que o arquivo disse. É o que torna o recálculo do RF-28 possível.
// ---------------------------------------------------------------------------

/** Linha de balancete. Chave natural, e por isso upsert (ADR-0009). */
export const balanceteLinha = pgTable(
  'balancete_linha',
  {
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'cascade' }),
    ...colunasDeCompetencia,
    conta: text('conta').notNull(),
    descricao: text('descricao').notNull(),
    saldoAnterior: centavos('saldo_anterior'),
    debito: centavos('debito').notNull(),
    credito: centavos('credito').notNull(),
    saldoAtual: centavos('saldo_atual'),
    grau: integer('grau').notNull(),
    sintetica: boolean('sintetica').notNull(),
    linha: integer('linha').notNull(),
    importacaoId: uuid('importacao_id').references(() => importacao.id),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.ano, t.mes, t.conta] }),
    check('balancete_linha_competencia', checkDeCompetencia),
  ],
);

/**
 * Conta do razão com o bloco dela.
 *
 * O razão **não tem chave natural de linha** — dois lançamentos idênticos no
 * mesmo dia são legítimos e indistinguíveis —, então o bloco é apagado e
 * reinserido por `(empresa, competência)`. Chave sintética por número de linha
 * amarraria a identidade do dado ao layout do arquivo.
 */
export const razaoConta = pgTable(
  'razao_conta',
  {
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'cascade' }),
    ...colunasDeCompetencia,
    conta: text('conta').notNull(),
    descricao: text('descricao').notNull(),
    saldoAnterior: centavos('saldo_anterior'),
    saldoAtual: centavos('saldo_atual'),
    importacaoId: uuid('importacao_id').references(() => importacao.id),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.ano, t.mes, t.conta] }),
    check('razao_conta_competencia', checkDeCompetencia),
  ],
);

export const razaoLancamento = pgTable(
  'razao_lancamento',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'cascade' }),
    ...colunasDeCompetencia,
    conta: text('conta').notNull(),
    linha: integer('linha').notNull(),
    /** Como o arquivo escreveu. Rastro de auditoria, nenhum cálculo a usa. */
    data: text('data'),
    historico: text('historico').notNull(),
    debito: centavos('debito').notNull(),
    credito: centavos('credito').notNull(),
    contrapartida: text('contrapartida'),
  },
  (t) => [check('razao_lancamento_competencia', checkDeCompetencia)],
);

// ---------------------------------------------------------------------------
// Projeção: o lançamento, derivado da fonte mais o mapeamento (ADR-0009).
// ---------------------------------------------------------------------------

/**
 * O período, e o estado do funil.
 *
 * Existe para que ausência de linha signifique **uma** coisa só: período nunca
 * importado. "Importado e ainda sem mapeamento" é valor que se consulta, não
 * silêncio que se interpreta — e é o estado real da primeira importação de toda
 * empresa, já que o mapeamento nasce das contas que aquele arquivo revelou.
 *
 * As colunas de versão são **detector**, não mecanismo: o recálculo é síncrono,
 * então linha defasada significa bug, e é melhor descobrir por query.
 */
export const periodo = pgTable(
  'periodo',
  {
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'cascade' }),
    ...colunasDeCompetencia,
    estado: text('estado').notNull(),
    cmv: centavos('cmv'),
    receita: centavos('receita'),
    compras: centavos('compras'),
    custoMateriaisOrigem: text('custo_materiais_origem'),
    custoMateriaisValor: centavos('custo_materiais_valor'),
    custoMateriaisInformado: centavos('custo_materiais_informado'),
    /**
     * Coluna **gerada**, nunca escrita: dois campos paralelos divergem, e o
     * comentário do próprio `CustoDeMateriais` diz por quê.
     */
    custoMateriaisDivergencia: doublePrecision('custo_materiais_divergencia').generatedAlwaysAs(
      sql`case
        when custo_materiais_valor is null or custo_materiais_informado is null or custo_materiais_valor = 0
        then null
        else abs(custo_materiais_valor - custo_materiais_informado)::double precision / abs(custo_materiais_valor)
      end`,
    ),
    custoMateriaisMotivoCodigo: text('custo_materiais_motivo_codigo'),
    custoMateriaisMotivoAncoraTipo: text('custo_materiais_motivo_ancora_tipo'),
    custoMateriaisMotivoAncoraLinha: integer('custo_materiais_motivo_ancora_linha'),
    custoMateriaisMotivoAncoraColuna: text('custo_materiais_motivo_ancora_coluna'),
    custoMateriaisMotivoAncoraConta: text('custo_materiais_motivo_ancora_conta'),
    custoMateriaisMotivoAncoraNivel: text('custo_materiais_motivo_ancora_nivel'),
    versaoMapeamento: integer('versao_mapeamento'),
    versaoValorInformado: integer('versao_valor_informado'),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.ano, t.mes] }),
    check('periodo_competencia', checkDeCompetencia),
    check('periodo_estado', sql`${t.estado} in ('importado', 'apurado')`),
    // O CMV é NOT NULL onde a invariante vale: a validação recusa produzir
    // Lançamento sem CMV mapeado, então período apurado sempre o tem.
    check('periodo_cmv', sql`${t.estado} <> 'apurado' or ${t.cmv} is not null`),
    check(
      'periodo_custo_materiais',
      sql`(${t.custoMateriaisOrigem} is null and ${t.custoMateriaisValor} is null and ${t.custoMateriaisInformado} is null)
        or (${t.custoMateriaisOrigem} in ('derivado', 'informado') and ${t.custoMateriaisValor} is not null and ${t.custoMateriaisInformado} is null)
        or (${t.custoMateriaisOrigem} = 'conferido' and ${t.custoMateriaisValor} is not null and ${t.custoMateriaisInformado} is not null)
        or (${t.custoMateriaisOrigem} = 'indefinido' and ${t.custoMateriaisValor} is null and ${t.custoMateriaisInformado} is null and ${sql.raw('custo_materiais_motivo_codigo')} is not null)`,
    ),
    check('periodo_custo_materiais_motivo', checkDeMotivo('custo_materiais_motivo')),
  ],
);

/**
 * O lançamento por nível: a chave idempotente do RF-05.
 *
 * Nível ausente é **linha explícita**. Ausência de linha significaria três
 * coisas ao mesmo tempo — nível ausente, período não importado, importação
 * interrompida — e a chave deixaria de distinguir "reimportei e agora tem menos
 * linhas" de "apaguei sem querer".
 */
export const lancamentoNivel = pgTable(
  'lancamento_nivel',
  {
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'cascade' }),
    ...colunasDeCompetencia,
    nivel: text('nivel').notNull(),

    estoqueEstado: text('estoque_estado').notNull(),
    estoqueAbertura: centavos('estoque_abertura'),
    estoqueFechamento: centavos('estoque_fechamento'),
    estoqueMotivoCodigo: text('estoque_motivo_codigo'),
    estoqueMotivoAncoraTipo: text('estoque_motivo_ancora_tipo'),
    estoqueMotivoAncoraLinha: integer('estoque_motivo_ancora_linha'),
    estoqueMotivoAncoraColuna: text('estoque_motivo_ancora_coluna'),
    estoqueMotivoAncoraConta: text('estoque_motivo_ancora_conta'),
    estoqueMotivoAncoraNivel: text('estoque_motivo_ancora_nivel'),

    consumoEstado: text('consumo_estado').notNull(),
    consumoValor: centavos('consumo_valor'),
    consumoMotivoCodigo: text('consumo_motivo_codigo'),
    consumoMotivoAncoraTipo: text('consumo_motivo_ancora_tipo'),
    consumoMotivoAncoraLinha: integer('consumo_motivo_ancora_linha'),
    consumoMotivoAncoraColuna: text('consumo_motivo_ancora_coluna'),
    consumoMotivoAncoraConta: text('consumo_motivo_ancora_conta'),
    consumoMotivoAncoraNivel: text('consumo_motivo_ancora_nivel'),

    /** `naoMedido` é o D7: empresa sem conta de baixa mapeada, nunca 0%. */
    perdasEstado: text('perdas_estado').notNull(),
    perdasValor: centavos('perdas_valor'),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.ano, t.mes, t.nivel] }),
    check('lancamento_competencia', checkDeCompetencia),
    check('lancamento_nivel_valido', sql`${t.nivel} in ('MP', 'PP', 'PA')`),
    check(
      'lancamento_estoque',
      sql`(${t.estoqueEstado} = 'lido' and ${t.estoqueFechamento} is not null and ${sql.raw('estoque_motivo_codigo')} is null)
        or (${t.estoqueEstado} = 'ausente' and ${t.estoqueAbertura} is null and ${t.estoqueFechamento} is null and ${sql.raw('estoque_motivo_codigo')} is null)
        or (${t.estoqueEstado} = 'indefinido' and ${t.estoqueAbertura} is null and ${t.estoqueFechamento} is null and ${sql.raw('estoque_motivo_codigo')} is not null)`,
    ),
    check('lancamento_estoque_motivo', checkDeMotivo('estoque_motivo')),
    check(
      'lancamento_consumo',
      sql`(${t.consumoEstado} = 'lido' and ${t.consumoValor} is not null and ${sql.raw('consumo_motivo_codigo')} is null)
        or (${t.consumoEstado} = 'indefinido' and ${t.consumoValor} is null and ${sql.raw('consumo_motivo_codigo')} is not null)`,
    ),
    check('lancamento_consumo_motivo', checkDeMotivo('consumo_motivo')),
    check(
      'lancamento_perdas',
      sql`(${t.perdasEstado} = 'medido' and ${t.perdasValor} is not null)
        or (${t.perdasEstado} = 'naoMedido' and ${t.perdasValor} is null)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Diagnósticos: dois lugares, por natureza (ADR-0009).
// ---------------------------------------------------------------------------

/** Do arquivo: fato histórico sobre bytes que não mudam mais. */
export const diagnosticoImportacao = pgTable(
  'diagnostico_importacao',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    importacaoId: uuid('importacao_id')
      .notNull()
      .references(() => importacao.id, { onDelete: 'cascade' }),
    severidade: text('severidade').notNull(),
    codigo: text('codigo').notNull(),
    mensagem: text('mensagem').notNull(),
    ancoraTipo: text('ancora_tipo'),
    ancoraLinha: integer('ancora_linha'),
    ancoraColuna: text('ancora_coluna'),
    ancoraConta: text('ancora_conta'),
    ancoraNivel: text('ancora_nivel'),
  },
  (t) => [
    check('diagnostico_importacao_severidade', sql`${t.severidade} in ('erro', 'aviso', 'info')`),
    check('diagnostico_importacao_ancora', checkDeAncora('ancora')),
  ],
);

/**
 * Do mapeamento: consequência de uma decisão que o gestor pode rever hoje à
 * tarde. Reescrito junto com o lançamento, e por isso keyed no período.
 */
export const diagnosticoPeriodo = pgTable(
  'diagnostico_periodo',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'cascade' }),
    ...colunasDeCompetencia,
    severidade: text('severidade').notNull(),
    codigo: text('codigo').notNull(),
    mensagem: text('mensagem').notNull(),
    ancoraTipo: text('ancora_tipo'),
    ancoraLinha: integer('ancora_linha'),
    ancoraColuna: text('ancora_coluna'),
    ancoraConta: text('ancora_conta'),
    ancoraNivel: text('ancora_nivel'),
  },
  (t) => [
    check('diagnostico_periodo_competencia', checkDeCompetencia),
    check('diagnostico_periodo_severidade', sql`${t.severidade} in ('erro', 'aviso', 'info')`),
    check('diagnostico_periodo_ancora', checkDeAncora('ancora')),
  ],
);

/** Toda tabela de domínio: as que a RLS protege e o teste tem de provar. */
export const TABELAS_DE_DOMINIO = [
  'empresa',
  'usuario_empresa',
  'importacao',
  'mapeamento_versao',
  'valor_informado',
  'balancete_linha',
  'razao_conta',
  'razao_lancamento',
  'periodo',
  'lancamento_nivel',
  'diagnostico_importacao',
  'diagnostico_periodo',
] as const;
