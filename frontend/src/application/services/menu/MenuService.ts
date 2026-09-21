import { injectable } from 'tsyringe'
import { MenuItem } from '@/domain/models/menu/MenuItem'
import { RouteStorage } from '@/lib/router/RouteStorage'
import { RouteInfo } from '@/lib/router/models/RouteInfo'

@injectable()
export class MenuService {
    public build(basePath: string): MenuItem[] {
        const items: MenuItem[] = []
        const routeTree = RouteStorage.instance.getRouteTree()

        for (let i = 0; i < routeTree.length; i++) {
            const route = routeTree[i]
            if (route.path == basePath) {
                const mapped = route.children.map(p => this.toMenuItem(p)).filter(p => !!p) as MenuItem[]
                items.push(...mapped)
            }
        }

        return items.sort((a, b) => (a.order || 0) - (b.order || 0))
    }

    private toMenuItem(route: RouteInfo): MenuItem | null {
        if (!route.meta || !route.meta.includeToMenu) {
            return null
        }
        return MenuItem.createFromRoute(route)
    }
}
