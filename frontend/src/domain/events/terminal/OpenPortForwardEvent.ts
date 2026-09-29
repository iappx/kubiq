import type { TPortForwardRemotePort } from '@/domain/entities/portForward/types/TPortForwardRemotePort'

export class OpenPortForwardEvent {
    constructor(
        public readonly clusterId: string,
        public readonly namespace: string = '',
        public readonly resource: string = '',
        public readonly name: string = '',
        public readonly remotePort: TPortForwardRemotePort = '',
        public readonly forwardId: string = '',
    ) {
    }

    public static edit(clusterId: string, forwardId: string): OpenPortForwardEvent {
        return new OpenPortForwardEvent(clusterId, '', '', '', '', forwardId)
    }

    public get isEdit(): boolean {
        return this.forwardId !== ''
    }

    public get hasTarget(): boolean {
        return this.name !== ''
    }
}
