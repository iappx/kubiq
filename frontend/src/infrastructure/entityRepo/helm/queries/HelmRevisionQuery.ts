import { EntityQuery } from '@iappx/entity-repo'
import type { Identifier } from '@iappx/entity-repo'
import { HelmRevisionEntity } from '@/domain/entities/helm/HelmRevisionEntity'
import type { THelmReleaseRef } from '@/domain/entities/helm/types/THelmReleaseRef'
import { HelmCommand } from '@/domain/models/helm/HelmCommand'
import { HelmOutput } from '@/domain/models/helm/HelmOutput'
import type { THelmRevisionOptions } from '@/infrastructure/entityRepo/helm/queries/types/THelmRevisionOptions'
import { HelmTransport } from '@/infrastructure/entityRepo/helm/transport/HelmTransport'

// No builder: helm history takes neither a condition, nor a sort, nor an offset —
// only a release and a cap, and the cap is a property of the set, not of a query.
export class HelmRevisionQuery extends EntityQuery<HelmRevisionEntity, HelmTransport, THelmRevisionOptions> {
    public static readonly defaultMax: number = 64

    private release: THelmReleaseRef = { name: '', namespace: '' }

    public forRelease(ref: THelmReleaseRef): HelmRevisionQuery {
        const scoped = new HelmRevisionQuery(this.entityConstructor, this.transport, this.options)
        scoped.release = { name: ref.name, namespace: ref.namespace }

        return scoped
    }

    public async getAll(): Promise<HelmRevisionEntity[]> {
        if (this.release.name === '') {
            return []
        }

        const raw = await this.transport.send<unknown>({
            args: [
                ...HelmCommand.history(this.release.name, this.max),
                ...HelmCommand.namespace(this.release.namespace),
            ],
            json: true,
        })

        return HelmOutput.revisions(raw, this.release)
            .map(record => this.entityConstructor.build(record))
            .sort((left, right) => right.revision - left.revision)
    }

    public async getById(id: Identifier): Promise<HelmRevisionEntity | null> {
        const revisions = await this.getAll()

        return revisions.find(revision => revision.id === id) ?? null
    }

    private get max(): number {
        return this.options?.max ?? HelmRevisionQuery.defaultMax
    }
}
