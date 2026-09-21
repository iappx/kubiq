export class ClusterDisconnectedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly contextName: string,
        public readonly stoppedStreams: number,
    ) {
    }
}
