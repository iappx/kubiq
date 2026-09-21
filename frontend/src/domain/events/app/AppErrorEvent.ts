export class AppErrorEvent {
    constructor(
        public readonly error: unknown,
        /** Where it happened — logged, never shown to the user. */
        public readonly context?: string,
    ) {
    }
}
