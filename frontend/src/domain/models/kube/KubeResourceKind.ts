import type { TKubeColumn } from '@/domain/models/kube/types/TKubeColumn'
import type { TKubeGvr } from '@/domain/models/kube/types/TKubeGvr'
import type { TKubeResourceKindDefinition } from '@/domain/models/kube/types/TKubeResourceKindDefinition'
import type { TKubeSection } from '@/domain/models/kube/types/TKubeSection'
import type { TKubeVerb } from '@/domain/models/kube/types/TKubeVerb'

export class KubeResourceKind {
    public readonly group: string

    public readonly version: string

    public readonly resource: string

    public readonly kind: string

    public readonly title: string

    public readonly namespaced: boolean

    public readonly section: TKubeSection

    public readonly icon: string

    public readonly columns: TKubeColumn[]

    public readonly verbs: TKubeVerb[]

    public readonly isCustom: boolean

    constructor(definition: TKubeResourceKindDefinition) {
        this.group = definition.group
        this.version = definition.version
        this.resource = definition.resource
        this.kind = definition.kind
        this.title = definition.title
        this.namespaced = definition.namespaced
        this.section = definition.section
        this.icon = definition.icon
        this.columns = [...definition.columns]
        this.verbs = [...definition.verbs]
        this.isCustom = definition.isCustom === true
    }

    // The version is left out: a cluster serves one preferred version per group,
    // and the registry has to find its entry before discovery names that version.
    public static registryKeyOf(group: string, resource: string): string {
        return `${group}/${resource}`
    }

    public static keyOf(group: string, version: string, resource: string): string {
        return `${group}/${version}/${resource}`
    }

    get key(): string {
        return KubeResourceKind.keyOf(this.group, this.version, this.resource)
    }

    get registryKey(): string {
        return KubeResourceKind.registryKeyOf(this.group, this.resource)
    }

    get apiVersion(): string {
        return this.group.length > 0 ? `${this.group}/${this.version}` : this.version
    }

    get gvr(): TKubeGvr {
        return { group: this.group, version: this.version, resource: this.resource }
    }

    get basePath(): string {
        return this.group.length > 0 ? `/apis/${this.group}/${this.version}` : `/api/${this.version}`
    }

    get canList(): boolean {
        return this.supports('list')
    }

    get canWatch(): boolean {
        return this.supports('watch')
    }

    get canCreate(): boolean {
        return this.supports('create')
    }

    get canUpdate(): boolean {
        return this.supports('update')
    }

    get canPatch(): boolean {
        return this.supports('patch')
    }

    get canDelete(): boolean {
        return this.supports('delete')
    }

    public supports(verb: TKubeVerb): boolean {
        return this.verbs.includes(verb)
    }

    public listPath(namespace?: string): string {
        const scope = this.namespaced && namespace ? `/namespaces/${namespace}` : ''
        return `${this.basePath}${scope}/${this.resource}`
    }

    public objectPath(name: string, namespace?: string): string {
        return `${this.listPath(namespace)}/${name}`
    }

    public definition(): TKubeResourceKindDefinition {
        return {
            group: this.group,
            version: this.version,
            resource: this.resource,
            kind: this.kind,
            title: this.title,
            namespaced: this.namespaced,
            section: this.section,
            icon: this.icon,
            columns: this.columns,
            verbs: this.verbs,
            isCustom: this.isCustom,
        }
    }

    public withDefinition(changes: Partial<TKubeResourceKindDefinition>): KubeResourceKind {
        return new KubeResourceKind({ ...this.definition(), ...changes })
    }
}
