import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'templates/assets',
    emptyOutDir: false,
    minify: 'esbuild',
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: 'src/input.css',
        'auth-split': 'src/auth-split.css'
      },
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: (assetInfo) => {
          const assetName = assetInfo.names?.[0] || assetInfo.name || '';

          if (assetName.endsWith('.css')) {
            if (assetName.startsWith('auth-split')) {
              return 'css/auth-split.css';
            }
            return 'css/main.css';
          }

          return '[name].[ext]';
        },
        manualChunks: {}
      },
      treeshake: true
    },
    target: 'es2015',
    chunkSizeWarningLimit: 500,
    esbuild: {
      minify: true,
      minifyIdentifiers: true,
      minifySyntax: true,
      minifyWhitespace: true
    }
  },
  optimizeDeps: {
    exclude: ['@types/node'],
    disableDependencyOptimization: true
  },
  server: {
    port: 3000,
    open: false
  }
});
