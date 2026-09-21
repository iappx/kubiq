import { inject, singleton } from 'tsyringe'
import { ProcessService, StartSpec } from '../../../bindings/iappx_k8s_admin/core/services/process'
import { TerminalBytes } from '@/domain/models/terminal'
import { ApiError } from '@/domain/errors/ApiError'
import { PtySubscription } from '@/infrastructure/process/PtySubscription'
import type { IPtyHandler } from '@/infrastructure/process/types/IPtyHandler'
import type { TPtySpec } from '@/infrastructure/process/types/TPtySpec'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class PtyAdapter {
    public static readonly unstartable: string = 'Could not start the shell'

    public static readonly unwritable: string = 'Could not send input to the shell'

    private readonly open = new Map<string, PtySubscription>()

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public get isAvailable(): boolean {
        return this.runtime.isAvailable()
    }

    public async start(spec: TPtySpec, handler: IPtyHandler): Promise<string> {
        if (!this.isAvailable) {
            return ''
        }

        const subscription = new PtySubscription(handler)
        subscription.listen()

        let result
        try {
            result = await ProcessService.Start(new StartSpec({
                command: spec.command,
                args: [...spec.args],
                env: { ...(spec.env ?? {}) },
                dir: spec.dir ?? '',
                pty: true,
                cols: spec.cols ?? 0,
                rows: spec.rows ?? 0,
            }))
        } catch (err) {
            subscription.cancel()
            throw new ApiError(PtyAdapter.unstartable, err instanceof Error ? err.message : String(err))
        }

        if (!result.success || result.processId === '') {
            subscription.cancel()
            throw new ApiError(PtyAdapter.unstartable, result.error)
        }

        subscription.attach(result.processId)
        this.open.set(result.processId, subscription)

        return result.processId
    }

    public async write(processId: string, data: Uint8Array): Promise<void> {
        if (processId === '' || !this.isAvailable) {
            return
        }

        let result
        try {
            result = await ProcessService.Write(processId, TerminalBytes.encode(data))
        } catch (err) {
            throw new ApiError(PtyAdapter.unwritable, err instanceof Error ? err.message : String(err))
        }

        if (!result.success) {
            throw new ApiError(PtyAdapter.unwritable, result.error)
        }
    }

    public async resize(processId: string, cols: number, rows: number): Promise<void> {
        if (processId === '' || !this.isAvailable) {
            return
        }

        try {
            await ProcessService.Resize(processId, cols, rows)
        } catch {
            return
        }
    }

    public async kill(processId: string): Promise<void> {
        const subscription = this.open.get(processId)
        this.open.delete(processId)
        subscription?.cancel()

        if (processId === '' || !this.isAvailable) {
            return
        }

        try {
            await ProcessService.Kill(processId)
        } catch {
            return
        }
    }
}
