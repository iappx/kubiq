export type TKubeGvr = {
    /** Empty for the core group, whose objects live under /api instead of /apis. */
    group: string
    version: string
    resource: string
}
