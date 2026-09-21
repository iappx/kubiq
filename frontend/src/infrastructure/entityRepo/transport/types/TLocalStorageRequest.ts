export type TLocalStorageRequest = {
    key: string
    operation: 'read' | 'write'
    /** Required for `write`, ignored otherwise. */
    content?: string
}
