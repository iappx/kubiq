import type { RepoEntityBase } from '@iappx/entity-repo'

export class KubeObjectKey {
    public static of(entity: RepoEntityBase): string {
        const source = entity as unknown as Record<string, unknown>

        return KubeObjectKey.from(
            KubeObjectKey.text(source.uid),
            KubeObjectKey.text(source.namespace),
            KubeObjectKey.text(source.name),
        )
    }

    public static ofObject(object: Record<string, unknown>): string {
        const metadata = object.metadata as Record<string, unknown> | undefined

        return KubeObjectKey.from(
            KubeObjectKey.text(metadata?.uid),
            KubeObjectKey.text(metadata?.namespace),
            KubeObjectKey.text(metadata?.name),
        )
    }

    private static from(uid: string, namespace: string, name: string): string {
        if (uid !== '') {
            return uid
        }

        return namespace === '' ? name : `${namespace}/${name}`
    }

    private static text(value: unknown): string {
        return typeof value === 'string' ? value : ''
    }
}
