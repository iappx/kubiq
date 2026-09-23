import { EntityContextBase, RepoEntitySet } from '@iappx/entity-repo'
import { RestEntityQuery } from '@iappx/entity-repo-rest'
import { ReleaseEntity } from '@/domain/entities/release/ReleaseEntity'
import { ReleaseEntitySetOptions } from '@/infrastructure/entityRepo/release/ReleaseEntitySetOptions'
import { ReleaseTransport } from '@/infrastructure/entityRepo/release/transport/ReleaseTransport'

export class ReleaseEntityContext extends EntityContextBase<ReleaseTransport> {
    @RepoEntitySet(() => ReleaseEntity, () => RestEntityQuery, ReleaseEntitySetOptions.releases())
    public releases: RestEntityQuery<ReleaseEntity>
}
