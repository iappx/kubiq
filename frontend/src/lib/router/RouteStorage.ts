import { RouteRecordRaw } from 'vue-router'
import { RouteMetaData } from '@/lib/router/types/RouteMetaData'
import { StorageBase } from '@/lib/storage/base/StorageBase'
import { RouteInfo } from '@/lib/router/models/RouteInfo'
import { TypeIdentity } from '@/lib/extendedTypes/TypeIdentity'
import { AppEnvironment } from '@/config/AppEnvironment'

export class RouteStorage extends StorageBase<RouteInfo> {
    public static readonly instance = new RouteStorage()

    private routesLoaded = false

    private routeTree: RouteInfo[] = []

    private flatRouteInfo: RouteInfo[] = []

    public addMeta<TKey extends keyof RouteMetaData>(key: string, metKey: TKey, value: RouteMetaData[TKey]): void {
        const item = this.addOrUpdate(key, {})
        if (!item.meta) {
            item.meta = {}
        }
        item.meta[metKey] = value
    }

    public getRouteByName(name: string): RouteInfo | null {
        return this.flatRouteInfo.find(p => p.name == name) || null
    }

    public getRouteUpline(name: string): RouteInfo[] {
        const result: RouteInfo[] = []
        let currentRoute = this.getRouteByName(name)
        while (currentRoute) {
            result.push(currentRoute)
            currentRoute = currentRoute.parentInfo
        }
        return result
    }

    public getRoutes(): RouteRecordRaw[] {
        this.loadRoutes()
        return this.routeTree.map(p => RouteStorage.createRouteRecord(p))
    }

    public getRouteTree(): RouteInfo[] {
        this.loadRoutes()
        return this.routeTree
    }

    private static createRouteRecord(routeInfo: RouteInfo): RouteRecordRaw {
        return {
            path: routeInfo.path,
            component: routeInfo.component,
            name: TypeIdentity.guid(routeInfo.module),
            redirect: routeInfo.redirect || undefined,
            beforeEnter: (routeInfo.moduleInstance.beforeEnter || undefined) as any,
            meta: routeInfo.meta,
            children: routeInfo.children ? routeInfo.children.map(p => this.createRouteRecord(p)) : [],
        }
    }

    private static createTree(nodes: RouteInfo[]): RouteInfo[] {
        const map: Record<string, number> = {}
        let node: RouteInfo
        const roots: RouteInfo[] = []

        for (let i = 0; i < nodes.length; i++) {
            map[TypeIdentity.guid(nodes[i].module)] = i
            nodes[i].children = []
        }

        for (let i = 0; i < nodes.length; i++) {
            node = nodes[i]
            if (node.parent) {
                const parent = nodes[map[TypeIdentity.guid(node.parent)]]
                if (parent) {
                    node.parentInfo = parent
                    parent.children.push(node)
                } else {
                    roots.push(node)
                }
            } else {
                roots.push(node)
            }
        }
        return roots
    }

    private static processPaths(routeInfo: RouteInfo, basePath = ''): void {
        if (basePath.endsWith('/')) {
            basePath = basePath.slice(basePath.length - 2)
        }
        let currentPath
        if (routeInfo.path.startsWith('/')) {
            currentPath = basePath + routeInfo.path
        } else {
            currentPath = basePath + '/' + routeInfo.path
        }
        routeInfo.fullPath = currentPath
        if (routeInfo.children) {
            for (let i = 0; i < routeInfo.children.length; i++) {
                const child = routeInfo.children[i]
                this.processPaths(child, currentPath)
            }
        }
    }

    private loadRoutes(): void {
        if (!this.routesLoaded) {
            let array = this.getAsArray().map(p => {
                p.moduleInstance = new p.module()
                return p
            })
            if (!AppEnvironment.Dev) {
                array = array.filter(p => !p.dev)
            }
            this.flatRouteInfo = array
            this.routeTree = RouteStorage.createTree(array)
            for (let i = 0; i < this.routeTree.length; i++) {
                RouteStorage.processPaths(this.routeTree[i])
            }
            this.routesLoaded = true
        }
    }
}
