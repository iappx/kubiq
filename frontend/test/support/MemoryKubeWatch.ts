import type { IKubeWatchHandler } from '@/infrastructure/entityRepo/kube/transport/types/IKubeWatchHandler'
import type { TKubeWatchEvent } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchEvent'
import type { TKubeWatchStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchStatus'

export class MemoryKubeWatch {
    public stopped = false

    constructor(private readonly handler: IKubeWatchHandler) {}

    public emit(event: TKubeWatchEvent): void {
        this.handler.onEvent(event)
    }

    public object(type: 'added' | 'modified' | 'deleted', name: string, resourceVersion = '1'): void {
        this.emit({
            type,
            object: { metadata: { uid: name, name, namespace: 'payments', resourceVersion } },
        })
    }

    public close(status: TKubeWatchStatus): void {
        this.stopped = true
        this.handler.onClose(status)
    }

    public async stop(): Promise<void> {
        if (this.stopped) {
            return
        }
        this.close('stopped')
    }
}
