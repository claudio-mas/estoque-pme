/**
 * Tema Claro / Escuro / Sistema com a classe `.dark` no <html> (informas-ui).
 *
 * O script vai inline no <head> do layout raiz: aplica o tema antes da primeira
 * pintura, acompanha o sistema operacional quando a preferência é "system" e
 * sincroniza abas. A chave e os valores são os mesmos da versão anterior, então
 * quem já tinha escolhido um tema continua com ele.
 */
export const CHAVE_DO_TEMA = 'estoque-pme.aparencia';
export type PreferenciaDeTema = 'light' | 'dark' | 'system';

export const SCRIPT_DO_TEMA = `(function(){try{var k=${JSON.stringify(CHAVE_DO_TEMA)},m=matchMedia('(prefers-color-scheme: dark)');
function a(){var p=null;try{p=localStorage.getItem(k)}catch(e){}var d=p==='dark'||(p!=='light'&&m.matches),h=document.documentElement;
h.classList.toggle('dark',d);h.style.colorScheme=d?'dark':'light'}
a();m.addEventListener('change',a);addEventListener('storage',function(e){if(e.key===k)a()});window.__aplicarTema=a}catch(e){}})();`;
