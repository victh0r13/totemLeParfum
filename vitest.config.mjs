import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Os testes cobrem a lógica pura do totem (filtros, quiz, formatação, notas
 * olfativas e a montagem do catálogo) — nada que dependa de React Native.
 * Por isso rodam em Node puro, sem jsdom nem preset de RN: são rápidos e não
 * quebram quando o Expo sobe de versão.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
