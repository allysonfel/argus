// Gravação de clipes no navegador: o canvas (vídeo + marcações) vira um
// arquivo de vídeo com MediaRecorder. MP4 quando o navegador grava MP4
// (Chrome recente, Safari); senão WebM.

export function formatoGravacao(): { mime: string; ext: 'mp4' | 'webm' } {
  const opcoes: [string, 'mp4' | 'webm'][] = [
    ['video/mp4;codecs=avc1', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm', 'webm'],
  ];
  for (const [mime, ext] of opcoes) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return { mime: '', ext: 'webm' };
}

export function podeGravar(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;
}

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Baixa um arquivo de outro domínio (o atributo download só vale no mesmo domínio). */
export async function baixarUrl(url: string, nome: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  baixarBlob(await r.blob(), nome);
}

/** Começa a gravar o canvas; `parar()` devolve o arquivo. */
export function gravarCanvas(canvas: HTMLCanvasElement, fps = 30): { parar: () => Promise<Blob>; ext: string } {
  const { mime, ext } = formatoGravacao();
  const stream = canvas.captureStream(fps);
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 5_000_000 });
  const partes: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
  rec.start(500);
  return {
    ext,
    parar: () =>
      new Promise((ok) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          ok(new Blob(partes, { type: mime || 'video/webm' }));
        };
        rec.stop();
      }),
  };
}

/** Nome de arquivo seguro: "argus-cam-01-praca-central-0m52s.mp4". */
export function nomeArquivo(partes: (string | number)[], ext: string): string {
  const base = partes
    .map((p) => String(p))
    .join('-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `argus-${base}.${ext}`;
}

export const fmtArquivoTempo = (s: number) => `${Math.floor(s / 60)}m${String(Math.floor(s % 60)).padStart(2, '0')}s`;
