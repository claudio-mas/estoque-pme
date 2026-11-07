import * as React from "react"

/**
 * Tema Claro / Escuro / Sistema com a classe `.dark` no <html> (informas-ui).
 *
 * - `themeScript()` vai inline antes da hidratação: aplica a preferência antes da
 *   primeira pintura, acompanha o sistema operacional no modo "system" e sincroniza abas.
 *   Next.js: <Script id="tema" strategy="beforeInteractive">{themeScript()}</Script> no layout raiz.
 *   Vite/HTML: <script>{conteúdo de themeScript()}</script> no <head> do index.html.
 * - `setThemePreference()` grava a escolha e aplica na hora.
 * - `useResolvedTheme()` diz se o tema efetivo é "light" ou "dark".
 */
export type ThemePreference = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "theme"

declare global {
  interface Window {
    __informasTheme?: () => void
  }
}

export function themeScript(storageKey: string = THEME_STORAGE_KEY): string {
  return `(function(){try{var k=${JSON.stringify(storageKey)},m=matchMedia('(prefers-color-scheme: dark)');function a(){var p=null;try{p=localStorage.getItem(k)}catch(e){}var d=p==='dark'||(p!=='light'&&m.matches),h=document.documentElement;h.classList.toggle('dark',d);h.style.colorScheme=d?'dark':'light'}a();m.addEventListener('change',a);addEventListener('storage',function(e){if(e.key===k)a()});window.__informasTheme=a}catch(e){}})();`
}

export function getThemePreference(storageKey: string = THEME_STORAGE_KEY): ThemePreference {
  try {
    const value = localStorage.getItem(storageKey)
    if (value === "light" || value === "dark" || value === "system") return value
  } catch {
    // Armazenamento bloqueado: vale o sistema.
  }
  return "system"
}

export function setThemePreference(value: ThemePreference, storageKey: string = THEME_STORAGE_KEY) {
  try {
    localStorage.setItem(storageKey, value)
  } catch {
    // Segue só nesta sessão.
  }
  if (window.__informasTheme) {
    window.__informasTheme()
    return
  }
  // Sem o script (ou com o armazenamento bloqueado), aplica direto.
  const dark = value === "dark" || (value === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
}

function readResolved(): ResolvedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

/** Tema efetivo, observando a classe `.dark` do <html>. No servidor, "light". */
export function useResolvedTheme(): ResolvedTheme {
  return React.useSyncExternalStore(
    (notify) => {
      const observer = new MutationObserver(notify)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
      return () => observer.disconnect()
    },
    readResolved,
    () => "light"
  )
}
