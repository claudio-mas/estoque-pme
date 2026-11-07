#!/usr/bin/env node
// Gerado pelo informas-ui 2.0.0-alpha.3 (item "contraste" do registro). Para atualizar: npx shadcn@latest add @informas/contraste

// scripts/registry/informas-contrast.mjs
import { existsSync, readFileSync as readFileSync2 } from "node:fs";

// scripts/lib/contrast.mjs
import { readFileSync } from "node:fs";

// scripts/lib/color.mjs
var NAMED = { white: [1, 1, 1, 1], black: [0, 0, 0, 1], transparent: [0, 0, 0, 0] };
var clamp01 = (x) => Math.min(1, Math.max(0, x));
function component(text, percentScale) {
  if (text === "none") return 0;
  if (text.endsWith("%")) return parseFloat(text) / 100 * percentScale;
  return parseFloat(text);
}
function hue(text) {
  if (text === "none") return 0;
  const value = parseFloat(text);
  if (text.endsWith("turn")) return value * 360;
  if (text.endsWith("rad")) return value * 180 / Math.PI;
  if (text.endsWith("grad")) return value * 0.9;
  return value;
}
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}
function oklchToRgb(L, C, h) {
  const a = C * Math.cos(h * Math.PI / 180);
  const b = C * Math.sin(h * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];
  return linear.map((x) => clamp01(x <= 31308e-7 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055));
}
function parseColor(input) {
  const value = String(input).trim().toLowerCase();
  if (NAMED[value]) return [...NAMED[value]];
  const hex = value.match(/^#([0-9a-f]+)$/);
  if (hex) {
    let digits = hex[1];
    if (![3, 4, 6, 8].includes(digits.length)) return null;
    if (digits.length <= 4) digits = [...digits].map((d) => d + d).join("");
    return [0, 2, 4, 6].map((i) => i < digits.length ? parseInt(digits.slice(i, i + 2), 16) / 255 : 1);
  }
  const fn = value.match(/^(rgba?|hsla?|oklch)\((.*)\)$/);
  if (!fn) return null;
  const parts = fn[2].replace(/\//g, " / ").split(/[\s,]+/).filter(Boolean);
  let alpha = 1;
  let channels = parts;
  const slash = parts.indexOf("/");
  if (slash >= 0) {
    alpha = component(parts[slash + 1] ?? "1", 1);
    channels = parts.slice(0, slash);
  } else if (parts.length === 4) {
    alpha = component(parts[3], 1);
    channels = parts.slice(0, 3);
  }
  if (channels.length !== 3) return null;
  let rgb;
  if (fn[1].startsWith("rgb")) rgb = channels.map((c) => component(c, 255) / 255);
  else if (fn[1].startsWith("hsl")) rgb = hslToRgb(hue(channels[0]), component(channels[1], 1) / (channels[1].endsWith("%") ? 1 : 100), component(channels[2], 1) / (channels[2].endsWith("%") ? 1 : 100));
  else rgb = oklchToRgb(component(channels[0], 1), component(channels[1], 0.4), hue(channels[2]));
  const result = [...rgb.map(clamp01), clamp01(alpha)];
  return result.some(Number.isNaN) ? null : result;
}
function composite(top, bottom) {
  const a = top[3];
  return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1);
}
function luminance([r, g, b]) {
  const lin = (c) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function toHex([r, g, b, a = 1]) {
  const hex = [r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");
  return `#${hex}${a < 1 ? Math.round(a * 255).toString(16).padStart(2, "0") : ""}`;
}

// scripts/lib/tokens.mjs
var tokensDir = new URL("../../tokens/", import.meta.url);
function resolveVar(name, vars, seen = /* @__PURE__ */ new Set()) {
  if (seen.has(name)) throw new Error(`Refer\xEAncia circular em ${[...seen, name].join(" \u2192 ")}`);
  const raw = vars.get(name);
  if (raw === void 0) return void 0;
  const next = new Set(seen).add(name);
  return raw.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (match, ref, fallback) => resolveVar(ref, vars, next) ?? fallback?.trim() ?? match);
}
function themeVars(blocks, mode) {
  const vars = /* @__PURE__ */ new Map();
  for (const { selector, decls } of blocks) {
    if (selector === ":root" || mode === "dark" && selector === ".dark") for (const [name, value] of decls) vars.set(name, value);
  }
  return vars;
}

// scripts/lib/contrast.mjs
function parseThemeCss(css, file = "CSS") {
  const blocks = [];
  const warnings = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, rawSelector, body] of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rawSelector.trim();
    if (selector.startsWith("@")) continue;
    const decls = [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g)].map(([, name, value]) => [name, value.replace(/\s*!important$/, "")]);
    if (!decls.length) continue;
    const parts = selector.split(",").map((s) => s.trim());
    const isDark = parts.some((s) => /\.dark\b/.test(s));
    const isRoot = parts.some((s) => s === ":root" || s === "html" || s === ":host");
    if (isDark) blocks.push({ selector: ".dark", decls });
    else if (isRoot) blocks.push({ selector: ":root", decls });
    else warnings.push(`${file}: seletor "${selector}" ignorado (use :root para o tema claro e .dark para o escuro).`);
  }
  return { blocks, warnings };
}
function background(vars, mode) {
  const color = parseColor(resolveVar("--background", vars) ?? "");
  const fallback = mode === "dark" ? [0, 0, 0, 1] : [1, 1, 1, 1];
  return color ? composite(color, fallback) : fallback;
}
function evaluate(blocks, { minimums, pairs }) {
  const results = [];
  for (const mode of ["light", "dark"]) {
    const vars = themeVars(blocks, mode);
    const page = background(vars, mode);
    for (const [kind, fgName, bgName] of pairs) {
      const min = minimums[kind];
      const fgValue = resolveVar(`--${fgName}`, vars);
      const bgValue = resolveVar(`--${bgName}`, vars);
      const fg = parseColor(fgValue ?? "");
      const bgRaw = parseColor(bgValue ?? "");
      const base = { mode, kind, fg: fgName, bg: bgName, min };
      if (!fg || !bgRaw) {
        const bad = !fg ? [fgName, fgValue] : [bgName, bgValue];
        results.push({ ...base, ok: false, error: `--${bad[0]}: valor "${bad[1] ?? "n\xE3o definido"}" n\xE3o \xE9 uma cor suportada (hex, rgb, hsl, oklch).` });
        continue;
      }
      const bg = composite(bgRaw, page);
      const ratio = contrastRatio(composite(fg, bg), bg);
      results.push({ ...base, ratio, ok: ratio >= min, fgHex: toHex(fg), bgHex: toHex(bgRaw) });
    }
  }
  return results;
}
function readFiles(files2) {
  const blocks = [];
  const warnings = [];
  for (const file of files2) {
    const parsed = parseThemeCss(readFileSync(file, "utf8"), file);
    blocks.push(...parsed.blocks);
    warnings.push(...parsed.warnings);
  }
  return { blocks, warnings };
}
function checkCss({ files: files2, contrast }) {
  const { blocks, warnings } = readFiles(files2);
  const results = evaluate(blocks, contrast);
  return { results, warnings, failures: results.filter((r) => !r.ok) };
}
function formatReport({ results, warnings, failures }) {
  const lines = [];
  for (const mode of ["light", "dark"]) {
    lines.push(`
${mode === "light" ? "Tema claro" : "Tema escuro"}`);
    for (const r of results.filter((item) => item.mode === mode)) {
      const status = r.ok ? "ok   " : "FALHA";
      const detail = r.error ?? `${r.ratio.toFixed(2)}:1 (m\xEDn. ${r.min}:1)  ${r.fgHex} sobre ${r.bgHex}`;
      lines.push(`  ${status} ${`${r.fg} / ${r.bg}`.padEnd(54)} ${detail}`);
    }
  }
  for (const warning of warnings) lines.push(`aviso: ${warning}`);
  lines.push("", failures.length ? `${failures.length} par(es) abaixo do m\xEDnimo.` : `Todos os ${results.length} pares atendem ao m\xEDnimo.`);
  return lines.join("\n");
}

// tokens/contrast.json
var contrast_default = {
  $description: "Pares verificados em cada tema. text = WCAG 1.4.3 (4,5:1 para texto normal). ui = WCAG 1.4.11 (3:1 para bordas de campo, foco, preenchimentos e gr\xE1ficos).",
  minimums: { text: 4.5, ui: 3 },
  pairs: [
    ["text", "foreground", "background"],
    ["text", "card-foreground", "card"],
    ["text", "popover-foreground", "popover"],
    ["text", "primary-foreground", "primary"],
    ["text", "secondary-foreground", "secondary"],
    ["text", "muted-foreground", "muted"],
    ["text", "muted-foreground", "background"],
    ["text", "muted-foreground", "card"],
    ["text", "accent-foreground", "accent"],
    ["text", "info-foreground", "info"],
    ["text", "info-subtle-foreground", "info-subtle"],
    ["text", "info-subtle-foreground", "background"],
    ["text", "success-foreground", "success"],
    ["text", "success-subtle-foreground", "success-subtle"],
    ["text", "success-subtle-foreground", "background"],
    ["text", "warning-foreground", "warning"],
    ["text", "warning-subtle-foreground", "warning-subtle"],
    ["text", "warning-subtle-foreground", "background"],
    ["text", "destructive-foreground", "destructive"],
    ["text", "destructive-subtle-foreground", "destructive-subtle"],
    ["text", "destructive-subtle-foreground", "background"],
    ["text", "sidebar-foreground", "sidebar"],
    ["text", "sidebar-primary-foreground", "sidebar-primary"],
    ["text", "sidebar-accent-foreground", "sidebar-accent"],
    ["ui", "input", "background"],
    ["ui", "input", "card"],
    ["ui", "ring", "background"],
    ["ui", "ring", "card"],
    ["ui", "sidebar-ring", "sidebar"],
    ["ui", "primary", "background"],
    ["ui", "info", "background"],
    ["ui", "success", "background"],
    ["ui", "warning", "background"],
    ["ui", "destructive", "background"],
    ["ui", "chart-1", "card"],
    ["ui", "chart-2", "card"],
    ["ui", "chart-3", "card"],
    ["ui", "chart-4", "card"],
    ["ui", "chart-5", "card"]
  ]
};

// scripts/registry/informas-contrast.mjs
var args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Uso: node scripts/informas-contrast.mjs [globals.css] [brand.css ...] [--json]");
  process.exit(0);
}
var files = args.filter((arg) => !arg.startsWith("--"));
if (!files.length && existsSync("components.json")) {
  const css = JSON.parse(readFileSync2("components.json", "utf8"))?.tailwind?.css;
  if (css) files = [css];
}
if (!files.length) {
  console.error("informas-contrast: informe o arquivo CSS do tema (n\xE3o encontrei components.json com tailwind.css).");
  process.exit(2);
}
try {
  const report = checkCss({ files, contrast: contrast_default });
  console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exitCode = report.failures.length ? 1 : 0;
} catch (error) {
  console.error(`informas-contrast: ${error.message}`);
  process.exitCode = 2;
}
