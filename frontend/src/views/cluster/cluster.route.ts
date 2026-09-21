import { RouteRecordNormalized } from 'vue-router'
import { PropsRoute, RoutePage, RouteTitle } from '@/lib/router/decorators/RouterDecorators'
import { RouteBase } from '@/lib/router/base/RouteBase'

@RoutePage(() => import('./index.vue'), '/cluster/:clusterId')
@PropsRoute()
@RouteTitle('Cluster')
export class ClusterShellRoute extends RouteBase {
    public async getRouteTitle(route: RouteRecordNormalized, routeParams: Record<string, any>): Promise<string> {
        const clusterId = routeParams.clusterId

        return typeof clusterId === 'string' && clusterId !== '' ? clusterId : super.getRouteTitle(route, routeParams)
    }
}
