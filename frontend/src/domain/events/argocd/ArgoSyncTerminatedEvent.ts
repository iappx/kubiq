export class ArgoSyncTerminatedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly namespace: string,
        public readonly name: string,
    ) {}
}
