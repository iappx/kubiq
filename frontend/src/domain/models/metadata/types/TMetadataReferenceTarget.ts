export type TMetadataReferenceTarget = {
    kindName: string
    apiVersion: string
    name: string
    namespace: string
    routeKind: 'kube' | 'helm' | 'argocd'
}
