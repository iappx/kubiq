export class WorkloadScaledEvent {
    constructor(
        public readonly clusterId: string,
        public readonly kindName: string,
        public readonly name: string,
        public readonly namespace: string,
        public readonly replicas: number,
    ) {
    }
}
