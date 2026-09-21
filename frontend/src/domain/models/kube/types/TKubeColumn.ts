export type TKubeColumn = {
    /** An entity property or getter for a built-in kind; the jsonPath drives a dynamic one. */
    key: string
    title: string
    jsonPath?: string
    align?: 'left' | 'right'
    /** Kubernetes printer-column priority: 0 is always shown, above 0 only in a wide table. */
    priority?: number
}
