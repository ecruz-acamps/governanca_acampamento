import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { LOGO_PNG_B64 } from '@/lib/logo-b64';

export const ENTIDADE = 'Associação dos Campistas São Padre Pio';
const A4: [number, number] = [595.28, 841.89];
const M = { l: 62, r: 62, t: 64, b: 64 };

/** As fontes padrão do PDF só aceitam Latin-1/WinAnsi: troca o que não couber. */
export function limpar(t: string): string {
  return t
    .replace(/[  ]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[→]/g, '->')
    .replace(/[^\x09\x0a\x20-\x7e¡-ÿ–—•€]/g, '?');
}

export class Doc {
  private pdf!: PDFDocument;
  private page!: PDFPage;
  private serif!: PDFFont;
  private serifB!: PDFFont;
  private sans!: PDFFont;
  private sansB!: PDFFont;
  private logo: PDFImage | null = null;
  private y = 0;
  private n = 0;

  constructor(private titulo: string, private rodape: string) {}

  static async criar(titulo: string, rodape: string): Promise<Doc> {
    const d = new Doc(titulo, rodape);
    d.pdf = await PDFDocument.create();
    d.pdf.setTitle(limpar(titulo));
    d.pdf.setAuthor(limpar(ENTIDADE));
    d.pdf.setCreator('Governança');
    d.serif = await d.pdf.embedFont(StandardFonts.TimesRoman);
    d.serifB = await d.pdf.embedFont(StandardFonts.TimesRomanBold);
    d.sans = await d.pdf.embedFont(StandardFonts.Helvetica);
    d.sansB = await d.pdf.embedFont(StandardFonts.HelveticaBold);
    try { d.logo = await d.pdf.embedPng(Buffer.from(LOGO_PNG_B64, 'base64')); } catch { d.logo = null; }
    d.nova();
    return d;
  }

  private get largura() { return A4[0] - M.l - M.r; }

  private nova() {
    this.page = this.pdf.addPage(A4);
    this.n++;
    this.y = A4[1] - M.t;
  }

  private garantir(h: number) {
    if (this.y - h < M.b) this.nova();
  }

  private quebrar(texto: string, fonte: PDFFont, tam: number, larg: number): string[] {
    const out: string[] = [];
    for (const par of limpar(texto).split('\n')) {
      if (par.trim() === '') { out.push(''); continue; }
      let linha = '';
      for (const p of par.split(/\s+/)) {
        const teste = linha ? linha + ' ' + p : p;
        if (fonte.widthOfTextAtSize(teste, tam) <= larg) linha = teste;
        else { if (linha) out.push(linha); linha = p; }
      }
      out.push(linha);
    }
    return out;
  }

  /** Cabeçalho institucional centralizado. */
  cabecalho(sub?: string) {
    if (this.logo) {
      const t = 54;
      this.page.drawImage(this.logo, { x: (A4[0] - t) / 2, y: this.y - t + 12, width: t, height: t });
      this.y -= t + 2;
    }
    this.centro(ENTIDADE.toUpperCase(), this.serifB, 13);
    if (sub) this.centro(sub, this.serif, 10);
    this.y -= 4;
    this.page.drawLine({ start: { x: M.l, y: this.y }, end: { x: A4[0] - M.r, y: this.y }, thickness: 0.8, color: rgb(0.2, 0.2, 0.2) });
    this.y -= 22;
  }

  private centro(t: string, f: PDFFont, tam: number) {
    this.garantir(tam + 6);
    const s = limpar(t);
    const w = f.widthOfTextAtSize(s, tam);
    this.page.drawText(s, { x: (A4[0] - w) / 2, y: this.y, size: tam, font: f });
    this.y -= tam + 4;
  }

  titulo1(t: string) {
    this.y -= 4;
    this.centro(t.toUpperCase(), this.serifB, 15);
    this.y -= 10;
  }

  sub(t: string) {
    this.garantir(30);
    this.y -= 8;
    this.page.drawText(limpar(t), { x: M.l, y: this.y, size: 12, font: this.serifB });
    this.y -= 18;
  }

  /** Parágrafo justificado à esquerda, em Times. */
  p(texto: string, opc: { tam?: number; negrito?: boolean; recuo?: number; depois?: number } = {}) {
    const tam = opc.tam ?? 11.5;
    const f = opc.negrito ? this.serifB : this.serif;
    const recuo = opc.recuo ?? 0;
    for (const l of this.quebrar(texto, f, tam, this.largura - recuo)) {
      this.garantir(tam * 1.5);
      if (l) this.page.drawText(l, { x: M.l + recuo, y: this.y, size: tam, font: f });
      this.y -= tam * 1.5;
    }
    this.y -= opc.depois ?? 6;
  }

  item(texto: string) {
    this.p('•  ' + texto, { recuo: 12, depois: 2 });
  }

  espaco(h: number) { this.y -= h; }

  /** Bloco de assinaturas lado a lado. */
  assinaturas(nomes: { nome: string; cargo: string }[]) {
    this.garantir(80);
    this.y -= 36;
    const col = this.largura / Math.min(nomes.length, 2);
    nomes.forEach((s, i) => {
      if (i > 0 && i % 2 === 0) { this.y -= 56; this.garantir(60); }
      const x = M.l + (i % 2) * col;
      this.page.drawLine({ start: { x: x + 8, y: this.y }, end: { x: x + col - 24, y: this.y }, thickness: 0.6, color: rgb(0, 0, 0) });
      this.page.drawText(limpar(s.nome), { x: x + 8, y: this.y - 13, size: 10.5, font: this.serifB });
      this.page.drawText(limpar(s.cargo), { x: x + 8, y: this.y - 26, size: 9.5, font: this.serif });
    });
    this.y -= 44;
  }

  /** Tabela simples em Helvetica; colunas em fração da largura. */
  tabela(cab: string[], linhas: string[][], frac: number[], opc: { direita?: number[] } = {}) {
    const tam = 9.5, pad = 4, alt = tam + 9;
    const ws = frac.map((f) => f * this.largura);
    const direita = new Set(opc.direita ?? []);
    const desenha = (cels: string[], negrito: boolean, fundo?: boolean) => {
      const f = negrito ? this.sansB : this.sans;
      const quebradas = cels.map((c, i) => this.quebrar(c, f, tam, ws[i] - pad * 2));
      const n = Math.max(1, ...quebradas.map((q) => q.length));
      const h = n * (tam + 2.5) + pad * 2;
      this.garantir(h + 2);
      if (fundo) this.page.drawRectangle({ x: M.l, y: this.y - h + pad, width: this.largura, height: h, color: rgb(0.92, 0.92, 0.92) });
      let x = M.l;
      quebradas.forEach((q, i) => {
        q.forEach((l, k) => {
          const w = f.widthOfTextAtSize(l, tam);
          const px = direita.has(i) ? x + ws[i] - pad - w : x + pad;
          this.page.drawText(l, { x: px, y: this.y - tam - k * (tam + 2.5) + 2, size: tam, font: f });
        });
        x += ws[i];
      });
      this.page.drawLine({ start: { x: M.l, y: this.y - h + pad }, end: { x: M.l + this.largura, y: this.y - h + pad }, thickness: 0.3, color: rgb(0.6, 0.6, 0.6) });
      this.y -= h;
    };
    void alt;
    desenha(cab, true, true);
    for (const l of linhas) desenha(l, false);
    this.y -= 8;
  }

  async bytes(): Promise<Uint8Array> {
    const paginas = this.pdf.getPages();
    paginas.forEach((pg, i) => {
      const t = limpar(`${this.rodape}  ·  Página ${i + 1} de ${paginas.length}`);
      const w = this.sans.widthOfTextAtSize(t, 8);
      pg.drawText(t, { x: (A4[0] - w) / 2, y: 30, size: 8, font: this.sans, color: rgb(0.4, 0.4, 0.4) });
    });
    return this.pdf.save();
  }
}

export function respostaPdf(bytes: Uint8Array, nome: string): Response {
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${nome.replace(/[^a-z0-9._-]/gi, '_')}"`,
      'cache-control': 'private, no-store',
    },
  });
}

export function respostaZip(bytes: Uint8Array, nome: string): Response {
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${nome.replace(/[^a-z0-9._-]/gi, '_')}"`,
      'cache-control': 'private, no-store',
    },
  });
}
