export class KubeconfigSkippedEvent {
    constructor(
        public readonly filePath: string,
        public readonly reason: string,
        public readonly details: string,
    ) {}
}
