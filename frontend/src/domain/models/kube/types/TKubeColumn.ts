export type TKubeColumn = {
    // A built-in kind reads this off the entity; a custom one is driven by jsonPath instead.
    key: string
    title: string
    jsonPath?: string
    align?: 'left' | 'right'
    // Kubernetes printer-column priority: 0 is always shown, above 0 only in a wide table.
    priority?: number
}
