# Cloudscape UI e mapeamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrar Cloudscape UI e preservar decisões de mapeamento após erros.
**Architecture:** Pacote compilado versionado, fronteira cliente Next e formulário controlado; DAL e apuração existentes.
**Tech Stack:** Next 16, React 19, Cloudscape UI 1.1, PGlite, Vitest e Playwright.
**Spec:** docs/superpowers/specs/2026-11-03-cloudscape-mapeamento-design.md

## Global Constraints
- Português brasileiro; bigint em centavos.
- Usar C:/Sistema/estoque-pme conforme preferência do usuário; branch própria.
- Manter fonte externa do design system intacta.
- Reutilizar Server Actions e as verificações de editor existentes.

## Review Focus
- Erro depois de sucesso não reseta seleções.
- Atualização após sucesso conserva decisões cobertas e propaga valores salvos.
- Contas de empresas diferentes nunca compartilham estado.
- Leitor não altera níveis ausentes nem motivo.
- Tema e tabela funcionam com teclado e viewport móvel.

## Task 1: Reproduzir o problema no navegador
Files: apps/web/e2e/mapeamento.spec.ts, apps/web/e2e/preparar.mts, apps/web/playwright.config.ts, apps/web/package.json.
Interfaces: banco de teste próprio; login real Auth.js; importação pela UI.
- [x] Instalar dependências fixadas e executar baseline.
- [x] Preparar empresas e usuários editor/leitor em banco isolado.
- [x] Testar conflito PP ausente + mapeado e preservação dos campos; assistir falha real.

## Task 2: Integrar Cloudscape e controlar o rascunho
Files: vendor/, apps/web/src/components/, src/app/layout.tsx, globals.css, empresas/[id]/layout.tsx e mapeamento/{page,formulario}.tsx, package-lock.json.
Interfaces: componentes cliente reexportados; props de formulário incluem versão corrente para atualização pós-sucesso.
- [x] Adicionar pacote versionado e estilos; criar estrutura de empresa com navegação.
- [x] Controlar decisões, ausências e motivo; atualizar base somente ao salvar; desabilitar todos os campos para leitor e durante envio.
- [x] Adaptar tabela, avisos e botões; preservar âncoras.
- [x] Passar regressão; acrescentar sucesso/erro posterior, leitor, isolamento, tema e viewport.
- [x] Executar npm test, typecheck, build e E2E; revisar diff e documentar integração.
