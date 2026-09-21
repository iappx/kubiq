export type TKubeGvr = {
    // Empty means the core group, not unset; its objects live under /api instead of /apis.
    group: string
    version: string
    resource: string
}
