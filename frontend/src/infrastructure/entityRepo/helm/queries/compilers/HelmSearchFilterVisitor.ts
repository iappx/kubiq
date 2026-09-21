import { FilterVisitor, QueryOperators, UnsupportedOperationError } from '@iappx/entity-repo-query'
import type { CompileContext, TComparisonNode, TFilterNode, TLogicalNode, TRawFilterNode, TRelationFilterNode } from '@iappx/entity-repo-query'
import type { THelmSearchFilter } from '@/infrastructure/entityRepo/helm/queries/types/THelmSearchFilter'

export class HelmSearchFilterVisitor extends FilterVisitor<THelmSearchFilter, CompileContext> {
    public static readonly repositoryField: string = 'repoName'

    public static readonly chartField: string = 'chartName'

    public encode(node: TFilterNode, context: CompileContext): THelmSearchFilter {
        return this.visit(node, context)
    }

    public static empty(): THelmSearchFilter {
        return { repoName: '', keyword: '' }
    }

    protected visitComparison(node: TComparisonNode, context?: CompileContext): THelmSearchFilter {
        const field = (context ? context.resolve(node.path).path : node.path).join('.')

        if (field === HelmSearchFilterVisitor.repositoryField) {
            HelmSearchFilterVisitor.require(node, QueryOperators.eq, 'a repository is named in full')

            return { repoName: HelmSearchFilterVisitor.scalar(node), keyword: '' }
        }
        if (field === HelmSearchFilterVisitor.chartField) {
            HelmSearchFilterVisitor.require(node, QueryOperators.contains, 'a chart is looked up by keyword')

            return { repoName: '', keyword: HelmSearchFilterVisitor.scalar(node) }
        }

        throw new UnsupportedOperationError(
            `helm search repo narrows by repository and chart keyword only, not by "${field}"`,
        )
    }

    protected visitLogical(node: TLogicalNode, context?: CompileContext): THelmSearchFilter {
        if (node.operator !== 'and') {
            throw new UnsupportedOperationError(`helm search repo cannot express "${node.operator}"`)
        }

        return this.visitAll(node.nodes, context).reduce(
            (merged, part) => HelmSearchFilterVisitor.merge(merged, part),
            HelmSearchFilterVisitor.empty(),
        )
    }

    protected visitRelation(node: TRelationFilterNode): THelmSearchFilter {
        throw new UnsupportedOperationError(
            `helm search repo cannot filter by a related object: "${node.path.join('.')}"`,
        )
    }

    protected visitRaw(node: TRawFilterNode): THelmSearchFilter {
        throw new UnsupportedOperationError('helm search repo takes no raw conditions')
    }

    protected static merge(left: THelmSearchFilter, right: THelmSearchFilter): THelmSearchFilter {
        if (left.repoName !== '' && right.repoName !== '' && left.repoName !== right.repoName) {
            throw new UnsupportedOperationError('helm search repo reads one repository at a time')
        }
        if (left.keyword !== '' && right.keyword !== '') {
            throw new UnsupportedOperationError('helm search repo takes a single keyword')
        }

        return {
            repoName: left.repoName || right.repoName,
            keyword: left.keyword || right.keyword,
        }
    }

    protected static require(node: TComparisonNode, operator: string, reason: string): void {
        if (node.operator !== operator) {
            throw new UnsupportedOperationError(
                `helm search repo cannot express "${node.operator}" on "${node.path.join('.')}": ${reason}`,
            )
        }
    }

    protected static scalar(node: TComparisonNode): string {
        if (typeof node.value === 'string' || typeof node.value === 'number') {
            return String(node.value)
        }

        throw new UnsupportedOperationError(
            `helm search repo compares "${node.path.join('.')}" with text, not with ${typeof node.value}`,
        )
    }
}
