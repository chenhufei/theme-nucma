import { defineConfig } from 'vite'
import { build as esbuild } from 'esbuild'
import { resolve } from 'path'
import { existsSync, copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
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
        // 分包文件名带 hash，逐个删除会让上一轮的死分包留在包里，只能整目录重建。
        rmSync(resolve(rootDir, 'templates/assets/js'), { recursive: true, force: true })
        rmSync(resolve(rootDir, 'templates/assets/fonts/KuaiKanShiJieTi.woff2'), { force: true })
        rmSync(resolve(rootDir, 'templates/assets/data'), { recursive: true, force: true })
        rmSync(resolve(rootDir, 'templates/assets/err404'), { recursive: true, force: true })
        rmSync(resolve(rootDir, 'templates/assets/auth'), { recursive: true, force: true })
        rmSync(resolve(rootDir, 'templates/assets/build-info.json'), { force: true })
      },
      closeBundle: async () => {
        const jsSrc = resolve(rootDir, 'src/js/main.js')
        const membersSrc = resolve(rootDir, 'src/js/members.js')
        const linksSrc = resolve(rootDir, 'src/js/links.js')
        const claimSrc = resolve(rootDir, 'src/js/claim.js')
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
        const pageEntries = [membersSrc, linksSrc, claimSrc].filter(existsSync)
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
        // 静态数据资产：地图 JSON 体积较大，走运行时按需请求，不打进 JS 包。
        const dataSrc = resolve(rootDir, 'src/data')
        if (existsSync(dataSrc)) {
          const dataOut = resolve(rootDir, 'templates/assets/data')
          mkdirSync(dataOut, { recursive: true })
          for (const file of readdirSync(dataSrc)) {
            if (!file.endsWith('.json')) continue
            copyFileSync(resolve(dataSrc, file), resolve(dataOut, file))
          }
        }
        // 404 页专用资源：只在错误页按需加载，不进主包。
        // 源码在 src/err404/，构建时压缩后落到 templates/assets/err404/。
        // 必须 bundle:false —— qrcode.js 是 UMD，包一层 IIFE 会把里面的 this 变成
        // undefined，window.qrcode 就挂不上，工牌二维码整块失效。
        const errDir = resolve(rootDir, 'src/err404')
        if (existsSync(errDir)) {
          const errOut = resolve(rootDir, 'templates/assets/err404')
          mkdirSync(errOut, { recursive: true })
          if (existsSync(resolve(errDir, 'err404.css'))) {
            copyFileSync(resolve(errDir, 'err404.css'), resolve(errOut, 'err404.css'))
          }
          // 插图等二进制资源直接复制（鸭子默认图 26KB，压缩收益抵不过解码成本）
          for (const file of readdirSync(errDir)) {
            if (/\.(png|jpe?g|webp|gif|svg)$/i.test(file)) {
              copyFileSync(resolve(errDir, file), resolve(errOut, file))
            }
          }
          const errJs = ['qrcode.js', 'err404.js'].map((f) => resolve(errDir, f)).filter(existsSync)
          if (errJs.length) {
            await esbuild({
              entryPoints: errJs,
              outdir: errOut,
              bundle: false,
              target: 'es2018',
              minify: true,
              legalComments: 'none',
              logLevel: 'info',
            })
          }
        }
        // 认证页专用样式：只在登录/注册等 gateway 页面按需加载，不进主包。
        // 源文件是手写 CSS（不经过 Tailwind），构建期原样复制到 assets/auth/。
        const authSrc = resolve(rootDir, 'src/auth')
        if (existsSync(resolve(authSrc, 'auth.css'))) {
          const authOut = resolve(rootDir, 'templates/assets/auth')
          mkdirSync(authOut, { recursive: true })
          copyFileSync(resolve(authSrc, 'auth.css'), resolve(authOut, 'auth.css'))
        }
        writeFileSync(
          resolve(rootDir, 'templates/assets/build-info.json'),
          `${JSON.stringify({ theme: packageJson.name, version: packageJson.version, assets: ['css/main.css', 'js/main.js', 'js/members.js', 'js/links.js', 'js/claim.js', 'data/china-provinces.json', 'err404/err404.css', 'err404/err404.js', 'auth/auth.css'] }, null, 2)}\n`,
          'utf8',
        )
        console.log('\nJS bundle completed!')
      },
    },
  ],
})
