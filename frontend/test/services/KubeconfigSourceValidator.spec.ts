import { beforeEach, describe, expect, it } from 'vitest'
import { KubeconfigSourceValidator } from '@/application/validators/KubeconfigSourceValidator'

let validator: KubeconfigSourceValidator

describe('KubeconfigSourceValidator', () => {
    beforeEach(() => {
        validator = new KubeconfigSourceValidator()
    })

    it('accepts a plain YAML path', () => {
        expect(validator.validate({ path: 'D:/work/clusters/staging.yaml' })).toEqual({ valid: true, errors: {} })
    })

    it('accepts a file with no extension, which is how kubectl ships its own', () => {
        expect(validator.validate({ path: '~/.kube/config' }).valid).toBe(true)
    })

    it('accepts the short forms of YAML and the .conf convention', () => {
        ['a.yml', 'a.yaml', 'a.conf', 'a.config'].forEach((path) => {
            expect(validator.validate({ path }).valid).toBe(true)
        })
    })

    it('asks for a path when the field is empty', () => {
        expect(validator.validate({ path: '   ' })).toEqual({
            valid: false,
            errors: { path: 'Enter the path to a kubeconfig file' },
        })
    })

    it('says a folder is not a file', () => {
        expect(validator.validate({ path: 'D:/work/clusters/' }).errors.path).toContain('folder')
        expect(validator.validate({ path: 'D:\\work\\clusters\\' }).errors.path).toContain('folder')
    })

    it('rejects an extension a kubeconfig never has', () => {
        expect(validator.validate({ path: 'D:/work/cluster.json' }).errors.path).toContain('YAML file')
    })

    it('does not mistake a dotted folder for an extension', () => {
        expect(validator.validate({ path: 'D:/work.v2/config' }).valid).toBe(true)
    })

    it('does not mistake a dotfile for an extension', () => {
        expect(validator.validate({ path: 'D:/work/.kubeconfig' }).valid).toBe(true)
    })
})
