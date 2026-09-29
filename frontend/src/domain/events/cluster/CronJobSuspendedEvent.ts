export class CronJobSuspendedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly name: string,
        public readonly namespace: string,
        public readonly suspended: boolean,
    ) {
    }
}
