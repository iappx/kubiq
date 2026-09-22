import { Rocket } from '@lucide/vue'
import { PropsRoute, RouteIcon, RoutePage, RouteTitle } from '@/lib/router/decorators/RouterDecorators'
import { RouteBase } from '@/lib/router/base/RouteBase'
import { ClusterShellRoute } from '@/views/cluster/cluster.route'

@RoutePage(() => import('./index.vue'), 'argocd', () => ClusterShellRoute)
@PropsRoute()
@RouteTitle('Argo CD')
@RouteIcon(Rocket)
export class ClusterArgoRoute extends RouteBase {
}
