import { describe, expect, it } from 'vitest'
import { WorkloadScaleValidator } from '@/application/validators/WorkloadScaleValidator'

const validator = new WorkloadScaleValidator()

describe('WorkloadScaleValidator', () => {
    it('accepts a whole number', () => {
        expect(validator.validate({ replicas: '3' })).toEqual({ valid: true, errors: {} })
    })

    it('accepts zero', () => {
        expect(validator.validate({ replicas: '0' }).valid).toBe(true)
    })

    it('rejects an empty field', () => {
        expect(validator.validate({ replicas: '  ' }).errors.replicas).toBe('Enter how many replicas to run')
    })

    it('rejects a negative count', () => {
        expect(validator.validate({ replicas: '-1' }).valid).toBe(false)
    })

    it('rejects a fraction', () => {
        expect(validator.validate({ replicas: '2.5' }).valid).toBe(false)
    })

    it('rejects anything that is not a number', () => {
        expect(validator.validate({ replicas: 'three' }).valid).toBe(false)
    })

    it('parses what it accepted', () => {
        expect(WorkloadScaleValidator.parse({ replicas: ' 12 ' })).toBe(12)
    })
})
