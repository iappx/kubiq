import { Package } from '@lucide/vue'
import { PropsRoute, RouteIcon, RoutePage, RouteTitle } from '@/lib/router/decorators/RouterDecorators'
import { RouteBase } from '@/lib/router/base/RouteBase'
import { ClusterShellRoute } from '@/views/cluster/cluster.route'

@RoutePage(() => import('./index.vue'), 'helm', () => ClusterShellRoute)
@PropsRoute()
@RouteTitle('Helm')
@RouteIcon(Package)
export class ClusterHelmRoute extends RouteBase {
}
