/**
 * Leitor de CSV delimitado.
 *
 * Escrito à mão e não delegado a biblioteca por um motivo só: o número da linha
 * física. O aceite do RF-01 exige apontar a linha do arquivo, e um campo entre
 * aspas pode conter quebra de linha — então o índice do registro e o número da
 * linha divergem justamente nos arquivos em que o gestor mais precisa do aviso.
 */
import type { Delimitador } from './tipos';

export interface RegistroCsv {
  /** Número da primeira linha física do registro, 1-based. */
  readonly linha: number;
  readonly campos: readonly string[];
}

/**
 * Divide o texto em registros, respeitando aspas duplas.
 *
 * `""` dentro de campo entre aspas é uma aspa literal. CRLF, LF e CR isolado
 * terminam registro — CR isolado ainda aparece em export de sistema antigo.
 */
export function lerCsv(texto: string, delimitador: Delimitador): RegistroCsv[] {
  const registros: RegistroCsv[] = [];
  let campos: string[] = [];
  let campo = '';
  let entreAspas = false;
  let linha = 1;
  let linhaDoRegistro = 1;
  let temConteudo = false;

  const fecharCampo = (): void => {
    campos.push(campo);
    campo = '';
  };
  const fecharRegistro = (): void => {
    fecharCampo();
    registros.push({ linha: linhaDoRegistro, campos });
    campos = [];
    temConteudo = false;
  };

  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i] as string;

    if (!temConteudo) {
      linhaDoRegistro = linha;
      temConteudo = true;
    }

    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          entreAspas = false;
        }
      } else {
        if (c === '\n') linha += 1;
        campo += c;
      }
      continue;
    }

    if (c === '"' && campo === '') {
      entreAspas = true;
      continue;
    }
    if (c === delimitador) {
      fecharCampo();
      continue;
    }
    if (c === '\r' || c === '\n') {
      fecharRegistro();
      if (c === '\r' && texto[i + 1] === '\n') i += 1;
      linha += 1;
      continue;
    }
    campo += c;
  }

  if (temConteudo || campo !== '' || campos.length > 0) {
    fecharRegistro();
  }
  return registros;
}

/** Registro sem nenhum campo preenchido — linha em branco ou só delimitadores. */
export function vazio(registro: RegistroCsv): boolean {
  return registro.campos.every((campo) => campo.trim() === '');
}
