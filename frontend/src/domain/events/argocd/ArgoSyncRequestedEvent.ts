export class ArgoSyncRequestedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly namespace: string,
        public readonly name: string,
        public readonly revision: string,
        public readonly dryRun: boolean,
    ) {}
}
