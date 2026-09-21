import { EntityQuery } from '@iappx/entity-repo'
import type { Identifier } from '@iappx/entity-repo'
import { HelmRepositoryEntity } from '@/domain/entities/helm/HelmRepositoryEntity'
import { HelmCommand } from '@/domain/models/helm/HelmCommand'
import { HelmOutput } from '@/domain/models/helm/HelmOutput'
import { HelmTransport } from '@/infrastructure/entityRepo/helm/transport/HelmTransport'

// No builder: helm repo list reads the whole repositories file and can neither
// filter, nor sort, nor page it.
export class HelmRepositoryQuery extends EntityQuery<HelmRepositoryEntity, HelmTransport> {
    public async getAll(): Promise<HelmRepositoryEntity[]> {
        const raw = await this.transport.send<unknown>({ args: HelmCommand.repositories(), json: true })

        return HelmOutput.repositories(raw)
            .map(record => this.entityConstructor.build(record))
            .sort((left, right) => left.name.localeCompare(right.name))
    }

    public async getById(id: Identifier): Promise<HelmRepositoryEntity | null> {
        const repositories = await this.getAll()

        return repositories.find(repository => repository.name === id) ?? null
    }

    public async create(entity: HelmRepositoryEntity): Promise<HelmRepositoryEntity> {
        await this.transport.send<string>({ args: HelmCommand.addRepository(entity.name, entity.url) })

        return entity
    }

    public async remove(id: Identifier): Promise<void> {
        await this.transport.send<string>({ args: HelmCommand.removeRepository(String(id)) })
    }

    public async refresh(): Promise<string> {
        const output = await this.transport.send<string | null>({ args: HelmCommand.updateRepositories() })

        return output ?? ''
    }
}
