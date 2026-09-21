export interface IKubeClusterProbe {
    succeeded(): void

    failed(error: unknown): void
}
