import type { KubeResourceKind } from '@/domain/models/kube'
import type { TKubeOpenApiDocument } from '@/infrastructure/kube/types/TKubeOpenApiDocument'

export class KubeSchemaBuilder {
    public static readonly gvkKey: string = 'x-kubernetes-group-version-kind'

    public static readonly refPrefix: string = '#/components/schemas/'

    // A bare `$ref` at the root has its siblings ignored under draft-07, so the pointer goes
    // in an allOf and the document's own component map travels with it for the resolver.
    public static forKind(
        document: TKubeOpenApiDocument | undefined,
        kind: KubeResourceKind,
    ): Record<string, unknown> | undefined {
        const schemas = document?.components?.schemas
        if (!schemas) {
            return undefined
        }

        const name = KubeSchemaBuilder.nameOf(schemas, kind)
        if (name === '') {
            return undefined
        }

        return {
            allOf: [{ $ref: `${KubeSchemaBuilder.refPrefix}${name}` }],
            components: { schemas },
        }
    }

    public static nameOf(schemas: Record<string, Record<string, unknown>>, kind: KubeResourceKind): string {
        return Object.keys(schemas).find(name => KubeSchemaBuilder.describes(schemas[name], kind)) ?? ''
    }

    private static describes(schema: Record<string, unknown>, kind: KubeResourceKind): boolean {
        const declared = schema[KubeSchemaBuilder.gvkKey]
        if (!Array.isArray(declared)) {
            return false
        }

        return declared.some((entry) => {
            if (!entry || typeof entry !== 'object') {
                return false
            }
            const gvk = entry as Record<string, unknown>

            return gvk.kind === kind.kind
                && (gvk.group ?? '') === kind.group
                && (gvk.version ?? '') === kind.version
        })
    }
}
