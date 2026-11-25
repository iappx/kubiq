import { describe, expect, it } from 'vitest'
import { ResourceDataEditor } from '@/application/services/resourceData/models/ResourceDataEditor'
import { Base64 } from '@/lib/encoding/Base64'

describe('ResourceDataEditor', () => {
    it('recognises immutable objects only when immutable is strictly true', () => {
        expect(ResourceDataEditor.isImmutable({ immutable: true })).toBe(true)
        expect(ResourceDataEditor.isImmutable({ immutable: false })).toBe(false)
        expect(ResourceDataEditor.isImmutable({ immutable: 'true' })).toBe(false)
        expect(ResourceDataEditor.isImmutable({})).toBe(false)
    })

    it('adds a plain-text key to a ConfigMap without mutating the input', () => {
        const original: Record<string, unknown> = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: { name: 'app-config', namespace: 'default' },
        }

        const updated = ResourceDataEditor.upsert(original, false, {
            key: 'log.level',
            value: 'debug',
        })

        expect(updated.data).toEqual({ 'log.level': 'debug' })
        expect(original.data).toBeUndefined()
    })

    it('updates and renames a ConfigMap key while keeping sibling keys intact', () => {
        const originalData = { oldKey: 'v1', keep: 'stay' }
        const original: Record<string, unknown> = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            data: originalData,
        }

        const updated = ResourceDataEditor.upsert(original, false, {
            key: 'newKey',
            value: 'v2\nline2',
            originalKey: 'oldKey',
        })

        expect(updated.data).toEqual({ keep: 'stay', newKey: 'v2\nline2' })
        expect(originalData).toEqual({ oldKey: 'v1', keep: 'stay' })
    })

    it('base64-encodes UTF-8 values when upserting into a Secret', () => {
        const original: Record<string, unknown> = {
            apiVersion: 'v1',
            kind: 'Secret',
            data: { existing: Base64.stringToB64('keep-me') },
        }
        const plain = 'line-1\nпривет-мир'

        const updated = ResourceDataEditor.upsert(original, true, {
            key: 'greeting',
            value: plain,
        })

        const data = updated.data as Record<string, string>
        expect(data.existing).toBe(Base64.stringToB64('keep-me'))
        expect(data.greeting).toBe(Base64.stringToB64(plain))
        expect(Base64.b64ToString(data.greeting)).toBe(plain)
        expect(updated.stringData).toBeUndefined()
    })

    it('removes the original key from both data and stringData when renaming on a Secret', () => {
        const originalData = { old: Base64.stringToB64('a'), other: Base64.stringToB64('b') }
        const originalStringData = { old: 'a', extra: 'x' }
        const original: Record<string, unknown> = {
            apiVersion: 'v1',
            kind: 'Secret',
            data: originalData,
            stringData: originalStringData,
        }

        const updated = ResourceDataEditor.upsert(original, true, {
            key: 'renamed',
            value: 'updated-text',
            originalKey: 'old',
        })

        expect(updated.data).toEqual({
            other: Base64.stringToB64('b'),
            renamed: Base64.stringToB64('updated-text'),
        })
        expect(updated.stringData).toEqual({ extra: 'x' })
        expect(originalData).toHaveProperty('old')
        expect(originalStringData).toHaveProperty('old')
    })

    it('removes a key from data by default without mutating the original object', () => {
        const originalData = { a: '1', b: '2' }
        const original: Record<string, unknown> = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            data: originalData,
        }

        const updated = ResourceDataEditor.remove(original, 'a')

        expect(updated.data).toEqual({ b: '2' })
        expect(originalData).toEqual({ a: '1', b: '2' })
    })

    it('removes a key from an explicit field and tolerates missing fields', () => {
        const original: Record<string, unknown> = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            binaryData: { blob: 'AAEC', keep: 'AQID' },
        }

        const updated = ResourceDataEditor.remove(original, 'blob', 'binaryData')
        expect(updated.binaryData).toEqual({ keep: 'AQID' })
        expect(original.binaryData).toEqual({ blob: 'AAEC', keep: 'AQID' })

        const untouched = ResourceDataEditor.remove({ apiVersion: 'v1' }, 'missing')
        expect(untouched).toEqual({ apiVersion: 'v1' })
    })
})
