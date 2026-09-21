import { beforeEach, describe, expect, it } from 'vitest'
import { ExecutableService } from '@/application/services/executable/ExecutableService'
import type { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import type { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'

const variables: Record<string, string> = {}
let separator = ';'
const present = new Set<string>()
const probed: string[] = []

const environment = {
    get: async (name: string) => variables[name] ?? '',
    pathListSeparator: async () => separator,
    expand: async (path: string) => path.replace('%HOME%', 'C:\\home'),
    homeDir: async () => 'C:\\home',
} as unknown as EnvironmentAdapter

const host = {
    exists: async (path: string) => {
        probed.push(path)
        return present.has(path)
    },
} as unknown as HostShellAdapter

const service = new ExecutableService(environment, host)

describe('ExecutableService', () => {
    beforeEach(() => {
        Object.keys(variables).forEach(key => delete variables[key])
        present.clear()
        probed.length = 0
        separator = ';'
    })

    describe('a path set in the settings', () => {
        it('is used when the file is there', async () => {
            present.add('C:\\tools\\kubectl.exe')

            const found = await service.locate('kubectl', 'C:\\tools\\kubectl.exe')

            expect(found).toEqual({ name: 'kubectl', path: 'C:\\tools\\kubectl.exe', source: 'settings' })
        })

        it('is expanded before it is checked', async () => {
            present.add('C:\\home\\bin\\kubectl')

            const found = await service.locate('kubectl', '%HOME%\\bin\\kubectl')

            expect(found.path).toBe('C:\\home\\bin\\kubectl')
        })

        // A configured path that is wrong is worse than none: PATH would silently
        // answer with a different binary than the one the user chose.
        it('reports nothing found when the file is not there, without falling back to PATH', async () => {
            variables.PATH = 'C:\\windows'
            present.add('C:\\windows\\kubectl.exe')

            const found = await service.locate('kubectl', 'C:\\tools\\kubectl.exe')

            expect(found.source).toBe('none')
            expect(found.path).toBe('')
        })
    })

    describe('searching PATH', () => {
        it('takes the first directory that has it', async () => {
            variables.PATH = 'C:\\one;C:\\two'
            present.add('C:\\two\\kubectl.EXE')

            const found = await service.locate('kubectl')

            expect(found).toEqual({ name: 'kubectl', path: 'C:\\two\\kubectl.EXE', source: 'path' })
        })

        it('tries the extensions Windows declares', async () => {
            variables.PATH = 'C:\\one'
            variables.PATHEXT = '.COM;.EXE;.CMD'
            present.add('C:\\one\\kubectl.CMD')

            const found = await service.locate('kubectl')

            expect(found.path).toBe('C:\\one\\kubectl.CMD')
            expect(probed).toEqual(['C:\\one\\kubectl.COM', 'C:\\one\\kubectl.EXE', 'C:\\one\\kubectl.CMD'])
        })

        it('uses no extension at all on a unix host', async () => {
            separator = ':'
            variables.PATH = '/usr/bin:/usr/local/bin'
            present.add('/usr/local/bin/kubectl')

            const found = await service.locate('kubectl')

            expect(found.path).toBe('/usr/local/bin/kubectl')
            expect(probed).toEqual(['/usr/bin/kubectl', '/usr/local/bin/kubectl'])
        })

        it('reports nothing found when no directory has it', async () => {
            separator = ':'
            variables.PATH = '/usr/bin'

            const found = await service.locate('kubectl')

            expect(found).toEqual({ name: 'kubectl', path: '', source: 'none' })
        })

        it('reports nothing found when the environment has no PATH', async () => {
            const found = await service.locate('kubectl')

            expect(found.source).toBe('none')
            expect(probed).toHaveLength(0)
        })

        it('ignores empty entries and trailing separators', async () => {
            separator = ':'
            variables.PATH = '/usr/bin: :/usr/local/bin/:'
            present.add('/usr/local/bin/helm')

            const found = await service.locate('helm')

            expect(found.path).toBe('/usr/local/bin/helm')
        })
    })

    it('knows the host is Windows from its path separator', async () => {
        expect(await service.isWindows()).toBe(true)

        separator = ':'
        expect(await service.isWindows()).toBe(false)
    })
})
