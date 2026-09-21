import { describe, expect, it } from 'vitest'
import { UiAgeFormatter } from '@/components/common/time/UiAgeFormatter'

const now = Date.parse('2026-01-01T12:00:00.000Z')
const ago = (seconds: number): string => UiAgeFormatter.format(now - seconds * 1000, now)

describe('UiAgeFormatter', () => {
    it('counts in seconds up to two minutes', () => {
        expect(ago(0)).toBe('0s')
        expect(ago(45)).toBe('45s')
        expect(ago(119)).toBe('119s')
    })

    it('switches to minutes at two minutes and keeps the seconds under ten', () => {
        expect(ago(120)).toBe('2m')
        expect(ago(125)).toBe('2m5s')
        expect(ago(599)).toBe('9m59s')
    })

    it('drops the seconds from ten minutes on', () => {
        expect(ago(600)).toBe('10m')
        expect(ago(60 * 179)).toBe('179m')
    })

    it('switches to hours at three hours and keeps the minutes under eight', () => {
        expect(ago(3600 * 3)).toBe('3h')
        expect(ago(3600 * 3 + 60 * 30)).toBe('3h30m')
        expect(ago(3600 * 8)).toBe('8h')
    })

    it('drops the minutes from eight hours on', () => {
        expect(ago(3600 * 10 + 60 * 30)).toBe('10h')
        expect(ago(3600 * 47)).toBe('47h')
    })

    it('switches to days at two days and keeps the hours under eight days', () => {
        expect(ago(86400 * 2)).toBe('2d')
        expect(ago(86400 * 3 + 3600 * 5)).toBe('3d5h')
        expect(ago(86400 * 8)).toBe('8d')
    })

    it('drops the hours from eight days on', () => {
        expect(ago(86400 * 10 + 3600 * 5)).toBe('10d')
        expect(ago(86400 * 400)).toBe('400d')
    })

    it('switches to years past two years', () => {
        expect(ago(86400 * 365 * 3)).toBe('3y')
        expect(ago(86400 * (365 * 3 + 40))).toBe('3y40d')
    })

    it('reads a clock skewed into the future as zero rather than a negative age', () => {
        expect(UiAgeFormatter.format(now + 5000, now)).toBe('0s')
    })

    it('accepts the shapes a timestamp arrives in and rejects the rest', () => {
        expect(UiAgeFormatter.parse('2026-01-01T12:00:00.000Z')).toBe(now)
        expect(UiAgeFormatter.parse(new Date(now))).toBe(now)
        expect(UiAgeFormatter.parse(now)).toBe(now)
        expect(UiAgeFormatter.parse(null)).toBeNull()
        expect(UiAgeFormatter.parse('')).toBeNull()
        expect(UiAgeFormatter.parse('not a date')).toBeNull()
        expect(UiAgeFormatter.parse(new Date('not a date'))).toBeNull()
    })
})
