import { FilterVisitor, QueryOperators, UnsupportedOperationError } from '@iappx/entity-repo-query'
import type { CompileContext, TComparisonNode, TFilterNode, TLogicalNode, TRawFilterNode, TRelationFilterNode } from '@iappx/entity-repo-query'
import { EncodedQueryMerger, ParamValueFormatter } from '@iappx/entity-repo-rest'
import type { IFilterEncoder, TCapabilitySlice, TEncodedQuery, TQueryParamValue, TRestQueryParams } from '@iappx/entity-repo-rest'
import { KubeSelectorPath } from '@/domain/entities/kube'
import { KubeApiParams } from '@/infrastructure/entityRepo/kube/KubeApiParams'

export class KubeSelectorFilterEncoder extends FilterVisitor<TEncodedQuery, CompileContext> implements IFilterEncoder {
    public readonly capabilities: TCapabilitySlice = {
        operators: [
            QueryOperators.eq,
            QueryOperators.ne,
            QueryOperators.in,
            QueryOperators.notIn,
            QueryOperators.isNull,
        ],
        logical: { or: false, not: false, nesting: true },
        relationFilters: { enabled: false, quantifiers: [] },
        raw: true,
    }

    private readonly formatter = new ParamValueFormatter()

    public encode(node: TFilterNode, context: CompileContext): TEncodedQuery {
        return this.visit(node, context)
    }

    protected visitComparison(node: TComparisonNode): TEncodedQuery {
        return KubeSelectorPath.isLabelPath(node.path)
            ? { params: { [KubeApiParams.labelSelector]: this.labelRequirement(node) } }
            : { params: { [KubeApiParams.fieldSelector]: this.fieldRequirement(node) } }
    }

    protected visitLogical(node: TLogicalNode, context?: CompileContext): TEncodedQuery {
        if (node.operator !== 'and') {
            throw new UnsupportedOperationError(
                `A Kubernetes selector is a conjunction, it cannot express "${node.operator}"`,
            )
        }
        return this.merge(this.visitAll(node.nodes, context))
    }

    protected visitRelation(node: TRelationFilterNode): TEncodedQuery {
        throw new UnsupportedOperationError(
            `The Kubernetes API cannot filter by a related object: "${node.path.join('.')}"`,
        )
    }

    protected visitRaw(node: TRawFilterNode): TEncodedQuery {
        return this.merge([{ params: { ...(node.payload as TRestQueryParams) } }])
    }

    protected labelRequirement(node: TComparisonNode): string {
        const key = KubeSelectorPath.labelKey(node.path) as string
        switch (node.operator) {
            case QueryOperators.eq:
                return `${key}=${this.scalar(node.value)}`
            case QueryOperators.ne:
                return `${key}!=${this.scalar(node.value)}`
            case QueryOperators.in:
                return `${key} in (${this.list(node.value)})`
            case QueryOperators.notIn:
                return `${key} notin (${this.list(node.value)})`
            case QueryOperators.isNull:
                return node.value === false ? key : `!${key}`
            default:
                throw new UnsupportedOperationError(
                    `A Kubernetes label selector cannot express "${node.operator}" on the label "${key}"`,
                )
        }
    }

    protected fieldRequirement(node: TComparisonNode): string {
        const name = KubeSelectorPath.fieldName(node.path)
        switch (node.operator) {
            case QueryOperators.eq:
                return `${name}=${this.scalar(node.value)}`
            case QueryOperators.ne:
                return `${name}!=${this.scalar(node.value)}`
            default:
                throw new UnsupportedOperationError(
                    `A Kubernetes field selector is equality only, it cannot express "${node.operator}" on "${name}"`,
                )
        }
    }

    // Every requirement lands in the same labelSelector or fieldSelector parameter,
    // so fragments are concatenated where the default merger would overwrite.
    protected merge(fragments: TEncodedQuery[]): TEncodedQuery {
        const params: TRestQueryParams = {}
        fragments.forEach((fragment) => {
            Object.keys(fragment.params).forEach((key) => {
                const existing = params[key]
                params[key] = KubeApiParams.isSelector(key) && existing !== undefined
                    ? `${existing},${fragment.params[key]}`
                    : fragment.params[key]
            })
        })
        return Object.keys(params).length > 0 ? { params } : EncodedQueryMerger.empty()
    }

    protected scalar(value: unknown): string {
        const formatted = this.formatter.format(value)
        return String(Array.isArray(formatted) ? formatted.join(',') : formatted)
    }

    protected list(value: unknown): string {
        const formatted = this.formatter.format(value)
        const values: TQueryParamValue[] = Array.isArray(formatted) ? formatted : [formatted]
        return values.map(item => String(item)).join(',')
    }
}
