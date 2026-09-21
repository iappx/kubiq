import { EntityQuery, Identifier, ITransport, RepoEntityBase } from '@iappx/entity-repo'
import { ApiError } from '@/domain/errors/ApiError'

export abstract class JsonCollectionQueryBase<
    T extends RepoEntityBase,
    TTransport extends ITransport<any>,
    TOptions extends object,
> extends EntityQuery<T, TTransport, TOptions> {
    protected abstract read(): Promise<string | null>

    protected abstract write(content: string): Promise<void>

    public async getAll(): Promise<T[]> {
        const content = await this.read()
        if (!content) {
            return []
        }
        return this.parse(content)
    }

    public async getById(id: Identifier): Promise<T | null> {
        const items = await this.getAll()
        return items.find(item => item.getPkValue() === id) ?? null
    }

    public async create(entity: T): Promise<T> {
        const items = await this.getAll()
        await this.writeAll([...items, entity])
        return entity
    }

    public async update(entity: T): Promise<T> {
        const id = entity.getPkValue()
        const items = await this.getAll()
        await this.writeAll(items.map(item => (item.getPkValue() === id ? entity : item)))
        return entity
    }

    public async remove(id: Identifier): Promise<void> {
        const items = await this.getAll()
        await this.writeAll(items.filter(item => item.getPkValue() !== id))
    }

    private writeAll(items: T[]): Promise<void> {
        return this.write(JSON.stringify(items.map(item => item.getDataValues()), null, 2))
    }

    private parse(content: string): T[] {
        let raw: unknown
        try {
            raw = JSON.parse(content)
        } catch (err) {
            throw new ApiError(
                'The data file is corrupted',
                err instanceof Error ? err.message : String(err),
            )
        }

        if (!Array.isArray(raw)) {
            throw new ApiError('The data file is corrupted', 'A list of records was expected')
        }

        return raw
            .filter(item => !!item && typeof item === 'object')
            .map(item => this.entityConstructor.build(item as Record<string, any>))
            .filter(entity => entity.getPkValue() !== undefined)
    }
}
