import { Component } from 'vue'
import { RouteBaseConstructor } from '@/lib/router/types/RouteBaseConstructor'
import { RouteMetaData } from '@/lib/router/types/RouteMetaData'
import { RouteStorage } from '@/lib/router/RouteStorage'
import { TypeIdentity } from '@/lib/extendedTypes/TypeIdentity'
import { TIconComponent } from '@/lib/types/TIconComponent'

export const RoutePage = (component: Component, path: string, parent?: () => RouteBaseConstructor) => (module: RouteBaseConstructor) => {
    const mame = TypeIdentity.guid(module)
    RouteStorage.instance.addOrUpdate(mame, {
        path,
        parent: parent ? parent() : undefined,
        module,
        component,
        name: mame,
    })
}

export const PropsRoute = () => (module: RouteBaseConstructor) => {
    RouteStorage.instance.addOrUpdate(TypeIdentity.guid(module), {
        props: true,
    })
}

export const RouteMeta = (data: RouteMetaData) => (module: RouteBaseConstructor) => {
    RouteStorage.instance.addOrUpdate(TypeIdentity.guid(module), {
        meta: data,
    })
}

export const RouteRedirect = (to: string) => (module: RouteBaseConstructor) => {
    RouteStorage.instance.addOrUpdate(TypeIdentity.guid(module), {
        redirect: to,
    })
}

export const DevRoute = () => (module: RouteBaseConstructor) => {
    RouteStorage.instance.addOrUpdate(TypeIdentity.guid(module), {
        dev: true,
    })
}

export const MenuIncluded = (order?: number) => (module: RouteBaseConstructor) => {
    RouteStorage.instance.addMeta(TypeIdentity.guid(module), 'includeToMenu', true)
    RouteStorage.instance.addMeta(TypeIdentity.guid(module), 'menuOrder', order)
}

export const RouteTitle = (title: string) => (module: RouteBaseConstructor) => {
    module.prototype.title = title
    RouteStorage.instance.addMeta(TypeIdentity.guid(module), 'title', title)
}

export const RouteIcon = (icon: TIconComponent) => (module: RouteBaseConstructor) => {
    RouteStorage.instance.addMeta(TypeIdentity.guid(module), 'icon', icon)
}

export const AdminRoute = () => (module: RouteBaseConstructor) => {
    RouteStorage.instance.addMeta(TypeIdentity.guid(module), 'adminRoute', true)
}
