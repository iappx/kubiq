import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const files: Record<string, string> = {}
const written: Record<string, string> = {}
const removed: string[] = []
const variables: Record<string, string> = {}
const start = vi.fn()
const openUri = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/process', () => ({
    ProcessService: {
        Start: (...args: unknown[]) => start(...args),
        Kill: (id: string) => {
            ;(window as any)._wails.dispatchWailsEvent({ name: 'process:exit', data: { processId: id, code: -1 } })
            return Promise.resolve({ success: true, error: '' })
        },
        Write: () => Promise.resolve({ success: true, error: '' }),
        Resize: () => Promise.resolve({ success: true, error: '' }),
        List: () => Promise.resolve({ success: true, processes: [], error: '' }),
        CloseAll: () => Promise.resolve(),
    },
    StartSpec: class {
        constructor(source: Record<string, unknown>) {
            Object.assign(this, source)
        }
    },
}))

vi.mock('../../../bindings/iappx_k8s_admin/core/services/env', () => ({
    EnvService: {
        Get: (name: string) => Promise.resolve(
            name in variables
                ? { success: true, value: variables[name] }
                : { success: false, value: '', error: 'not set' },
        ),
        UserHomeDir: () => Promise.resolve({ success: true, value: 'C:/Users/tester' }),
        PathSeparator: () => Promise.resolve({ success: true, value: ';' }),
        Expand: (path: string) => Promise.resolve({ success: true, value: path }),
    },
}))

vi.mock('../../../bindings/iappx_k8s_admin/core/services/io', () => ({
    IoService: {
        ReadFile: (path: string) => Promise.resolve(
            path in files ? { success: true, data: files[path] } : { success: true, data: '' },
        ),
        WriteFile: (path: string, content: string) => {
            written[path] = content
            return Promise.resolve({ success: true, data: 'Success' })
        },
        RemoveFile: (path: string) => {
            removed.push(path)
            return Promise.resolve({ success: true, data: 'Success' })
        },
        AbsolutePath: (path: string) => Promise.resolve({ success: true, data: `C:/profile/${path}` }),
        FileExists: (path: string) => Promise.resolve({ success: true, data: path in files ? 'true' : 'false' }),
        OpenURI: (...args: unknown[]) => {
            openUri(...args)
            return Promise.resolve({ success: true, data: 'Success' })
        },
    },
    IOOptions: class {
        constructor(source: Record<string, unknown>) {
            Object.assign(this, source)
        }
    },
}))

import { HelmService } from '@/application/services/helm/HelmService'
import type { IHelmOperationSink } from '@/application/services/helm/types/IHelmOperationSink'
import { HelmContextProvider } from '@/infrastructure/entityRepo/helm/HelmContextProvider'
import { MemoryProcessHost } from '../../support/MemoryProcessHost'

const host = new MemoryProcessHost()
const service = container.resolve(HelmService)
const contexts = container.resolve(HelmContextProvider)

const kubeconfig = [
    'apiVersion: v1',
    'kind: Config',
    'current-context: staging',
    'contexts:',
    '  - name: staging',
    '    context:',
    '      cluster: staging-cluster',
    '      user: staging-user',
    'clusters:',
    '  - name: staging-cluster',
    '    cluster:',
    '      server: https://staging.example.com',
    'users:',
    '  - name: staging-user',
    '    user:',
    '      token: not-a-real-token',
    '',
].join('\n')

const sink = () => {
    const lines: number[] = []
    const exits: number[] = []
    const handler: IHelmOperationSink = {
        onOperationOutput: (key, count) => lines.push(count),
        onOperationFinished: (key, code) => exits.push(code),
    }

    return { lines, exits, handler }
}

const settings = (helmPath: string): void => {
    files['userdata:settings/app.json'] = JSON.stringify({ kubectlPath: '', helmPath, nodeShellImage: '', closeToTray: false })
}

describe('HelmService', () => {
    beforeEach(() => {
        host.reset()
        start.mockReset()
        openUri.mockReset()
        start.mockImplementation((spec: any) => host.start(spec))
        Object.keys(files).forEach(key => delete files[key])
        Object.keys(written).forEach(key => delete written[key])
        Object.keys(variables).forEach(key => delete variables[key])
        removed.splice(0, removed.length)
        contexts.releaseAll()
        service.forgetProbes()
        ;(window as any).chrome = { webview: { postMessage: () => undefined } }

        variables.KUBECONFIG = 'C:/kube/main.yaml;C:/kube/extra.yaml'
        files['C:/kube/main.yaml'] = kubeconfig
        files['C:/kube/extra.yaml'] = 'apiVersion: v1\nkind: Config\n'
        settings('')
    })

    describe('finding helm', () => {
        it('takes the executable from the settings when one is set there', async () => {
            settings('C:/tools/helm.exe')
            files['C:/tools/helm.exe'] = ''

            expect((await service.environmentOf('staging')).executable).toBe('C:/tools/helm.exe')
        })

        it('searches PATH when the settings leave the field empty', async () => {
            variables.PATH = 'C:/bin;C:/other'
            variables.PATHEXT = '.EXE'
            files['C:/bin/helm.EXE'] = ''

            expect((await service.environmentOf('staging')).executable).toBe('C:/bin/helm.EXE')
        })

        it('falls back to the bare name so the Go side can look PATH up itself', async () => {
            expect((await service.environmentOf('staging')).executable).toBe('helm')
        })

        it('runs helm against the kubeconfig and the context of the open connection', async () => {
            const environment = await service.environmentOf('staging')

            expect(environment.contextName).toBe('staging')
            expect(environment.kubeconfig).toBe('C:/kube/main.yaml;C:/kube/extra.yaml')
        })
    })

    describe('availability', () => {
        it('reads the version helm reports and accepts Helm 3', async () => {
            host.script({ stdout: 'v3.14.0+g3fc9f4b\n' })

            const availability = await service.availability('staging')

            expect(availability.available).toBe(true)
            expect(availability.version).toBe('v3.14.0+g3fc9f4b')
            expect(host.lastArgs).toEqual(['version', '--short'])
        })

        it('refuses a Helm older than 3 and says which one it saw', async () => {
            host.script({ stdout: 'v2.17.0\n' })

            const availability = await service.availability('staging')

            expect(availability.available).toBe(false)
            expect(availability.reason).toContain('v2.17.0')
        })

        it('says where it looked when helm is nowhere to be found', async () => {
            host.script({ stderr: 'executable file not found in $PATH', code: 1 })

            const availability = await service.availability('staging')

            expect(availability.available).toBe(false)
            expect(availability.reason).toContain('Settings')
            expect(availability.detail).toContain('executable file not found')
        })

        it('probes once and only probes again when asked to', async () => {
            host.script({ stdout: 'v3.14.0\n' })
            await service.availability('staging')
            await service.availability('staging')
            expect(host.started).toHaveLength(1)

            host.script({ stdout: 'v3.15.0\n' })
            expect((await service.availability('staging', true)).version).toBe('v3.15.0')
        })
    })

    describe('reading', () => {
        it('turns the screen filters into one helm list invocation', async () => {
            host.script({ stdout: '[]' })

            await service.listReleases('staging', { namespace: 'dev', search: 'web', includeSuperseded: true })

            expect(host.lastArgs).toEqual(expect.arrayContaining([
                'list', '--namespace', 'dev', '--filter', 'web', '--all', '--date', '--reverse', '--max', '500',
            ]))
        })

        it('reads the history of one release', async () => {
            host.script({ stdout: JSON.stringify([{ revision: 1, status: 'deployed', chart: 'nginx-15.1.0' }]) })

            const revisions = await service.history('staging', { name: 'web', namespace: 'dev' })

            expect(revisions[0].id).toBe('dev/web@1')
        })

        it('reads the objects a release rendered out of its manifest', () => {
            const manifest = [
                '---',
                'apiVersion: apps/v1',
                'kind: Deployment',
                'metadata:',
                '  name: web',
                '---',
                'apiVersion: v1',
                'kind: Service',
                'metadata:',
                '  name: web',
                '  namespace: other',
                '',
            ].join('\n')

            expect(service.resourcesOf(manifest, 'dev')).toEqual([
                { apiVersion: 'apps/v1', kind: 'Deployment', name: 'web', namespace: 'dev' },
                { apiVersion: 'v1', kind: 'Service', name: 'web', namespace: 'other' },
            ])
        })
    })

    describe('operations', () => {
        it('streams an install and hands helm the values through a file it then deletes', async () => {
            host.script({ hold: true })
            const recorder = sink()

            await service.install('staging', 'op-1', {
                releaseName: 'web',
                namespace: 'dev',
                createNamespace: true,
                chart: 'bitnami/nginx',
                version: '15.1.0',
                values: 'replicaCount: 2\n',
            }, recorder.handler)

            const valuesPath = Object.keys(written)[0]
            expect(written[valuesPath]).toBe('replicaCount: 2\n')
            expect(host.lastArgs).toEqual([
                'install', 'web', 'bitnami/nginx', '--version', '15.1.0', '--create-namespace',
                '--namespace', 'dev', '--values', `C:/profile/${valuesPath}`, '--kube-context', 'staging',
            ])

            host.write('process-1', 'NAME: web\n')
            host.exit('process-1', 0)

            expect(service.lines('op-1')).toEqual(['NAME: web'])
            expect(recorder.exits).toEqual([0])
            expect(removed).toContain(`C:/profile/${valuesPath}`)
        })

        it('uninstalls and rolls back in the namespace of the release', async () => {
            host.script({ stdout: 'release "web" uninstalled\n' })
            await service.uninstall('staging', 'op-2', { name: 'web', namespace: 'dev' }, false, sink().handler)
            expect(host.lastArgs).toEqual(['uninstall', 'web', '--namespace', 'dev', '--kube-context', 'staging'])

            host.script({ stdout: 'Rollback was a success\n' })
            await service.rollback('staging', 'op-3', { name: 'web', namespace: 'dev' }, 2, sink().handler)
            expect(host.lastArgs).toEqual(['rollback', 'web', '2', '--namespace', 'dev', '--kube-context', 'staging'])
        })

        it('stops a running command and remembers that it was stopped', async () => {
            host.script({ hold: true })
            const recorder = sink()

            await service.upgrade('staging', 'op-4', {
                releaseName: 'web',
                namespace: 'dev',
                chart: 'bitnami/nginx',
                version: '',
                values: '',
                reuseValues: false,
            }, recorder.handler)

            await service.cancel('op-4')

            expect(service.wasCancelled('op-4')).toBe(true)
            expect(recorder.exits).toHaveLength(1)
        })
    })

    it('opens the install guide through the host, not through a window of its own', async () => {
        await service.openInstallGuide()

        expect(openUri).toHaveBeenCalledWith('https://helm.sh/docs/intro/install/')
    })
})
