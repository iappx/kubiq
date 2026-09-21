export class NodeSchedulingChangedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly name: string,
        public readonly cordoned: boolean,
    ) {
    }
}
