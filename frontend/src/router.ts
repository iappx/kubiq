import { createRouter, createWebHashHistory, Router } from 'vue-router'
import { RouteStorage } from '@/lib/router/RouteStorage'
import { container } from 'tsyringe'
import { RouterNavigationStore } from '@/store/modules/routerNavigation/RouterNavigationStore'

export async function createComponentRouter(): Promise<Router> {
    const modulePaths = import.meta.glob('./views/**/*route.ts')
    const importFunctions = Object.values(modulePaths).map(p => p())
    await Promise.all(importFunctions)
    const routes = RouteStorage.instance.getRoutes()

    routes.push({
        path: '/:catchAll(.*)',
        component: () => import('@/views/Error.vue'),
    })

    const router = createRouter({
        history: createWebHashHistory(),
        routes: routes,
    })

    const setNavigating = (value: boolean) => {
        container.resolve(RouterNavigationStore).navigating = value
    }

    router.beforeEach(() => setNavigating(true))
    router.afterEach(() => setNavigating(false))
    router.onError(() => setNavigating(false))

    return router
}
