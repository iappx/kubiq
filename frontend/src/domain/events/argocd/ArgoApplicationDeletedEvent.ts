export class ArgoApplicationDeletedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly namespace: string,
        public readonly name: string,
        public readonly cascade: boolean,
    ) {}
}
