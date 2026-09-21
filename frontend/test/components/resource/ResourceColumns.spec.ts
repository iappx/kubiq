import { describe, expect, it } from 'vitest'
import { ResourceColumns } from '@/components/resource/ResourceColumns'
import { KubeResourceRegistry } from '@/domain/models/kube'
import type { TKubeColumn } from '@/domain/models/kube'

const pods = KubeResourceRegistry.find('', 'pods')!

const byKey = (columns: ReturnType<typeof ResourceColumns.map>, key: string) =>
    columns.find(column => column.key === key)

describe('ResourceColumns.map', () => {
    it('keeps the registry order and titles', () => {
        const mapped = ResourceColumns.map(pods.columns)

        expect(mapped.map(column => column.key)).toEqual(pods.columns.map(column => column.key))
        expect(mapped.map(column => column.title)).toEqual(pods.columns.map(column => column.title))
    })

    it('locks Name, Status and Age, and nothing else', () => {
        const mapped = ResourceColumns.map(pods.columns)
        const locked = mapped.filter(column => column.locked).map(column => column.key)

        expect(locked).toEqual(['name', 'state', 'createdAt'])
    })

    it('carries a right alignment through', () => {
        expect(byKey(ResourceColumns.map(pods.columns), 'restartCount')?.align).toBe('right')
    })

    it('carries a printer-column priority through', () => {
        const columns: TKubeColumn[] = [{ key: 'extra', title: 'Extra', priority: 1 }]

        expect(ResourceColumns.map(columns)[0].priority).toBe(1)
    })

    it('leaves priority off a column that declares none, rather than inventing a zero', () => {
        expect(byKey(ResourceColumns.map(pods.columns), 'nodeName')).not.toHaveProperty('priority')
    })

    it('gives Age a fixed width so it cannot stretch across the row', () => {
        expect(byKey(ResourceColumns.map(pods.columns), 'createdAt')?.width).toBe('80px')
    })

    it('maps a CRD printer column, whose key is its own name', () => {
        const columns: TKubeColumn[] = [{ key: 'Phase', title: 'Phase', jsonPath: '.status.phase' }]

        expect(ResourceColumns.map(columns)[0]).toMatchObject({ key: 'Phase', title: 'Phase', locked: false })
    })

    it('maps every kind in the registry without losing a column', () => {
        KubeResourceRegistry.all().forEach((kind) => {
            expect(ResourceColumns.map(kind.columns)).toHaveLength(kind.columns.length)
        })
    })
})

describe('ResourceColumns.defaultHidden', () => {
    it('hides a priority column even when the table is far from full', () => {
        const columns = ResourceColumns.map([
            { key: 'name', title: 'Name' },
            { key: 'extra', title: 'Extra', priority: 1 },
        ])

        expect(ResourceColumns.defaultHidden(columns)).toEqual(['extra'])
    })

    it('never hides a locked column, however many there are', () => {
        const columns = ResourceColumns.map([
            { key: 'name', title: 'Name' },
            { key: 'a', title: 'A' },
            { key: 'b', title: 'B' },
            { key: 'c', title: 'C' },
            { key: 'd', title: 'D' },
            { key: 'e', title: 'E' },
            { key: 'f', title: 'F' },
            { key: 'g', title: 'G' },
            { key: 'state', title: 'Status' },
            { key: 'createdAt', title: 'Age' },
        ])
        const hidden = ResourceColumns.defaultHidden(columns)

        expect(hidden).not.toContain('name')
        expect(hidden).not.toContain('state')
        expect(hidden).not.toContain('createdAt')
        expect(hidden).toContain('g')
    })

    it('shows every column of a kind that stays inside the cap', () => {
        expect(ResourceColumns.defaultHidden(ResourceColumns.map(pods.columns))).toEqual([])
    })
})
