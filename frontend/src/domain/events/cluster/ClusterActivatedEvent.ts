export class ClusterActivatedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly contextName: string,
    ) {
    }
}
