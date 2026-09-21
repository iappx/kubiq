export class PortForwardStartedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly forwardId: string,
        public readonly label: string,
        public readonly localPort: number,
    ) {
    }
}
