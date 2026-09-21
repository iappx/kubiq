import { describe, expect, it } from 'vitest'
import { PodLogArchive } from '@/application/services/podLogs/models/PodLogArchive'

describe('PodLogArchive', () => {
    it('names the file after the object and the moment it was saved', () => {
        const path = PodLogArchive.pathFor('payments', 'api-0', 'app', new Date(2026, 8, 21, 14, 32, 5))

        expect(path).toBe('userdata:logs/payments_api-0_app_20260921-143205.log')
    })

    it('pads every part of the stamp', () => {
        expect(PodLogArchive.stamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102-030405')
    })

    it('leaves out the container when the cluster picked one', () => {
        const path = PodLogArchive.pathFor('payments', 'api-0', '', new Date(2026, 8, 21, 14, 32, 5))

        expect(path).toBe('userdata:logs/payments_api-0_20260921-143205.log')
    })

    it('leaves no separator in a name that could otherwise escape the directory', () => {
        const path = PodLogArchive.pathFor('../etc', 'a/b', 'c\\d', new Date(2026, 8, 21, 14, 32, 5))

        expect(path.startsWith(`${PodLogArchive.directory}/`)).toBe(true)
        expect(path.slice(PodLogArchive.directory.length + 1)).not.toMatch(/[/\\]/)
    })
})
