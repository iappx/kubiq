import { inject, singleton } from 'tsyringe'
import { ProcessService } from '../../../bindings/iappx_k8s_admin/core/services/process'
import { StartSpec } from '../../../bindings/iappx_k8s_admin/core/services/process/models'
import { ApiError } from '@/domain/errors/ApiError'
import { ProcessRun } from '@/infrastructure/process/ProcessRun'
import { ProcessCollector } from '@/infrastructure/process/ProcessCollector'
import type { IProcessSink } from '@/infrastructure/process/types/IProcessSink'
import type { TProcessOutcome } from '@/infrastructure/process/types/TProcessOutcome'
import type { TProcessSpec } from '@/infrastructure/process/types/TProcessSpec'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class ProcessAdapter {
    public static readonly unavailableCode: number = -2

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public isAvailable(): boolean {
        return this.runtime.isAvailable()
    }

    public async start(spec: TProcessSpec, sink: IProcessSink): Promise<ProcessRun> {
        const run = new ProcessRun(sink)

        if (!this.isAvailable()) {
            run.cancel(ProcessAdapter.unavailableCode)

            return run
        }

        // Must precede Start: the first chunks are emitted while its answer is still in flight.
        run.listen()

        let started
        try {
            started = await ProcessService.Start(ProcessAdapter.specOf(spec))
        } catch (err) {
            run.cancel(ProcessAdapter.unavailableCode)
            throw new ApiError(
                `Could not run ${spec.command}`,
                err instanceof Error ? err.message : String(err),
            )
        }

        if (!started.success || started.processId === '') {
            run.cancel(ProcessAdapter.unavailableCode)
            throw new ApiError(`Could not run ${spec.command}`, started.error)
        }

        run.attach(started.processId)

        return run
    }

    public async collect(spec: TProcessSpec): Promise<TProcessOutcome> {
        if (!this.isAvailable()) {
            return { code: ProcessAdapter.unavailableCode, stdout: '', stderr: '' }
        }

        const collector = new ProcessCollector()
        await this.start(spec, collector)

        return collector.outcome()
    }

    private static specOf(spec: TProcessSpec): StartSpec {
        return new StartSpec({
            command: spec.command,
            args: [...spec.args],
            env: { ...(spec.env ?? {}) },
            dir: spec.dir ?? '',
            pty: false,
            cols: 0,
            rows: 0,
        })
    }
}
