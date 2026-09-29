import { beforeEach, describe, expect, it } from 'vitest'
import { ClusterAppearanceService } from '@/application/services/clusterAppearance/ClusterAppearanceService'
import { ClusterIconFile } from '@/application/services/clusterAppearance/models/ClusterIconFile'
import { ClusterMonogram } from '@/domain/entities/catalog/ClusterMonogram'
import type { TClusterAppearanceDraft } from '@/domain/entities/catalog/types/TClusterAppearanceDraft'
import { ApiError } from '@/domain/errors/ApiError'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import type { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import type { FileDialogAdapter } from '@/infrastructure/wails/FileDialogAdapter'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'

const APPEARANCE_FILE = 'userdata:clusters/appearance.json'
const LOGO = 'D:/pictures/logo.png'
const OTHER_LOGO = 'D:/pictures/other.svg'

let transport: MemoryFileTransport
let picked: string

const dialog = {
    isAvailable: true,
    openFile: async () => picked,
} as unknown as FileDialogAdapter

const service = () => new ClusterAppearanceService(
    new EntityRepoProvider(transport as unknown as FileSystemTransport),
    transport as unknown as FileSystemTransport,
    dialog,
)

const draft = (overrides: Partial<TClusterAppearanceDraft> = {}): TClusterAppearanceDraft => ({
    displayName: '',
    iconKind: 'initials',
    initials: 'PR',
    color: 'red',
    glyph: 'server',
    imageFile: '',
    ...overrides,
})

const iconFiles = () => [...transport.files.keys()].filter(path => path.startsWith(`${ClusterIconFile.directory}/`))

describe('ClusterAppearanceService', () => {
    beforeEach(() => {
        transport = new MemoryFileTransport()
        transport.files.set(LOGO, 'iVBORw0KGgo=')
        transport.files.set(OTHER_LOGO, 'PHN2Zy8+')
        picked = ''
    })

    it('answers nothing on a first run', async () => {
        await expect(service().getAll()).resolves.toEqual([])
    })

    it('generates initials and a color from the name when nothing was chosen', () => {
        const appearance = ClusterAppearanceService.defaultOf('prod-eu')

        expect(appearance.displayName).toBe('')
        expect(appearance.icon).toEqual(ClusterMonogram.iconFor('prod-eu'))
    })

    it('keeps initials and a color across a restart', async () => {
        await service().save('prod', draft({ displayName: '  Production  ', initials: 'pr' }), 10)

        const [stored] = await service().getAll()

        expect(stored.displayName).toBe('Production')
        expect(stored.icon).toMatchObject({ kind: 'initials', initials: 'PR', color: 'red' })
        expect(transport.read(APPEARANCE_FILE)).toHaveLength(1)
    })

    it('keeps a symbol and a color across a restart', async () => {
        await service().save('prod', draft({ iconKind: 'glyph', glyph: 'shield', color: 'violet' }), 10)

        const [stored] = await service().getAll()

        expect(stored.icon).toMatchObject({ kind: 'glyph', glyph: 'shield', color: 'violet' })
    })

    it('falls back to generated initials when the operator left the field empty', async () => {
        const saved = await service().save('staging-eu', draft({ iconKind: 'glyph', initials: '  ' }), 10)

        expect(saved.icon.initials).toBe('SE')
    })

    it('replaces the record of a cluster instead of adding a second one', async () => {
        await service().save('prod', draft({ color: 'red' }), 10)
        await service().save('prod', draft({ color: 'blue' }), 20)

        expect(transport.read(APPEARANCE_FILE)).toEqual([expect.objectContaining({ clusterId: 'prod', color: 'blue' })])
    })

    describe('images', () => {
        it('copies the image into the user profile and shows it from there', async () => {
            const saved = await service().save('prod', draft({ iconKind: 'image', imageFile: LOGO }), 10)

            expect(iconFiles()).toEqual([saved.imagePath])
            expect(saved.icon).toMatchObject({ kind: 'image', imageUrl: 'data:image/png;base64,iVBORw0KGgo=' })
        })

        it('still shows the image once the original is gone', async () => {
            await service().save('prod', draft({ iconKind: 'image', imageFile: LOGO }), 10)
            transport.files.delete(LOGO)

            const [stored] = await service().getAll()

            expect(stored.icon.imageUrl).toBe('data:image/png;base64,iVBORw0KGgo=')
        })

        it('keeps the stored image when the operator saves without choosing another', async () => {
            const first = await service().save('prod', draft({ iconKind: 'image', imageFile: LOGO }), 10)

            const second = await service().save('prod', draft({ iconKind: 'image', displayName: 'Production' }), 20)

            expect(second.imagePath).toBe(first.imagePath)
            expect(iconFiles()).toEqual([first.imagePath])
        })

        it('deletes the old copy when the image is replaced', async () => {
            const first = await service().save('prod', draft({ iconKind: 'image', imageFile: LOGO }), 10)

            const second = await service().save('prod', draft({ iconKind: 'image', imageFile: OTHER_LOGO }), 20)

            expect(iconFiles()).toEqual([second.imagePath])
            expect(transport.removed).toContain(first.imagePath)
            expect(second.icon.imageUrl).toBe('data:image/svg+xml;base64,PHN2Zy8+')
        })

        it('deletes the copy when the icon stops being an image', async () => {
            const first = await service().save('prod', draft({ iconKind: 'image', imageFile: LOGO }), 10)

            const second = await service().save('prod', draft({ iconKind: 'initials' }), 20)

            expect(second.imagePath).toBe('')
            expect(iconFiles()).toEqual([])
            expect(transport.removed).toContain(first.imagePath)
        })

        it('refuses an image icon with no image', async () => {
            const failure = await service().save('prod', draft({ iconKind: 'image' }), 10).catch(err => err)

            expect(failure).toBeInstanceOf(ApiError)
            expect((failure as ApiError).message).toBe(ClusterAppearanceService.noImage)
            expect(transport.files.has(APPEARANCE_FILE)).toBe(false)
        })

        it('refuses a file that is not a picture before copying anything', async () => {
            transport.files.set('D:/notes.txt', 'hello')

            const failure = await service().save('prod', draft({ iconKind: 'image', imageFile: 'D:/notes.txt' }), 10)
                .catch(err => err)

            expect((failure as ApiError).message).toBe(ClusterIconFile.unsupported)
            expect(iconFiles()).toEqual([])
        })

        it('refuses an image that is too large', async () => {
            transport.files.set('D:/huge.png', 'x'.repeat(ClusterIconFile.maxBytes + 1))

            const failure = await service().save('prod', draft({ iconKind: 'image', imageFile: 'D:/huge.png' }), 10)
                .catch(err => err)

            expect((failure as ApiError).message).toBe(ClusterIconFile.tooLarge)
            expect(iconFiles()).toEqual([])
        })

        it('shows initials when the stored copy has gone missing', async () => {
            const saved = await service().save('prod', draft({ iconKind: 'image', imageFile: LOGO }), 10)
            transport.files.delete(saved.imagePath)

            const [stored] = await service().getAll()

            expect(stored.icon).toMatchObject({ kind: 'initials', imageUrl: '' })
        })

        it('previews a picked file before anything is saved', async () => {
            await expect(service().previewOf(OTHER_LOGO)).resolves.toBe('data:image/svg+xml;base64,PHN2Zy8+')
            expect(iconFiles()).toEqual([])
        })

        it('says so when the picked file cannot be read', async () => {
            await expect(service().previewOf('D:/pictures/gone.png')).rejects.toBeInstanceOf(ApiError)
        })

        it('hands back whatever the file dialog picked', async () => {
            picked = LOGO

            await expect(service().chooseImage()).resolves.toBe(LOGO)
        })
    })

    describe('reset', () => {
        it('forgets the appearance and deletes the image copy', async () => {
            const saved = await service().save('prod', draft({ iconKind: 'image', imageFile: LOGO }), 10)

            await service().reset('prod')

            await expect(service().getAll()).resolves.toEqual([])
            expect(transport.removed).toContain(saved.imagePath)
        })

        it('leaves the other clusters alone', async () => {
            await service().save('prod', draft(), 10)
            await service().save('lab', draft(), 10)

            await service().reset('prod')

            expect((await service().getAll()).map(item => item.clusterId)).toEqual(['lab'])
        })

        it('does nothing for a cluster that was never customized', async () => {
            await service().reset('prod')

            expect(transport.writes).toBe(0)
        })
    })

    it('turns an appearance into a draft the form can edit', () => {
        const appearance = ClusterAppearanceService.defaultOf('prod')

        expect(ClusterAppearanceService.draftOf(appearance)).toEqual({
            displayName: '',
            iconKind: 'initials',
            initials: appearance.icon.initials,
            color: appearance.icon.color,
            glyph: appearance.icon.glyph,
            imageFile: '',
        })
    })
})
