import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Zasoby Tesseracta serwujemy sami (zamiast domyślnego CDN): aplikacja działa
// w pełni offline i nic nie zależy od zewnętrznych serwerów. Pliki są
// kopiowane z node_modules przy budowaniu — nie trzymamy binariów w repo.
const tesseractAssets = [
  { src: 'node_modules/tesseract.js/dist/worker.min.js', dest: 'tesseract', rename: { stripBase: true as const, name: 'worker.min.js' } },
  ...[
    'tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-simd-lstm.wasm',
    'tesseract-core-lstm.wasm.js',
    'tesseract-core-lstm.wasm',
  ].map((file) => ({
    src: `node_modules/tesseract.js-core/${file}`,
    dest: 'tesseract/core',
    rename: { stripBase: true as const, name: file },
  })),
  {
    src: 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
    dest: 'tesseract/lang',
    rename: { stripBase: true as const, name: 'eng.traineddata.gz' },
  },
];

export default defineConfig({
  base: '/nono/',
  plugins: [react(), tailwindcss(), viteStaticCopy({ targets: tesseractAssets })],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
