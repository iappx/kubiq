import type { TKubeSection } from '@/domain/models/kube/types/TKubeSection'

export class KubeSectionCatalog {
    public static readonly custom: TKubeSection = 'custom'

    public static readonly values: Record<TKubeSection, string> = {
        cluster: 'Cluster',
        workloads: 'Workloads',
        config: 'Config',
        network: 'Network',
        storage: 'Storage',
        access: 'Access Control',
        custom: 'Custom Resources',
    }

    private static readonly sequence: TKubeSection[] = [
        'cluster',
        'workloads',
        'config',
        'network',
        'storage',
        'access',
        'custom',
    ]

    public static title(section: TKubeSection): string {
        return KubeSectionCatalog.values[section] ?? section
    }

    public static has(section: string): boolean {
        return Object.prototype.hasOwnProperty.call(KubeSectionCatalog.values, section)
    }

    public static all(): TKubeSection[] {
        return [...KubeSectionCatalog.sequence]
    }

    public static orderOf(section: TKubeSection): number {
        const index = KubeSectionCatalog.sequence.indexOf(section)
        return index === -1 ? KubeSectionCatalog.sequence.length : index
    }
}
