import { describe, expect, it } from 'vitest'
import { NodeShellCommand, PodShellCommand } from '@/domain/models/terminal'

describe('PodShellCommand', () => {
    it('runs the fallback inside the container instead of retrying the channel', () => {
        const argv = PodShellCommand.argv()

        expect(argv[0]).toBe('/bin/sh')
        expect(argv[1]).toBe('-c')
        expect(argv).toHaveLength(3)
    })

    it('prefers bash and falls back to sh', () => {
        expect(PodShellCommand.shells).toEqual(['bash', 'sh'])
        expect(PodShellCommand.script()).toContain('for candidate in bash sh')
        expect(PodShellCommand.script()).toContain('exec "$candidate"')
    })

    it('says so and exits when the container has no shell at all', () => {
        expect(PodShellCommand.script()).toContain(PodShellCommand.missing)
        expect(PodShellCommand.script()).toContain('exit 127')
    })
})

describe('NodeShellCommand', () => {
    it('enters the host namespaces from pid 1', () => {
        const argv = NodeShellCommand.argv()

        expect(argv.slice(0, 3)).toEqual(['nsenter', '--target', '1'])
        expect(argv).toContain('--mount')
        expect(argv).toContain('--pid')
        expect(argv).toContain('--net')
    })

    it('hands the same shell fallback to the host', () => {
        const argv = NodeShellCommand.argv()

        expect(argv[argv.length - 1]).toBe(PodShellCommand.script())
        expect(argv).toContain('--')
    })
})
