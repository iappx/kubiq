export class ResourceDeletedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly kindName: string,
        public readonly name: string,
        public readonly namespace: string,
    ) {
    }
}
