import type { Identifier } from '@iappx/entity-repo'
import { QueryableEntityQuery, QueryValidator } from '@iappx/entity-repo-query'
import { HelmChartEntity } from '@/domain/entities/helm/HelmChartEntity'
import { HelmCommand } from '@/domain/models/helm/HelmCommand'
import { HelmOutput } from '@/domain/models/helm/HelmOutput'
import { HelmSearchCompiler } from '@/infrastructure/entityRepo/helm/queries/compilers/HelmSearchCompiler'
import type { THelmQueryPlan } from '@/infrastructure/entityRepo/helm/queries/types/THelmQueryPlan'
import { HelmTransport } from '@/infrastructure/entityRepo/helm/transport/HelmTransport'

export class HelmChartQuery extends QueryableEntityQuery<HelmChartEntity, HelmTransport> {
    private static readonly compiler = new HelmSearchCompiler()

    public compile(): THelmQueryPlan {
        const ast = this.toAst()
        new QueryValidator(HelmChartQuery.compiler.capabilities, HelmChartQuery.compiler.name).validate(ast)

        return HelmChartQuery.compiler.compile(ast, this.createContext())
    }

    public async getAll(): Promise<HelmChartEntity[]> {
        const raw = await this.transport.send<unknown>({ args: this.compile().args, json: true })

        return HelmOutput.charts(raw).map(record => this.entityConstructor.build(record))
    }

    public async getById(id: Identifier): Promise<HelmChartEntity | null> {
        const charts = await this.getAll()

        return charts.find(chart => chart.id === id) ?? null
    }

    public readme(ref: string, version: string): Promise<string> {
        return this.document(HelmCommand.showReadme(ref, version))
    }

    public defaultValues(ref: string, version: string): Promise<string> {
        return this.document(HelmCommand.showValues(ref, version))
    }

    protected async document(args: string[]): Promise<string> {
        const text = await this.transport.send<string | null>({ args })

        return text ?? ''
    }
}
