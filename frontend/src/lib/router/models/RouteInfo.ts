import { RouteBase } from '@/lib/router/base/RouteBase'
import { Component } from 'vue'
import { RouteMetaData } from '@/lib/router/types/RouteMetaData'
import { RouteBaseConstructor } from '@/lib/router/types/RouteBaseConstructor'

export class RouteInfo {
    path: string
    fullPath: string
    parent: RouteBaseConstructor
    parentInfo: RouteInfo
    meta: RouteMetaData
    module: RouteBaseConstructor
    moduleInstance: RouteBase
    name: string
    props: boolean
    component: Component
    children: RouteInfo[]
    redirect: string
    dev: boolean
}
