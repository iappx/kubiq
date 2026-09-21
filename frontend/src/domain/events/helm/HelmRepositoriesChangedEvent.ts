export class HelmRepositoriesChangedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly message: string,
    ) {}
}
