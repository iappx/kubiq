import { describe, expect, it } from 'vitest'
import { CronJobRunValidator } from '@/application/validators/CronJobRunValidator'
import { KubeResourceRegistry } from '@/domain/models/kube'

const jobs = KubeResourceRegistry.find('batch', 'jobs')!
const validator = new CronJobRunValidator()

const validate = (manifest: string) => validator.validate({ manifest, jobKind: jobs, namespace: 'payments' })

const job = [
    'apiVersion: batch/v1',
    'kind: Job',
    'metadata:',
    '  generateName: nightly-manual-',
    '  namespace: payments',
    'spec:',
    '  template:',
    '    spec:',
    '      containers: []',
].join('\n')

describe('CronJobRunValidator', () => {
    it('accepts the job built from the template', () => {
        expect(validate(job)).toEqual({ valid: true, errors: {} })
    })

    it('accepts a job that leaves the namespace to its cron job', () => {
        expect(validate(job.replace('  namespace: payments\n', '')).valid).toBe(true)
    })

    it('asks for a manifest when the editor is empty', () => {
        expect(validate('   ').errors.manifest).toBe('Write the manifest of the job to run')
    })

    it('reports YAML that does not parse', () => {
        const result = validate('kind: [Job')

        expect(result.valid).toBe(false)
        expect(result.errors.manifest).toContain('not valid YAML')
    })

    it('refuses to run anything but a job', () => {
        const result = validate(job.replace('kind: Job', 'kind: Deployment'))

        expect(result.valid).toBe(false)
        expect(result.errors.manifest).toContain('must describe a Job of batch/v1')
    })

    it('asks for a name when both name and generateName are gone', () => {
        expect(validate(job.replace('  generateName: nightly-manual-\n', '')).errors.manifest)
            .toContain('metadata.name or metadata.generateName')
    })

    it('keeps the job in the namespace of its cron job', () => {
        expect(validate(job.replace('namespace: payments', 'namespace: default')).errors.manifest)
            .toContain('runs in payments')
    })

    it('reports every problem at once', () => {
        const broken = job
            .replace('kind: Job', 'kind: Pod')
            .replace('  generateName: nightly-manual-\n', '')
            .replace('namespace: payments', 'namespace: default')

        const message = validate(broken).errors.manifest

        expect(message).toContain('must describe')
        expect(message).toContain('metadata.name')
        expect(message).toContain('runs in payments')
    })
})
