import { inject, singleton } from 'tsyringe'
import { EntityRepo } from '@iappx/entity-repo'
import { AppEntityContext } from '@/infrastructure/entityRepo/AppEntityContext'
import { KubeconfigEntityContext } from '@/infrastructure/entityRepo/kubeconfig/KubeconfigEntityContext'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'

@singleton()
export class EntityRepoProvider {
    private readonly appContext: AppEntityContext

    private readonly kubeconfigContext: KubeconfigEntityContext

    constructor(
        @inject(FileSystemTransport) transport: FileSystemTransport,
    ) {
        const repo = EntityRepo.create()
            .use(AppEntityContext, transport)
            .use(KubeconfigEntityContext, transport)

        // getContext() builds a new context on every call, so each is built once here.
        this.appContext = repo.getContext(AppEntityContext)
        this.kubeconfigContext = repo.getContext(KubeconfigEntityContext)
    }

    public get context(): AppEntityContext {
        return this.appContext
    }

    public get kubeconfig(): KubeconfigEntityContext {
        return this.kubeconfigContext
    }
}
