import { afterEach, describe, expect, it } from 'vitest'
import { AppTheme } from '@/domain/models/theme'
import { ThemeAdapter } from '@/infrastructure/theme/ThemeAdapter'

const adapter = new ThemeAdapter()

describe('ThemeAdapter', () => {
    afterEach(() => {
        document.body.style.backgroundColor = ''
        document.documentElement.classList.remove(AppTheme.Light, AppTheme.Dark)
    })

    it('puts exactly one theme class on the document', () => {
        adapter.applyToDocument(AppTheme.Light)
        adapter.applyToDocument(AppTheme.Dark)

        expect(document.documentElement.classList.contains(AppTheme.Dark)).toBe(true)
        expect(document.documentElement.classList.contains(AppTheme.Light)).toBe(false)
    })

    it('reads the background the page actually paints', () => {
        document.body.style.backgroundColor = 'rgb(21, 27, 30)'

        expect(adapter.documentBackground()).toEqual({ red: 21, green: 27, blue: 30 })
    })

    it('reads an opaque rgba background as its colour', () => {
        document.body.style.backgroundColor = 'rgba(255, 255, 255, 1)'

        expect(adapter.documentBackground()).toEqual({ red: 255, green: 255, blue: 255 })
    })

    it('answers nothing while the page has no background yet', () => {
        expect(adapter.documentBackground()).toBeNull()

        document.body.style.backgroundColor = 'rgba(0, 0, 0, 0)'
        expect(adapter.documentBackground()).toBeNull()
    })
})
