import { beforeEach, describe, expect, it } from 'vitest'
import type { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { PendingUpdateAdapter } from '@/infrastructure/update/PendingUpdateAdapter'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'

let transport: MemoryFileTransport
let adapter: PendingUpdateAdapter

describe('PendingUpdateAdapter', () => {
    beforeEach(() => {
        transport = new MemoryFileTransport()
        adapter = new PendingUpdateAdapter(transport as unknown as FileSystemTransport)
    })

    it('reads nothing when no update was started', async () => {
        await expect(adapter.read()).resolves.toBeNull()
    })

    it('keeps the pending update in the user profile and reads it back', async () => {
        await adapter.write({ version: '0.2.0', installer: 'userdata:updates/kubiq-installer.exe' })

        expect([...transport.files.keys()]).toEqual(['userdata:updates/pending.json'])
        await expect(adapter.read()).resolves.toEqual({
            version: '0.2.0',
            installer: 'userdata:updates/kubiq-installer.exe',
        })
    })

    it('reads a corrupted or incomplete record as nothing', async () => {
        transport.files.set(PendingUpdateAdapter.File, '{ broken')
        await expect(adapter.read()).resolves.toBeNull()

        transport.seed(PendingUpdateAdapter.File, { installer: 'x' })
        await expect(adapter.read()).resolves.toBeNull()
    })

    it('forgets the record and deletes the installer it is told to', async () => {
        await adapter.write({ version: '0.2.0', installer: 'userdata:updates/a.exe' })

        await adapter.clear()
        await adapter.removeFile('userdata:updates/a.exe')
        await adapter.removeFile('')

        expect(transport.removed).toEqual([PendingUpdateAdapter.File, 'userdata:updates/a.exe'])
        await expect(adapter.read()).resolves.toBeNull()
    })
})
