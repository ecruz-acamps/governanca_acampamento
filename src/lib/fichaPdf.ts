import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

// Gera as fichas a partir do PDF modelo (ficha-modelo.pdf): o modelo é mantido idêntico e só são trocados
// missão, data, horários, valor/PIX/contato e nº da ficha, cobrindo o original e redesenhando o texto.
// O modelo é recebido como bytes (Uint8Array) para não depender de fs/caminhos: leia o arquivo como quiser.
const BRANCO = rgb(1, 1, 1);
const PRETO = rgb(0, 0, 0);
const VERMELHO = rgb(1, 0, 0);
const AMARELO = rgb(1, 1, 0);
const AZUL_CAIXA = rgb(145 / 255, 205 / 255, 219 / 255); // fundo das caixas de horário (página 4)

// caixas do texto original (coordenadas do pdftotext, y de cima para baixo)
type Caixa = { x0: number; y0: number; x1: number; y1: number };
const NUM_FICHA: Caixa[] = [
  { x0: 489.48, y0: 105.1, x1: 525.48, y1: 131.66 },
  { x0: 508.56, y0: 18.2, x1: 544.56, y1: 44.78 },
  { x0: 507.84, y0: 17.0, x1: 543.84, y1: 43.58 },
  { x0: 510.36, y0: 11.98, x1: 546.36, y1: 38.54 },
];

function cobrir(page: PDFPage, c: Caixa, folga = 1.5, color = BRANCO) {
  const h = page.getHeight();
  page.drawRectangle({
    x: c.x0 - folga,
    y: h - c.y1 - folga,
    width: c.x1 - c.x0 + folga * 2,
    height: c.y1 - c.y0 + folga * 2,
    color,
  });
}

// substitui uma linha de texto centralizada na mesma posição horizontal do original
function trocarLinhaCentralizada(page: PDFPage, c: Caixa, texto: string, font: PDFFont, size: number, fundo = BRANCO, alinhar: "centro" | "esquerda" = "centro") {
  cobrir(page, c, fundo === BRANCO ? 2 : 0.5, fundo);
  const h = page.getHeight();
  const cx = (c.x0 + c.x1) / 2;
  const w = font.widthOfTextAtSize(texto, size);
  // linha de base ≈ borda inferior da caixa menos o descendente
  const y = h - c.y1 + (c.y1 - c.y0) * 0.22;
  page.drawText(texto, { x: alinhar === "centro" ? cx - w / 2 : c.x0, y, size, font, color: PRETO });
}

export type Opcoes = {
  missao: string;
  data: string;
  saida: string; // YYYY-MM-DD
  encerramento: string; // YYYY-MM-DD
  valor: number;
  pix: string;
  contato: string;
};

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

// "2026-04-29" → "29/04/2026 (quarta-feira)"
export function dataComDiaSemana(iso: string) {
  const [a, m, d] = iso.split("-");
  const dia = DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
  return `${d}/${m}/${a} (${dia})`;
}

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

// inteiro de 1 a 999 por extenso; fora disso devolve null
export function extensoAte999(n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > 999) return null;
  if (n === 100) return "cem";
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c) partes.push(CENTENAS[c]);
  if (r) partes.push(r < 20 ? UNIDADES[r] : DEZENAS[Math.floor(r / 10)] + (r % 10 ? ` e ${UNIDADES[r % 10]}` : ""));
  return partes.join(" e ");
}

// "R$ 300,00 (trezentos reais)"
export function valorPorExtenso(valor: number) {
  const base = `R$ ${valor.toFixed(2).replace(".", ",")}`;
  const ext = extensoAte999(valor);
  return ext ? `${base} (${ext} ${valor === 1 ? "real" : "reais"})` : base;
}

type Palavra = { t: string; font: PDFFont; cor: ReturnType<typeof rgb>; size: number };

// reescreve o bloco amarelo "Observação:" (página 2) com valor, PIX e contato da missão, justificado
function desenharObservacao(page: PDFPage, o: Opcoes, fontes: { timesBold: PDFFont; times: PDFFont; helvBold: PDFFont }) {
  const X0 = 19;
  const LARGURA = 553;
  const TOPO = 420.3;
  const ALTURA_LINHA = 11.5;
  const MAX_LINHAS = 5;
  const h = page.getHeight();

  cobrir(page, { x0: X0, y0: TOPO - 1, x1: X0 + LARGURA + 4, y1: TOPO + MAX_LINHAS * ALTURA_LINHA + 1 }, 0);

  const partes: { texto: string; font: PDFFont; cor: ReturnType<typeof rgb>; base: number }[] = [
    { texto: "Observação:", font: fontes.timesBold, cor: PRETO, base: 11 },
    {
      texto:
        "O Acampamento Sênior é para pessoas de 30 anos em diante ou no caso de já terem o sacramento do Matrimônio, porém que tenham mínimo de 20 anos. Nele acontecem atividades físicas leves. É proibida a participação de gestantes. O valor da inscrição é de",
      font: fontes.times,
      cor: PRETO,
      base: 11,
    },
    {
      texto: `${valorPorExtenso(o.valor)}. O pagamento poderá ser feito através de PIX ${o.pix} (Associação dos Campistas São Padre Pio) ou em Dinheiro com o Setor Financeiro através do contato: ${o.contato}.`,
      font: fontes.helvBold,
      cor: PRETO,
      base: 10.5,
    },
    {
      texto: `No caso de Pix, enviar COMPROVANTE IDENTIFICADO para ${o.contato}.`,
      font: fontes.helvBold,
      cor: VERMELHO,
      base: 10.5,
    },
  ];

  // reduz a fonte até caber em 5 linhas (chave PIX/contato longos)
  let linhas: Palavra[][] = [];
  for (let escala = 1; escala >= 0.7; escala -= 0.03) {
    const palavras: Palavra[] = partes.flatMap((p) =>
      p.texto.split(/\s+/).map((t) => ({ t, font: p.font, cor: p.cor, size: p.base * escala })),
    );
    linhas = [[]];
    let usado = 0;
    for (const w of palavras) {
      const largura = w.font.widthOfTextAtSize(w.t, w.size);
      const espaco = w.font.widthOfTextAtSize(" ", w.size);
      const atual = linhas[linhas.length - 1];
      if (atual.length && usado + espaco + largura > LARGURA) {
        linhas.push([w]);
        usado = largura;
      } else {
        usado += (atual.length ? espaco : 0) + largura;
        atual.push(w);
      }
    }
    if (linhas.length <= MAX_LINHAS) break;
  }

  linhas.forEach((linha, i) => {
    const ultima = i === linhas.length - 1;
    const larguras = linha.map((w) => w.font.widthOfTextAtSize(w.t, w.size));
    const espacos = linha.map((w) => w.font.widthOfTextAtSize(" ", w.size));
    const natural = larguras.reduce((a, b) => a + b, 0) + espacos.slice(0, -1).reduce((a, b) => a + b, 0);
    const extra = !ultima && linha.length > 1 ? (LARGURA - natural) / (linha.length - 1) : 0;
    const topo = TOPO + i * ALTURA_LINHA;
    page.drawRectangle({
      x: X0,
      y: h - (topo + ALTURA_LINHA) + 0.3,
      width: ultima ? natural : LARGURA,
      height: ALTURA_LINHA,
      color: AMARELO,
    });
    let x = X0;
    linha.forEach((w, j) => {
      page.drawText(w.t, { x, y: h - (topo + 9), size: w.size, font: w.font, color: w.cor });
      x += larguras[j] + espacos[j] + extra;
    });
  });
}

type Fontes = { bold: PDFFont; regular: PDFFont; boldItalic: PDFFont; helvBold: PDFFont };

// aplica, sobre as 4 páginas de uma ficha, os textos que mudam
function aplicarFicha(pages: PDFPage[], numero: number, opcoes: Opcoes, f: Fontes) {
  const { missao, data, saida, encerramento } = opcoes;
  const { bold, regular, boldItalic, helvBold } = f;
  const [p1, p2, p3, p4] = pages;
  const nFicha = String(numero).padStart(3, "0");
  const m = `${missao}º`;

  // página 1: título e data
  trocarLinhaCentralizada(p1, { x0: 213.84, y0: 65.95, x1: 381.42, y1: 83.08 }, `${m} ACAMPAMENTO SÊNIOR`, bold, 14);
  trocarLinhaCentralizada(p1, { x0: 218.16, y0: 83.14, x1: 377.32, y1: 97.78 }, data, regular, 11);
  // página 2: "Uso de Imagem dos participantes do Nº Acampamento Sênior."
  trocarLinhaCentralizada(
    p2,
    { x0: 133.92, y0: 594.59, x1: 455.86, y1: 607.87 },
    `Uso de Imagem dos participantes do ${m} Acampamento Sênior.`,
    bold,
    11.5,
  );
  // página 3: linha do anexo de medicações
  trocarLinhaCentralizada(p3, { x0: 131.04, y0: 64.48, x1: 464.52, y1: 78.19 }, `${m} ACAMPAMENTO SÊNIOR – ${data}.`, boldItalic, 12.5);

  // página 2: observação com valor, PIX e contato do financeiro
  desenharObservacao(p2, opcoes, { timesBold: bold, times: regular, helvBold });
  // página 3: lembrete das medicações cita o dia da saída
  const ddmm = saida.split("-").reverse().slice(0, 2).join("/");
  trocarLinhaCentralizada(p3, { x0: 53.9, y0: 726.2, x1: 503.5, y1: 739.5 }, `· As medicações deverão estar em mãos na chegada no salão da Igreja Matriz no dia ${ddmm}.`, boldItalic, 12, BRANCO, "esquerda");
  // página 4: horário de saída e encerramento (caixas azuis)
  trocarLinhaCentralizada(
    p4,
    { x0: 103.3, y0: 453.1, x1: 493.5, y1: 466.5 },
    `Horário de saída no dia ${dataComDiaSemana(saida)}, às 07:30 da manhã,`,
    helvBold,
    12,
    AZUL_CAIXA,
  );
  trocarLinhaCentralizada(
    p4,
    { x0: 46.6, y0: 594.5, x1: 543.5, y1: 607.9 },
    `O Encerramento do Acampamento será no dia ${dataComDiaSemana(encerramento)} às 17:30, no Salão`,
    helvBold,
    12,
    AZUL_CAIXA,
  );

  // número da ficha nas 4 páginas
  [p1, p2, p3, p4].forEach((page, i) => {
    const c = NUM_FICHA[i];
    cobrir(page, c, 2);
    const size = 24;
    const w = bold.widthOfTextAtSize(nFicha, size);
    page.drawText(nFicha, { x: (c.x0 + c.x1) / 2 - w / 2, y: page.getHeight() - c.y1 + 5, size, font: bold, color: PRETO });
  });
}

/**
 * Gera UM PDF com as fichas dos números pedidos (4 páginas cada, em sequência).
 * O modelo é embutido uma só vez e reaproveitado, então o arquivo fica leve
 * (~1 MB + poucos KB por ficha) em vez de 1 MB por ficha.
 */
export async function gerarFichasPdf(modelo: Uint8Array, opcoes: Opcoes, numeros: number[]) {
  const doc = await PDFDocument.create();
  const fontes: Fontes = {
    bold: await doc.embedFont(StandardFonts.TimesRomanBold),
    regular: await doc.embedFont(StandardFonts.TimesRoman),
    boldItalic: await doc.embedFont(StandardFonts.TimesRomanBoldItalic),
    helvBold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const origem = await PDFDocument.load(modelo);
  const tamanhos = origem.getPages().map((p) => p.getSize());
  const embutidas = await doc.embedPdf(origem, [0, 1, 2, 3]);
  for (const n of numeros) {
    const pages = embutidas.map((e, i) => {
      const page = doc.addPage([tamanhos[i].width, tamanhos[i].height]);
      page.drawPage(e, { x: 0, y: 0, width: tamanhos[i].width, height: tamanhos[i].height });
      return page;
    });
    aplicarFicha(pages, n, opcoes, fontes);
  }
  return doc.save();
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// "2026-04-29" + "2026-05-03" → "29 de abril a 03 de maio de 2026" (campo `data` de Opcoes)
export function textoPeriodo(ini: string, fim: string) {
  const [ai, mi, di] = ini.split("-");
  const [af, mf, df] = fim.split("-");
  const mesI = MESES[Number(mi) - 1];
  const mesF = MESES[Number(mf) - 1];
  if (ai === af) return `${di} de ${mesI} a ${df} de ${mesF} de ${af}`;
  return `${di} de ${mesI} de ${ai} a ${df} de ${mesF} de ${af}`;
}

// Validação dos dados da ficha; devolve mensagem de erro ou null.
export function validarEntrada(q: Opcoes): string | null {
  const dataOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
  if (!dataOk(q.saida) || !dataOk(q.encerramento) || !(q.valor > 0 && q.valor < 100000) || !q.pix || !q.contato || q.pix.length > 120 || q.contato.length > 120)
    return "Informe saída, encerramento, valor, PIX e contato.";
  if (!/^\d{1,3}$/.test(q.missao) || !q.data || q.data.length > 80) return "Dados inválidos.";
  return null;
}
