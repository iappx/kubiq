import { describe, expect, it } from 'vitest'
import { MetricFormat, MetricQuantity } from '@/domain/models/metrics'

describe('MetricQuantity', () => {
    it('reads the nano and milli suffixes metrics-server answers with', () => {
        expect(MetricQuantity.parse('123456789n')).toBeCloseTo(0.123456789, 9)
        expect(MetricQuantity.parse('250m')).toBeCloseTo(0.25, 9)
        expect(MetricQuantity.parse('1500u')).toBeCloseTo(0.0015, 9)
        expect(MetricQuantity.parse('2')).toBe(2)
    })

    it('reads binary and decimal memory suffixes apart', () => {
        expect(MetricQuantity.parse('1Ki')).toBe(1024)
        expect(MetricQuantity.parse('1k')).toBe(1000)
        expect(MetricQuantity.parse('2Mi')).toBe(2 * 1024 * 1024)
        expect(MetricQuantity.parse('3G')).toBe(3e9)
    })

    it('reads the exponent form without mistaking E for exa', () => {
        expect(MetricQuantity.parse('129e6')).toBe(129e6)
        expect(MetricQuantity.parse('1E')).toBe(1e18)
        expect(MetricQuantity.parse('2E3')).toBe(2000)
    })

    it('answers zero for anything that is not a quantity', () => {
        expect(MetricQuantity.parse('')).toBe(0)
        expect(MetricQuantity.parse('a lot')).toBe(0)
        expect(MetricQuantity.parse(undefined)).toBe(0)
        expect(MetricQuantity.parse(null)).toBe(0)
        expect(MetricQuantity.parse(Number.NaN)).toBe(0)
        expect(MetricQuantity.parse(7)).toBe(7)
    })

    it('sums a list and refuses to divide by nothing', () => {
        expect(MetricQuantity.sum(['100m', '150m', undefined])).toBeCloseTo(0.25, 9)
        expect(MetricQuantity.ratio(1, 4)).toBe(0.25)
        expect(MetricQuantity.ratio(1, 0)).toBe(0)
    })
})

describe('MetricFormat', () => {
    it('writes small CPU figures in millicores and larger ones in cores', () => {
        expect(MetricFormat.cores(0.052)).toBe('52m')
        expect(MetricFormat.cores(1.25)).toBe('1.25')
        expect(MetricFormat.cores(2)).toBe('2')
        expect(MetricFormat.cores(0)).toBe('0')
    })

    it('scales memory to binary units', () => {
        expect(MetricFormat.bytes(512)).toBe('512 B')
        expect(MetricFormat.bytes(1536)).toBe('1.5 KiB')
        expect(MetricFormat.bytes(3 * 1024 * 1024)).toBe('3 MiB')
        expect(MetricFormat.bytes(0)).toBe('0')
    })

    it('picks the unit from the series kind', () => {
        expect(MetricFormat.of('cpu', 0.5)).toBe('500m')
        expect(MetricFormat.of('memory', 2048)).toBe('2 KiB')
        expect(MetricFormat.unitOf('cpu')).toBe('cores')
        expect(MetricFormat.unitOf('memory')).toBe('bytes')
    })

    it('rounds a share and leaves an unknown one out', () => {
        expect(MetricFormat.percent(0.426)).toBe('43%')
        expect(MetricFormat.percent(0)).toBe('0%')
        expect(MetricFormat.share('52m', 0.5)).toBe('52m · 50%')
        expect(MetricFormat.share('52m', 0)).toBe('52m')
    })
})
