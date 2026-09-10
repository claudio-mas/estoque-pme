/**
 * Codificação, CSV e dialeto — as três coisas que o CLAUDE.md avisa que um
 * importador genérico erra em arquivo brasileiro.
 */
import { describe, expect, it } from 'vitest';
import {
  decodificar,
  detectarDecimal,
  detectarDelimitador,
  detectarDialeto,
  lerCsv,
  normalizar,
} from '../src/index';

/** Latin-1/cp1252: cada caractere abaixo de U+0100 vira um byte só. */
const latin1 = (texto: string): Uint8Array =>
  Uint8Array.from([...texto].map((c) => c.charCodeAt(0)));

const utf8 = (texto: string): Uint8Array => new TextEncoder().encode(texto);

describe('codificação', () => {
  it('lê acento de arquivo Latin-1, que é como o ERP costuma exportar', () => {
    const resultado = decodificar(latin1('MATÉRIAS-PRIMAS;12.000,00'));
    expect(resultado.codificacao).toBe('windows-1252');
    expect(resultado.texto).toBe('MATÉRIAS-PRIMAS;12.000,00');
  });

  it('lê UTF-8 sem estragar o acento', () => {
    const resultado = decodificar(utf8('MATÉRIAS-PRIMAS;12.000,00'));
    expect(resultado.codificacao).toBe('utf-8');
    expect(resultado.texto).toBe('MATÉRIAS-PRIMAS;12.000,00');
  });

  it('remove o BOM em vez de deixá-lo virar parte do primeiro campo', () => {
    const comBom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('Conta;Saldo')]);
    const resultado = decodificar(comBom);
    expect(resultado.texto).toBe('Conta;Saldo');
    expect(resultado.texto.startsWith('Conta')).toBe(true);
  });

  it('lê UTF-16, que é o que sai do Excel salvo como "Texto Unicode"', () => {
    const bytes = [0xff, 0xfe];
    for (const c of 'Conta\tSaldo') {
      bytes.push(c.charCodeAt(0) & 0xff, c.charCodeAt(0) >> 8);
    }
    const resultado = decodificar(Uint8Array.from(bytes));
    expect(resultado.codificacao).toBe('utf-16le');
    expect(resultado.texto).toBe('Conta\tSaldo');
  });

  it('obedece a codificação do perfil em vez de detectar de novo', () => {
    // Reprocessar um arquivo anos depois tem que dar o mesmo texto (RF-24).
    expect(decodificar(latin1('AÇÚCAR'), 'windows-1252').texto).toBe('AÇÚCAR');
  });

  it('normaliza rótulo para comparação: sem acento, sem caixa, sem pontuação', () => {
    expect(normalizar('Saldo Anterior')).toBe('saldo anterior');
    expect(normalizar('SALDO  ANTER.')).toBe('saldo anter');
    expect(normalizar('Descrição')).toBe('descricao');
  });
});

describe('CSV', () => {
  it('respeita aspas e o delimitador dentro do campo', () => {
    const [registro] = lerCsv('1.1.3;"ESTOQUES; GERAL";1.000,00', ';');
    expect(registro?.campos).toEqual(['1.1.3', 'ESTOQUES; GERAL', '1.000,00']);
  });

  it('trata aspas duplicadas como aspa literal', () => {
    const [registro] = lerCsv('a;"diz ""ok""";b', ';');
    expect(registro?.campos[1]).toBe('diz "ok"');
  });

  it('numera a linha física, não o registro, quando há quebra dentro do campo', () => {
    // É a razão de o parser ser escrito à mão: o aceite do RF-01 pede a linha
    // do arquivo, e ela deixa de bater com o índice do registro justamente aqui.
    const registros = lerCsv('a;b\n"linha\nquebrada";c\nd;e', ';');
    expect(registros.map((r) => r.linha)).toEqual([1, 2, 4]);
    expect(registros[1]?.campos[0]).toBe('linha\nquebrada');
  });

  it('aceita CRLF, LF e CR isolado', () => {
    expect(lerCsv('a;b\r\nc;d', ';')).toHaveLength(2);
    expect(lerCsv('a;b\nc;d', ';')).toHaveLength(2);
    expect(lerCsv('a;b\rc;d', ';')).toHaveLength(2);
  });

  it('não perde a última linha quando o arquivo não termina em quebra', () => {
    const registros = lerCsv('a;b\nc;d', ';');
    expect(registros[1]?.campos).toEqual(['c', 'd']);
  });
});

describe('dialeto', () => {
  it('escolhe ponto e vírgula mesmo com vírgula na descrição das contas', () => {
    // A armadilha: contar ocorrências elege a vírgula, porque descrição de
    // conta em português tem vírgula. O que decide é a regularidade das colunas.
    const texto = [
      'Conta;Descrição;Saldo',
      '1.1.3.01;MATÉRIAS-PRIMAS, GRÃOS;12.000,00',
      '1.1.3.02;EMBALAGENS, ROTULOS, CAIXAS;5.000,00',
      '1.1.3.03;PRODUTOS ACABADOS;15.000,00',
    ].join('\n');
    expect(detectarDelimitador(texto)).toBe(';');
    expect(detectarDecimal(texto, ';')).toBe(',');
  });

  it('reconhece o CSV internacional', () => {
    const texto = ['Account,Name,Balance', '1.1.3.01,RAW MATERIALS,12000.00'].join('\n');
    expect(detectarDialeto(texto)).toEqual({ delimitador: ',', separadorDecimal: '.' });
  });

  it('reconhece TSV', () => {
    const texto = ['Conta\tDescrição\tSaldo', '1.1.3.01\tMATÉRIAS-PRIMAS\t12.000,00'].join('\n');
    expect(detectarDelimitador(texto)).toBe('\t');
  });

  it('usa o padrão de milhar como prova quando ele existe', () => {
    // "1.234,56" só faz sentido com vírgula decimal; a contagem de casos
    // ambíguos não deve derrubar essa evidência.
    const texto = 'Conta;Saldo\n1.1;1.234,56\n1.2;9.876,54';
    expect(detectarDecimal(texto, ';')).toBe(',');
  });
});
