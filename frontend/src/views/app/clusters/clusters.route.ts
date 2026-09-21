import { Boxes } from '@lucide/vue'
import { AppRoute } from '@/views/app/app.route'
import { MenuIncluded, RouteIcon, RoutePage, RouteTitle } from '@/lib/router/decorators/RouterDecorators'
import { RouteBase } from '@/lib/router/base/RouteBase'

@RoutePage(() => import('./index.vue'), 'clusters', () => AppRoute)
@MenuIncluded(1)
@RouteTitle('Clusters')
@RouteIcon(Boxes)
export class ClustersRoute extends RouteBase {
}
