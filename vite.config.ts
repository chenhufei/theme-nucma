import { defineConfig } from 'vite'
import { build as esbuild } from 'esbuild'
import { resolve } from 'path'
import { existsSync, mkdirSync } from 'fs'

export default defineConfig({
  build: {
    outDir: 'templates/assets',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/css/main.css'),
      },
      output: {
        assetFileNames: 'css/[name].[ext]',
        entryFileNames: 'js/[name].js',
      },
    },
  },
  plugins: [
    {
      name: 'build-js',
      apply: 'build',
      closeBundle: async () => {
        const jsSrc = resolve(__dirname, 'src/js/main.js')
        const outDir = resolve(__dirname, 'templates/assets/js')
        if (!existsSync(jsSrc)) return
        mkdirSync(outDir, { recursive: true })
        await esbuild({
          entryPoints: [jsSrc],
          bundle: true,
          outfile: resolve(outDir, 'main.js'),
          format: 'iife',
          target: 'es2018',
          minify: true,
          legalComments: 'none',
          logLevel: 'info',
        })
        console.log('\nJS bundle completed!')
      },
    },
  ],
})