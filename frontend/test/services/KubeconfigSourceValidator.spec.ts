import { beforeEach, describe, expect, it } from 'vitest'
import { KubeconfigSourceValidator } from '@/application/validators/KubeconfigSourceValidator'
import { PastedKubeconfig } from '@/application/services/kubeconfigImport/models/PastedKubeconfig'
import type { TKubeconfigSourceDraft } from '@/domain/entities/catalog/types/TKubeconfigSourceDraft'

let validator: KubeconfigSourceValidator

const file = (path: string): TKubeconfigSourceDraft => ({ mode: 'file', path, text: '' })

const pasted = (text: string): TKubeconfigSourceDraft => ({ mode: 'paste', path: '', text })

const kubeconfig = [
    'apiVersion: v1',
    'kind: Config',
    'clusters:',
    '  - name: staging',
    '    cluster:',
    '      server: https://staging.example.invalid:6443',
    'contexts:',
    '  - name: staging',
    '    context:',
    '      cluster: staging',
    '      user: staging-admin',
].join('\n')

describe('KubeconfigSourceValidator', () => {
    beforeEach(() => {
        validator = new KubeconfigSourceValidator()
    })

    describe('a file path', () => {
        it('accepts a plain YAML path', () => {
            expect(validator.validate(file('D:/work/clusters/staging.yaml'))).toEqual({ valid: true, errors: {} })
        })

        it('accepts a file with no extension, which is how kubectl ships its own', () => {
            expect(validator.validate(file('~/.kube/config')).valid).toBe(true)
        })

        it('accepts the short forms of YAML and the .conf convention', () => {
            ['a.yml', 'a.yaml', 'a.conf', 'a.config'].forEach((path) => {
                expect(validator.validate(file(path)).valid).toBe(true)
            })
        })

        it('asks for a path when the field is empty', () => {
            expect(validator.validate(file('   '))).toEqual({
                valid: false,
                errors: { path: 'Enter the path to a kubeconfig file' },
            })
        })

        it('says a folder is not a file', () => {
            expect(validator.validate(file('D:/work/clusters/')).errors.path).toContain('folder')
            expect(validator.validate(file('D:\\work\\clusters\\')).errors.path).toContain('folder')
        })

        it('rejects an extension a kubeconfig never has', () => {
            expect(validator.validate(file('D:/work/cluster.json')).errors.path).toContain('YAML file')
        })

        it('does not mistake a dotted folder for an extension', () => {
            expect(validator.validate(file('D:/work.v2/config')).valid).toBe(true)
        })

        it('does not mistake a dotfile for an extension', () => {
            expect(validator.validate(file('D:/work/.kubeconfig')).valid).toBe(true)
        })

        it('ignores pasted text left behind by the other way', () => {
            expect(validator.validate({ mode: 'file', path: 'a.yaml', text: 'not yaml at all: [' }).valid).toBe(true)
        })
    })

    describe('pasted contents', () => {
        it('accepts a kubeconfig', () => {
            expect(validator.validate(pasted(kubeconfig))).toEqual({ valid: true, errors: {} })
        })

        it('asks for text when nothing was pasted', () => {
            expect(validator.validate(pasted('  '))).toEqual({
                valid: false,
                errors: { text: PastedKubeconfig.empty },
            })
        })

        it('reports the problem against the field the operator is filling in', () => {
            const result = validator.validate(pasted('apiVersion: v1'))

            expect(result.valid).toBe(false)
            expect(result.errors.path).toBeUndefined()
            expect(result.errors.text).toContain('clusters and contexts')
        })

        it('refuses text that is not YAML', () => {
            expect(validator.validate(pasted('clusters:\n  - a\n b: c')).errors.text).toBe(PastedKubeconfig.notYaml)
        })

        it('ignores a path left behind by the other way', () => {
            expect(validator.validate({ mode: 'paste', path: 'D:/nope.json', text: kubeconfig }).valid).toBe(true)
        })
    })
})
