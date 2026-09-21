export class OpenNodeShellEvent {
    constructor(
        public readonly clusterId: string,
        public readonly nodeName: string,
    ) {
    }
}
