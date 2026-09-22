import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Router } from 'vue-router'
import { RouteQueryState } from '@/lib/router/query/RouteQueryState'
import type { TRouteQueryField } from '@/lib/router/query/types/TRouteQueryField'

type TPage = { name: string; namespace: string; tab: string }

const fieldsOf = (page: TPage): TRouteQueryField[] => [
    { key: 'name', read: () => page.name, write: (value) => { page.name = value } },
    { key: 'ns', read: () => page.namespace, write: (value) => { page.namespace = value } },
    {
        key: 'tab',
        read: () => page.tab,
        write: (value) => { page.tab = value },
        defaultValue: 'overview',
    },
]

const build = (): Router => createRouter({
    history: createMemoryHistory(),
    routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/pods', component: { template: '<div />' } },
        { path: '/nodes', component: { template: '<div />' } },
    ],
})

describe('RouteQueryState', () => {
    let page: TPage
    let router: Router
    let state: RouteQueryState

    beforeEach(async () => {
        page = reactive({ name: '', namespace: '', tab: 'overview' })
        router = build()
        await router.replace('/pods')
        await router.isReady()

        state = new RouteQueryState(router, fieldsOf(page))
    })

    afterEach(() => {
        state.stop()
        vi.restoreAllMocks()
    })

    describe('reading the address', () => {
        it('puts the declared keys into state when it starts', async () => {
            await router.replace('/pods?name=api-7f9&ns=prod&tab=events')

            state.start()

            expect(page.name).toBe('api-7f9')
            expect(page.namespace).toBe('prod')
            expect(page.tab).toBe('events')
        })

        it('writes the default where the key is absent', async () => {
            page.tab = 'yaml'
            await router.replace('/pods?name=api-7f9')

            state.start()

            expect(page.name).toBe('api-7f9')
            expect(page.tab).toBe('overview')
        })

        it('takes the first value of a key that was repeated', async () => {
            await router.replace('/pods?name=first&name=second')

            state.start()

            expect(page.name).toBe('first')
        })

        it('treats a key with no value as absent', async () => {
            page.name = 'api-7f9'
            await router.replace('/pods?name')

            state.start()

            expect(page.name).toBe('')
        })

        it('re-reads when the route changes underneath it', async () => {
            state.start()

            await router.push('/pods?name=api-7f9&ns=prod')

            expect(page.name).toBe('api-7f9')
            expect(page.namespace).toBe('prod')
        })

        it('stops re-reading once released', async () => {
            state.start()
            state.stop()

            await router.push('/pods?name=api-7f9')

            expect(page.name).toBe('')
        })

        it('is inert until it is started', async () => {
            await router.replace('/pods?name=api-7f9')

            expect(page.name).toBe('')
        })
    })

    describe('writing the address', () => {
        it('puts a changed value into the query', async () => {
            state.start()

            page.name = 'api-7f9'
            await state.settled()

            expect(router.currentRoute.value.query).toEqual({ name: 'api-7f9' })
        })

        it('drops a key whose value went back to the default', async () => {
            await router.replace('/pods?tab=events')
            state.start()

            page.tab = 'overview'
            await state.settled()

            expect(router.currentRoute.value.query.tab).toBeUndefined()
        })

        it('drops a key whose value went back to empty', async () => {
            await router.replace('/pods?name=api-7f9')
            state.start()

            page.name = ''
            await state.settled()

            expect(router.currentRoute.value.query.name).toBeUndefined()
        })

        it('leaves keys it was never told about alone', async () => {
            await router.replace('/pods?sort=age&name=api-7f9')
            state.start()

            page.name = 'db-0'
            await state.settled()

            expect(router.currentRoute.value.query).toEqual({ sort: 'age', name: 'db-0' })
        })

        it('replaces rather than pushing, so selecting rows does not fill the back stack', async () => {
            state.start()
            const replace = vi.spyOn(router, 'replace')
            const push = vi.spyOn(router, 'push')

            page.name = 'api-7f9'
            await state.settled()

            expect(replace).toHaveBeenCalledTimes(1)
            expect(push).not.toHaveBeenCalled()
        })

        it('coalesces a burst of changes into one navigation', async () => {
            state.start()
            const replace = vi.spyOn(router, 'replace')

            page.name = 'api-7f9'
            page.namespace = 'prod'
            page.tab = 'events'
            await state.settled()

            expect(replace).toHaveBeenCalledTimes(1)
            expect(router.currentRoute.value.query).toEqual({ name: 'api-7f9', ns: 'prod', tab: 'events' })
        })

        it('navigates again for a change that was not part of the burst', async () => {
            state.start()
            const replace = vi.spyOn(router, 'replace')

            page.name = 'api-7f9'
            await state.settled()
            page.namespace = 'prod'
            await state.settled()

            expect(replace).toHaveBeenCalledTimes(2)
        })

        it('does not navigate when the address already says what the state says', async () => {
            await router.replace('/pods?name=api-7f9')
            state.start()
            const replace = vi.spyOn(router, 'replace')

            page.name = 'api-7f9'
            await state.settled()

            expect(replace).not.toHaveBeenCalled()
        })

        it('does not write back what it has just read', async () => {
            state.start()
            const replace = vi.spyOn(router, 'replace')

            await router.push('/pods?name=api-7f9&tab=events')
            await state.settled()

            expect(replace).not.toHaveBeenCalled()
        })

        it('stops writing once released', async () => {
            state.start()
            state.stop()
            const replace = vi.spyOn(router, 'replace')

            page.name = 'api-7f9'
            await state.settled()

            expect(replace).not.toHaveBeenCalled()
        })

        it('keeps the path and the fragment it was on', async () => {
            await router.replace('/nodes#detail')
            state.start()

            page.name = 'worker-1'
            await state.settled()

            expect(router.currentRoute.value.path).toBe('/nodes')
            expect(router.currentRoute.value.hash).toBe('#detail')
        })
    })

    it('ignores a second start', async () => {
        state.start()
        state.start()
        state.stop()

        await router.push('/pods?name=api-7f9')

        expect(page.name).toBe('')
    })
})
