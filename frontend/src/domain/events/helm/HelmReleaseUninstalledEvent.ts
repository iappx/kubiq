export class HelmReleaseUninstalledEvent {
    constructor(
        public readonly clusterId: string,
        public readonly namespace: string,
        public readonly releaseName: string,
    ) {}
}
