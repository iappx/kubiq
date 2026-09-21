import type { Identifier } from '@iappx/entity-repo'
import { QueryableEntityQuery, QueryValidator } from '@iappx/entity-repo-query'
import { HelmReleaseEntity } from '@/domain/entities/helm/HelmReleaseEntity'
import type { THelmReleaseRef } from '@/domain/entities/helm/types/THelmReleaseRef'
import { HelmCommand } from '@/domain/models/helm/HelmCommand'
import { HelmOutput } from '@/domain/models/helm/HelmOutput'
import { HelmReleaseKey } from '@/domain/models/helm/HelmReleaseKey'
import { HelmListCompiler } from '@/infrastructure/entityRepo/helm/queries/compilers/HelmListCompiler'
import type { THelmQueryPlan } from '@/infrastructure/entityRepo/helm/queries/types/THelmQueryPlan'
import { HelmTransport } from '@/infrastructure/entityRepo/helm/transport/HelmTransport'

export class HelmReleaseQuery extends QueryableEntityQuery<HelmReleaseEntity, HelmTransport> {
    private static readonly compiler = new HelmListCompiler()

    public compile(): THelmQueryPlan {
        const ast = this.toAst()
        new QueryValidator(HelmReleaseQuery.compiler.capabilities, HelmReleaseQuery.compiler.name).validate(ast)

        return HelmReleaseQuery.compiler.compile(ast, this.createContext())
    }

    public async getAll(): Promise<HelmReleaseEntity[]> {
        const raw = await this.transport.send<unknown>({ args: this.compile().args, json: true })

        return HelmOutput.releases(raw).map(record => this.entityConstructor.build(record))
    }

    public async getById(id: Identifier): Promise<HelmReleaseEntity | null> {
        const ref = HelmReleaseKey.parse(String(id))
        const found = await this
            .andWhere(filter => filter.and(filter.eq('namespace', ref.namespace), filter.eq('name', ref.name)))
            .getAll()

        return found.find(release => release.id === id) ?? null
    }

    public valuesOf(ref: THelmReleaseRef, computed: boolean): Promise<string> {
        return this.document(HelmCommand.values(ref.name, computed), ref)
    }

    public manifest(ref: THelmReleaseRef): Promise<string> {
        return this.document(HelmCommand.manifest(ref.name), ref)
    }

    public notes(ref: THelmReleaseRef): Promise<string> {
        return this.document(HelmCommand.notes(ref.name), ref)
    }

    protected async document(args: string[], ref: THelmReleaseRef): Promise<string> {
        const text = await this.transport.send<string | null>({
            args: [...args, ...HelmCommand.namespace(ref.namespace)],
        })

        return text ?? ''
    }
}
