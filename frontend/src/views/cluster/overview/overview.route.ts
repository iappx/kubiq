import { PropsRoute, RoutePage, RouteTitle } from '@/lib/router/decorators/RouterDecorators'
import { RouteBase } from '@/lib/router/base/RouteBase'
import { ClusterShellRoute } from '@/views/cluster/cluster.route'

@RoutePage(() => import('./index.vue'), 'overview', () => ClusterShellRoute)
@PropsRoute()
@RouteTitle('Overview')
export class ClusterOverviewRoute extends RouteBase {
}
