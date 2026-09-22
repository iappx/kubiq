import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { container } from 'tsyringe'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { DetailTabs } from '@/components/resource/detail/DetailTabs'
import { ResourceSelection } from '@/components/resource/ResourceSelection'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { RouteQueryState } from '@/lib/router/query/RouteQueryState'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'

const ui = container.resolve(AppUiStore)

const pods = KubeResourceRegistry.find('', 'pods')!
const nodes = KubeResourceRegistry.find('', 'nodes')!

const listPath = '/cluster/staging/workloads/pods'

describe('ResourceSelection', () => {
    describe('what the address may say', () => {
        it('opens a namespaced object the address fully names', () => {
            expect(ResourceSelection.isAddressable(pods, 'prod', 'api-7f9')).toBe(true)
        })

        it('ignores a namespaced object whose namespace the address left out', () => {
            expect(ResourceSelection.isAddressable(pods, '', 'api-7f9')).toBe(false)
        })

        it('opens a cluster-scoped object, which has no namespace to leave out', () => {
            expect(ResourceSelection.isAddressable(nodes, '', 'worker-1')).toBe(true)
        })

        it('keeps a namespace it cannot yet judge, because the kind is not resolved', () => {
            expect(ResourceSelection.isAddressable(null, '', 'api-7f9')).toBe(true)
        })

        it('opens nothing when the address names no object', () => {
            expect(ResourceSelection.isAddressable(pods, 'prod', '')).toBe(false)
        })
    })

    describe('the tab the address asks for', () => {
        it('keeps a tab the kind actually has', () => {
            expect(ResourceSelection.tabOf(DetailTabs.of(pods), DetailTabs.environmentKey))
                .toBe(DetailTabs.environmentKey)
        })

        it('falls back to the overview for a tab this kind does not have', () => {
            expect(ResourceSelection.tabOf(DetailTabs.of(nodes), DetailTabs.environmentKey))
                .toBe(DetailTabs.overviewKey)
        })

        it('falls back to the overview for a tab that exists nowhere', () => {
            expect(ResourceSelection.tabOf(DetailTabs.of(pods), 'nonsense')).toBe(DetailTabs.overviewKey)
        })
    })

    describe('the row stood in for an object the list does not hold', () => {
        it('names the object and says the cluster has not spoken yet', () => {
            const row = ResourceSelection.rowOf('prod', 'api-7f9')

            expect(row.name).toBe('api-7f9')
            expect(row.namespace).toBe('prod')
            expect(row.tone).toBe('unknown')
            expect(row.key).toBe('prod/api-7f9')
        })

        it('keys a cluster-scoped object by its name alone', () => {
            expect(ResourceSelection.rowOf('', 'worker-1').key).toBe('worker-1')
        })
    })

    describe('the round trip through the address', () => {
        let router: Router
        let state: RouteQueryState
        let page: { tab: string }

        const start = async (path: string): Promise<void> => {
            await router.replace(path)
            state = new RouteQueryState(
                router,
                ResourceSelection.fields(ui, () => page.tab, (value) => { page.tab = value }),
            )
            state.start()
        }

        beforeEach(async () => {
            ui.closeDetail()
            page = reactive({ tab: DetailTabs.overviewKey })

            router = createRouter({
                history: createMemoryHistory(),
                routes: [{ path: '/cluster/:clusterId/:section/:resource', component: { template: '<div />' } }],
            })
            await router.replace(listPath)
            await router.isReady()
        })

        afterEach(() => {
            state.stop()
            ui.closeDetail()
        })

        it('opens the object and the tab a shared link names', async () => {
            await start(`${listPath}?ns=prod&name=api-7f9&tab=${DetailTabs.eventsKey}`)

            expect(ui.detailNamespace).toBe('prod')
            expect(ui.detailName).toBe('api-7f9')
            expect(page.tab).toBe(DetailTabs.eventsKey)
        })

        it('writes the object the operator selected into the address', async () => {
            await start(listPath)

            ui.openDetail('prod', 'api-7f9')
            await state.settled()

            expect(router.currentRoute.value.query).toEqual({ ns: 'prod', name: 'api-7f9' })
        })

        it('leaves the default tab out of the address', async () => {
            await start(`${listPath}?tab=${DetailTabs.yamlKey}`)

            page.tab = DetailTabs.overviewKey
            await state.settled()

            expect(router.currentRoute.value.query.tab).toBeUndefined()
        })

        it('empties the address when the panel is closed', async () => {
            await start(`${listPath}?ns=prod&name=api-7f9`)

            ui.closeDetail()
            await state.settled()

            expect(router.currentRoute.value.query).toEqual({})
        })

        it('carries no namespace while nothing is selected', async () => {
            await start(`${listPath}?ns=prod`)
            await state.settled()

            expect(ui.detailOpen).toBe(false)
            expect(router.currentRoute.value.query.ns).toBeUndefined()
        })

        it('keeps a filter or sort another mechanism owns', async () => {
            await start(`${listPath}?sort=age`)

            ui.openDetail('prod', 'api-7f9')
            await state.settled()

            expect(router.currentRoute.value.query.sort).toBe('age')
        })

        it('follows the address when the operator walks back through history', async () => {
            await start(`${listPath}?ns=prod&name=api-7f9`)

            await router.push(`${listPath}?ns=prod&name=db-0`)

            expect(ui.detailName).toBe('db-0')
        })
    })
})
