export type TFileRequest = {
    path: string
    operation: 'read' | 'write'
    /** Required for `write`, ignored otherwise. */
    content?: string
}
