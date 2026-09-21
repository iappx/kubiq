import { QueryOperators, UnsupportedOperationError } from '@iappx/entity-repo-query'
import type { CompileContext, IQueryCompiler, TOrderNode, TPagingNode, TQueryAst, TQueryCapabilities } from '@iappx/entity-repo-query'
import { HelmCommand } from '@/domain/models/helm/HelmCommand'
import { HelmQueryMeta } from '@/infrastructure/entityRepo/helm/HelmQueryMeta'
import { HelmListFilterVisitor } from '@/infrastructure/entityRepo/helm/queries/compilers/HelmListFilterVisitor'
import type { THelmQueryPlan } from '@/infrastructure/entityRepo/helm/queries/types/THelmQueryPlan'

export class HelmListCompiler implements IQueryCompiler<THelmQueryPlan> {
    public static readonly updatedField: string = 'updated'

    public readonly name: string = 'HelmList'

    public readonly capabilities: TQueryCapabilities = {
        operators: [
            QueryOperators.eq,
            QueryOperators.contains,
            QueryOperators.startsWith,
            QueryOperators.endsWith,
        ],
        logical: { or: false, not: false, nesting: true },
        relationFilters: { enabled: false, quantifiers: [] },
        relationArguments: false,
        paging: ['offset'],
        ordering: { multiple: false, nulls: false, byPath: false },
        selection: 'none',
        raw: false,
    }

    private readonly filters = new HelmListFilterVisitor()

    public compile(ast: TQueryAst, context: CompileContext): THelmQueryPlan {
        const filter = ast.filter
            ? this.filters.encode(ast.filter, context)
            : HelmListFilterVisitor.empty()

        return {
            args: [
                ...HelmCommand.list(),
                ...(filter.namespace === ''
                    ? HelmCommand.allNamespaces()
                    : HelmCommand.namespace(filter.namespace)),
                ...(filter.pattern === '' ? [] : HelmCommand.filter(filter.pattern)),
                ...HelmListCompiler.order(ast.order ?? []),
                ...HelmListCompiler.paging(ast.paging),
                ...(HelmQueryMeta.includesSuperseded(ast.meta) ? HelmCommand.includeSuperseded() : []),
            ],
        }
    }

    protected static order(order: TOrderNode[]): string[] {
        const node = order[0]
        if (!node) {
            return []
        }

        const field = node.path.join('.')
        const reversed = node.direction === 'desc' ? HelmCommand.reverse() : []

        if (field === HelmListFilterVisitor.nameField) {
            return reversed
        }
        if (field === HelmListCompiler.updatedField) {
            return [...HelmCommand.byDate(), ...reversed]
        }

        throw new UnsupportedOperationError(
            `helm list sorts by release name or by update time, not by "${field}"`,
        )
    }

    protected static paging(paging?: TPagingNode): string[] {
        if (!paging || paging.kind !== 'offset') {
            return []
        }

        return [
            ...(paging.limit === undefined ? [] : HelmCommand.limit(paging.limit)),
            ...(paging.offset === undefined ? [] : HelmCommand.offset(paging.offset)),
        ]
    }
}
