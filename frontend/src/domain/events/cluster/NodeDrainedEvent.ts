export class NodeDrainedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly name: string,
        public readonly evicted: number,
        public readonly skipped: number,
        public readonly failed: number,
    ) {
    }
}
