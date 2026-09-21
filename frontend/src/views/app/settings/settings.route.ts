import { Settings } from '@lucide/vue'
import { AppRoute } from '@/views/app/app.route'
import { MenuIncluded, RouteIcon, RoutePage, RouteTitle } from '@/lib/router/decorators/RouterDecorators'
import { RouteBase } from '@/lib/router/base/RouteBase'

@RoutePage(() => import('./index.vue'), 'settings', () => AppRoute)
@MenuIncluded(2)
@RouteTitle('Settings')
@RouteIcon(Settings)
export class SettingsRoute extends RouteBase {
}
