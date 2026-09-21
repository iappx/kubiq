import { TerminalSession } from '@/application/services/terminal/models/TerminalSession'
import type { ITerminalSink } from '@/application/services/terminal/types/ITerminalSink'
import type { TTerminalKind } from '@/domain/models/terminal'
import type { PtyAdapter } from '@/infrastructure/process/PtyAdapter'
import type { IPtyHandler } from '@/infrastructure/process/types/IPtyHandler'

export class PtyTerminalSession extends TerminalSession implements IPtyHandler {
    private processId: string = ''

    constructor(
        key: string,
        clusterId: string,
        kind: TTerminalKind,
        sink: ITerminalSink,
        private readonly ptys: PtyAdapter,
    ) {
        super(key, clusterId, kind, sink)
    }

    public attach(processId: string): void {
        if (this.disposed) {
            void this.ptys.kill(processId)
            return
        }

        this.processId = processId
        this.enter('running')
    }

    public onData(_stream: string, data: Uint8Array): void {
        this.enter('running')
        this.publish(data)
    }

    public onExit(code: number): void {
        if (this.disposed) {
            return
        }

        this.enter('ended', code === 0 ? '' : `The shell exited with code ${code}`)
    }

    public write(data: Uint8Array): Promise<void> {
        return this.isWritable ? this.ptys.write(this.processId, data) : Promise.resolve()
    }

    public resize(cols: number, rows: number): Promise<void> {
        return this.ptys.resize(this.processId, cols, rows)
    }

    public async stop(): Promise<void> {
        const processId = this.processId
        this.processId = ''
        this.dispose()

        await this.ptys.kill(processId)
    }
}
