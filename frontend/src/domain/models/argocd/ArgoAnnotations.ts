export class ArgoAnnotations {
    public static readonly refresh: string = 'argocd.argoproj.io/refresh'

    public static readonly normalRefresh: string = 'normal'

    public static readonly hardRefresh: string = 'hard'

    public static readonly resourcesFinalizer: string = 'resources-finalizer.argocd.argoproj.io'

    public static refreshValue(hard: boolean): string {
        return hard ? ArgoAnnotations.hardRefresh : ArgoAnnotations.normalRefresh
    }
}
