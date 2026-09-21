import { inject, injectable } from 'tsyringe'
import type { EntityAttribute, RepoEntityBase } from '@iappx/entity-repo'
import type { RestEntityQuery } from '@iappx/entity-repo-rest'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { YamlApplyPlanner } from '@/application/services/resourceYaml/models/YamlApplyPlanner'
import type { TResourceObjectRequest } from '@/application/services/resourceYaml/types/TResourceObjectRequest'
import type { TYamlApplyPlan } from '@/application/services/resourceYaml/types/TYamlApplyPlan'
import type { TYamlApplyRequest } from '@/application/services/resourceYaml/types/TYamlApplyRequest'
import type { TYamlApplyResult } from '@/application/services/resourceYaml/types/TYamlApplyResult'
import type { TYamlCreateRequest } from '@/application/services/resourceYaml/types/TYamlCreateRequest'
import type { TYamlCreateResult } from '@/application/services/resourceYaml/types/TYamlCreateResult'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeManifest } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import { KubeEntitySets } from '@/infrastructure/entityRepo/kube/KubeEntitySets'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'
import { KubeObjectAdapter } from '@/infrastructure/kube/KubeObjectAdapter'

@injectable()
export class ResourceYamlService {
    public static readonly notConnected: string = 'That cluster is not connected'

    public static readonly cannotExpress: string = 'This build cannot write every field of that manifest'

    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(KubeObjectAdapter) private readonly objects: KubeObjectAdapter,
    ) {}

    public async read(request: TResourceObjectRequest): Promise<Record<string, unknown>> {
        const path = request.kind.objectPath(request.name, request.kind.namespaced ? request.namespace : undefined)
        const object = await this.objects.read(request.clusterId, this.session(request.clusterId), path)

        return KubeManifest.readable(object)
    }

    public plan(
        clusterId: string,
        kind: KubeResourceKind,
        current: Record<string, unknown>,
        edited: Record<string, unknown>,
    ): TYamlApplyPlan {
        return YamlApplyPlanner.plan(current, edited, this.attributes(clusterId, kind), kind.canPatch, kind.canUpdate)
    }

    public async apply(request: TYamlApplyRequest): Promise<TYamlApplyResult> {
        const plan = this.plan(request.clusterId, request.kind, request.current, request.edited)
        if (plan.unsupported.length > 0) {
            throw new ApiError(
                ResourceYamlService.cannotExpress,
                `${request.kind.kind} is modelled without ${plan.unsupported.join(', ')} — change those fields with kubectl`,
            )
        }
        if (plan.mode === 'noop') {
            return { plan, object: request.current }
        }

        const query = this.query(request.clusterId, request.kind, request.namespace)
            .withPathParams({ [KubeUrlBuilder.nameParam]: request.name })

        if (plan.mode === 'replace') {
            await query.update(query.entityConstructor.build(request.edited))
        } else {
            await query.patch(ResourceYamlService.changes(query, request, plan))
        }

        // The API server defaults fields, bumps the resourceVersion and rewrites
        // managedFields, so what it now holds is read back rather than guessed at.
        return { plan, object: await this.read(request) }
    }

    public async create(request: TYamlCreateRequest): Promise<TYamlCreateResult> {
        const namespace = KubeManifest.namespaceOf(request.document) || request.namespace
        const query = this.query(request.clusterId, request.kind, request.kind.namespaced ? namespace : '')

        const created = await query.create(query.entityConstructor.build(request.document))

        return {
            name: ResourceYamlService.read(created, 'name') || KubeManifest.nameOf(request.document),
            namespace: ResourceYamlService.read(created, 'namespace') || namespace,
        }
    }

    public attributes(clusterId: string, kind: KubeResourceKind): Record<string, EntityAttribute> {
        return this.query(clusterId, kind, '').entityConstructor.getAttributes()
    }

    // A merge patch has no optimistic concurrency of its own: resourceVersion in the body
    // is what turns it into a test-and-set the API server answers with 409.
    private static changes(
        query: RestEntityQuery<RepoEntityBase>,
        request: TYamlApplyRequest,
        plan: TYamlApplyPlan,
    ): RepoEntityBase {
        const changes = query.entityConstructor.build({})
        plan.fields.forEach(field => changes.setDataValue(field, request.edited[field]))

        if (!plan.fields.includes(KubeManifest.metadataKey)) {
            changes.setDataValue(KubeManifest.metadataKey, {
                resourceVersion: KubeManifest.resourceVersionOf(request.current),
            })
        }

        return changes
    }

    private static read(entity: RepoEntityBase | undefined, key: string): string {
        const value = entity ? (entity as unknown as Record<string, unknown>)[key] : undefined

        return typeof value === 'string' ? value : ''
    }

    private query(clusterId: string, kind: KubeResourceKind, namespace: string): RestEntityQuery<RepoEntityBase> {
        return KubeEntitySets.queryFor(this.connectionService.context(clusterId), kind, namespace)
    }

    private session(clusterId: string): string {
        const connection = this.connectionService.connection(clusterId)
        if (!connection) {
            throw new ApiError(
                ResourceYamlService.notConnected,
                `No open session for "${clusterId}" — connect to it from the cluster catalog first`,
            )
        }

        return connection.sessionId
    }
}
