export type TDownloadMessage = {
    downloadId: string
    progress?: { received: number, total: number }
    done?: { success: boolean, cancelled: boolean, path: string, size: number, sha256: string, error: string }
}
