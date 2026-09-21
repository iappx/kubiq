import { describe, expect, it } from 'vitest'
import { ResourceActions } from '@/components/resource/ResourceActions'
import { KubeResourceRegistry } from '@/domain/models/kube'

const kind = (group: string, resource: string) => KubeResourceRegistry.find(group, resource)!
const keys = (group: string, resource: string) => ResourceActions.of(kind(group, resource)).map(item => item.key)

describe('ResourceActions', () => {
    it('offers nothing before a kind is resolved', () => {
        expect(ResourceActions.of(null)).toEqual([])
    })

    it('offers logs on pods and on nothing else', () => {
        expect(keys('', 'pods')).toContain(ResourceActions.logsKey)
        expect(keys('apps', 'deployments')).not.toContain(ResourceActions.logsKey)
    })

    it('offers scale and restart on a deployment', () => {
        expect(keys('apps', 'deployments')).toEqual([
            ResourceActions.openKey,
            ResourceActions.scaleKey,
            ResourceActions.restartKey,
            ResourceActions.deleteKey,
        ])
    })

    it('offers restart but not scale on a daemon set', () => {
        const items = keys('apps', 'daemonsets')

        expect(items).toContain(ResourceActions.restartKey)
        expect(items).not.toContain(ResourceActions.scaleKey)
    })

    it('offers a manual run on a cron job', () => {
        expect(keys('batch', 'cronjobs')).toContain(ResourceActions.triggerKey)
    })

    it('keeps delete last, marked dangerous and set apart', () => {
        const items = ResourceActions.of(kind('apps', 'deployments'))
        const last = items[items.length - 1]

        expect(last).toMatchObject({ key: ResourceActions.deleteKey, danger: true, separatorBefore: true })
    })

    it('leaves out what this cluster does not let the user do', () => {
        const readOnly = kind('apps', 'deployments').withDefinition({ verbs: ['list', 'get', 'watch'] })

        expect(ResourceActions.of(readOnly).map(item => item.key)).toEqual([ResourceActions.openKey])
    })
})
