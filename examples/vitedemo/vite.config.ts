import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^aac-processors\/validation$/,
        replacement: path.resolve(__dirname, '../../src/validation.ts'),
      },
      {
        find: /^aac-processors$/,
        replacement: path.resolve(__dirname, '../../src/index.browser.ts'),
      },
      {
        find: /^stream$/,
        replacement: path.resolve(__dirname, 'node_modules/stream-browserify'),
      },
      {
        find: /^events$/,
        replacement: path.resolve(__dirname, 'node_modules/events'),
      },
      {
        find: /^timers$/,
        replacement: path.resolve(__dirname, 'node_modules/timers-browserify'),
      },
      {
        find: /^util$/,
        replacement: path.resolve(__dirname, 'node_modules/util'),
      },
    ],
  },
  optimizeDeps: {
    exclude: ['aac-processors'],
    include: []
  },
  define: {
    'process.env': '{}',
    'process.version': '"v18.0.0"',
    'process.platform': '"browser"',
    'process.cwd': '(() => "/")',
    'process.browser': 'true',
    'global': 'globalThis'
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    commonjsOptions: {
      // Ignore Node.js built-in modules
      ignore: ['crypto', 'stream', 'timers', 'events', 'fs', 'path', 'os']
    }
  }
});
