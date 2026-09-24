import type { TConfigReferenceUse } from '@/domain/entities/config/types/TConfigReferenceUse'

export class ConfigReferenceUseCatalog {
    public static readonly labels: Readonly<Record<TConfigReferenceUse, string>> = {
        volume: 'volume',
        projectedVolume: 'projected volume',
        envFrom: 'envFrom',
        env: 'env',
        imagePullSecret: 'imagePullSecrets',
        mountableSecret: 'secrets',
        tls: 'TLS',
    }

    public static describe(uses: readonly TConfigReferenceUse[]): string {
        return uses.map(use => ConfigReferenceUseCatalog.labels[use]).join(', ')
    }
}
