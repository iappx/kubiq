export class DefaultClassChangedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly kindName: string,
        public readonly name: string,
        public readonly isDefault: boolean,
        public readonly cleared: readonly string[],
    ) {
    }
}
