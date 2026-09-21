import { QueryOperators } from '@iappx/entity-repo-query'
import type { CompileContext, IQueryCompiler, TQueryAst, TQueryCapabilities } from '@iappx/entity-repo-query'
import { HelmChartRef } from '@/domain/models/helm/HelmChartRef'
import { HelmCommand } from '@/domain/models/helm/HelmCommand'
import { HelmQueryMeta } from '@/infrastructure/entityRepo/helm/HelmQueryMeta'
import { HelmSearchFilterVisitor } from '@/infrastructure/entityRepo/helm/queries/compilers/HelmSearchFilterVisitor'
import type { THelmQueryPlan } from '@/infrastructure/entityRepo/helm/queries/types/THelmQueryPlan'

export class HelmSearchCompiler implements IQueryCompiler<THelmQueryPlan> {
    public readonly name: string = 'HelmSearch'

    public readonly capabilities: TQueryCapabilities = {
        operators: [QueryOperators.eq, QueryOperators.contains],
        logical: { or: false, not: false, nesting: true },
        relationFilters: { enabled: false, quantifiers: [] },
        relationArguments: false,
        paging: [],
        ordering: { multiple: false, nulls: false, byPath: false },
        selection: 'none',
        raw: false,
    }

    private readonly filters = new HelmSearchFilterVisitor()

    public compile(ast: TQueryAst, context: CompileContext): THelmQueryPlan {
        const filter = ast.filter
            ? this.filters.encode(ast.filter, context)
            : HelmSearchFilterVisitor.empty()

        return {
            args: HelmCommand.search(
                HelmChartRef.keyword(filter.keyword, filter.repoName),
                HelmQueryMeta.includesAllVersions(ast.meta),
            ),
        }
    }
}
