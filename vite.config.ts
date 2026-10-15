import { createReadStream, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const require = createRequire(import.meta.url)
const pkgDir = (name: string) => path.dirname(require.resolve(`${name}/package.json`))

/** Runtime files fetched on demand, served from our own origin instead of a CDN. */
const VENDOR_ASSETS: Array<{ url: string; dir: string; include: (file: string) => boolean }> = [
  // pdf.js: standard-14 fonts, CJK cmaps, JPX/JBIG2/ICC decoders.
  ...['standard_fonts', 'cmaps', 'wasm', 'iccs'].map((sub) => ({
    url: `pdfjs/${sub}`,
    dir: path.join(pkgDir('pdfjs-dist'), sub),
    include: () => true,
  })),
  // Tesseract (OCR) worker and LSTM engine builds; loaded only when OCR runs.
  { url: 'tesseract', dir: path.join(pkgDir('tesseract.js'), 'dist'), include: (f) => f === 'worker.min.js' },
  { url: 'tesseract/core', dir: pkgDir('tesseract.js-core'), include: (f) => /^tesseract-core.*lstm\.wasm\.js$/.test(f) },
]

const CONTENT_TYPES: Record<string, string> = { '.wasm': 'application/wasm', '.js': 'text/javascript' }

/** Serves (dev) and emits (build) VENDOR_ASSETS under `<base><url>/`. */
function vendorAssets(): Plugin {
  return {
    name: 'pdfoid:vendor-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const reqPath = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '')
        for (const asset of VENDOR_ASSETS) {
          if (!reqPath.startsWith(`${asset.url}/`)) continue
          const name = reqPath.slice(asset.url.length + 1)
          if (name.includes('/') || !asset.include(name)) continue
          const file = path.join(asset.dir, name)
          if (!statSync(file, { throwIfNoEntry: false })?.isFile()) continue
          const type = CONTENT_TYPES[path.extname(file)]
          if (type) res.setHeader('Content-Type', type)
          createReadStream(file).pipe(res)
          return
        }
        next()
      })
    },
    generateBundle() {
      for (const asset of VENDOR_ASSETS) {
        for (const name of readdirSync(asset.dir).filter(asset.include)) {
          this.emitFile({ type: 'asset', fileName: `${asset.url}/${name}`, source: readFileSync(path.join(asset.dir, name)) })
        }
      }
    },
  }
}

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/pdfoid/' : '/',
  plugins: [react(), tailwindcss(), vendorAssets()],
  server: {
    port: 5173,
  },
  build: {
    // pdf-lib and pdf.js are large by nature; they are split into their own chunks.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'pdf-lib', test: /node_modules[\\/](@cantoo[\\/])?pdf-lib/ },
            { name: 'pdfjs', test: /node_modules[\\/]pdfjs-dist/ },
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
})
