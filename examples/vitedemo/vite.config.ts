import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'aac-processors': path.resolve(__dirname, '../../src/index.browser.ts'),
      stream: path.resolve(__dirname, 'node_modules/stream-browserify'),
      events: path.resolve(__dirname, 'node_modules/events'),
      timers: path.resolve(__dirname, 'node_modules/timers-browserify'),
      util: path.resolve(__dirname, 'node_modules/util')
    }
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
