import { FunctionalComponent } from 'vue'

export type RouteMetaData = {
    title?: string
    icon?: FunctionalComponent<any>
    includeToMenu?: boolean
    menuOrder?: number
    adminRoute?: boolean
}
