import { describe, expect, it } from 'vitest'
import { SettingsMigrationPlan } from '@/application/services/settings/models/SettingsMigrationPlan'
import { SettingsMigrations } from '@/application/services/settings/constants/SettingsMigrations'
import type { TSettingsMigration } from '@/application/services/settings/types/TSettingsMigration'

const step = (to: number): TSettingsMigration => ({ to, apply: () => Promise.resolve() })

describe('SettingsMigrationPlan', () => {
    it('keeps only the steps newer than the stored version', () => {
        const pending = SettingsMigrationPlan.pending(2, [step(1), step(2), step(3), step(4)])

        expect(pending.map(item => item.to)).toEqual([3, 4])
    })

    it('runs the steps oldest first however the list was written', () => {
        const pending = SettingsMigrationPlan.pending(0, [step(3), step(1), step(2)])

        expect(pending.map(item => item.to)).toEqual([1, 2, 3])
    })

    it('replays the whole history when the stamp was lost', () => {
        expect(SettingsMigrationPlan.pending(0, [step(1), step(2)]).map(item => item.to)).toEqual([1, 2])
    })

    it('has nothing to do when the stored version is the newest one', () => {
        expect(SettingsMigrationPlan.pending(2, [step(1), step(2)])).toEqual([])
    })

    it('targets the newest of the last step and the current version', () => {
        expect(SettingsMigrationPlan.targetVersion(0, [step(1), step(2)], 2)).toBe(2)
        expect(SettingsMigrationPlan.targetVersion(0, [], 3)).toBe(3)
    })

    it('never stamps a version down when the profile was written by a newer build', () => {
        expect(SettingsMigrationPlan.targetVersion(9, [step(1)], 2)).toBe(9)
    })

    it('ships a history whose newest step is the version the app writes', () => {
        const steps = SettingsMigrations.all()

        expect(steps.map(candidate => candidate.to)).toEqual([2])
        expect(Math.max(...steps.map(candidate => candidate.to))).toBe(SettingsMigrations.CurrentVersion)
    })
})
