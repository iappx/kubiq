import { inject, injectable } from 'tsyringe'
import { ClipboardService } from '@/application/services/clipboard/ClipboardService'
import { PodEnvironmentReport } from '@/application/services/podEnvironment/models/PodEnvironmentReport'
import { PodEnvironmentSources } from '@/application/services/podEnvironment/models/PodEnvironmentSources'
import { PodEnvironmentText } from '@/application/services/podEnvironment/models/PodEnvironmentText'
import type { TPodEnvironmentEntry } from '@/application/services/podEnvironment/types/TPodEnvironmentEntry'
import type { TPodEnvironmentGroup } from '@/application/services/podEnvironment/types/TPodEnvironmentGroup'
import type { TPodEnvironmentRequest } from '@/application/services/podEnvironment/types/TPodEnvironmentRequest'
import type { TPodEnvironmentSource } from '@/application/services/podEnvironment/types/TPodEnvironmentSource'
import type { TPodEnvironmentSourceState } from '@/application/services/podEnvironment/types/TPodEnvironmentSourceState'
import { ResourceYamlService } from '@/application/services/resourceYaml/ResourceYamlService'
import type { TKubeDataMap } from '@/domain/entities/config'
import { PodEnvironmentPlan } from '@/domain/entities/workloads'
import type { TPodEnvironmentObjectRef, TPodEnvironmentSourceKind } from '@/domain/entities/workloads'
import { KubeKindLocator, KubeManifest, KubeResourceRegistry } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'

@injectable()
export class PodEnvironmentService {
    public static readonly configMapKind: string = 'ConfigMap'

    public static readonly secretKind: string = 'Secret'

    constructor(
        @inject(ResourceYamlService) private readonly yamlService: ResourceYamlService,
        @inject(ClipboardService) private readonly clipboardService: ClipboardService,
    ) {}

    public async describe(request: TPodEnvironmentRequest): Promise<TPodEnvironmentGroup[]> {
        const plans = PodEnvironmentPlan.of(request.object)
        const references = PodEnvironmentPlan.referencesOf(plans)
        const read = await Promise.all(references.map(object => this.read(request, object)))

        const sources = new PodEnvironmentSources()
        references.forEach((object, index) => sources.remember(object, read[index]))

        return PodEnvironmentReport.of(plans, sources)
    }

    public copyEntry(entry: TPodEnvironmentEntry): Promise<void> {
        return this.clipboardService.write(entry.value)
    }

    public async copyGroup(group: TPodEnvironmentGroup): Promise<number> {
        const entries = PodEnvironmentText.copyable(group)
        await this.clipboardService.write(PodEnvironmentText.of(entries))

        return entries.length
    }

    private async read(
        request: TPodEnvironmentRequest,
        object: TPodEnvironmentObjectRef,
    ): Promise<TPodEnvironmentSource> {
        const kind = PodEnvironmentService.kindOf(request.served, object.sourceKind)
        if (!kind) {
            return PodEnvironmentService.absent('missing')
        }

        try {
            const read = await this.yamlService.read({
                clusterId: request.clusterId,
                kind,
                name: object.name,
                namespace: KubeManifest.namespaceOf(request.object),
            })

            return {
                state: 'read',
                data: PodEnvironmentService.dataOf(read),
                encoded: object.sourceKind === 'secret',
            }
        } catch (err) {
            if (KubeStatusReader.isForbidden(err)) {
                return PodEnvironmentService.absent('forbidden')
            }
            if (KubeStatusReader.isMissing(err)) {
                return PodEnvironmentService.absent('missing')
            }

            throw err
        }
    }

    private static kindOf(
        served: readonly KubeResourceKind[],
        sourceKind: TPodEnvironmentSourceKind,
    ): KubeResourceKind | null {
        const name = sourceKind === 'secret'
            ? PodEnvironmentService.secretKind
            : PodEnvironmentService.configMapKind

        return KubeKindLocator.find(served, 'v1', name)
            ?? KubeKindLocator.find(KubeResourceRegistry.all(), 'v1', name)
            ?? null
    }

    // stringData is write-only and never served back, so data is the whole environment either way.
    private static dataOf(object: Record<string, unknown>): TKubeDataMap {
        return KubeManifest.isObject(object.data) ? object.data as TKubeDataMap : {}
    }

    private static absent(state: TPodEnvironmentSourceState): TPodEnvironmentSource {
        return { state, data: {}, encoded: false }
    }
}
