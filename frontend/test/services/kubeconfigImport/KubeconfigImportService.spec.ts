import { beforeEach, describe, expect, it } from 'vitest'
import { KubeconfigImportService } from '@/application/services/kubeconfigImport/KubeconfigImportService'
import { PastedKubeconfig } from '@/application/services/kubeconfigImport/models/PastedKubeconfig'
import { ApiError } from '@/domain/errors/ApiError'
import type { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import type { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'

const kubeconfig = [
    'apiVersion: v1',
    'kind: Config',
    'current-context: staging',
    'clusters:',
    '  - name: staging',
    '    cluster:',
    '      server: https://staging.example.invalid:6443',
    'contexts:',
    '  - name: staging',
    '    context:',
    '      cluster: staging',
    '      user: staging-admin',
].join('\n')

const host = (root: string) => ({
    absolutePath: async (path: string) => (root === '' ? '' : `${root}/${path.split(':')[1]}`),
}) as HostShellAdapter

let files: MemoryFileTransport

const service = (root = 'C:/Users/tester/AppData/Roaming/kubiq') =>
    new KubeconfigImportService(files as unknown as FileSystemTransport, host(root))

describe('KubeconfigImportService', () => {
    beforeEach(() => {
        files = new MemoryFileTransport()
    })

    it('writes the pasted config into the app data folder and answers with its absolute path', async () => {
        const path = await service().save(kubeconfig)

        expect(path).toMatch(/^C:\/Users\/tester\/AppData\/Roaming\/kubiq\/kubeconfigs\/staging-[0-9a-z]+\.yaml$/)
    })

    it('stores the text exactly as it was pasted', async () => {
        await service().save(kubeconfig)

        expect([...files.files.values()]).toEqual([kubeconfig])
    })

    it('writes once for a config pasted twice', async () => {
        await service().save(kubeconfig)
        await service().save(kubeconfig)

        expect(files.files.size).toBe(1)
    })

    it('refuses text that is not a kubeconfig before writing anything', async () => {
        const failure = await service().save('apiVersion: v1').catch(err => err)

        expect(failure).toBeInstanceOf(ApiError)
        expect((failure as ApiError).message).toContain('A kubeconfig lists clusters and contexts')
        expect(files.writes).toBe(0)
    })

    it('refuses an empty paste', async () => {
        const failure = await service().save('  ').catch(err => err)

        expect((failure as ApiError).message).toBe(PastedKubeconfig.empty)
    })

    it('says so when the path cannot be resolved, rather than handing back a path that is not one', async () => {
        const failure = await service('').save(kubeconfig).catch(err => err)

        expect(failure).toBeInstanceOf(ApiError)
        expect((failure as ApiError).message).toBe(KubeconfigImportService.unsaved)
    })

    it('never puts the pasted text in what it reports', async () => {
        const failure = await service('').save(kubeconfig).catch(err => err)

        expect(`${(failure as ApiError).message} ${(failure as ApiError).details}`).not.toContain('staging.example.invalid')
    })
})
