'use client';

import { useEffect, useState } from 'react';
import { CHAVE_DO_TEMA, type PreferenciaDeTema } from './tema';

const OPCOES: readonly { valor: PreferenciaDeTema; rotulo: string }[] = [
  { valor: 'light', rotulo: 'Claro' },
  { valor: 'dark', rotulo: 'Escuro' },
  { valor: 'system', rotulo: 'Sistema' },
];

declare global { interface Window { __aplicarTema?: () => void } }

function lida(): PreferenciaDeTema {
  try {
    const v = localStorage.getItem(CHAVE_DO_TEMA);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* armazenamento bloqueado: vale o sistema */ }
  return 'system';
}

export function SeletorDeTema() {
  // null até montar: o servidor não sabe a preferência, e nenhuma opção aparece marcada errada.
  const [preferencia, setPreferencia] = useState<PreferenciaDeTema | null>(null);
  useEffect(() => setPreferencia(lida()), []);

  function escolher(valor: PreferenciaDeTema) {
    try { localStorage.setItem(CHAVE_DO_TEMA, valor); } catch { /* segue só nesta sessão */ }
    setPreferencia(valor);
    if (window.__aplicarTema) { window.__aplicarTema(); return; }
    // Sem o script do layout (ou com o armazenamento bloqueado), aplica direto.
    const escuro = valor === 'dark' || (valor === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', escuro);
    document.documentElement.style.colorScheme = escuro ? 'dark' : 'light';
  }

  return (
    <div className="grid gap-2">
      <span className="text-xs text-muted-foreground">Aparência</span>
      <div role="group" aria-label="Tema da interface" className="inline-flex w-fit gap-0.5 rounded-md border border-border bg-background p-0.5">
        {OPCOES.map((o) => (
          <button key={o.valor} type="button" aria-pressed={preferencia === o.valor} onClick={() => escolher(o.valor)}
            className="rounded px-3 py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground">
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
