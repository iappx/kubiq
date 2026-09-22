import { describe, expect, it } from 'vitest'
import { PastedKubeconfig } from '@/application/services/kubeconfigImport/models/PastedKubeconfig'

const kubeconfig = [
    'apiVersion: v1',
    'kind: Config',
    'current-context: staging',
    'clusters:',
    '  - name: staging',
    '    cluster:',
    '      server: https://staging.example.invalid:6443',
    'contexts:',
    '  - name: staging',
    '    context:',
    '      cluster: staging',
    '      user: staging-admin',
    'users:',
    '  - name: staging-admin',
    '    user:',
    '      token: placeholder-not-a-secret',
].join('\n')

describe('PastedKubeconfig', () => {
    it('accepts a kubeconfig that lists clusters and contexts', () => {
        expect(PastedKubeconfig.problemWith(kubeconfig)).toBe('')
    })

    it('asks for text when nothing was pasted', () => {
        expect(PastedKubeconfig.problemWith('   \n  ')).toBe(PastedKubeconfig.empty)
    })

    it('refuses text that is not YAML', () => {
        expect(PastedKubeconfig.problemWith('clusters:\n  - a\n b: c')).toBe(PastedKubeconfig.notYaml)
    })

    it('refuses YAML that is not a mapping', () => {
        expect(PastedKubeconfig.problemWith('- one\n- two')).toBe(PastedKubeconfig.notYaml)
    })

    it('names every missing section in one pass', () => {
        expect(PastedKubeconfig.problemWith('apiVersion: v1\nkind: Config'))
            .toBe('A kubeconfig lists clusters and contexts — this text has no clusters and no contexts')
    })

    it('names the one section that is missing', () => {
        const text = 'clusters:\n  - name: staging\n    cluster:\n      server: https://staging.example.invalid'

        expect(PastedKubeconfig.problemWith(text))
            .toBe('A kubeconfig lists clusters and contexts — this text has no contexts')
    })

    it('treats an empty section as a missing one', () => {
        expect(PastedKubeconfig.problemWith('clusters: []\ncontexts: []')).toContain('no clusters and no contexts')
    })

    it('never repeats the pasted text in the problem it reports', () => {
        const problem = PastedKubeconfig.problemWith('token: placeholder-not-a-secret\n  bad: [')

        expect(problem).toBe(PastedKubeconfig.notYaml)
        expect(problem).not.toContain('placeholder-not-a-secret')
    })

    it('stores the file in the app data folder, named after the current context', () => {
        expect(PastedKubeconfig.pathFor(kubeconfig)).toMatch(/^userdata:kubeconfigs\/staging-[0-9a-z]+\.yaml$/)
    })

    it('falls back to the first context when the document names no current one', () => {
        const text = kubeconfig.replace('current-context: staging\n', '')

        expect(PastedKubeconfig.pathFor(text)).toMatch(/^userdata:kubeconfigs\/staging-[0-9a-z]+\.yaml$/)
    })

    it('falls back to a plain name when no context is named at all', () => {
        expect(PastedKubeconfig.pathFor('clusters:\n  - name: a\ncontexts:\n  - context: {}'))
            .toMatch(/^userdata:kubeconfigs\/kubeconfig-[0-9a-z]+\.yaml$/)
    })

    it('turns a context name that is not a file name into one', () => {
        const text = kubeconfig.replace('current-context: staging', 'current-context: arn:aws:eks:eu-west-1:1/cluster')

        expect(PastedKubeconfig.pathFor(text)).toMatch(/^userdata:kubeconfigs\/arn-aws-eks-eu-west-1-1-cluster-[0-9a-z]+\.yaml$/)
    })

    it('keeps the file name short when the context name is not', () => {
        const text = kubeconfig.replace('current-context: staging', `current-context: ${'n'.repeat(200)}`)
        const name = PastedKubeconfig.pathFor(text).slice(`${PastedKubeconfig.directory}/`.length)

        expect(name.length).toBeLessThan(64)
    })

    it('gives the same text the same file, so re-pasting one config does not pile up copies', () => {
        expect(PastedKubeconfig.pathFor(kubeconfig)).toBe(PastedKubeconfig.pathFor(kubeconfig))
    })

    it('gives two configs sharing a context name two files, so neither overwrites the other', () => {
        const other = kubeconfig.replace('staging.example.invalid', 'staging-2.example.invalid')

        expect(PastedKubeconfig.pathFor(other)).not.toBe(PastedKubeconfig.pathFor(kubeconfig))
    })
})
