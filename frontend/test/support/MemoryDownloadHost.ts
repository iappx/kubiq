import { DownloadRun } from '@/infrastructure/download/DownloadRun'

export type TScriptedDownload = {
    body?: string
    progress?: number[]
    hold?: boolean
    refuse?: string
    error?: string
}

export type TStartedDownload = {
    url: string
    path: string
    headers: Record<string, string>
}

export class MemoryDownloadHost {
    public readonly started: TStartedDownload[] = []

    public readonly cancelled: string[] = []

    private readonly scripted: TScriptedDownload[] = []

    private sequence = 0

    public script(download: TScriptedDownload): void {
        this.scripted.push(download)
    }

    public reset(): void {
        this.started.splice(0, this.started.length)
        this.cancelled.splice(0, this.cancelled.length)
        this.scripted.splice(0, this.scripted.length)
        this.sequence = 0
    }

    public async start(spec: TStartedDownload): Promise<{ success: boolean, downloadId: string, error: string }> {
        this.started.push({ ...spec, headers: { ...spec.headers } })

        const download = this.scripted.shift() ?? {}
        if (download.refuse !== undefined) {
            return { success: false, downloadId: '', error: download.refuse }
        }

        const downloadId = `d${++this.sequence}`
        this.play(downloadId, spec.path, download)

        return { success: true, downloadId, error: '' }
    }

    public async cancel(downloadId: string): Promise<{ success: boolean, error: string }> {
        this.cancelled.push(downloadId)
        MemoryDownloadHost.emit(DownloadRun.doneEvent, {
            downloadId, success: false, cancelled: true, path: '', size: 0, sha256: '', error: 'download cancelled',
        })

        return { success: true, error: '' }
    }

    public progress(downloadId: string, received: number, total: number): void {
        MemoryDownloadHost.emit(DownloadRun.progressEvent, { downloadId, received, total })
    }

    public static async sha256Of(body: string): Promise<string> {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))

        return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
    }

    private play(downloadId: string, path: string, download: TScriptedDownload): void {
        const body = download.body ?? 'installer'
        const total = body.length

        for (const received of download.progress ?? []) {
            this.progress(downloadId, received, total)
        }
        if (download.hold === true) {
            return
        }

        if (download.error !== undefined) {
            MemoryDownloadHost.emit(DownloadRun.doneEvent, {
                downloadId, success: false, cancelled: false, path, size: 0, sha256: '', error: download.error,
            })
            return
        }

        void MemoryDownloadHost.sha256Of(body).then(sha256 => MemoryDownloadHost.emit(DownloadRun.doneEvent, {
            downloadId, success: true, cancelled: false, path, size: total, sha256, error: '',
        }))
    }

    private static emit(name: string, data: unknown): void {
        (window as any)._wails.dispatchWailsEvent({ name, data })
    }
}
