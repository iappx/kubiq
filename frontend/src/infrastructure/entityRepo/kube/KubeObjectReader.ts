import type { RepoEntityBase, RepoEntityStatic } from '@iappx/entity-repo'
import type { KubeResourceKind } from '@/domain/models/kube'

export class KubeObjectReader {
    // A list element carries no apiVersion or kind of its own and no flat key: those
    // headers sit on the list, and the uid under metadata.
    public static decorate(item: Record<string, unknown>, kind?: KubeResourceKind): Record<string, unknown> {
        const metadata = item.metadata as Record<string, unknown> | undefined
        const decorated: Record<string, unknown> = { ...item }

        if (metadata && typeof metadata.uid === 'string') {
            decorated.uid = metadata.uid
        }
        if (kind && decorated.apiVersion === undefined) {
            decorated.apiVersion = kind.apiVersion
        }
        if (kind && decorated.kind === undefined) {
            decorated.kind = kind.kind
        }

        return decorated
    }

    public static toEntity<T extends RepoEntityBase>(
        entityConstructor: RepoEntityStatic<T>,
        item: Record<string, unknown>,
        kind?: KubeResourceKind,
    ): T {
        return entityConstructor.build(KubeObjectReader.decorate(item, kind))
    }

    public static resourceVersionOf(object: Record<string, unknown>): string {
        const metadata = object.metadata as Record<string, unknown> | undefined
        const version = metadata?.resourceVersion

        return typeof version === 'string' ? version : ''
    }
}
