import { KubeColumns } from '@/domain/models/kube/KubeColumns'
import { KubeResourceKind } from '@/domain/models/kube/KubeResourceKind'
import { KubeSectionCatalog } from '@/domain/models/kube/KubeSectionCatalog'
import { KubeVerbCatalog } from '@/domain/models/kube/KubeVerbCatalog'
import type { TKubeColumn } from '@/domain/models/kube/types/TKubeColumn'
import type { TCrdPrinterColumnDocument } from '@/domain/models/kube/discovery/types/TCrdPrinterColumnDocument'
import type { TCustomResourceDefinitionDocument } from '@/domain/models/kube/discovery/types/TCustomResourceDefinitionDocument'

export class KubeCrdReader {
    public static readonly icon: string = 'Puzzle'

    public static read(crd: TCustomResourceDefinitionDocument): KubeResourceKind[] {
        const spec = crd?.spec
        const group = spec?.group
        const resource = spec?.names?.plural
        const kind = spec?.names?.kind
        if (!group || !resource || !kind) {
            return []
        }
        const namespaced = spec?.scope === 'Namespaced'
        const result: KubeResourceKind[] = []
        const versions = spec?.versions ?? []
        for (let i = 0; i < versions.length; i++) {
            const version = versions[i]
            if (version.served !== true || !version.name) {
                continue
            }
            result.push(new KubeResourceKind({
                group,
                version: version.name,
                resource,
                kind,
                title: kind,
                namespaced,
                section: KubeSectionCatalog.custom,
                icon: KubeCrdReader.icon,
                columns: KubeCrdReader.columns(namespaced, version.additionalPrinterColumns),
                verbs: KubeVerbCatalog.all(),
                isCustom: true,
            }))
        }
        return result
    }

    public static columns(namespaced: boolean, printerColumns: TCrdPrinterColumnDocument[] | undefined): TKubeColumn[] {
        const declared = (printerColumns ?? []).filter(p => !!p.name && !!p.jsonPath)
        if (declared.length === 0) {
            return KubeColumns.baseWithAge(namespaced)
        }
        const mapped = declared.map(column => ({
            key: column.name as string,
            title: column.name as string,
            jsonPath: column.jsonPath,
            priority: column.priority,
        }))
        return [...KubeColumns.base(namespaced), ...mapped]
    }
}
