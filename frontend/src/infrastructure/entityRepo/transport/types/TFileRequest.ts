export type TFileRequest = {
    path: string
    operation: 'read' | 'write' | 'remove'
    content?: string
}
