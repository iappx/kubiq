import { beforeEach, describe, expect, it, vi } from 'vitest'

const variables: Record<string, string> = {}
let home = 'C:/Users/tester'
let separator = ';'

vi.mock('../../../bindings/iappx_k8s_admin/core/services/env', () => ({
    EnvService: {
        Get: (name: string) => Promise.resolve(
            name in variables
                ? { success: true, value: variables[name] }
                : { success: false, value: '', error: 'environment variable is not set' },
        ),
        UserHomeDir: () => Promise.resolve(
            home ? { success: true, value: home } : { success: false, value: '', error: 'no home' },
        ),
        PathSeparator: () => Promise.resolve({ success: true, value: separator }),
        Expand: (path: string) => Promise.resolve({ success: true, value: path.replace('~', home) }),
    },
}))

import { container } from 'tsyringe'
import { KubeconfigExecService } from '@/application/services/kubeconfig/KubeconfigExecService'
import { KubeconfigOidcService } from '@/application/services/kubeconfig/KubeconfigOidcService'
import { KubeconfigService } from '@/application/services/kubeconfig/KubeconfigService'
import { ApiError } from '@/domain/errors/ApiError'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'
import { KubeconfigFixtures } from '../../support/fixtures/KubeconfigFixtures'

const HOME_KUBE = 'C:/Users/tester/.kube'
const HOME_CONFIG = `${HOME_KUBE}/config`
const WORK_CONFIG = 'D:/work/kubeconfig.yaml'

const environment = new EnvironmentAdapter({ isAvailable: () => true } as WailsRuntimeService)
const offline = new EnvironmentAdapter({ isAvailable: () => false } as WailsRuntimeService)

let transport: MemoryFileTransport
let execService: { resolve: ReturnType<typeof vi.fn>; forget: ReturnType<typeof vi.fn> }
let oidcService: { resolve: ReturnType<typeof vi.fn>; forget: ReturnType<typeof vi.fn> }
let service: KubeconfigService

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

describe('KubeconfigService', () => {
    beforeEach(() => {
        Object.keys(variables).forEach(key => delete variables[key])
        home = 'C:/Users/tester'
        separator = ';'
        transport = new MemoryFileTransport()
        execService = {
            resolve: vi.fn(),
            forget: vi.fn(),
        }
        oidcService = {
            resolve: vi.fn(),
            forget: vi.fn(),
        }
        service = new KubeconfigService(
            environment,
            new EntityRepoProvider(transport as unknown as FileSystemTransport),
            execService as unknown as KubeconfigExecService,
            oidcService as unknown as KubeconfigOidcService,
        )
    })

    describe('locating the files', () => {
        it('reads the kubeconfig in ~/.kube when nothing else is named', async () => {
            transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())

            await expect(service.locate()).resolves.toEqual([HOME_CONFIG])
        })

        it('reads every path of KUBECONFIG and ignores the empty ones', async () => {
            variables.KUBECONFIG = `${HOME_CONFIG};;${WORK_CONFIG};  `

            await expect(service.locate()).resolves.toEqual([HOME_CONFIG, WORK_CONFIG])
        })

        it('keeps the whole value when the separator is unknown', async () => {
            variables.KUBECONFIG = WORK_CONFIG
            separator = ''

            await expect(service.locate()).resolves.toEqual([WORK_CONFIG])
        })

        it('still reads ~/.kube when KUBECONFIG names files elsewhere, after them', async () => {
            variables.KUBECONFIG = WORK_CONFIG
            transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())

            await expect(service.locate()).resolves.toEqual([WORK_CONFIG, HOME_CONFIG])
        })

        it('puts a file named from outside in front of the discovered ones', async () => {
            transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())

            await expect(service.locate([WORK_CONFIG])).resolves.toEqual([WORK_CONFIG, HOME_CONFIG])
        })

        it('keeps the order of several files named from outside', async () => {
            const extra = 'D:/work/extra.yaml'
            transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())

            await expect(service.locate([WORK_CONFIG, extra])).resolves.toEqual([WORK_CONFIG, extra, HOME_CONFIG])
        })

        it('reads every kubeconfig in ~/.kube, kubectl\'s own file first', async () => {
            transport.files.set(`${HOME_KUBE}/b-lab`, KubeconfigFixtures.secondary())
            transport.files.set(`${HOME_KUBE}/a-dev.yaml`, KubeconfigFixtures.secondary())
            transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())

            await expect(service.locate()).resolves.toEqual([HOME_CONFIG, `${HOME_KUBE}/a-dev.yaml`, `${HOME_KUBE}/b-lab`])
        })

        it('passes over what in ~/.kube is not a kubeconfig, without a word', async () => {
            transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())
            transport.files.set(`${HOME_KUBE}/kubectx`, 'prod\n')
            transport.files.set(`${HOME_KUBE}/.DS_Store`, '\u0000\u0001binary')
            transport.files.set(`${HOME_KUBE}/cache/discovery/servergroups.json`, '{}')
            transport.files.set(`${HOME_KUBE}/empty`, '')

            const read = await service.read()

            expect(read.files).toEqual([HOME_CONFIG])
            expect(read.problems).toEqual([])
        })

        it('reads a folder named from outside, whether added by hand or on KUBECONFIG', async () => {
            variables.KUBECONFIG = 'D:/team'
            transport.files.set('D:/team/staging', KubeconfigFixtures.secondary())
            transport.files.set('D:/mine/lab.yaml', KubeconfigFixtures.withPlugins())

            await expect(service.locate(['D:/mine'])).resolves.toEqual(['D:/mine/lab.yaml', 'D:/team/staging'])
        })

        it('names a file once when a folder and KUBECONFIG both reach it', async () => {
            variables.KUBECONFIG = HOME_CONFIG
            transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())

            await expect(service.locate()).resolves.toEqual([HOME_CONFIG])
        })

        it('reports a broken file in a folder and keeps reading the others', async () => {
            transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())
            transport.files.set(`${HOME_KUBE}/staging`, KubeconfigFixtures.broken())

            const read = await service.read()

            expect(read.files).toEqual([HOME_CONFIG])
            expect(read.contexts.map(context => context.name)).toEqual(['prod', 'staging', 'shared'])
            expect(read.problems.map(problem => problem.path)).toEqual([`${HOME_KUBE}/staging`])
            expect(read.problems[0].details).toContain('YAML syntax error')
        })

        it('expands the file named from outside', async () => {
            await expect(service.locate(['~/.kube/config'])).resolves.toEqual([HOME_CONFIG])
        })

        it('names every file once', async () => {
            variables.KUBECONFIG = `${WORK_CONFIG};${WORK_CONFIG}`

            await expect(service.locate([WORK_CONFIG])).resolves.toEqual([WORK_CONFIG])
        })

        it('finds nothing without a home directory and without KUBECONFIG', async () => {
            home = ''

            await expect(service.locate()).resolves.toEqual([])
        })

        it('finds nothing without the Wails runtime', async () => {
            const offlineService = new KubeconfigService(
                offline,
                new EntityRepoProvider(transport as unknown as FileSystemTransport),
            )

            await expect(offlineService.locate()).resolves.toEqual([])
            await expect(offlineService.getContexts()).resolves.toEqual([])
            await expect(offlineService.getCurrentContextName()).resolves.toBe('')
        })
    })

    describe('merging the files', () => {
        beforeEach(() => {
            variables.KUBECONFIG = `${HOME_CONFIG};${WORK_CONFIG}`
            transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())
            transport.files.set(WORK_CONFIG, KubeconfigFixtures.secondary())
        })

        it('collects the contexts of every file', async () => {
            const contexts = await service.getContexts()

            expect(contexts.map(context => context.name)).toEqual(['prod', 'staging', 'shared', 'lab'])
        })

        it('keeps the context of the first file that declares the name', async () => {
            const contexts = await service.getContexts()
            const prod = contexts.find(context => context.name === 'prod')

            expect(prod?.namespace).toBe('payments')
            expect(prod?.userName).toBe('prod-admin')
            expect(prod?.filePath).toBe(HOME_CONFIG)
        })

        it('keeps the cluster of the first file that declares the name', async () => {
            const contexts = await service.getContexts()

            expect(contexts.find(context => context.name === 'prod')?.server)
                .toBe('https://prod.example.internal:6443')
        })

        it('merges clusters and users apart from contexts', async () => {
            const contexts = await service.getContexts()
            const shared = contexts.find(context => context.name === 'shared')

            expect(shared?.filePath).toBe(HOME_CONFIG)
            expect(shared?.cluster.server).toBe('https://shared.example.internal:6443')
            expect(shared?.cluster.filePath).toBe(WORK_CONFIG)
            expect(shared?.user.token).toBe(KubeconfigFixtures.sharedToken)
        })

        it('takes the current context from the first file that names one', async () => {
            await expect(service.getCurrentContextName()).resolves.toBe('prod')
        })

        it('skips a file whose current context is empty', async () => {
            variables.KUBECONFIG = `D:/work/empty.yaml;${HOME_CONFIG}`
            transport.files.set('D:/work/empty.yaml', KubeconfigFixtures.withoutCurrentContext())

            await expect(service.getCurrentContextName()).resolves.toBe('prod')
        })

        it('reads what it can when one of the files is missing', async () => {
            variables.KUBECONFIG = `D:/work/gone.yaml;${HOME_CONFIG}`

            const contexts = await service.getContexts()

            expect(contexts.map(context => context.name)).toEqual(['prod', 'staging', 'shared'])
        })

        it('skips a file that is not valid yaml, says which, and reads the rest', async () => {
            transport.files.set(WORK_CONFIG, KubeconfigFixtures.broken())

            const read = await service.read()

            expect(read.contexts.map(context => context.name)).toEqual(['prod', 'staging', 'shared'])
            expect(read.problems).toHaveLength(1)
            expect(read.problems[0].path).toBe(WORK_CONFIG)
            expect(read.problems[0].details).toContain(WORK_CONFIG)
        })

        it('skips a named file that is YAML but not a kubeconfig document', async () => {
            transport.files.set(WORK_CONFIG, '- just\n- a list\n')

            const read = await service.read()

            expect(read.contexts.map(context => context.name)).toEqual(['prod', 'staging', 'shared'])
            expect(read.problems.map(problem => problem.path)).toEqual([WORK_CONFIG])
        })
    })

    describe('noticing changes', () => {
        beforeEach(() => {
            transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())
        })

        it('gives the same answer while nothing changes', async () => {
            await expect(service.fingerprint([WORK_CONFIG])).resolves.toBe(await service.fingerprint([WORK_CONFIG]))
        })

        it('changes when a kubeconfig in ~/.kube is edited', async () => {
            const before = await service.fingerprint()
            transport.touch(HOME_CONFIG, 1700000000000)

            await expect(service.fingerprint()).resolves.not.toBe(before)
        })

        it('changes when a file is put into ~/.kube', async () => {
            const before = await service.fingerprint()
            transport.files.set(`${HOME_KUBE}/lab`, KubeconfigFixtures.secondary())

            await expect(service.fingerprint()).resolves.not.toBe(before)
        })

        it('changes when a file named from outside appears or is edited', async () => {
            transport.files.delete(WORK_CONFIG)
            const missing = await service.fingerprint([WORK_CONFIG])

            transport.files.set(WORK_CONFIG, KubeconfigFixtures.secondary())
            const present = await service.fingerprint([WORK_CONFIG])

            transport.touch(WORK_CONFIG, 1700000000000)
            const edited = await service.fingerprint([WORK_CONFIG])

            expect(new Set([missing, present, edited]).size).toBe(3)
        })

        it('changes when a file lands in a folder named from outside', async () => {
            transport.files.set('D:/team/staging', KubeconfigFixtures.secondary())
            const before = await service.fingerprint(['D:/team'])

            transport.files.set('D:/team/lab', KubeconfigFixtures.secondary())

            await expect(service.fingerprint(['D:/team'])).resolves.not.toBe(before)
        })

        it('does not stir for Finder metadata or editor swap files', async () => {
            const before = await service.fingerprint()
            transport.files.set(`${HOME_KUBE}/.DS_Store`, 'metadata')
            transport.files.set(`${HOME_KUBE}/.config.swp`, 'swap')

            await expect(service.fingerprint()).resolves.toBe(before)
        })
    })

    describe('building the connection specification', () => {
        beforeEach(() => {
            variables.KUBECONFIG = `${HOME_CONFIG};${WORK_CONFIG}`
            transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())
            transport.files.set(WORK_CONFIG, KubeconfigFixtures.secondary())
        })

        it('decodes the inline certificate material into pem', async () => {
            const spec = await service.buildConnectionSpec('prod')

            expect(spec.server).toBe('https://prod.example.internal:6443')
            expect(spec.caPem).toBe(KubeconfigFixtures.caPem)
            expect(spec.clientCertPem).toBe(KubeconfigFixtures.clientCertPem)
            expect(spec.clientKeyPem).toBe(KubeconfigFixtures.clientKeyPem)
            expect(spec.token).toBe('')
            expect(spec.timeoutSeconds).toBe(0)
        })

        it('carries the transport-level cluster settings', async () => {
            const spec = await service.buildConnectionSpec('staging')

            expect(spec.token).toBe(KubeconfigFixtures.stagingToken)
            expect(spec.insecureSkipTlsVerify).toBe(true)
            expect(spec.serverName).toBe('staging.internal')
            expect(spec.proxyUrl).toBe('http://proxy.example.internal:3128')
        })

        it('carries basic credentials as they are', async () => {
            const spec = await service.buildConnectionSpec('lab')

            expect(spec.username).toBe('lab')
            expect(spec.password).toBe(KubeconfigFixtures.labPassword)
        })

        it('reads the files a kubeconfig points at, relative to its own folder', async () => {
            variables.KUBECONFIG = WORK_CONFIG
            transport.files.set(WORK_CONFIG, KubeconfigFixtures.withFileReferences())
            transport.files.set('D:/work/pki/ca.pem', KubeconfigFixtures.caPem)
            transport.files.set('D:/work/pki/client.crt', KubeconfigFixtures.clientCertPem)
            transport.files.set('/etc/kubiq/client.key', KubeconfigFixtures.clientKeyPem)
            transport.files.set('D:/work/pki/token', ' fake-file-token\n')

            const spec = await service.buildConnectionSpec('files')

            expect(spec.caPem).toBe(KubeconfigFixtures.caPem)
            expect(spec.clientCertPem).toBe(KubeconfigFixtures.clientCertPem)
            expect(spec.clientKeyPem).toBe(KubeconfigFixtures.clientKeyPem)
            expect(spec.token).toBe('fake-file-token')
        })

        it('raises an ApiError when a referenced file is missing', async () => {
            variables.KUBECONFIG = WORK_CONFIG
            transport.files.set(WORK_CONFIG, KubeconfigFixtures.withFileReferences())

            const error = await failure(() => service.buildConnectionSpec('files'))

            expect(error.details).toBe('D:/work/pki/ca.pem')
        })

        it('raises an ApiError for a context nobody declares', async () => {
            const error = await failure(() => service.buildConnectionSpec('nope'))

            expect(error.message).toContain('"nope"')
        })

        it('raises an ApiError when the cluster has no address', async () => {
            variables.KUBECONFIG = WORK_CONFIG
            transport.files.set(WORK_CONFIG, [
                'apiVersion: v1',
                'contexts:',
                '  - name: lonely',
                '    context:',
                '      cluster: gone',
                '      user: gone',
                '',
            ].join('\n'))

            const error = await failure(() => service.buildConnectionSpec('lonely'))

            expect(error.message).toContain('no cluster address')
        })

        it('resolves exec credential plugins into the connection spec', async () => {
            variables.KUBECONFIG = WORK_CONFIG
            transport.files.set(WORK_CONFIG, KubeconfigFixtures.withPlugins())
            execService.resolve.mockResolvedValue({
                token: 'fake-exec-token',
                clientCertPem: KubeconfigFixtures.clientCertPem,
                clientKeyPem: KubeconfigFixtures.clientKeyPem,
                expiresAt: 0,
            })

            const spec = await service.buildConnectionSpec('exec')

            expect(execService.resolve).toHaveBeenCalledTimes(1)
            expect(spec.token).toBe('fake-exec-token')
            expect(spec.clientCertPem).toBe(KubeconfigFixtures.clientCertPem)
            expect(spec.clientKeyPem).toBe(KubeconfigFixtures.clientKeyPem)
        })

        it('resolves oidc auth-provider credentials and passes idp CA material', async () => {
            variables.KUBECONFIG = WORK_CONFIG
            transport.files.set(WORK_CONFIG, [
                'apiVersion: v1',
                'kind: Config',
                'clusters:',
                '  - name: oidc',
                '    cluster:',
                '      server: https://oidc.example.internal:6443',
                'contexts:',
                '  - name: oidc',
                '    context:',
                '      cluster: oidc',
                '      user: oidc-user',
                'users:',
                '  - name: oidc-user',
                '    user:',
                '      auth-provider:',
                '        name: oidc',
                '        config:',
                `          idp-certificate-authority-data: ${KubeconfigFixtures.b64(KubeconfigFixtures.caPem)}`,
                '          id-token: fake-oidc-token',
                '',
            ].join('\n'))
            oidcService.resolve.mockResolvedValue('fake-resolved-oidc-token')

            const spec = await service.buildConnectionSpec('oidc')

            expect(oidcService.resolve).toHaveBeenCalledTimes(1)
            expect(oidcService.resolve.mock.calls[0][1]).toBe(KubeconfigFixtures.caPem)
            expect(spec.token).toBe('fake-resolved-oidc-token')
        })

        it('refuses an unsupported legacy auth provider and interactive-only exec plugins', async () => {
            variables.KUBECONFIG = WORK_CONFIG
            transport.files.set(WORK_CONFIG, [
                'apiVersion: v1',
                'kind: Config',
                'clusters:',
                '  - name: legacy',
                '    cluster:',
                '      server: https://legacy.example.internal:6443',
                'contexts:',
                '  - name: gcp',
                '    context:',
                '      cluster: legacy',
                '      user: gcp-user',
                '  - name: interactive',
                '    context:',
                '      cluster: legacy',
                '      user: interactive-user',
                'users:',
                '  - name: gcp-user',
                '    user:',
                '      auth-provider:',
                '        name: gcp',
                '  - name: interactive-user',
                '    user:',
                '      exec:',
                '        apiVersion: client.authentication.k8s.io/v1',
                '        command: kubelogin',
                '        interactiveMode: Always',
                '',
            ].join('\n'))

            const gcpError = await failure(() => service.buildConnectionSpec('gcp'))
            expect(gcpError.message).toContain('gcp')
            expect(gcpError.message).toContain('exec')

            const interactiveError = await failure(() => service.buildConnectionSpec('interactive'))
            expect(interactiveError.message).toContain('non-interactively')
        })

        it('forgets cached exec and oidc credentials for a context', () => {
            service.forgetCredentials('prod')

            expect(execService.forget).toHaveBeenCalledWith('prod')
            expect(oidcService.forget).toHaveBeenCalledWith('prod')
        })

        it('injects exec and oidc services through tsyringe', () => {
            const resolved = container.resolve(KubeconfigService)

            expect(() => resolved.forgetCredentials('prod')).not.toThrow()
        })

        it('lists exec and oidc contexts as supported', async () => {
            variables.KUBECONFIG = WORK_CONFIG
            transport.files.delete(HOME_CONFIG)
            transport.files.set(WORK_CONFIG, KubeconfigFixtures.withPlugins())

            const contexts = await service.getContexts()

            expect(contexts.map(context => context.name)).toEqual(['exec', 'oidc'])
            expect(contexts.every(context => context.isSupported)).toBe(true)
            expect(contexts[0].authType).toBe('exec')
            expect(contexts[1].authType).toBe('authProvider')
        })

        it('keeps the offending value out of a base64 complaint', async () => {
            variables.KUBECONFIG = WORK_CONFIG
            transport.files.set(WORK_CONFIG, [
                'apiVersion: v1',
                'clusters:',
                '  - name: bad',
                '    cluster:',
                '      server: https://bad.example.internal:6443',
                '      certificate-authority-data: "@@@ fake-ca-material @@@"',
                'contexts:',
                '  - name: bad',
                '    context:',
                '      cluster: bad',
                '      user: bad',
                'users:',
                '  - name: bad',
                '    user:',
                '      token: fake-bad-token',
                '',
            ].join('\n'))

            const error = await failure(() => service.buildConnectionSpec('bad'))

            expect(error.message).toContain('certificate-authority-data')
            expect(`${error.message} ${error.details}`).not.toContain('fake-ca-material')
        })
    })
})
