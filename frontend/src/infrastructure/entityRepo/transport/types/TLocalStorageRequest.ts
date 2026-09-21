export type TLocalStorageRequest = {
    key: string
    operation: 'read' | 'write'
    content?: string
}
