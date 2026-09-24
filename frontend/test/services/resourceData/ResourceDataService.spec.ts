import { beforeEach, describe, expect, it } from 'vitest'
import { ClipboardService } from '@/application/services/clipboard/ClipboardService'
import { ResourceDataService } from '@/application/services/resourceData/ResourceDataService'
import { ApiError } from '@/domain/errors/ApiError'

const writes: string[] = []
let refuse = false

const clipboard = {
    write: (text: string) => {
        if (refuse) {
            return Promise.reject(new ApiError(ClipboardService.refused, 'denied'))
        }
        writes.push(text)

        return Promise.resolve()
    },
} as unknown as ClipboardService

const service = new ResourceDataService(clipboard)

describe('ResourceDataService', () => {
    beforeEach(() => {
        writes.length = 0
        refuse = false
    })

    it('copies one value exactly as given', async () => {
        await service.copyValue({ key: 'level', value: 'debug\n' })

        expect(writes).toEqual(['debug\n'])
    })

    it('copies every pair as one YAML map and says how many it copied', async () => {
        const copied = await service.copyAll([
            { key: 'level', value: 'debug' },
            { key: 'app.conf', value: 'a=1\nb=2\n' },
        ])

        expect(copied).toBe(2)
        expect(writes).toEqual(['level: debug\napp.conf: |\n  a=1\n  b=2\n'])
    })

    it('lets a refused clipboard fail upwards', async () => {
        refuse = true

        await expect(service.copyAll([{ key: 'a', value: 'b' }])).rejects.toBeInstanceOf(ApiError)
    })
})
