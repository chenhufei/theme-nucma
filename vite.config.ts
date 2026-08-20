import { defineConfig } from 'vite'
import { build as esbuild } from 'esbuild'
import { resolve } from 'path'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import packageJson from './package.json' with { type: 'json' }

const rootDir = import.meta.dirname

export default defineConfig({
  base: './',
  build: {
    outDir: 'templates/assets',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'src/css/main.css'),
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
      buildStart: () => {
        rmSync(resolve(rootDir, 'templates/assets/css/main.css'), { force: true })
        rmSync(resolve(rootDir, 'templates/assets/js/main.js'), { force: true })
        rmSync(resolve(rootDir, 'templates/assets/js/members.js'), { force: true })
        rmSync(resolve(rootDir, 'templates/assets/js/links.js'), { force: true })
        rmSync(resolve(rootDir, 'templates/assets/js/chunks'), { recursive: true, force: true })
        rmSync(resolve(rootDir, 'templates/assets/fonts/KuaiKanShiJieTi.woff2'), { force: true })
        rmSync(resolve(rootDir, 'templates/assets/build-info.json'), { force: true })
      },
      closeBundle: async () => {
        const jsSrc = resolve(rootDir, 'src/js/main.js')
        const membersSrc = resolve(rootDir, 'src/js/members.js')
        const linksSrc = resolve(rootDir, 'src/js/links.js')
        const outDir = resolve(rootDir, 'templates/assets/js')
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
        const pageEntries = [membersSrc, linksSrc].filter(existsSync)
        if (pageEntries.length) {
          await esbuild({
            entryPoints: pageEntries,
            bundle: true,
            outdir: outDir,
            format: 'esm',
            splitting: true,
            entryNames: '[name]',
            chunkNames: 'chunks/[name]-[hash]',
            target: 'es2018',
            minify: true,
            legalComments: 'none',
            logLevel: 'info',
          })
        }
        writeFileSync(
          resolve(rootDir, 'templates/assets/build-info.json'),
          `${JSON.stringify({ theme: packageJson.name, version: packageJson.version, assets: ['css/main.css', 'js/main.js', 'js/members.js', 'js/links.js'] }, null, 2)}\n`,
          'utf8',
        )
        console.log('\nJS bundle completed!')
      },
    },
  ],
})
