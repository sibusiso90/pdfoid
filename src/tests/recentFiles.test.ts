import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { listRecent, loadRecent, MAX_RECENT_FILES, MAX_RECENT_FILE_BYTES, removeRecent, saveRecent } from '../utils/recentFiles'

describe('recentFiles', () => {
  beforeEach(() => {
    // setup.ts stubs indexedDB with a minimal mock; use a real in-memory one here.
    vi.stubGlobal('indexedDB', new IDBFactory())
  })

  it('lists newest first and round-trips bytes', async () => {
    await saveRecent({ id: 'a', name: 'a.pdf', bytes: new Uint8Array([1, 2]), updatedAt: 1 })
    await saveRecent({ id: 'b', name: 'b.pdf', bytes: new Uint8Array([3]), updatedAt: 2 })
    expect((await listRecent()).map((r) => r.id)).toEqual(['b', 'a'])
    const loaded = await loadRecent('a')
    expect(loaded?.name).toBe('a.pdf')
    expect(Array.from(loaded?.bytes ?? [])).toEqual([1, 2])
  })

  it('updates an existing entry in place', async () => {
    await saveRecent({ id: 'a', name: 'a.pdf', bytes: new Uint8Array([1]), updatedAt: 1 })
    await saveRecent({ id: 'a', name: 'a.pdf', bytes: new Uint8Array([9, 9]), updatedAt: 5 })
    expect(await listRecent()).toEqual([{ id: 'a', name: 'a.pdf', size: 2, updatedAt: 5 }])
  })

  it(`keeps only the ${MAX_RECENT_FILES} most recent, evicting the oldest`, async () => {
    for (let i = 1; i <= MAX_RECENT_FILES + 1; i++) {
      await saveRecent({ id: `f${i}`, name: `f${i}.pdf`, bytes: new Uint8Array([i]), updatedAt: i })
    }
    const ids = (await listRecent()).map((r) => r.id)
    expect(ids).toHaveLength(MAX_RECENT_FILES)
    expect(ids).not.toContain('f1')
    expect(ids[0]).toBe(`f${MAX_RECENT_FILES + 1}`)
  })

  it('refuses files over the size limit and removes entries', async () => {
    const huge = { byteLength: MAX_RECENT_FILE_BYTES + 1 } as Uint8Array
    expect(await saveRecent({ id: 'big', name: 'big.pdf', bytes: huge })).toBe(false)
    await saveRecent({ id: 'a', name: 'a.pdf', bytes: new Uint8Array([1]) })
    await removeRecent('a')
    expect(await listRecent()).toEqual([])
    expect(await loadRecent('a')).toBeNull()
  })
})
