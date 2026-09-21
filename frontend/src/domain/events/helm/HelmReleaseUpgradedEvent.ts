export class HelmReleaseUpgradedEvent {
    constructor(
        public readonly clusterId: string,
        public readonly namespace: string,
        public readonly releaseName: string,
        public readonly chart: string,
    ) {}
}
