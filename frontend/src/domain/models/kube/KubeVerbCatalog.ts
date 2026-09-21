import type { TKubeVerb } from '@/domain/models/kube/types/TKubeVerb'

export class KubeVerbCatalog {
    public static readonly values: Record<TKubeVerb, string> = {
        get: 'Get',
        list: 'List',
        watch: 'Watch',
        create: 'Create',
        update: 'Update',
        patch: 'Patch',
        delete: 'Delete',
        deletecollection: 'Delete collection',
    }

    public static title(verb: TKubeVerb): string {
        return KubeVerbCatalog.values[verb] ?? verb
    }

    public static has(verb: string): boolean {
        return Object.prototype.hasOwnProperty.call(KubeVerbCatalog.values, verb)
    }

    public static all(): TKubeVerb[] {
        return Object.keys(KubeVerbCatalog.values) as TKubeVerb[]
    }

    // A cluster may report verbs we do not model (`bind`, `escalate`); dropping them is what makes the cast sound.
    public static known(verbs: string[] | undefined): TKubeVerb[] {
        return (verbs ?? []).filter(p => KubeVerbCatalog.has(p)) as TKubeVerb[]
    }
}
