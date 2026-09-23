export class UpdateAvailableEvent {
    constructor(
        public readonly version: string,
        public readonly automatic: boolean,
    ) {}
}
