import { describe, expect, it, vi } from 'vitest'

vi.mock('@iappx/vue-facing-di', () => ({
    Component: () => <T>(target: T): T => target,
    Prop: () => () => {},
    VModel: () => () => {},
    Watch: () => () => {},
    VueBase: class {},
}))

import UiDock from '@/components/common/panel/UiDock.vue'

type TDockHarness = {
    active: string | null
    collapsed: boolean
    $emit: ReturnType<typeof vi.fn>
    select: (key: string) => void
}

const createDock = (active: string | null, collapsed: boolean): TDockHarness => {
    const instance = new (UiDock as unknown as new () => TDockHarness)()
    instance.active = active
    instance.collapsed = collapsed
    instance.$emit = vi.fn()
    return instance
}

describe('UiDock.select', () => {
    it('expands a collapsed dock when clicking the active tab', () => {
        const dock = createDock('shell:t8s-nsk', true)

        dock.select('shell:t8s-nsk')

        expect(dock.$emit).toHaveBeenCalledTimes(1)
        expect(dock.$emit).toHaveBeenCalledWith('update:collapsed', false)
    })

    it('activates the clicked tab and expands a collapsed dock when clicking an inactive tab', () => {
        const dock = createDock('shell:t8s-nsk', true)

        dock.select('log:api')

        expect(dock.$emit).toHaveBeenCalledTimes(2)
        expect(dock.$emit).toHaveBeenNthCalledWith(1, 'update:active', 'log:api')
        expect(dock.$emit).toHaveBeenNthCalledWith(2, 'update:collapsed', false)
    })

    it('activates an inactive tab without re-emitting collapsed when already expanded', () => {
        const dock = createDock('shell:t8s-nsk', false)

        dock.select('log:api')

        expect(dock.$emit).toHaveBeenCalledTimes(1)
        expect(dock.$emit).toHaveBeenCalledWith('update:active', 'log:api')
    })

    it('emits nothing when clicking the active tab of an expanded dock', () => {
        const dock = createDock('shell:t8s-nsk', false)

        dock.select('shell:t8s-nsk')

        expect(dock.$emit).not.toHaveBeenCalled()
    })
})
