import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeconfigContextEntity } from '@/domain/entities/kubeconfig'
import { KubeconfigEntityQuery } from '@/infrastructure/entityRepo/kubeconfig/KubeconfigEntityQuery'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'
import { KubeconfigFixtures } from '../../support/fixtures/KubeconfigFixtures'

const FILE = 'C:/Users/tester/.kube/config'

let transport: MemoryFileTransport
let query: KubeconfigEntityQuery

const failure = async (action: () => Promise<unknown>): Promise<ApiError> => {
    let caught: unknown
    try {
        await action()
    } catch (err) {
        caught = err
    }
    expect(caught).toBeInstanceOf(ApiError)
    return caught as ApiError
}

describe('KubeconfigEntityQuery', () => {
    beforeEach(() => {
        transport = new MemoryFileTransport()
        query = new KubeconfigEntityQuery(
            KubeconfigContextEntity,
            transport as unknown as FileSystemTransport,
            { file: FILE },
        )
    })

    it('treats an absent file as an empty configuration', async () => {
        await expect(query.getAll()).resolves.toEqual([])
        await expect(query.getCurrentContextName()).resolves.toBe('')
        await expect(query.getClusters()).resolves.toEqual([])
    })

    it('treats an empty file as an empty configuration', async () => {
        transport.files.set(FILE, '   \n')

        await expect(query.getAll()).resolves.toEqual([])
    })

    it('builds every named context of the file', async () => {
        transport.files.set(FILE, KubeconfigFixtures.primary())

        const contexts = await query.getAll()

        expect(contexts.map(context => context.name)).toEqual(['prod', 'staging', 'shared'])
        expect(contexts.every(context => context.filePath === FILE)).toBe(true)
    })

    it('puts the cluster and the user of the same file into the context', async () => {
        transport.files.set(FILE, KubeconfigFixtures.primary())

        const [prod] = await query.getAll()

        expect(prod.cluster.server).toBe('https://prod.example.internal:6443')
        expect(prod.cluster.filePath).toBe(FILE)
        expect(prod.user.name).toBe('prod-admin')
        expect(prod.authType).toBe('clientCertificate')
        expect(prod.namespace).toBe('payments')
    })

    it('leaves the cluster out when the file does not declare it', async () => {
        transport.files.set(FILE, KubeconfigFixtures.primary())

        const shared = await query.getById('shared')

        expect(shared?.clusterName).toBe('shared')
        expect(shared?.cluster).toBeUndefined()
    })

    it('reads the cluster flags kubectl allows', async () => {
        transport.files.set(FILE, KubeconfigFixtures.primary())

        const clusters = await query.getClusters()
        const staging = clusters.find(cluster => cluster.name === 'staging')

        expect(staging?.insecureSkipTlsVerify).toBe(true)
        expect(staging?.tlsServerName).toBe('staging.internal')
        expect(staging?.proxyUrl).toBe('http://proxy.example.internal:3128')
    })

    it('reads the users of the file', async () => {
        transport.files.set(FILE, KubeconfigFixtures.primary())

        const users = await query.getUsers()

        expect(users.map(user => user.name)).toEqual(['prod-admin', 'staging-token'])
        expect(users[1].token).toBe(KubeconfigFixtures.stagingToken)
    })

    it('recognises the plugin entries without pretending to support them', async () => {
        transport.files.set(FILE, KubeconfigFixtures.withPlugins())

        const users = await query.getUsers()

        expect(users.find(user => user.name === 'exec-user')?.usesExec).toBe(true)
        expect(users.find(user => user.name === 'oidc-user')?.usesAuthProvider).toBe(true)
    })

    it('reports the current context of the file', async () => {
        transport.files.set(FILE, KubeconfigFixtures.primary())

        await expect(query.getCurrentContextName()).resolves.toBe('prod')
    })

    it('finds nothing for an unknown context name', async () => {
        transport.files.set(FILE, KubeconfigFixtures.primary())

        await expect(query.getById('nope')).resolves.toBeNull()
    })

    it('raises an ApiError for a file that is not valid yaml', async () => {
        transport.files.set(FILE, KubeconfigFixtures.broken())

        const error = await failure(() => query.getAll())

        expect(error.details).toContain(FILE)
        expect(error.details).toContain('line')
    })

    it('keeps the contents of a broken file out of the error', async () => {
        transport.files.set(FILE, KubeconfigFixtures.broken())

        const error = await failure(() => query.getAll())

        expect(`${error.message} ${error.details}`).not.toContain('fake-broken-token')
    })

    it('raises an ApiError when the document is not a kubeconfig', async () => {
        transport.files.set(FILE, '- prod\n- staging\n')

        const error = await failure(() => query.getAll())

        expect(error.details).toContain('kubeconfig document was expected')
    })

    it('resolves a relative credential file against the folder of the kubeconfig', async () => {
        transport.files.set('C:/Users/tester/.kube/pki/ca.pem', KubeconfigFixtures.caPem)

        await expect(query.readCredentialFile('pki/ca.pem')).resolves.toBe(KubeconfigFixtures.caPem)
    })

    it('leaves an absolute credential path alone', async () => {
        transport.files.set('/etc/kubiq/client.key', KubeconfigFixtures.clientKeyPem)
        transport.files.set('D:\\kubiq\\client.crt', KubeconfigFixtures.clientCertPem)

        await expect(query.readCredentialFile('/etc/kubiq/client.key')).resolves.toBe(KubeconfigFixtures.clientKeyPem)
        await expect(query.readCredentialFile('D:\\kubiq\\client.crt')).resolves.toBe(KubeconfigFixtures.clientCertPem)
    })

    it('raises an ApiError when a referenced credential file is missing', async () => {
        const error = await failure(() => query.readCredentialFile('pki/ca.pem'))

        expect(error.details).toBe('C:/Users/tester/.kube/pki/ca.pem')
    })

    it('hands out a query for another file without touching its own', async () => {
        const other = 'D:/work/kubeconfig.yaml'
        transport.files.set(FILE, KubeconfigFixtures.primary())
        transport.files.set(other, KubeconfigFixtures.secondary())

        const contexts = await query.forFile(other).getAll()

        expect(contexts.map(context => context.name)).toEqual(['prod', 'lab'])
        expect(await query.getCurrentContextName()).toBe('prod')
    })

    it('refuses to read anything until a file is named', async () => {
        const unbound = new KubeconfigEntityQuery(
            KubeconfigContextEntity,
            transport as unknown as FileSystemTransport,
            { file: '' },
        )

        await expect(unbound.getAll()).rejects.toThrow('KubeconfigEntityQuery needs a file')
    })

    describe('telling a kubeconfig from other files', () => {
        it('recognises a kubeconfig by its sections or its kind', async () => {
            transport.files.set(FILE, KubeconfigFixtures.primary())
            await expect(query.isKubeconfig()).resolves.toBe(true)

            transport.files.set(FILE, 'apiVersion: v1\nkind: Config\n')
            await expect(query.isKubeconfig()).resolves.toBe(true)
        })

        it('says no to what kubectx and friends leave beside it', async () => {
            transport.files.set(FILE, 'prod-cluster\n')
            await expect(query.isKubeconfig()).resolves.toBe(false)

            transport.files.set(FILE, 'theme: dark\n')
            await expect(query.isKubeconfig()).resolves.toBe(false)
        })

        it('says no to an absent or empty file', async () => {
            await expect(query.isKubeconfig()).resolves.toBe(false)

            transport.files.set(FILE, '   \n')
            await expect(query.isKubeconfig()).resolves.toBe(false)
        })

        it('raises an ApiError for a file that is not valid yaml, since it may be a kubeconfig gone wrong', async () => {
            transport.files.set(FILE, KubeconfigFixtures.broken())

            const error = await failure(() => query.isKubeconfig())

            expect(error.details).toContain('YAML syntax error')
        })
    })
})
