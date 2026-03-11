import { defineConfig } from 'vite';
import path from 'path';
import commonjs from 'vite-plugin-commonjs';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    commonjs(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/sql.js/dist/sql-wasm.js',
          dest: 'public'
        }
      ]
    })
  ],
  resolve: {
    alias: [
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
    include: ['@willwade/aac-processors']
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
      ignore: ['crypto', 'stream', 'timers', 'events', 'fs', 'path', 'os'],
      include: [/@willwade\/aac-processors/, /node_modules/]
    }
  }
});
