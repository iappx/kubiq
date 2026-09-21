import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TRoleRef } from '@/domain/entities/access/types/TRoleRef'
import type { TRoleSubject } from '@/domain/entities/access/types/TRoleSubject'

export class RoleBindingEntity extends RepoEntityBase<RoleBindingEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    roleRef: TRoleRef

    @RepoEntityField()
    subjects: TRoleSubject[]

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get roleName(): string {
        return this.roleRef?.name ?? ''
    }

    get subjectNames(): string[] {
        return (this.subjects ?? []).map(p => p.name ?? '').filter(p => p.length > 0)
    }

    get subjectsText(): string {
        return this.subjectNames.join(', ')
    }
}
