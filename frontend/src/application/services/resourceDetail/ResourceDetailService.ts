import { inject, injectable } from 'tsyringe'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { ResourceYamlService } from '@/application/services/resourceYaml/ResourceYamlService'
import { ResourceRelationLimits } from '@/application/services/resourceDetail/constants/ResourceRelationLimits'
import type { TRelatedGroup } from '@/application/services/resourceDetail/types/TRelatedGroup'
import type { TRelatedObject } from '@/application/services/resourceDetail/types/TRelatedObject'
import type { TResourceRelationsRequest } from '@/application/services/resourceDetail/types/TResourceRelationsRequest'
import {
    KubeClusterCatalog,
    KubeKindLocator,
    KubeManifest,
    KubePodRelations,
    KubeResourceRegistry,
    KubeWorkloadCatalog,
} from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import { ConfigReferenceFinder, ConfigReferenceUseCatalog } from '@/domain/entities/config'
import type { TConfigReferenceTarget } from '@/domain/entities/config'
import type { TKubeLabels } from '@/domain/entities/kube'

@injectable()
export class ResourceDetailService {
    public static readonly ownersTitle: string = 'Controlled by'

    public static readonly servicesTitle: string = 'Exposed by'

    public static readonly claimsTitle: string = 'Volume claims'

    public static readonly referrersTitle: string = 'Referenced by'

    constructor(
        @inject(ResourceYamlService) private readonly yamlService: ResourceYamlService,
        @inject(ResourceListService) private readonly listService: ResourceListService,
    ) {}

    public async relations(request: TResourceRelationsRequest): Promise<TRelatedGroup[]> {
        const [owners, services, referrers] = await Promise.all([
            this.owners(request),
            this.services(request),
            this.referrers(request),
        ])

        return [
            { title: ResourceDetailService.ownersTitle, objects: owners },
            { title: ResourceDetailService.servicesTitle, objects: services },
            { title: ResourceDetailService.claimsTitle, objects: ResourceDetailService.claims(request) },
            ...referrers,
        ].filter(group => group.objects.length > 0)
    }

    public async referrers(request: TResourceRelationsRequest): Promise<TRelatedGroup[]> {
        const target = ResourceDetailService.referenceTargetOf(request)
        const namespace = KubeManifest.namespaceOf(request.object)
        if (!target || namespace === '') {
            return []
        }

        const kinds = ConfigReferenceFinder.referrersOf(target.objectKind)
            .map(referrer => KubeKindLocator.find(request.served, referrer.apiVersion, referrer.kind))
            .filter((kind): kind is KubeResourceKind => kind !== undefined)

        const groups = await Promise.all(kinds.map(kind => this.referrersOfKind(request.clusterId, kind, namespace, target)))

        return groups.filter(group => group.objects.length > 0)
    }

    public async owners(request: TResourceRelationsRequest): Promise<TRelatedObject[]> {
        const chain: TRelatedObject[] = []
        const seen = new Set<string>()

        let object = request.object
        let namespace = KubeManifest.namespaceOf(request.object)

        for (let hop = 0; hop < ResourceRelationLimits.maxOwnerHops; hop++) {
            const owner = ResourceDetailService.controllerOf(object)
            if (!owner) {
                return chain
            }

            const kind = KubeKindLocator.find(request.served, owner.apiVersion, owner.kindName)
                ?? KubeKindLocator.find(KubeResourceRegistry.all(), owner.apiVersion, owner.kindName)
                ?? null
            const key = `${owner.kindName}/${namespace}/${owner.name}`
            if (seen.has(key)) {
                return chain
            }
            seen.add(key)

            chain.push({
                key,
                kindName: owner.kindName,
                name: owner.name,
                namespace: kind?.namespaced === false ? '' : namespace,
                kind,
                detail: owner.apiVersion,
            })

            if (!kind) {
                return chain
            }

            const next = await this.tryRead(request.clusterId, kind, owner.name, namespace)
            if (!next) {
                return chain
            }

            object = next
            namespace = KubeManifest.namespaceOf(next) || namespace
        }

        return chain
    }

    // Matching a selector against labels is the inverse of a label selector and the API has
    // no such query, so the list stays namespace-scoped and only the match runs client-side.
    public async services(request: TResourceRelationsRequest): Promise<TRelatedObject[]> {
        const namespace = KubeManifest.namespaceOf(request.object)
        const servicesKind = KubeKindLocator.find(request.served, 'v1', 'Service')
        if (!KubeWorkloadCatalog.isPod(request.kind) || !servicesKind || namespace === '') {
            return []
        }

        const labels = KubePodRelations.labelsOf(request.object)
        if (Object.keys(labels).length === 0) {
            return []
        }

        const listed = await this.tryList(request.clusterId, servicesKind, namespace)

        return listed
            .filter(service => KubePodRelations.matchesSelector(labels, ResourceDetailService.selectorOf(service)))
            .map(service => ({
                key: `service/${namespace}/${service.name}`,
                kindName: servicesKind.kind,
                name: service.name,
                namespace,
                kind: servicesKind,
                detail: service.detail,
            }))
    }

    public static claims(request: TResourceRelationsRequest): TRelatedObject[] {
        const namespace = KubeManifest.namespaceOf(request.object)
        const claimsKind = KubeKindLocator.find(request.served, 'v1', 'PersistentVolumeClaim') ?? null
        if (!KubeWorkloadCatalog.isPod(request.kind)) {
            return []
        }

        return KubePodRelations.claimNames(request.object).map(name => ({
            key: `claim/${namespace}/${name}`,
            kindName: 'PersistentVolumeClaim',
            name,
            namespace,
            kind: claimsKind,
            detail: '',
        }))
    }

    private async referrersOfKind(
        clusterId: string,
        kind: KubeResourceKind,
        namespace: string,
        target: TConfigReferenceTarget,
    ): Promise<TRelatedGroup> {
        const listed = await this.tryListObjects(clusterId, kind, namespace)
        const objects: TRelatedObject[] = []

        for (const candidate of listed) {
            const uses = ConfigReferenceFinder.usesIn(kind.kind, candidate.object, target)
            if (uses.length === 0 || candidate.name === '') {
                continue
            }

            objects.push({
                key: `${kind.key}/${namespace}/${candidate.name}`,
                kindName: kind.kind,
                name: candidate.name,
                namespace,
                kind,
                detail: ConfigReferenceUseCatalog.describe(uses),
            })
        }

        return { title: `${ResourceDetailService.referrersTitle} ${kind.title}`, objects }
    }

    private async tryListObjects(
        clusterId: string,
        kind: KubeResourceKind,
        namespace: string,
    ): Promise<{ name: string; object: Record<string, unknown> }[]> {
        try {
            const result = await this.listService.list({
                clusterId,
                kind,
                namespaces: [namespace],
                limit: ResourceRelationLimits.maxReferenceCandidates,
            })

            return result.items.map((item) => {
                const source = item as unknown as Record<string, unknown>

                return {
                    name: typeof source.name === 'string' ? source.name : '',
                    object: {
                        spec: source.spec,
                        secrets: source.secrets,
                        imagePullSecrets: source.imagePullSecrets,
                    },
                }
            })
        } catch {
            return []
        }
    }

    private static referenceTargetOf(request: TResourceRelationsRequest): TConfigReferenceTarget | null {
        const name = KubeManifest.nameOf(request.object)
        if (name === '') {
            return null
        }
        if (KubeClusterCatalog.isSecret(request.kind)) {
            return { objectKind: 'secret', name }
        }

        return KubeClusterCatalog.isConfigMap(request.kind) ? { objectKind: 'configMap', name } : null
    }

    private async tryRead(
        clusterId: string,
        kind: KubeResourceKind,
        name: string,
        namespace: string,
    ): Promise<Record<string, unknown> | null> {
        try {
            return await this.yamlService.read({ clusterId, kind, name, namespace })
        } catch {
            return null
        }
    }

    private async tryList(
        clusterId: string,
        kind: KubeResourceKind,
        namespace: string,
    ): Promise<{ name: string; detail: string; spec: unknown }[]> {
        try {
            const result = await this.listService.list({
                clusterId,
                kind,
                namespaces: [namespace],
                limit: ResourceRelationLimits.maxRelatedServices,
            })

            return result.items.map((item) => {
                const source = item as unknown as Record<string, unknown>

                return {
                    name: typeof source.name === 'string' ? source.name : '',
                    detail: typeof source.portsText === 'string' ? source.portsText : '',
                    spec: source.spec,
                }
            })
        } catch {
            return []
        }
    }

    private static selectorOf(service: { spec: unknown }): TKubeLabels | undefined {
        const spec = service.spec

        return KubeManifest.isObject(spec) && KubeManifest.isObject(spec.selector)
            ? spec.selector as TKubeLabels
            : undefined
    }

    private static controllerOf(object: Record<string, unknown>): { kindName: string; name: string; apiVersion: string } | null {
        const references = KubeManifest.metadataOf(object).ownerReferences
        if (!Array.isArray(references)) {
            return null
        }

        const owned = references
            .filter((reference): reference is Record<string, unknown> => KubeManifest.isObject(reference))
        const controller = owned.find(reference => reference.controller === true) ?? owned[0]
        if (!controller) {
            return null
        }

        const kindName = typeof controller.kind === 'string' ? controller.kind : ''
        const name = typeof controller.name === 'string' ? controller.name : ''

        return kindName === '' || name === ''
            ? null
            : { kindName, name, apiVersion: typeof controller.apiVersion === 'string' ? controller.apiVersion : '' }
    }
}
