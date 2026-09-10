# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Pre-implementation, with a PRD draft in place. There is no source code, build system, package manager, test
runner, or git repository yet — nothing to build, lint, or run. The stack has not been chosen.

| File | What it is |
|------|-----------|
| `estoque.txt` | Original product brief (Portuguese) — the source of truth for intent |
| `estoque.webp` | Reference spreadsheet model the brief is based on — source of the formulas |
| `prd-estoque-pme.html` | **PRD v1 draft.** Standalone page; also published (private) at https://claude.ai/code/artifact/f3014e5d-8402-4f67-bf4f-17851b823f90 |

When code lands, replace this section with the real build/test/run commands.

**Editing the PRD:** edit `prd-estoque-pme.html` and republish with the Artifact tool passing that URL as `url`,
or a second, separate artifact is created instead of updating the existing link.

## Product

A micro-SaaS for inventory financial/budget planning aimed at small and medium food-industry companies.
Core job: project the monetary value of inventory over the coming months from historical data, cost
forecasts, and average inventory holding periods.

**v1 is a controllership tool**, not an operational one: it speaks in reais, at the aggregate level, on the
monthly closing cycle. Primary user is the controller / administrative-financial manager; the ledger closes
between the 5th and 10th business day, which is when the product is actually used.

In scope for v1: inventory value by level, PME apuration and projection, cost/CMV forecasting, financial
cycle and working-capital requirement, comparable scenarios, sensitivity on PME, backtesting, XLSX/PDF export,
multi-company access.

Out of scope for v1 (deliberate — see D1): per-SKU purchase/production suggestion (that is an MRP), lot/expiry/FEFO
control, direct ERP integration (v2; v1 ingests spreadsheets), costing and standard-cost formation, multi-currency.

## Domain model

Inventory is split into three levels, and every calculation is done per level. The asymmetry in the cost
driver is the core of the model:

| Level | Meaning | Cost driver |
|-------|---------|-------------|
| **MP** — Matérias-Primas | Purchased materials not yet consumed in production | Custo de Materiais |
| **PP** — Produtos em Processo | Work in process | CMV |
| **PA** — Produtos Acabados | Finished goods awaiting sale/shipping | CMV |

**PP is optional** (D6). Many food-industry SMEs have a short process and do not record WIP at all. Every
aggregate calculation must treat an absent level as a deliberate absence, never as a silent zero and never as
missing data to be imputed.

Entities: `Empresa` → `Período` (month) → `Lançamento` (balance per level, custo de materiais, CMV, receita).
On top of those sit `Cenário` and `Premissa` (projected PME, cost projection method, PMR, PMP, loss %).

## Calculation model

One bidirectional relationship, used in both directions. `d` = days in the period (**30** for a month, see D4).

Historical direction — derive PME from actuals:

```
PME_MP = Estoque_médio_MP / Custo_Materiais * d
PME_PP = Estoque_médio_PP / CMV             * d
PME_PA = Estoque_médio_PA / CMV             * d
```

Forecast direction — derive inventory value from forecast costs and an estimated PME:

```
MP = Custo_Materiais_prev * PME_MP_prev / d
PP = CMV_prev             * PME_PP_prev / d
PA = CMV_prev             * PME_PA_prev / d

Total_Estoque = MP + PP + PA
```

Derived:

```
Giro_anualizado  = CMV_12m / Estoque_médio
Cobertura_dias   = PME_MP + PME_PP + PME_PA
Ciclo_financeiro = Cobertura_dias + PMR - PMP
NCG              = Estoque + (Receita * PMR / d) - (Compras * PMP / d)
Custo_ajustado   = Custo_Materiais / (1 - perda%)
```

`Estoque_médio` = (opening balance + closing balance) / 2, falling back to the closing balance when no opening
balance exists — and the report must say which one it used (D5).

Projection methods for the premise (replacing the reference spreadsheet's underivable "Média" column): last
observation, simple mean of last N, weighted mean, linear trend, same month last year (seasonal), manual.
Default is the 3-month mean, with a warning when dispersion across those months exceeds 15%.

### Notes that are easy to get wrong

- **The reference spreadsheet uses a different time base.** It applies a 360 factor to a *monthly* cost flow,
  producing PME values around 200 that are not calendar days. Both directions are exact inverses, so the factor
  cancels and the choice is presentational — v1 shows real days (D4). Expect a scale mismatch when comparing
  against a client's existing spreadsheet, and explain it rather than "fixing" the formula.
- **Despite the "Estoque Médio" label, the reference numbers use the closing balance.** Verified against the
  diagram's own figures: 10.000 / 17.500 * 360 = 205,71.
- **The diagram's forecast formulas render as `Custo x 360 / PME`;** its own numbers only reconcile with
  `Custo x PME / 360`, which is what is written above.
- Worked example in the PRD reproduces the reference figures at d = 30 and lands within 0,2% of the
  spreadsheet's projected totals — useful as a regression fixture once code exists.

## Decisions taken (D1–D7)

These closed the PRD draft and constrain implementation. **All are pending stakeholder validation**; D1–D3
change the product itself, not just the implementation. They appear as P1–P7 in the PRD.

1. **D1 — Aggregate by level, not per SKU.** v1 works in R$ over consolidated MP/PP/PA, with no item, quantity,
   or unit price. This is what puts "how much to buy" out of scope; reversing it means redoing the PRD.
2. **D2 — Revenue and financial cycle are in v1.** Two of the brief's five questions (inventory vs. sales,
   working-capital requirement) cannot be answered from cost and CMV alone, so `receita` is an input and
   PMR/PMP are parameters.
3. **D3 — Spreadsheet ingestion, not ERP.** CSV/XLSX import against a supplied template, plus manual entry.
   Import must be idempotent on the `período + nível` key.
4. **D4 — PME presented in real days (d = 30)**, not the reference model's 360-over-monthly-flow.
5. **D5 — Average inventory by default**, degrading to closing balance when no opening balance exists.
6. **D6 — PP is optional**, per the domain note above.
7. **D7 — Loss is a parametric percentage** applied to consumption per level. The product quantifies the cost
   of waste; it does not prevent it operationally.

## Open questions blocking the final PRD

1. Does "say how much to buy and produce" leave v1? If non-negotiable for the pilot customer, D1 inverts and
   the scope changes completely.
2. What method was the reference spreadsheet's "Média" column meant to use? It does not reconcile with a
   simple mean of the actuals (17.500 / 18.500 / 19.500 average to 18.500, but the column shows 19.890).
3. Do PMR and PMP make v1, or does NCG wait? (D2.)
4. Which ERPs do the first five customers use? Sets the v2 integration queue and the v1 importer's shape.
5. Is the sale to the company or to the accounting firm that serves it? Changes pricing and the priority of
   multi-company support.
6. Target ticket and plan design — no limit decision (companies, users, horizon) can be made before this.

## Conventions

- The brief, the reference model, the PRD, and all domain vocabulary are in **Brazilian Portuguese**. Keep
  domain terms (MP, PP, PA, PME, CMV, Estoque, Cenário, Premissa) in Portuguese in the model and UI — they are
  the terms the users and the source material use. Do not translate them to English identifiers.
- Monetary figures in the reference model are in **R$ milhares** (thousands of BRL). UI formatting is pt-BR
  (`1.234,56`), currency BRL, periods by monthly competence.
- Every premise or entry change must record user, timestamp, and prior value. Financial figures without an
  audit trail are not defensible to a partner or a bank.
