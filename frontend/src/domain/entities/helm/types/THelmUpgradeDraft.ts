export type THelmUpgradeDraft = {
    releaseName: string
    namespace: string
    chart: string
    version: string
    values: string
    reuseValues: boolean
}
