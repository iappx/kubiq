import { inject, singleton } from 'tsyringe'
import { DownloadService } from '../../../bindings/iappx_k8s_admin/core/services/download'
import { DownloadSpec } from '../../../bindings/iappx_k8s_admin/core/services/download/models'
import { ApiError } from '@/domain/errors/ApiError'
import { DownloadRun } from '@/infrastructure/download/DownloadRun'
import type { IDownloadSink } from '@/infrastructure/download/types/IDownloadSink'
import type { TDownloadSpec } from '@/infrastructure/download/types/TDownloadSpec'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class DownloadAdapter {
    public static readonly unavailable: string = 'Downloads need the desktop application'

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public isAvailable(): boolean {
        return this.runtime.isAvailable()
    }

    public async start(spec: TDownloadSpec, sink: IDownloadSink): Promise<DownloadRun> {
        const run = new DownloadRun(sink)

        if (!this.isAvailable()) {
            run.fail(new ApiError(DownloadAdapter.unavailable))

            return run
        }

        // Must precede Start: a small file can finish before its answer arrives.
        run.listen()

        let started
        try {
            started = await DownloadService.Start(new DownloadSpec({
                url: spec.url,
                path: spec.path,
                headers: { ...(spec.headers ?? {}) },
            }))
        } catch (err) {
            run.fail(new ApiError(DownloadRun.failureMessage, err instanceof Error ? err.message : String(err)))

            return run
        }

        if (!started.success || started.downloadId === '') {
            run.fail(new ApiError(DownloadRun.failureMessage, started.error))

            return run
        }

        run.attach(started.downloadId)

        return run
    }
}
