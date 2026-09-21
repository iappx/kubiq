import type { THelmReleaseRef } from '@/domain/entities/helm/types/THelmReleaseRef'

export class HelmReleaseKey {
    public static of(namespace: string, name: string): string {
        return `${namespace}/${name}`
    }

    public static forRevision(namespace: string, name: string, revision: number): string {
        return `${HelmReleaseKey.of(namespace, name)}@${revision}`
    }

    public static parse(key: string): THelmReleaseRef {
        const separator = key.indexOf('/')

        return separator === -1
            ? { namespace: '', name: key }
            : { namespace: key.slice(0, separator), name: key.slice(separator + 1) }
    }
}
