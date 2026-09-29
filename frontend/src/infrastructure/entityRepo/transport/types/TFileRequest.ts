export type TFileRequest = {
    path: string
    operation: 'read' | 'readBinary' | 'write' | 'copy' | 'remove' | 'list' | 'stat'
    content?: string
    source?: string
}
