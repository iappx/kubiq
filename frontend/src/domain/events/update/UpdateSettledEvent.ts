export class UpdateSettledEvent {
    constructor(
        public readonly target: string,
        public readonly current: string,
        public readonly applied: boolean,
    ) {}
}
