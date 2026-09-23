import { beforeEach, describe, expect, it } from 'vitest'
import { AppSettings } from '@/domain/models/settings'
import { AppSettingsAdapter } from '@/infrastructure/settings/AppSettingsAdapter'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'

let transport: MemoryFileTransport
let adapter: AppSettingsAdapter

describe('AppSettingsAdapter', () => {
    beforeEach(() => {
        transport = new MemoryFileTransport()
        adapter = new AppSettingsAdapter(transport as unknown as FileSystemTransport)
    })

    it('keeps the document in the user profile, not beside the binary', async () => {
        await adapter.write({ kubectlPath: 'kubectl' })

        expect([...transport.files.keys()]).toEqual(['userdata:settings/app.json'])
    })

    it('reads nothing on a first run', async () => {
        await expect(adapter.read()).resolves.toBeNull()
    })

    it('reads back what it wrote', async () => {
        await adapter.write(AppSettings.serialize({
            kubectlPath: 'C:/tools/kubectl.exe',
            helmPath: '',
            nodeShellImage: '',
            checkForUpdates: false,
            skippedVersion: '0.2.0',
        }))

        await expect(adapter.read()).resolves.toEqual({
            kubectlPath: 'C:/tools/kubectl.exe',
            helmPath: '',
            nodeShellImage: '',
            checkForUpdates: false,
            skippedVersion: '0.2.0',
        })
    })

    it('reads a corrupted file as nothing rather than raising', async () => {
        transport.files.set(AppSettingsAdapter.File, '{ half a doc')

        await expect(adapter.read()).resolves.toBeNull()
        expect(AppSettings.parse(await adapter.read())).toEqual(AppSettings.defaults())
    })

    it('reads a hand-edited file holding the wrong shape as nothing', async () => {
        transport.files.set(AppSettingsAdapter.File, '"kubectlPath=C:/tools"')

        expect(AppSettings.parse(await adapter.read())).toEqual(AppSettings.defaults())
    })
})
