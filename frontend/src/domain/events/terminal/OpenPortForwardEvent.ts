export class OpenPortForwardEvent {
    constructor(
        public readonly clusterId: string,
        public readonly namespace: string,
        public readonly resource: string,
        public readonly name: string,
        public readonly remotePort: number = 0,
    ) {
    }
}
