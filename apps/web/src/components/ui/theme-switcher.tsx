"use client"

import * as React from "react"
import { cn } from "cn"

import {
  getThemePreference,
  setThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme-mode"

const OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
]

/**
 * Seletor Claro / Escuro / Sistema. Precisa do `themeScript()` no layout raiz
 * para o tema valer desde a primeira pintura.
 */
function ThemeSwitcher({
  storageKey = THEME_STORAGE_KEY,
  label = "Aparência",
  className,
  ...props
}: React.ComponentProps<"div"> & { storageKey?: string; label?: string }) {
  // null até montar: o servidor não sabe a preferência, e nenhuma opção aparece marcada errada.
  const [preference, setPreference] = React.useState<ThemePreference | null>(null)
  React.useEffect(() => setPreference(getThemePreference(storageKey)), [storageKey])

  return (
    <div data-slot="theme-switcher" className={cn("grid gap-2", className)} {...props}>
      {label ? <span className="text-xs text-muted-foreground">{label}</span> : null}
      <div
        role="group"
        aria-label="Tema da interface"
        className="inline-flex w-fit gap-0.5 rounded-md border bg-background p-0.5"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={preference === option.value}
            onClick={() => {
              setThemePreference(option.value, storageKey)
              setPreference(option.value)
            }}
            className="rounded px-3 py-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export { ThemeSwitcher }
