import { RouteRecordNormalized } from 'vue-router'
import { PropsRoute, RoutePage, RouteTitle } from '@/lib/router/decorators/RouterDecorators'
import { RouteBase } from '@/lib/router/base/RouteBase'
import { ClusterShellRoute } from '@/views/cluster/cluster.route'
import { KubeResourceRegistry } from '@/domain/models/kube'

@RoutePage(() => import('./index.vue'), ':section/:resource', () => ClusterShellRoute)
@PropsRoute()
@RouteTitle('Resources')
export class ClusterResourceRoute extends RouteBase {
    public async getRouteTitle(route: RouteRecordNormalized, routeParams: Record<string, any>): Promise<string> {
        const slug = routeParams.resource
        if (typeof slug !== 'string' || slug === '') {
            return super.getRouteTitle(route, routeParams)
        }

        return KubeResourceRegistry.findBySlug(slug)?.title ?? slug
    }
}
