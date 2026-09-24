import { beforeEach, describe, expect, it } from 'vitest'
import { KubeconfigFileEntity } from '@/domain/entities/kubeconfig'
import { KubeconfigEntityContext } from '@/infrastructure/entityRepo/kubeconfig/KubeconfigEntityContext'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { EntityRepo } from '@iappx/entity-repo'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'

const FOLDER = '/home/tester/.kube'

let transport: MemoryFileTransport
let context: KubeconfigEntityContext

describe('KubeconfigFileQuery', () => {
    beforeEach(() => {
        transport = new MemoryFileTransport()
        context = EntityRepo.create()
            .use(KubeconfigEntityContext, transport as unknown as FileSystemTransport)
            .getContext(KubeconfigEntityContext)
    })

    it('lists what a folder holds as entities', async () => {
        transport.files.set(`${FOLDER}/config`, 'apiVersion: v1\n')
        transport.files.set(`${FOLDER}/cache/discovery`, '{}')
        transport.touch(`${FOLDER}/config`, 1700000000000)

        const entries = await context.inFolder(FOLDER).getAll()

        expect(entries.every(entry => entry instanceof KubeconfigFileEntity)).toBe(true)
        expect(entries.map(entry => [entry.name, entry.isDirectory])).toEqual([['config', false], ['cache', true]])
        expect(entries[0].path).toBe(`${FOLDER}/config`)
        expect(entries[0].size).toBe(15)
        expect(entries[0].modifiedAt).toBe(1700000000000)
    })

    it('lists nothing for a folder that is not there', async () => {
        await expect(context.inFolder('/home/tester/nowhere').getAll()).resolves.toEqual([])
    })

    it('refuses to list without being told which folder', async () => {
        await expect(context.files.getAll()).rejects.toThrow('inFolder')
    })

    it('describes one path, file or folder', async () => {
        transport.files.set(`${FOLDER}/config`, 'apiVersion: v1\n')

        expect((await context.files.getById(`${FOLDER}/config`))?.isDirectory).toBe(false)
        expect((await context.files.getById(FOLDER))?.isDirectory).toBe(true)
        await expect(context.files.getById(`${FOLDER}/gone`)).resolves.toBeNull()
    })
})
