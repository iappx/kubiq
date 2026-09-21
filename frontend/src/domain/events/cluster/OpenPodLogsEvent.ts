export class OpenPodLogsEvent {
    constructor(
        public readonly clusterId: string,
        public readonly namespace: string,
        public readonly podName: string,
        public readonly containerName: string = '',
        public readonly previous: boolean = false,
    ) {
    }
}
