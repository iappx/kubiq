export class BulkActionCompletedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly action: 'delete' | 'restart' | 'cordon' | 'uncordon',
        public readonly kindName: string,
        public readonly kindTitle: string,
        public readonly succeeded: number,
        public readonly failed: number,
    ) {
    }
}
