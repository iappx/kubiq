export type TNodeTaint = {
    key: string
    value?: string
    effect?: string
    /** RFC 3339 timestamp. */
    timeAdded?: string
}
