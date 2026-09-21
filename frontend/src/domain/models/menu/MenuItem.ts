import { FunctionalComponent, h } from 'vue'
import { RouteInfo } from '@/lib/router/models/RouteInfo'
import { plainToInstance } from 'class-transformer'

export class MenuItem {
    title: string
    label: string
    key?: string
    children: MenuItem[]
    path: string
    icon?: FunctionalComponent<any>
    noLink: boolean
    order?: number

    get menuChildren(): MenuItem[] {
        return this.children.filter(p => !p.noLink)
    }

    public static createFromRoute(route: RouteInfo): MenuItem {
        let children: MenuItem[] = []
        if (route.children) {
            for (let i = 0; i < route.children.length; i++) {
                const child = route.children[i]
                if (!child.meta?.includeToMenu) {
                    continue
                }
                const item = MenuItem.createFromRoute(child)
                children.push(item)
            }
            children = children.sort((a: MenuItem, b: MenuItem) => (a.order || 0) - (b.order || 0))
        }
        return plainToInstance(MenuItem, {
            title: route.meta?.title,
            key: route.name,
            order: route.meta?.menuOrder,
            children: children.length > 0 ? children : undefined,
            path: route.fullPath,
            icon: route.meta?.icon ? () => h(route.meta?.icon as any) : undefined,
            noLink: false,
            label: route.meta?.title,
        })
    }
}
