# OpenWolf

This project uses OpenWolf for context management. The always-on rules live in `.claude/rules/openwolf.md`; the hooks handle bookkeeping (anatomy index, memory log, read tracking) automatically.

For the full operating protocol (session handoff, memory discipline, bug logging), load the `openwolf` skill, or read `.wolf/OPENWOLF.md`. Regenerate the session handoff with `/handoff`.


# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Two pure packages exist; no app and no database yet.

`packages/motor-calculo` is the dependency-free engine the whole stack decision rests on (D11) — the PME in
both directions, the projection methods, the derived indicators and the budget ceilings, tested against the
PRD's worked example.

`packages/importador` reads the balancete as the ERP exports it (RF-01, D3): encoding, delimiter, decimal
separator, header position and column roles are all detected, and what the detection finds *is* the ERP
profile of RF-24 — feed it back on the next file and nothing is re-detected. It is pure in the same sense:
bytes in, structure plus diagnostics out. **Reading the file is all it does** — the meaning of an account is
the per-company mapping of RF-28, and is not the importer's job.

Still missing on the ingestion path, in the order that matters: the account mapping (RF-28), the razão
reader that RF-29 and the loss indicator both need (D7), XLSX input via SheetJS — today only delimited text
is read — and persistence with the idempotent `período + nível` key (RF-05).

npm workspaces, Node 22+. Commands run from the repository root:

| Command | What it does |
|---------|--------------|
| `npm install` | Installs the workspace. Dev dependencies only — the engine itself has none |
| `npm test` | Vitest over every workspace |
| `npm run typecheck` | `tsc --noEmit` over every workspace |
| `npm test --workspace @estoque-pme/motor-calculo` | One package only (`@estoque-pme/importador` for the other) |

On Windows, run npm from PowerShell rather than Git Bash: package install scripts spawn `cmd.exe`, which does
not inherit Git Bash's `PATH` and fails to find `node`.

Git repo on branch `main`, private remote at https://github.com/claudio-mas/estoque-pme

| File | What it is |
|------|-----------|
| `estoque.txt` | Original product brief (Portuguese) — the source of truth for intent |
| `estoque.webp` | Reference spreadsheet model the brief is based on — source of the formulas |
| `prd-estoque-pme.html` | **PRD v1 draft.** Standalone page; also published (private) at https://claude.ai/code/artifact/f3014e5d-8402-4f67-bf4f-17851b823f90 |
| `packages/motor-calculo/` | The calculation engine. `test/exemplo-trabalhado.test.ts` is the golden fixture |
| `packages/importador/` | Balancete reader. `test/balancete.test.ts` carries a realistic Latin-1 fixture |

**Editing the PRD:** edit `prd-estoque-pme.html` and republish with the Artifact tool passing that URL as `url`,
or a second, separate artifact is created instead of updating the existing link.

## Stack

TypeScript end to end (D11). The deciding factor was not the ecosystem: the RNF budget of under 2 s to
recalculate 18 months × 3 levels × 3 scenarios means the calculation engine should run **in the browser** for
instant feedback, with the server as the authority. One language means one implementation of that arithmetic
rather than two that can silently diverge — which in a financial product is the expensive kind of bug.

**The invariant:** the calculation engine is a **pure, dependency-free package** — plain functions over
numbers, no DB access, no I/O. That is what lets it run on both sides, be tested against the PRD's worked
example, and survive a change of anything else. Everything in the table below is replaceable; this is not.

| Layer | Choice |
|---|---|
| Runtime | TypeScript strict, Node 22 LTS |
| App | Next.js App Router — one deployable; the report route renders server-side for the PDF |
| Database | PostgreSQL with **Row-Level Security** — tenant isolation enforced in the DB, not trusted to each query |
| ORM | Drizzle — typed and close to SQL, which RLS and window functions will need |
| Auth | Auth.js, self-hosted — PII stays in our own Postgres |
| Read spreadsheets | SheetJS |
| Write XLSX | ExcelJS |
| PDF | Playwright over the HTML report route — one layout, not two |
| Grid | TanStack Table (headless) — editable cells with overwrite marking is RF-11 |
| Validation | Zod at every boundary, imports above all |
| Tests | Vitest, with the PRD worked example as a golden fixture |

**Money is `bigint` centavos, never a float.** PME and percentages are ratios, where floats are fine. Round at
the storage boundary.

### Brazilian specifics a generic stack choice gets wrong

- **ERP CSV exports** commonly arrive with `;` as delimiter, comma as decimal separator and Latin-1 encoding.
  The importer must detect all three instead of assuming UTF-8 with commas. Expect this to be half the work
  of RF-01.
- **Host in São Paulo** (`sa-east-1`, or GRU on Fly). LGPD does not require data residency — but keeping data
  in-country removes the international-transfer conversation with customers and helps latency in an app this
  table-heavy.
- **Billing by boleto and PIX**, not cards: Brazilian SMEs do not pay for SaaS on a corporate card. Asaas, Iugu
  or Pagar.me. Decide at the first paying customer, not before.
- **SheetJS**: check the distribution channel and CVE history at install time — the npm package went stale and
  official distribution moved to the project's own registry.

### Deliberately excluded

Redis, job queues, microservices, caching layers. A 12-month import fits in a synchronous request with a
progress stream inside RF-01's 60 s budget, and the data is tiny — one company is 24 periods × 3 levels.
Adding infrastructure before the first customer is the standard failure mode for this kind of project.

## Product

A micro-SaaS for inventory financial/budget planning aimed at small and medium food-industry companies.
Core job: project the monetary value of inventory over the coming months from historical data, cost
forecasts, and average inventory holding periods.

**v1 is a controllership tool**, not an operational one: it speaks in reais, at the aggregate level, on the
monthly closing cycle. Primary user is the controller / administrative-financial manager; the ledger closes
between the 5th and 10th business day, which is when the product is actually used.

In scope for v1: inventory value by level, PME apuration and projection, cost/CMV forecasting, financial
cycle and working-capital requirement, purchase and production budget ceilings, comparable scenarios,
sensitivity on PME, backtesting, XLSX/PDF export, multi-company access.

Out of scope for v1 (deliberate — see D1): per-SKU purchase/production suggestion (that is an MRP), lot/expiry/FEFO
control, direct ERP integration (v2; v1 ingests the client's own balancete/razão exports), costing and
standard-cost formation, multi-currency.

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
missing data to be imputed. The same rule governs the loss indicator (D7): unmapped reads **não medido**, not
0%. Reporting "no losses" to a company that simply lets spoilage run through CMV is worse than reporting
nothing.

Entities: `Empresa` → `Período` (month) → `Lançamento` (balance per level, custo de materiais, CMV, receita).
On top of those sit `Cenário` and `Premissa` (projected PME, cost projection method, PMR, PMP, loss %). Each
`Empresa` also owns a `MapeamentoDeContas` — chart-of-accounts codes to MP/PP/PA/CMV/receita — which every
import passes through (D3, RF-28); it is versioned, because changing it recalculates history.

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
perda%           = Perdas_do_período / Consumo_do_período   <- measured, never typed
Custo_cenário    = Custo_projetado * (1 - perda_base) / (1 - perda_cenário)

Compras_teto     = MP_alvo - MP_inicial + Custo_Materiais
                   where MP_alvo = Custo_Materiais * PME_alvo / d

Produção_teto    = PA_alvo - PA_inicial + CMV
                   where PA_alvo = CMV * PME_alvo / d
```

`Compras_teto` (PRD RF-26) and `Produção_teto` (RF-27) are **budget ceilings** — how much material spend and
finished production the cash position supports in a period, in R$ at the aggregate level. Each falls straight
out of a balance identity (`MP_final = MP_inicial + Compras - Consumo`, `PA_final = PA_inicial + Produção -
CMV`), so neither needs SKU data and neither breaches D1. Two limits on how they may be presented: never as a
purchase suggestion or order — the product says *how much*, never *what* or *when* — and `Produção_teto` is
stated at the cost of finished production, carries no unit quantities, and **does not check plant capacity**.

`Estoque_médio` = (opening balance + closing balance) / 2, falling back to the closing balance when no opening
balance exists — and the report must say which one it used (D5).

**`Custo_Materiais` usually has to be derived, not read.** It is neither a balancete line nor a DRE line. Back
it out of the MP account's razão with the same identity RF-26 uses forwards:

```
Custo_Materiais = MP_inicial + Compras - MP_final
```

Entered by hand instead, it corrupts `PME_MP` and therefore `Compras_teto` with nothing to flag it — hence
RF-29, which derives it where the razão exists and warns when the derived and entered figures diverge.

**Known calendar bias — accepted, not fixed.** With `d` fixed at 30, month length leaks into the measured PME:
on a constant daily flow February reads ~7% high and January ~3% low, a 10,7% spread. It propagates through
the 3-month-mean premise and shifts projected inventory by roughly 2% — inside the 12% MAPE target, but it
must not surprise anyone during backtesting. Using actual calendar days would remove it by construction, at
the cost of implying a 365-day year and drifting 1,4% from the 360 convention the bank uses; that trade was
judged not worth it. Keep `d` a **named constant, never a literal**, so the switch stays a one-line change —
the formulas already cancel the factor.

Projection methods: last realized value with a fixed growth rate, last observation, simple mean of last N,
weighted mean, linear trend, same month last year (seasonal), manual. Default is the growth rate for the cost
lines — that is what the reference model actually does — and the 3-month mean for PME, with a warning when
dispersion across those months exceeds 15%.

### Notes that are easy to get wrong

- **The reference spreadsheet's PME is exactly 12x too large.** It applies a 360 factor to a *monthly* cost
  flow, so it annualises twice. 205,71 / 12 = 17,14; 221,54 / 12 = 18,46; 67,20 / 12 = 5,60 — each matches the
  v1 figure exactly. The conversion for a client arriving from that spreadsheet is therefore just **divide by
  12**. Do not "fix" the formula to match their numbers.
- **The reference spreadsheet's "Média" column is not an average — it is the first forecast period.** Its cost
  rows are the last realized month compounded at exactly 2%/month: 19.500 → 19.890 → 20.288 → 20.694 → 21.107
  → 21.530 → 21.960, and the same chain for CMV from 24.500. Verified in all twelve forecast cells. The PME
  rows are entered by hand (the diagram says so outright); no average of the three visible months reproduces
  them — arithmetic 213,77, harmonic 213,57, cost-weighted 214,05, against the 207,67 shown. Inventory rows
  are fully derived from `custo * PME / 360`.
- **Despite the "Estoque Médio" label, the reference numbers use the closing balance.** Verified against the
  diagram's own figures: 10.000 / 17.500 * 360 = 205,71.
- **The diagram's forecast formulas render as `Custo x 360 / PME`;** its own numbers only reconcile with
  `Custo x PME / 360`, which is what is written above.
- Worked example in the PRD reproduces the reference figures at d = 30 and lands within 0,2% of the
  spreadsheet's projected totals — useful as a regression fixture once code exists.

## Decisions taken (D1–D11)

These closed the PRD draft and constrain implementation. **D1–D9 and D11 are confirmed; D10 is a hypothesis
with a review trigger, not a validated decision.** D1–D7 appear as P1–P7 in the PRD, D9 and D10 as P8 and P9;
D8 and D11 have no P counterpart — they were decided after the draft.

1. **D1 — Aggregate by level, not per SKU.** *Confirmed.* v1 works in R$ over consolidated MP/PP/PA, with no
   item, quantity, or unit price. "How much to buy and produce" is out of v1 by decision: the data it needs
   (item, lead time, minimum lot, safety stock) is exactly what the PME model does not use, and collecting it
   would sink the 30-minute onboarding target. Do not reintroduce SKU-level fields into v1 models or importers.
   The boundary: the budget ceilings (`Compras_teto` RF-26, `Produção_teto` RF-27) are in scope because each
   is a single R$ figure derived from a balance identity; a per-item purchase or production suggestion is not.
2. **D2 — Revenue and financial cycle are in v1.** *Confirmed.* Two of the brief's five questions (inventory
   vs. sales, working-capital requirement) cannot be answered from cost and CMV alone, so `receita` is an
   input and PMR/PMP are scenario parameters (PRD RF-25), overridable per period. They are entered by the
   manager — this is explicitly **not** accounts-receivable/payable modelling.
3. **D3 — Ingest what the ERP already exports, not a template of ours.** *Confirmed.* v1 reads the client's
   **balancete** and the **razão of the inventory accounts** in whatever CSV/XLSX shape the ERP produces, and
   resolves meaning in-product by mapping the client's chart of accounts to MP/PP/PA (RF-28). The three-level
   split is an accounting classification, so the balancete — not the inventory module — is the natural source,
   and it is the one artifact every Brazilian SME produces monthly regardless of ERP. A blank template survives
   only as an escape hatch. Direct ERP integration stays in v2: the hard part is account semantics, not
   transport, and it has to be solved either way. Import stays idempotent on the `período + nível` key.
4. **D4 — PME in real days, `d = 30`.** *Confirmed.* Not a readability choice: `d = 30` on a monthly flow is
   identical to the accounting convention of 360 days on an annual flow — `Estoque / (12 * CMV_mensal) * 360 =
   Estoque / CMV_mensal * 30` — so the product agrees with the bank, the accountant and the textbook, all of
   which work in the 360-day commercial year. The reference model's error was applying 360 to a monthly flow.
5. **D5 — Average inventory by default**, degrading to closing balance when no opening balance exists.
   *Confirmed.* Since D3, that degradation is a rare path: the balancete carries `saldo anterior` on every
   line, including the first period of the series, so imported data always supports the average. Only manual
   entry falls back to the closing balance.
6. **D6 — PP is optional**, per the domain note above. *Confirmed.* One caveat to surface in the UI: an absent
   PP account does not mean there is no work in process — it means the WIP sits inside MP or PA, inflating
   that level's PME. Never let a two-level company's `PME_PA` be read as a genuinely short cycle.
7. **D7 — Loss is measured from the razão, not parameterised.** *Confirmed.* It comes from the write-off
   accounts (avaria, quebra, validade) mapped in RF-28 and is shown as an indicator with a trend series
   (RF-13). **Never apply a loss percentage to consumption**: the consumption read from the razão already
   contains the loss, so correcting it double-counts — that was the defect in the original formulation. The
   percentage survives only as a scenario lever against the measured baseline, as a ratio of yields (RF-17),
   which correctly becomes a no-op when the scenario equals the base. With no loss account mapped the
   indicator reads **não medido**, never zero — same principle as D6 for PP. No lot, expiry or FEFO control.
8. **D8 — The importer keeps a profile per source system and records the origin of every import.** *Confirmed.*
   The profile holds the export layout already known for that ERP, so the second client on the same ERP imports
   with no reconfiguration; the origin field is required on a company's first import (PRD RF-24). Which ERPs
   the first customers actually run cannot be known in advance, so the v2 integration queue is settled by
   accumulated data rather than opinion — which only works if this exists from the first customer onward.
9. **D9 — Sell direct to the company; the accounting firm is a channel, not a user.** *Confirmed.* The
   accountant does not hold the decision — estimating next quarter's PME depends on harvest, supplier
   contracts and the production plan, all of which live inside the company. They do hold the historical data
   and the relationship, which makes them distribution. So: multi-company stays Essencial from day one
   (RF-23), onboarding is written for the controller, and no per-accountant-seat pricing gets built before
   there are ten direct customers. Appears as P8 in the PRD.
10. **D10 — Price per company, three plans.** *Hypothesis, not a validated decision.* Two parts are structural
    and settled: charge per **empresa**, never per seat, and keep **backtesting in the paid tier**, since it is
    what sustains renewal. The figures are a starting point only — Essencial (1 company) R$ 300–500/mo;
    Profissional (3 companies, unlimited scenarios, backtesting) R$ 800–1.200/mo; Contabilidade (10+) from
    R$ 2.000/mo. **They were set with zero pricing conversations** and carry a review trigger: revisit after 10
    paying customers or 6 months, whichever comes first. Appears as P9 in the PRD, flagged as a hypothesis.
11. **D11 — TypeScript end to end.** *Confirmed.* The full choice and its rationale are in the Stack section
    above. The load-bearing part is not the framework but the calculation engine being a pure, dependency-free
    package that runs unchanged on client and server. This is an implementation decision and deliberately does
    **not** appear in the PRD, which describes what the product does and why, not how it is built.

## Open items

No product or commercial question is still open — every decision is recorded as D1–D10 above. Two empirical
checks remain, and neither blocks building:

1. **The timed balancete test.** Take a real balancete and measure how long it takes to go from file to first
   projection. The only item that can still change an ingestion requirement before development, and it needs a
   real file from the pilot customer or their accountant (D3).
2. **The pricing review.** After 10 paying customers or 6 months, whichever comes first (D10).

Six questions have been closed and must not be reopened without new information: whether "how much to buy"
stays in v1 (D1), what the reference spreadsheet's "Média" column computed (answered in the notes above),
whether PMR/PMP make v1 (D2), which ERPs to integrate with (D8 replaces the question with a measurement), who
the product is sold to (D9), and how it is packaged (D10, as a hypothesis).

## Conventions

- The brief, the reference model, the PRD, and all domain vocabulary are in **Brazilian Portuguese**. Keep
  domain terms (MP, PP, PA, PME, CMV, Estoque, Cenário, Premissa) in Portuguese in the model and UI — they are
  the terms the users and the source material use. Do not translate them to English identifiers.
- Monetary figures in the reference model are in **R$ milhares** (thousands of BRL). UI formatting is pt-BR
  (`1.234,56`), currency BRL, periods by monthly competence.
- Every premise or entry change must record user, timestamp, and prior value. Financial figures without an
  audit trail are not defensible to a partner or a bank.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `claudio-mas/estoque-pme`, driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repository root. See `docs/agents/domain.md`.
