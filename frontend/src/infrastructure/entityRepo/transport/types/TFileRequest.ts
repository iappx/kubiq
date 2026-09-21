export type TFileRequest = {
    path: string
    operation: 'read' | 'write'
    content?: string
}
