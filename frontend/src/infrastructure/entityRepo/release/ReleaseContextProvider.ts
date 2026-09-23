import { inject, singleton } from 'tsyringe'
import { EntityRepo } from '@iappx/entity-repo'
import { ReleaseEntityContext } from '@/infrastructure/entityRepo/release/ReleaseEntityContext'
import { ReleaseTransport } from '@/infrastructure/entityRepo/release/transport/ReleaseTransport'

@singleton()
export class ReleaseContextProvider {
    private readonly releaseContext: ReleaseEntityContext

    constructor(
        @inject(ReleaseTransport) transport: ReleaseTransport,
    ) {
        this.releaseContext = EntityRepo.create()
            .use(ReleaseEntityContext, transport)
            .getContext(ReleaseEntityContext)
    }

    public get context(): ReleaseEntityContext {
        return this.releaseContext
    }
}
