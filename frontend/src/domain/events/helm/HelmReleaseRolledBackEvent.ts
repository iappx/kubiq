export class HelmReleaseRolledBackEvent {
    constructor(
        public readonly clusterId: string,
        public readonly namespace: string,
        public readonly releaseName: string,
        public readonly revision: number,
    ) {}
}
