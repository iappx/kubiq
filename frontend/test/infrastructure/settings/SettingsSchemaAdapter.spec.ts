import { beforeEach, describe, expect, it } from 'vitest'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { SettingsSchemaAdapter } from '@/infrastructure/settings/SettingsSchemaAdapter'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'

let transport: MemoryFileTransport
let adapter: SettingsSchemaAdapter

describe('SettingsSchemaAdapter', () => {
    beforeEach(() => {
        transport = new MemoryFileTransport()
        adapter = new SettingsSchemaAdapter(transport as unknown as FileSystemTransport)
    })

    it('keeps the stamp in a file of its own so a migration step cannot clobber it', async () => {
        await adapter.write(2)

        expect([...transport.files.keys()]).toEqual(['userdata:settings/schema.json'])
        expect(transport.read(SettingsSchemaAdapter.File)).toEqual({ version: 2 })
    })

    it('reads a first run as version zero', async () => {
        await expect(adapter.read()).resolves.toBe(0)
    })

    it('reads back the stamp it wrote', async () => {
        await adapter.write(4)

        await expect(adapter.read()).resolves.toBe(4)
    })

    it('reads a corrupted stamp as version zero so the history replays', async () => {
        transport.files.set(SettingsSchemaAdapter.File, '{ "version": ')

        await expect(adapter.read()).resolves.toBe(0)
    })

    it('reads a stamp that is not a whole number as version zero', async () => {
        transport.seed(SettingsSchemaAdapter.File, { version: 'two' })

        await expect(adapter.read()).resolves.toBe(0)
    })
})
