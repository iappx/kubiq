export class ClusterRemovedEvent {
    constructor(
        public readonly filePath: string,
        public readonly contextNames: string[],
        public readonly kubeconfigDeleted: boolean,
    ) {}
}
