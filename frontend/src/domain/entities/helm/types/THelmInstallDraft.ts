export type THelmInstallDraft = {
    releaseName: string
    namespace: string
    createNamespace: boolean
    chart: string
    version: string
    values: string
}
