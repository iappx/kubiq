import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        sink: null as any,
        output: [] as string[],
        cancelled: false,
        refuse: null as Error | null,
    }

    const capture = vi.fn(async (clusterId: string, key: string, ...rest: unknown[]) => {
        if (state.refuse) {
            throw state.refuse
        }
        state.sink = rest[rest.length - 1]
    })

    return {
        state,
        capture,
        lines: vi.fn(() => state.output),
        text: vi.fn(() => state.output.join('\n')),
        wasCancelled: vi.fn(() => state.cancelled),
        cancel: vi.fn(async () => {
            state.cancelled = true
        }),
        discard: vi.fn(),
    }
})

vi.mock('@/application/services/helm/HelmService', () => ({
    HelmService: class {
        public install = fake.capture

        public upgrade = fake.capture

        public uninstall = fake.capture

        public rollback = fake.capture

        public lines = fake.lines

        public text = fake.text

        public wasCancelled = fake.wasCancelled

        public cancel = fake.cancel

        public discard = fake.discard
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { HelmReleaseInstalledEvent } from '@/domain/events/helm/HelmReleaseInstalledEvent'
import { HelmReleaseRolledBackEvent } from '@/domain/events/helm/HelmReleaseRolledBackEvent'
import { HelmReleaseUninstalledEvent } from '@/domain/events/helm/HelmReleaseUninstalledEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { HelmOperationStore } from '@/store/modules/helm/HelmOperationStore'

const store = container.resolve(HelmOperationStore)
const eventBus = container.resolve(EventBus)

const installed: HelmReleaseInstalledEvent[] = []
const uninstalled: HelmReleaseUninstalledEvent[] = []
const rolledBack: HelmReleaseRolledBackEvent[] = []
const errors: AppErrorEvent[] = []

eventBus.registerHandler(HelmReleaseInstalledEvent, event => void installed.push(event))
eventBus.registerHandler(HelmReleaseUninstalledEvent, event => void uninstalled.push(event))
eventBus.registerHandler(HelmReleaseRolledBackEvent, event => void rolledBack.push(event))
eventBus.registerHandler(AppErrorEvent, event => void errors.push(event))

const draft = {
    releaseName: 'web',
    namespace: 'dev',
    createNamespace: false,
    chart: 'bitnami/nginx',
    version: '',
    values: '',
}

describe('HelmOperationStore', () => {
    beforeEach(() => {
        installed.splice(0, installed.length)
        uninstalled.splice(0, uninstalled.length)
        rolledBack.splice(0, rolledBack.length)
        errors.splice(0, errors.length)
        fake.state.sink = null
        fake.state.output = []
        fake.state.cancelled = false
        fake.state.refuse = null
        Object.keys(store.operations).forEach(key => store.close(key))
    })

    it('shows the command as running before helm has said anything', async () => {
        const key = await store.install('staging', draft)

        expect(store.viewOf(key)?.state).toBe('running')
        expect(store.isRunning).toBe(true)
        expect(store.activeKey).toBe(key)
    })

    it('counts the lines helm writes as they arrive', async () => {
        const key = await store.install('staging', draft)
        fake.state.output = ['NAME: web', 'LAST DEPLOYED: today']

        fake.state.sink.onOperationOutput(key, 2)

        expect(store.viewOf(key)?.lineCount).toBe(2)
        expect(store.lines(key)).toEqual(['NAME: web', 'LAST DEPLOYED: today'])
    })

    it('announces the change once helm exits cleanly', async () => {
        const key = await store.install('staging', draft)

        fake.state.sink.onOperationFinished(key, 0)

        expect(store.viewOf(key)?.state).toBe('succeeded')
        expect(installed).toHaveLength(1)
        expect(installed[0]).toMatchObject({ clusterId: 'staging', namespace: 'dev', releaseName: 'web' })
    })

    it('carries the whole output into the failure it reports', async () => {
        const key = await store.install('staging', draft)
        fake.state.output = ['Error: INSTALLATION FAILED', 'cannot re-use a name that is still in use']

        fake.state.sink.onOperationFinished(key, 1)

        expect(store.viewOf(key)?.state).toBe('failed')
        expect(store.viewOf(key)?.code).toBe(1)
        expect(installed).toHaveLength(0)
        expect(errors).toHaveLength(1)
        expect((errors[0].error as ApiError).details).toContain('cannot re-use a name')
    })

    it('announces nothing when the operator stopped the command', async () => {
        const key = await store.install('staging', draft)
        await store.cancel(key)

        fake.state.sink.onOperationFinished(key, -1)

        expect(store.viewOf(key)?.state).toBe('cancelled')
        expect(installed).toHaveLength(0)
        expect(errors).toHaveLength(0)
    })

    it('reports a helm that would not start at all', async () => {
        fake.state.refuse = new ApiError('Could not run helm', 'executable file not found')

        const key = await store.install('staging', draft)

        expect(store.viewOf(key)?.state).toBe('failed')
        expect(errors).toHaveLength(1)
    })

    it('tells the right story for an uninstall and for a rollback', async () => {
        const uninstallKey = await store.uninstall('staging', { name: 'web', namespace: 'dev' }, false)
        fake.state.sink.onOperationFinished(uninstallKey, 0)

        const rollbackKey = await store.rollback('staging', { name: 'web', namespace: 'dev' }, 3)
        fake.state.sink.onOperationFinished(rollbackKey, 0)

        expect(uninstalled).toHaveLength(1)
        expect(rolledBack[0].revision).toBe(3)
    })

    it('forgets a closed command and its output', async () => {
        const key = await store.install('staging', draft)

        store.close(key)

        expect(store.viewOf(key)).toBeUndefined()
        expect(store.activeKey).toBe('')
        expect(fake.discard).toHaveBeenCalledWith(key)
    })
})
