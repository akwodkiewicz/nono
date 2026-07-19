import { PSM, createWorker, type Worker } from 'tesseract.js';

// Jeden współdzielony worker Tesseracta: inicjalizacja (pobranie WASM
// i danych językowych) trwa kilka sekund, więc robimy ją raz i leniwie.
let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  workerPromise ??= (async () => {
    // Ścieżki lokalne (kopiowane do dist w vite.config.ts) zamiast CDN —
    // OCR działa offline i bez wysyłania czegokolwiek na zewnątrz.
    const base = import.meta.env.BASE_URL;
    const worker = await createWorker('eng', undefined, {
      workerPath: `${base}tesseract/worker.min.js`,
      corePath: `${base}tesseract/core`,
      langPath: `${base}tesseract/lang`,
    });
    await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
    return worker;
  })();
  return workerPromise;
}

export interface DigitsResult {
  /** Rozpoznana liczba; null gdy OCR nie zwrócił żadnej cyfry. */
  value: number | null;
  /** Pewność 0-100 z Tesseracta. */
  confidence: number;
}

async function recognizeWith(
  worker: Worker,
  canvas: HTMLCanvasElement,
  psm: PSM,
): Promise<DigitsResult> {
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const { data } = await worker.recognize(canvas);
  const text = data.text.replace(/\D/g, '');
  return {
    value: text.length > 0 ? Number.parseInt(text, 10) : null,
    confidence: Math.round(data.confidence),
  };
}

/**
 * Rozpoznaje pojedynczy token (jedną liczbę). Najpierw tryb SINGLE_WORD
 * (obsługuje liczby wielocyfrowe); gdy nie da żadnej cyfry lub jest bardzo
 * niepewny, ponawiamy w SINGLE_CHAR — Tesseract potrafi nie zauważyć
 * samotnej cyfry w trybie słowa, a tryb znaku radzi sobie z nią lepiej.
 */
export async function recognizeDigits(canvas: HTMLCanvasElement): Promise<DigitsResult> {
  const worker = await getWorker();
  const first = await recognizeWith(worker, canvas, PSM.SINGLE_WORD);
  if (first.value !== null && first.confidence >= 40) return first;
  const second = await recognizeWith(worker, canvas, PSM.SINGLE_CHAR);
  if (second.value !== null && (first.value === null || second.confidence > first.confidence)) {
    return second;
  }
  return first;
}
