import { createReadStream, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const require = createRequire(import.meta.url)
const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'))
// Data pdf.js fetches at runtime: standard-14 fonts, CJK cmaps, JPX/ICC decoders.
const PDFJS_ASSET_DIRS = ['standard_fonts', 'cmaps', 'wasm', 'iccs']

/** Serves (dev) and emits (build) pdf.js runtime data under `<base>pdfjs/`. */
function pdfjsAssets(): Plugin {
  return {
    name: 'pdfoid:pdfjs-assets',
    configureServer(server) {
      server.middlewares.use('/pdfjs', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '')
        const file = path.resolve(pdfjsRoot, rel)
        const allowed = PDFJS_ASSET_DIRS.some((dir) => file.startsWith(path.join(pdfjsRoot, dir) + path.sep))
        if (!allowed || !statSync(file, { throwIfNoEntry: false })?.isFile()) return next()
        if (file.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm')
        createReadStream(file).pipe(res)
      })
    },
    generateBundle() {
      for (const dir of PDFJS_ASSET_DIRS) {
        for (const name of readdirSync(path.join(pdfjsRoot, dir))) {
          this.emitFile({
            type: 'asset',
            fileName: `pdfjs/${dir}/${name}`,
            source: readFileSync(path.join(pdfjsRoot, dir, name)),
          })
        }
      }
    },
  }
}

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/pdfoid/' : '/',
  plugins: [react(), tailwindcss(), pdfjsAssets()],
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
