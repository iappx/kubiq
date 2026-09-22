export type TRouteQueryField = {
    key: string
    read: () => string
    write: (value: string) => void
    defaultValue?: string
}
