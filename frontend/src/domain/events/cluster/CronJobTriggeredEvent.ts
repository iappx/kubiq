export class CronJobTriggeredEvent {
    constructor(
        public readonly clusterId: string,
        public readonly name: string,
        public readonly namespace: string,
        public readonly jobName: string,
    ) {
    }
}
