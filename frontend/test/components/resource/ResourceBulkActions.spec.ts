import { describe, expect, it } from 'vitest'
import { ResourceBulkActions } from '@/components/resource/ResourceBulkActions'
import { KubeResourceRegistry } from '@/domain/models/kube'

const kind = (group: string, resource: string) => KubeResourceRegistry.find(group, resource)!
const keys = (group: string, resource: string) => ResourceBulkActions.availableFor(kind(group, resource)).map(item => item.key)

describe('ResourceBulkActions', () => {
    it('returns nothing when no kind is resolved', () => {
        expect(ResourceBulkActions.availableFor(null)).toEqual([])
    })

    it('offers restart and delete on deployments, statefulsets and daemonsets', () => {
        expect(keys('apps', 'deployments')).toEqual([ResourceBulkActions.restartKey, ResourceBulkActions.deleteKey])
        expect(keys('apps', 'statefulsets')).toEqual([ResourceBulkActions.restartKey, ResourceBulkActions.deleteKey])
        expect(keys('apps', 'daemonsets')).toEqual([ResourceBulkActions.restartKey, ResourceBulkActions.deleteKey])
    })

    it('offers cordon, uncordon and delete on nodes', () => {
        expect(keys('', 'nodes')).toEqual([
            ResourceBulkActions.cordonKey,
            ResourceBulkActions.uncordonKey,
            ResourceBulkActions.deleteKey,
        ])
    })

    it('offers only delete on pods', () => {
        expect(keys('', 'pods')).toEqual([ResourceBulkActions.deleteKey])
    })

    it('omits actions the cluster verbs do not allow', () => {
        const readOnlyNodes = kind('', 'nodes').withDefinition({ verbs: ['list', 'get', 'watch'] })
        const deleteOnlyDeployments = kind('apps', 'deployments').withDefinition({ verbs: ['list', 'get', 'delete'] })

        expect(ResourceBulkActions.availableFor(readOnlyNodes)).toEqual([])
        expect(ResourceBulkActions.availableFor(deleteOnlyDeployments).map(item => item.key)).toEqual([
            ResourceBulkActions.deleteKey,
        ])
    })

    it('marks delete as dangerous and keeps it last', () => {
        const actions = ResourceBulkActions.availableFor(kind('apps', 'deployments'))
        const last = actions[actions.length - 1]

        expect(last).toMatchObject({ key: ResourceBulkActions.deleteKey, danger: true })
    })
})
