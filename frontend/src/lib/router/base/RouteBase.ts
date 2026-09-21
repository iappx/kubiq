import { NavigationGuardNext, RouteLocationNormalized, RouteLocationRaw, RouteRecordNormalized } from 'vue-router'
import { ComponentPublicInstance } from 'vue'
import { TBreadcrumb } from '@/lib/breadcrumbs/TBreadcrumb'

type NavigationGuardNextCallback = (vm: ComponentPublicInstance) => unknown;
export type NavigationGuardReturn = void | Error | RouteLocationRaw | boolean | NavigationGuardNextCallback;

export abstract class RouteBase {
    path: string

    public async beforeEnter(to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext): Promise<NavigationGuardReturn> {
        await next()
    }

    public async getRouteTitle(route: RouteRecordNormalized, routeParams: Record<string, any>): Promise<string> {
        return route.meta?.title?.toString() || ''
    }

    public async getBreadcrumbVariants(route: RouteRecordNormalized, routeParams: Record<string, any>): Promise<TBreadcrumb[]> {
        return []
    }
}
