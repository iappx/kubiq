import { describe, expect, it } from 'vitest'
import { ResourceDataKeyValidator } from '@/application/validators/ResourceDataKeyValidator'

const validator = new ResourceDataKeyValidator()

describe('ResourceDataKeyValidator', () => {
    it('accepts valid Kubernetes ConfigMap and Secret key names', () => {
        expect(validator.validate({ key: 'app.properties', value: 'a=1' }, ['other'])).toEqual({
            valid: true,
            errors: {},
        })
        expect(validator.validate({ key: 'DB_HOST-1.local', value: '' }, [])).toEqual({
            valid: true,
            errors: {},
        })
        expect(validator.validate({ key: '.envrc', value: 'x' }, [])).toEqual({
            valid: true,
            errors: {},
        })
    })

    it('requires a non-empty key', () => {
        expect(validator.validate({ key: '', value: 'x' }, [])).toEqual({
            valid: false,
            errors: { key: 'Key is required' },
        })
        expect(validator.validate({ key: '   ', value: 'x' }, [])).toEqual({
            valid: false,
            errors: { key: 'Key is required' },
        })
    })

    it('rejects characters outside the Kubernetes key alphabet', () => {
        for (const key of ['bad key', 'dir/file', 'a=b', 'name@host', 'ключ']) {
            expect(validator.validate({ key, value: 'x' }, [])).toEqual({
                valid: false,
                errors: { key: "Key may contain only letters, digits, '-', '_' and '.'" },
            })
        }
    })

    it('rejects duplicate keys when adding or renaming onto an existing key', () => {
        expect(validator.validate({ key: 'existing', value: 'x' }, ['existing', 'other'])).toEqual({
            valid: false,
            errors: { key: 'Key "existing" already exists' },
        })
        expect(validator.validate(
            { key: 'other', value: 'x', originalKey: 'existing' },
            ['existing', 'other'],
        )).toEqual({
            valid: false,
            errors: { key: 'Key "other" already exists' },
        })
    })

    it('allows keeping the same key when editing an existing entry', () => {
        expect(validator.validate(
            { key: 'existing', value: 'updated', originalKey: 'existing' },
            ['existing', 'other'],
        )).toEqual({
            valid: true,
            errors: {},
        })
    })
})
