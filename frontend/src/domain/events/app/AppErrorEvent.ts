export class AppErrorEvent {
    constructor(
        public readonly error: unknown,
        public readonly context?: string,
    ) {
    }
}
