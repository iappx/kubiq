export class NamespaceCreatedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly name: string,
    ) {
    }
}
