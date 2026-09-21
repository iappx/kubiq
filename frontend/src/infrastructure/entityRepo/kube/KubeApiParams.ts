export class KubeApiParams {
    public static readonly labelSelector: string = 'labelSelector'

    public static readonly fieldSelector: string = 'fieldSelector'

    public static readonly limit: string = 'limit'

    public static readonly continueToken: string = 'continue'

    public static readonly watch: string = 'watch'

    public static readonly resourceVersion: string = 'resourceVersion'

    public static readonly allowWatchBookmarks: string = 'allowWatchBookmarks'

    public static readonly propagationPolicy: string = 'propagationPolicy'

    public static isSelector(name: string): boolean {
        return name === KubeApiParams.labelSelector || name === KubeApiParams.fieldSelector
    }
}
