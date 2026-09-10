/**
 * Detecção do dialeto do arquivo: delimitador e separador decimal.
 *
 * Não são independentes. Ponto e vírgula existe como delimitador **porque** a
 * vírgula é o decimal — é o CSV que o Excel em português gera. Mas a inferência
 * de um pelo outro é só o desempate: o que decide é a evidência dentro do
 * arquivo, porque exportador mal configurado emite as combinações erradas
 * também, e é nesse arquivo que errar dói.
 */
import { lerCsv, vazio } from './csv';
import type { Delimitador, SeparadorDecimal } from './tipos';

const CANDIDATOS: readonly Delimitador[] = [';', ',', '\t', '|'];

/** Quantas linhas bastam para decidir. Arquivo grande não precisa ser lido todo. */
const LINHAS_DE_AMOSTRA = 200;

/**
 * O que se detecta a partir do **texto** já decodificado.
 *
 * Nome qualificado porque `Dialeto`, em `tipos.ts`, é a coisa maior: a
 * propriedade do ERP, que inclui a codificação — e essa vem dos bytes, antes de
 * existir texto para inspecionar.
 */
export interface DialetoDelimitado {
  readonly delimitador: Delimitador;
  readonly separadorDecimal: SeparadorDecimal;
}

/**
 * Escolhe o delimitador pela **regularidade** das colunas, não pela contagem.
 *
 * Contar ocorrências elege a vírgula em qualquer arquivo com texto em
 * português, porque descrição de conta tem vírgula. O delimitador verdadeiro é
 * o que produz o mesmo número de campos em quase toda linha; um separador falso
 * produz contagem errática. Empate resolve pela ordem de `CANDIDATOS`, que põe
 * `;` na frente por ser o caso brasileiro dominante.
 */
export function detectarDelimitador(texto: string): Delimitador {
  const amostra = primeirasLinhas(texto, LINHAS_DE_AMOSTRA);
  let melhor: Delimitador = ';';
  let melhorNota = -1;

  for (const candidato of CANDIDATOS) {
    const registros = lerCsv(amostra, candidato).filter((r) => !vazio(r));
    if (registros.length === 0) continue;

    const contagens = registros.map((r) => r.campos.length);
    const moda = modaDe(contagens);
    if (moda < 2) continue;

    const regulares = contagens.filter((n) => n === moda).length;
    const nota = (regulares / contagens.length) * (moda - 1);
    if (nota > melhorNota) {
      melhorNota = nota;
      melhor = candidato;
    }
  }
  return melhor;
}

/**
 * Escolhe o separador decimal pelos números que o arquivo realmente contém.
 *
 * O padrão com milhar (`1.234,56`) é prova: só uma das duas leituras faz
 * sentido. Sem ele, vale a maioria simples entre `,dd` e `.dd` no fim do campo.
 * Sem número nenhum, cai na convenção do delimitador.
 */
export function detectarDecimal(texto: string, delimitador: Delimitador): SeparadorDecimal {
  const amostra = primeirasLinhas(texto, LINHAS_DE_AMOSTRA);
  let virgula = 0;
  let ponto = 0;

  for (const registro of lerCsv(amostra, delimitador)) {
    for (const bruto of registro.campos) {
      const campo = bruto.trim();
      if (/^-?\d{1,3}(?:\.\d{3})+,\d+$/.test(campo)) virgula += 10;
      else if (/^-?\d{1,3}(?:,\d{3})+\.\d+$/.test(campo)) ponto += 10;
      else if (/^-?\d+,\d{1,2}$/.test(campo)) virgula += 1;
      else if (/^-?\d+\.\d{1,2}$/.test(campo)) ponto += 1;
    }
  }

  if (virgula !== ponto) return virgula > ponto ? ',' : '.';
  return delimitador === ',' ? '.' : ',';
}

export function detectarDialeto(texto: string): DialetoDelimitado {
  const delimitador = detectarDelimitador(texto);
  return { delimitador, separadorDecimal: detectarDecimal(texto, delimitador) };
}

function primeirasLinhas(texto: string, quantas: number): string {
  let corte = -1;
  for (let i = 0; i < quantas; i += 1) {
    const proximo = texto.indexOf('\n', corte + 1);
    if (proximo === -1) return texto;
    corte = proximo;
  }
  return texto.slice(0, corte);
}

function modaDe(valores: readonly number[]): number {
  const frequencia = new Map<number, number>();
  for (const valor of valores) {
    frequencia.set(valor, (frequencia.get(valor) ?? 0) + 1);
  }
  let moda = 0;
  let maior = 0;
  for (const [valor, vezes] of frequencia) {
    if (vezes > maior || (vezes === maior && valor > moda)) {
      moda = valor;
      maior = vezes;
    }
  }
  return moda;
}
