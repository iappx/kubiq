export type TFileRequest = {
    path: string
    operation: 'read' | 'write' | 'remove' | 'list' | 'stat'
    content?: string
}
