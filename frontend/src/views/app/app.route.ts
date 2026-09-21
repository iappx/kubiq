import { RoutePage, RouteRedirect } from '@/lib/router/decorators/RouterDecorators'
import { RouteBase } from '@/lib/router/base/RouteBase'

@RoutePage(() => import('./index.vue'), '/app')
@RouteRedirect('/app/clusters')
export class AppRoute extends RouteBase {
}

@RoutePage(() => import('./index.vue'), '/')
@RouteRedirect('/app/clusters')
export class RootRoute extends RouteBase {
}
