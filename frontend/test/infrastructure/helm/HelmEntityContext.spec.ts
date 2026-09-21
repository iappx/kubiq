import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const start = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/process', () => ({
    ProcessService: {
        Start: (...args: unknown[]) => start(...args),
        Kill: () => Promise.resolve({ success: true, error: '' }),
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

import { EntityRepo } from '@iappx/entity-repo'
import { QueryValidationError } from '@iappx/entity-repo-query'
import { HelmRepositoryEntity } from '@/domain/entities/helm/HelmRepositoryEntity'
import { HelmContextProvider } from '@/infrastructure/entityRepo/helm/HelmContextProvider'
import { HelmEntityContext } from '@/infrastructure/entityRepo/helm/HelmEntityContext'
import { HelmQueryMeta } from '@/infrastructure/entityRepo/helm/HelmQueryMeta'
import { HelmTransport } from '@/infrastructure/entityRepo/helm/transport/HelmTransport'
import { ProcessAdapter } from '@/infrastructure/process/ProcessAdapter'
import { MemoryProcessHost } from '../../support/MemoryProcessHost'

const host = new MemoryProcessHost()
const transport = new HelmTransport(
    { executable: 'helm', contextName: 'staging', kubeconfig: '/home/k/config' },
    container.resolve(ProcessAdapter),
)
const context = EntityRepo.create().use(HelmEntityContext, transport).getContext(HelmEntityContext)

const release = (name: string, namespace: string = 'dev') => ({
    name,
    namespace,
    revision: '2',
    updated: '2026-05-01T10:11:12Z',
    status: 'deployed',
    chart: 'nginx-15.1.0',
    app_version: '1.25.3',
})

describe('HelmEntityContext', () => {
    beforeEach(() => {
        host.reset()
        start.mockReset()
        start.mockImplementation((spec: any) => host.start(spec))
        ;(window as any).chrome = { webview: { postMessage: () => undefined } }
    })

    describe('releases', () => {
        it('reads every namespace unless the query names one', async () => {
            host.script({ stdout: '[]' })

            await context.releases.getAll()

            expect(host.lastArgs).toEqual(['list', '--output', 'json', '--all-namespaces', '--kube-context', 'staging'])
        })

        it('compiles a namespace condition into --namespace', async () => {
            host.script({ stdout: '[]' })

            await context.releases.where(f => f.eq('namespace', 'dev')).getAll()

            expect(host.lastArgs).toContain('--namespace')
            expect(host.lastArgs).toContain('dev')
            expect(host.lastArgs).not.toContain('--all-namespaces')
        })

        it('compiles a name condition into the --filter regular expression it means', async () => {
            host.script({ stdout: '[]' })
            await context.releases.where(f => f.contains('name', 'web')).getAll()
            expect(host.lastArgs).toEqual(expect.arrayContaining(['--filter', 'web']))

            host.script({ stdout: '[]' })
            await context.releases.where(f => f.eq('name', 'web.api')).getAll()
            expect(host.lastArgs).toEqual(expect.arrayContaining(['--filter', '^web\\.api$']))

            host.script({ stdout: '[]' })
            await context.releases.where(f => f.startsWith('name', 'web')).getAll()
            expect(host.lastArgs).toEqual(expect.arrayContaining(['--filter', '^web']))
        })

        it('compiles ordering and paging into the flags helm list understands', async () => {
            host.script({ stdout: '[]' })
            await context.releases.orderBy('updated', 'desc').take(20).skip(40).getAll()

            expect(host.lastArgs).toEqual(expect.arrayContaining(['--date', '--reverse', '--max', '20', '--offset', '40']))
        })

        it('leaves helm at its own sort order when the query asks for name ascending', async () => {
            host.script({ stdout: '[]' })

            await context.releases.orderBy('name', 'asc').getAll()

            expect(host.lastArgs).not.toContain('--date')
            expect(host.lastArgs).not.toContain('--reverse')
        })

        it('asks for superseded revisions only when the query says so', async () => {
            host.script({ stdout: '[]' })
            await context.releases.getAll()
            expect(host.lastArgs).not.toContain('--all')

            host.script({ stdout: '[]' })
            await context.releases.withMeta(HelmQueryMeta.withSuperseded()).getAll()
            expect(host.lastArgs).toContain('--all')
        })

        it('refuses a condition helm list cannot express, before helm is run', async () => {
            await expect(context.releases.where(f => f.eq('status', 'failed')).getAll()).rejects.toThrow()
            expect(host.started).toHaveLength(0)
        })

        it('refuses a disjunction, because helm list has no place to put one', async () => {
            await expect(
                context.releases.where(f => f.or(f.eq('namespace', 'dev'), f.eq('namespace', 'prod'))).getAll(),
            ).rejects.toThrow(QueryValidationError)
            expect(host.started).toHaveLength(0)
        })

        it('builds release entities out of what helm printed', async () => {
            host.script({ stdout: JSON.stringify([release('web'), release('api', 'prod')]) })

            const releases = await context.releases.getAll()

            expect(releases).toHaveLength(2)
            expect(releases[0].id).toBe('dev/web')
            expect(releases[0].chartName).toBe('nginx')
            expect(releases[0].chartVersion).toBe('15.1.0')
            expect(releases[1].namespace).toBe('prod')
        })

        it('narrows a lookup by key to one namespace and one name', async () => {
            host.script({ stdout: JSON.stringify([release('web')]) })

            const found = await context.releases.getById('dev/web')

            expect(found?.name).toBe('web')
            expect(host.lastArgs).toEqual(expect.arrayContaining(['--namespace', 'dev', '--filter', '^web$']))
        })

        it('reads the documents of one release in its own namespace', async () => {
            host.script({ stdout: 'replicaCount: 2\n' })
            await context.releases.valuesOf({ name: 'web', namespace: 'dev' }, true)
            expect(host.lastArgs).toEqual([
                'get', 'values', 'web', '--output', 'yaml', '--all', '--namespace', 'dev', '--kube-context', 'staging',
            ])

            host.script({ stdout: 'kind: Deployment\n' })
            await context.releases.manifest({ name: 'web', namespace: 'dev' })
            expect(host.lastArgs).toEqual(['get', 'manifest', 'web', '--namespace', 'dev', '--kube-context', 'staging'])

            host.script({ stdout: 'Thank you for installing nginx.\n' })
            await context.releases.notes({ name: 'web', namespace: 'dev' })
            expect(host.lastArgs).toEqual(['get', 'notes', 'web', '--namespace', 'dev', '--kube-context', 'staging'])
        })
    })

    describe('revisions', () => {
        it('reads the history of one release, newest first', async () => {
            host.script({
                stdout: JSON.stringify([
                    { revision: 1, status: 'superseded', chart: 'nginx-15.0.0', description: 'Install complete' },
                    { revision: 2, status: 'deployed', chart: 'nginx-15.1.0', description: 'Upgrade complete' },
                ]),
            })

            const revisions = await context.historyOf('web', 'dev').getAll()

            expect(revisions.map(revision => revision.revision)).toEqual([2, 1])
            expect(revisions[0].id).toBe('dev/web@2')
            expect(host.lastArgs).toEqual([
                'history', 'web', '--max', '64', '--output', 'json', '--namespace', 'dev', '--kube-context', 'staging',
            ])
        })

        it('runs nothing at all when no release was named', async () => {
            expect(await context.revisions.getAll()).toEqual([])
            expect(host.started).toHaveLength(0)
        })
    })

    describe('repositories', () => {
        it('lists repositories by name', async () => {
            host.script({
                stdout: JSON.stringify([
                    { name: 'stable', url: 'https://charts.example.com/stable' },
                    { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' },
                ]),
            })

            const repositories = await context.repositories.getAll()

            expect(repositories.map(repository => repository.name)).toEqual(['bitnami', 'stable'])
        })

        it('adds, removes and updates repositories through helm itself', async () => {
            host.script({ stdout: '' })
            await context.repositories.create(HelmRepositoryEntity.build({ name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' }))
            expect(host.lastArgs).toEqual([
                'repo', 'add', 'bitnami', 'https://charts.bitnami.com/bitnami', '--force-update', '--kube-context', 'staging',
            ])

            host.script({ stdout: '' })
            await context.repositories.remove('bitnami')
            expect(host.lastArgs).toEqual(['repo', 'remove', 'bitnami', '--kube-context', 'staging'])

            host.script({ stdout: 'Update Complete.\n' })
            expect(await context.repositories.refresh()).toBe('Update Complete.\n')
            expect(host.lastArgs).toEqual(['repo', 'update', '--kube-context', 'staging'])
        })
    })

    describe('charts', () => {
        it('turns a chart keyword and a repository into one search term', async () => {
            host.script({ stdout: '[]' })

            await context.charts
                .where(f => f.and(f.eq('repoName', 'bitnami'), f.contains('chartName', 'nginx')))
                .getAll()

            expect(host.lastArgs).toEqual([
                'search', 'repo', '--output', 'json', 'bitnami/nginx', '--kube-context', 'staging',
            ])
        })

        it('asks for every version only when the query says so', async () => {
            host.script({ stdout: '[]' })

            await context.charts.withMeta(HelmQueryMeta.withAllVersions()).getAll()

            expect(host.lastArgs).toContain('--versions')
        })

        it('refuses to pretend that a chart keyword is an exact match', async () => {
            await expect(context.charts.where(f => f.eq('chartName', 'nginx')).getAll()).rejects.toThrow()
            expect(host.started).toHaveLength(0)
        })

        it('reads the readme and the default values of one chart version', async () => {
            host.script({ stdout: '# nginx\n' })
            await context.charts.readme('bitnami/nginx', '15.1.0')
            expect(host.lastArgs).toEqual([
                'show', 'readme', 'bitnami/nginx', '--version', '15.1.0', '--kube-context', 'staging',
            ])

            host.script({ stdout: 'replicaCount: 1\n' })
            await context.charts.defaultValues('bitnami/nginx', '')
            expect(host.lastArgs).toEqual(['show', 'values', 'bitnami/nginx', '--kube-context', 'staging'])
        })
    })

    describe('the context provider', () => {
        it('keeps one context per cluster and rebuilds it when the environment changes', () => {
            const provider = new HelmContextProvider(container.resolve(ProcessAdapter))
            const first = provider.context('staging', { executable: 'helm', contextName: 'staging', kubeconfig: '/a' })
            const again = provider.context('staging', { executable: 'helm', contextName: 'staging', kubeconfig: '/a' })
            const moved = provider.context('staging', { executable: 'C:/helm.exe', contextName: 'staging', kubeconfig: '/a' })

            expect(again).toBe(first)
            expect(moved).not.toBe(first)
        })
    })
})
