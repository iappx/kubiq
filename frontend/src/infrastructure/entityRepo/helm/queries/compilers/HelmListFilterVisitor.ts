import { FilterVisitor, QueryOperators, UnsupportedOperationError } from '@iappx/entity-repo-query'
import type { CompileContext, TComparisonNode, TFilterNode, TLogicalNode, TRawFilterNode, TRelationFilterNode } from '@iappx/entity-repo-query'
import { HelmCommand } from '@/domain/models/helm/HelmCommand'
import type { THelmListFilter } from '@/infrastructure/entityRepo/helm/queries/types/THelmListFilter'

export class HelmListFilterVisitor extends FilterVisitor<THelmListFilter, CompileContext> {
    public static readonly namespaceField: string = 'namespace'

    public static readonly nameField: string = 'name'

    public encode(node: TFilterNode, context: CompileContext): THelmListFilter {
        return this.visit(node, context)
    }

    public static empty(): THelmListFilter {
        return { namespace: '', pattern: '' }
    }

    protected visitComparison(node: TComparisonNode, context?: CompileContext): THelmListFilter {
        const field = (context ? context.resolve(node.path).path : node.path).join('.')

        if (field === HelmListFilterVisitor.namespaceField) {
            if (node.operator !== QueryOperators.eq) {
                throw new UnsupportedOperationError(
                    `helm list takes one namespace, it cannot express "${node.operator}" on it`,
                )
            }

            return { namespace: HelmListFilterVisitor.scalar(node), pattern: '' }
        }
        if (field === HelmListFilterVisitor.nameField) {
            return { namespace: '', pattern: HelmListFilterVisitor.pattern(node) }
        }

        throw new UnsupportedOperationError(
            `helm list narrows by namespace and release name only, not by "${field}"`,
        )
    }

    protected visitLogical(node: TLogicalNode, context?: CompileContext): THelmListFilter {
        if (node.operator !== 'and') {
            throw new UnsupportedOperationError(`helm list cannot express "${node.operator}"`)
        }

        return this.visitAll(node.nodes, context).reduce(
            (merged, part) => HelmListFilterVisitor.merge(merged, part),
            HelmListFilterVisitor.empty(),
        )
    }

    protected visitRelation(node: TRelationFilterNode): THelmListFilter {
        throw new UnsupportedOperationError(
            `helm list cannot filter by a related object: "${node.path.join('.')}"`,
        )
    }

    protected visitRaw(node: TRawFilterNode): THelmListFilter {
        throw new UnsupportedOperationError('helm list takes no raw conditions')
    }

    protected static merge(left: THelmListFilter, right: THelmListFilter): THelmListFilter {
        if (left.namespace !== '' && right.namespace !== '' && left.namespace !== right.namespace) {
            throw new UnsupportedOperationError('helm list reads one namespace at a time')
        }
        if (left.pattern !== '' && right.pattern !== '') {
            throw new UnsupportedOperationError('helm list takes a single release name pattern')
        }

        return {
            namespace: left.namespace || right.namespace,
            pattern: left.pattern || right.pattern,
        }
    }

    protected static pattern(node: TComparisonNode): string {
        const value = HelmCommand.literal(HelmListFilterVisitor.scalar(node))

        switch (node.operator) {
            case QueryOperators.eq:
                return `^${value}$`
            case QueryOperators.startsWith:
                return `^${value}`
            case QueryOperators.endsWith:
                return `${value}$`
            case QueryOperators.contains:
                return value
            default:
                throw new UnsupportedOperationError(
                    `helm list matches a release name by pattern, it cannot express "${node.operator}"`,
                )
        }
    }

    protected static scalar(node: TComparisonNode): string {
        if (typeof node.value === 'string' || typeof node.value === 'number') {
            return String(node.value)
        }

        throw new UnsupportedOperationError(
            `helm list compares "${node.path.join('.')}" with text, not with ${typeof node.value}`,
        )
    }
}
