import { describe, expect, it } from 'vitest'
import { ChannelExitReason } from '@/application/services/terminal/models/ChannelExitReason'

describe('ChannelExitReason', () => {
    it('says nothing about a clean exit', () => {
        expect(ChannelExitReason.text('{"kind":"Status","status":"Success"}')).toBe('')
        expect(ChannelExitReason.text('')).toBe('')
        expect(ChannelExitReason.text('   ')).toBe('')
    })

    it('reads the message the API server sent', () => {
        const status = '{"kind":"Status","status":"Failure","message":"command terminated with exit code 1"}'

        expect(ChannelExitReason.text(status)).toBe('command terminated with exit code 1')
    })

    it('shows the document itself when it is a failure with nothing to read', () => {
        expect(ChannelExitReason.text('{"status":"Failure"}')).toBe('{"status":"Failure"}')
    })

    it('shows plain text the cluster sent instead of a status document', () => {
        expect(ChannelExitReason.text('unable to upgrade connection')).toBe('unable to upgrade connection')
    })

    it('does not treat a JSON array as a status document', () => {
        expect(ChannelExitReason.text('[1,2]')).toBe('[1,2]')
    })
})
