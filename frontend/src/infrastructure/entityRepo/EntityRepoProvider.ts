import { inject, singleton } from 'tsyringe'
import { EntityRepo } from '@iappx/entity-repo'
import { AppEntityContext } from '@/infrastructure/entityRepo/AppEntityContext'
import { ClusterCatalogEntityContext } from '@/infrastructure/entityRepo/catalog/ClusterCatalogEntityContext'
import { KubeconfigEntityContext } from '@/infrastructure/entityRepo/kubeconfig/KubeconfigEntityContext'
import { SettingsEntityContext } from '@/infrastructure/entityRepo/settings/SettingsEntityContext'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'

@singleton()
export class EntityRepoProvider {
    private readonly appContext: AppEntityContext

    private readonly kubeconfigContext: KubeconfigEntityContext

    private readonly catalogContext: ClusterCatalogEntityContext

    private readonly settingsContext: SettingsEntityContext

    constructor(
        @inject(FileSystemTransport) transport: FileSystemTransport,
    ) {
        const repo = EntityRepo.create()
            .use(AppEntityContext, transport)
            .use(KubeconfigEntityContext, transport)
            .use(ClusterCatalogEntityContext, transport)
            .use(SettingsEntityContext, transport)

        // getContext() builds a new context on every call, so each is built once here.
        this.appContext = repo.getContext(AppEntityContext)
        this.kubeconfigContext = repo.getContext(KubeconfigEntityContext)
        this.catalogContext = repo.getContext(ClusterCatalogEntityContext)
        this.settingsContext = repo.getContext(SettingsEntityContext)
    }

    public get context(): AppEntityContext {
        return this.appContext
    }

    public get kubeconfig(): KubeconfigEntityContext {
        return this.kubeconfigContext
    }

    public get catalog(): ClusterCatalogEntityContext {
        return this.catalogContext
    }

    public get settings(): SettingsEntityContext {
        return this.settingsContext
    }
}
