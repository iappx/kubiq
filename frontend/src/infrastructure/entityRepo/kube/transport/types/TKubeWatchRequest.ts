export type TKubeWatchRequest = {
    path: string
    resourceVersion?: string
    labelSelector?: string
    fieldSelector?: string
    allowWatchBookmarks?: boolean
}
