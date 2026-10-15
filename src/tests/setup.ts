import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import { GlobalWorkerOptions } from 'pdfjs-dist'

// Real (unmocked) pdf.js runs a fake worker in Node; point it at the file on disk.
GlobalWorkerOptions.workerSrc = import.meta.resolve('pdfjs-dist/build/pdf.worker.min.mjs')
;(globalThis as { __PDFJS_ASSET_BASE__?: string }).__PDFJS_ASSET_BASE__ =
    new URL('.', import.meta.resolve('pdfjs-dist/package.json')).pathname

// Node 25+ exposes its own `localStorage` global (a method-less stub unless
// --localstorage-file is set), which shadows jsdom's. Swap in a working one.
class MemoryStorage implements Storage {
    private store = new Map<string, string>()
    get length() { return this.store.size }
    clear() { this.store.clear() }
    getItem(key: string) { return this.store.get(key) ?? null }
    key(index: number) { return [...this.store.keys()][index] ?? null }
    removeItem(key: string) { this.store.delete(key) }
    setItem(key: string, value: string) { this.store.set(key, String(value)) }
}
for (const name of ['localStorage', 'sessionStorage'] as const) {
    if (typeof globalThis[name]?.setItem !== 'function') {
        vi.stubGlobal(name, new MemoryStorage())
    }
}

// Global mocks
const ResizeObserverMock = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}))
vi.stubGlobal('ResizeObserver', ResizeObserverMock)

vi.stubGlobal('indexedDB', {
    open: vi.fn(() => ({
        result: {
            createObjectStore: vi.fn(),
            transaction: vi.fn(() => ({
                objectStore: vi.fn(() => ({
                    put: vi.fn(() => ({
                        set onsuccess(cb: any) { setTimeout(() => cb({ target: { result: 'id' } }), 0) },
                        set onerror(cb: any) { },
                    })),
                    getAll: vi.fn(() => ({
                        set onsuccess(cb: any) { setTimeout(() => cb({ target: { result: [] } }), 0) }
                    })),
                })),
            })),
        },
        set onsuccess(cb: any) { setTimeout(() => cb({ target: { result: this.result } }), 0) },
        set onupgradeneeded(cb: any) { },
    })),
})
