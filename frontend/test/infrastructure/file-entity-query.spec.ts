import { beforeEach, describe, expect, it } from 'vitest'
import { FileEntityQuery } from '@/infrastructure/entityRepo/queries/FileEntityQuery'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { ApiError } from '@/domain/errors/ApiError'
import { MemoryFileTransport } from '../support/MemoryFileTransport'
import { SampleEntity } from '../support/SampleEntity'

const FILE = 'data/samples.json'

const dto = (id: string, title = 'Record', createdAt = 100) => ({
    id,
    title,
    createdAt,
})

let transport: MemoryFileTransport
let query: FileEntityQuery<SampleEntity>

describe('FileEntityQuery', () => {
    beforeEach(() => {
        transport = new MemoryFileTransport()
        query = new FileEntityQuery<SampleEntity>(
            SampleEntity,
            transport as unknown as FileSystemTransport,
            { file: FILE },
        )
    })

    it('treats an absent file as an empty collection', async () => {
        await expect(query.getAll()).resolves.toEqual([])
    })

    it('builds entities out of the stored rows', async () => {
        transport.seed(FILE, [dto('1', 'First')])

        const [item] = await query.getAll()

        expect(item).toBeInstanceOf(SampleEntity)
        expect(item.title).toBe('First')
    })

    it('drops rows without a primary key', async () => {
        transport.seed(FILE, [dto('1'), { title: 'No id' }])

        const items = await query.getAll()

        expect(items.map(i => i.id)).toEqual(['1'])
    })

    it('raises an ApiError when the file is not valid json', async () => {
        transport.files.set(FILE, '{ not json')

        await expect(query.getAll()).rejects.toBeInstanceOf(ApiError)
    })

    it('raises an ApiError when the file holds something other than a list', async () => {
        transport.seed(FILE, { items: [] })

        await expect(query.getAll()).rejects.toBeInstanceOf(ApiError)
    })

    it('appends a created entity and writes it in serialisable form', async () => {
        transport.seed(FILE, [dto('1')])

        await query.create(SampleEntity.build(dto('2', 'Second', 200)))

        expect(transport.read(FILE)).toEqual([dto('1'), dto('2', 'Second', 200)])
    })

    it('replaces the stored entity on update', async () => {
        transport.seed(FILE, [dto('1', 'Old'), dto('2')])
        const entity = await query.getById('1')

        entity!.title = 'New'
        await query.update(entity!)

        expect(transport.read(FILE)[0].title).toBe('New')
        expect(transport.read(FILE)[1].id).toBe('2')
    })

    it('removes by primary key and keeps the rest', async () => {
        transport.seed(FILE, [dto('1'), dto('2')])

        await query.remove('1')

        expect(transport.read(FILE).map((i: any) => i.id)).toEqual(['2'])
    })

    it('finds nothing for an unknown id', async () => {
        transport.seed(FILE, [dto('1')])

        await expect(query.getById('404')).resolves.toBeNull()
    })
})
