import { beforeEach, describe, expect, it } from 'vitest'
import { container } from 'tsyringe'
import { LocalStorageEntityQuery } from '@/infrastructure/entityRepo/queries/LocalStorageEntityQuery'
import { LocalStorageTransport } from '@/infrastructure/entityRepo/transport/LocalStorageTransport'
import { SampleEntity } from '../support/SampleEntity'

const KEY = 'samples'

const dto = (id: string, title = 'Record') => ({
    id,
    title,
    createdAt: 100,
})

const stored = () => JSON.parse(localStorage.getItem(KEY) as string)

let query: LocalStorageEntityQuery<SampleEntity>

describe('LocalStorageEntityQuery', () => {
    beforeEach(() => {
        localStorage.clear()
        query = new LocalStorageEntityQuery<SampleEntity>(
            SampleEntity,
            container.resolve(LocalStorageTransport),
            { key: KEY },
        )
    })

    it('treats an empty key as an empty collection', async () => {
        await expect(query.getAll()).resolves.toEqual([])
    })

    it('round-trips an entity through storage', async () => {
        await query.create(SampleEntity.build(dto('1', 'First')))

        const [item] = await query.getAll()

        expect(item).toBeInstanceOf(SampleEntity)
        expect(item.title).toBe('First')
        expect(stored()).toEqual([dto('1', 'First')])
    })

    it('replaces the stored entity on update', async () => {
        localStorage.setItem(KEY, JSON.stringify([dto('1', 'Old'), dto('2')]))
        const entity = await query.getById('1')

        entity!.title = 'New'
        await query.update(entity!)

        expect(stored()[0].title).toBe('New')
        expect(stored()[1].id).toBe('2')
    })

    it('removes by primary key and keeps the rest', async () => {
        localStorage.setItem(KEY, JSON.stringify([dto('1'), dto('2')]))

        await query.remove('1')

        expect(stored().map((i: any) => i.id)).toEqual(['2'])
    })
})
