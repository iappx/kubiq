export class ClusterNamespacesChangedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly namespaces: string[],
    ) {
    }
}
