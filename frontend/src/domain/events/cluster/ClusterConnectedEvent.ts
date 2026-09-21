export class ClusterConnectedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly contextName: string,
        public readonly versionText: string,
    ) {
    }
}
