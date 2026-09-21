export class OpenLocalShellEvent {
    constructor(
        public readonly clusterId: string,
        public readonly namespace: string = '',
    ) {
    }
}
