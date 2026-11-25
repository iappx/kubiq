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

    it('marks the container indicator unsortable and gives it a width of its own', () => {
        const containers = byKey(ResourceColumns.map(pods.columns), ResourceColumns.containersKey)

        expect(containers?.sortable).toBe(false)
        expect(containers?.width).toBe('120px')
        expect(containers?.locked).toBe(false)
    })

    it('leaves every other column sortable rather than opting each one in', () => {
        const unsortable = ResourceColumns.map(pods.columns)
            .filter(column => column.sortable === false)
            .map(column => column.key)

        expect(unsortable).toEqual([ResourceColumns.containersKey])
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
        expect(ResourceColumns.map(columns)[0]).not.toHaveProperty('format')
    })

    it('carries a date column format and alignment through', () => {
        const columns: TKubeColumn[] = [
            { key: 'Age', title: 'Age', jsonPath: '.metadata.creationTimestamp', format: 'date', align: 'right' },
        ]

        expect(ResourceColumns.map(columns)[0]).toMatchObject({
            key: 'Age',
            title: 'Age',
            format: 'date',
            align: 'right',
            locked: false,
        })
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

    it('leaves the container indicator visible on a pod table, and hideable from the picker', () => {
        const mapped = ResourceColumns.map(pods.columns)

        expect(ResourceColumns.defaultHidden(mapped)).not.toContain(ResourceColumns.containersKey)
        expect(ResourceColumns.isLocked(ResourceColumns.containersKey)).toBe(false)
    })
})

describe('ResourceColumns.dateKeys and ResourceColumns.dateValue', () => {
    it('returns keys for date-formatted columns while excluding built-in slots', () => {
        const columns = ResourceColumns.map([
            { key: 'name', title: 'Name' },
            { key: 'createdAt', title: 'Age', format: 'date' },
            { key: 'state', title: 'Status', format: 'date' },
            { key: 'Age', title: 'Age', jsonPath: '.metadata.creationTimestamp', format: 'date', align: 'right' },
            { key: 'Renewed', title: 'Renewed', jsonPath: '.status.renewalTime', format: 'date', align: 'right' },
            { key: 'Ready', title: 'Ready', jsonPath: '.status.conditions[?(@.type=="Ready")].status' },
        ])

        expect(ResourceColumns.dateKeys(columns)).toEqual(['Age', 'Renewed'])
    })

    it('passes valid date input types through and coerces unsupported values to null', () => {
        const now = new Date('2026-07-26T07:20:11Z')

        expect(ResourceColumns.dateValue('2026-07-26T07:20:11Z')).toBe('2026-07-26T07:20:11Z')
        expect(ResourceColumns.dateValue(1785050411000)).toBe(1785050411000)
        expect(ResourceColumns.dateValue(now)).toBe(now)
        expect(ResourceColumns.dateValue(undefined)).toBeNull()
        expect(ResourceColumns.dateValue(null)).toBeNull()
        expect(ResourceColumns.dateValue(true)).toBeNull()
        expect(ResourceColumns.dateValue({ iso: '2026-07-26T07:20:11Z' })).toBeNull()
    })
})
