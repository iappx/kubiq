import { inject, injectable } from 'tsyringe'
import { ClusterIconFile } from '@/application/services/clusterAppearance/models/ClusterIconFile'
import type { TClusterAppearance } from '@/application/services/clusterAppearance/types/TClusterAppearance'
import { ClusterAppearanceEntity } from '@/domain/entities/catalog/ClusterAppearanceEntity'
import { ClusterIconColorCatalog } from '@/domain/entities/catalog/ClusterIconColorCatalog'
import { ClusterIconGlyphCatalog } from '@/domain/entities/catalog/ClusterIconGlyphCatalog'
import { ClusterIconKindCatalog } from '@/domain/entities/catalog/ClusterIconKindCatalog'
import { ClusterMonogram } from '@/domain/entities/catalog/ClusterMonogram'
import type { TClusterAppearanceDraft } from '@/domain/entities/catalog/types/TClusterAppearanceDraft'
import type { TClusterIcon } from '@/domain/entities/catalog/types/TClusterIcon'
import { ApiError } from '@/domain/errors/ApiError'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import type { TFileEntry } from '@/infrastructure/entityRepo/transport/types/TFileEntry'
import { FileDialogAdapter } from '@/infrastructure/wails/FileDialogAdapter'

@injectable()
export class ClusterAppearanceService {
    public static readonly noImage: string = 'Choose an image for the icon'

    constructor(
        @inject(EntityRepoProvider) private readonly repoProvider: EntityRepoProvider,
        @inject(FileSystemTransport) private readonly files: FileSystemTransport,
        @inject(FileDialogAdapter) private readonly fileDialog: FileDialogAdapter,
    ) {}

    public static defaultOf(clusterId: string): TClusterAppearance {
        return { clusterId, displayName: '', icon: ClusterMonogram.iconFor(clusterId), imagePath: '' }
    }

    public static draftOf(appearance: TClusterAppearance): TClusterAppearanceDraft {
        return {
            displayName: appearance.displayName,
            iconKind: appearance.icon.kind,
            initials: appearance.icon.initials,
            color: appearance.icon.color,
            glyph: appearance.icon.glyph,
            imageFile: '',
        }
    }

    public get canChooseImage(): boolean {
        return this.fileDialog.isAvailable
    }

    public async getAll(): Promise<TClusterAppearance[]> {
        const entities = await this.repoProvider.catalog.appearances.getAll()

        return Promise.all(entities.map(entity => this.appearanceOf(entity)))
    }

    public async save(clusterId: string, draft: TClusterAppearanceDraft, at: number): Promise<TClusterAppearance> {
        const existing = await this.repoProvider.catalog.appearances.getById(clusterId)
        const previousImage = existing?.imagePath ?? ''
        const kind = ClusterIconKindCatalog.of(draft.iconKind)

        let imagePath = kind === 'image' ? previousImage : ''
        if (kind === 'image' && draft.imageFile !== '') {
            imagePath = await this.importImage(clusterId, draft.imageFile, at)
        }
        if (kind === 'image' && imagePath === '') {
            throw new ApiError(ClusterAppearanceService.noImage)
        }

        const entity = ClusterAppearanceEntity.build({
            clusterId,
            displayName: draft.displayName.trim(),
            iconKind: kind,
            initials: ClusterMonogram.normalize(draft.initials) || ClusterMonogram.initialsOf(clusterId),
            color: ClusterIconColorCatalog.of(draft.color),
            glyph: ClusterIconGlyphCatalog.of(draft.glyph),
            imagePath,
            updatedAt: at,
        })

        if (existing) {
            await this.repoProvider.catalog.appearances.update(entity)
        } else {
            await this.repoProvider.catalog.appearances.create(entity)
        }

        if (previousImage !== '' && previousImage !== imagePath) {
            await this.discardImage(previousImage)
        }

        return this.appearanceOf(entity)
    }

    public async reset(clusterId: string): Promise<void> {
        const existing = await this.repoProvider.catalog.appearances.getById(clusterId)
        if (!existing) {
            return
        }

        await this.repoProvider.catalog.appearances.remove(clusterId)

        if (existing.imagePath) {
            await this.discardImage(existing.imagePath)
        }
    }

    public chooseImage(): Promise<string> {
        return this.fileDialog.openFile({
            title: 'Choose an image for the cluster icon',
            filters: [{ title: 'Images', pattern: ClusterIconFile.pattern }],
        })
    }

    public async previewOf(path: string): Promise<string> {
        await this.checkImage(path)

        const url = await this.readImage(path)
        if (url === '') {
            throw new ApiError(ClusterIconFile.missing, path)
        }

        return url
    }

    private async appearanceOf(entity: ClusterAppearanceEntity): Promise<TClusterAppearance> {
        const kind = ClusterIconKindCatalog.of(entity.iconKind)
        const imagePath = entity.imagePath ?? ''
        const imageUrl = kind === 'image' && imagePath !== '' ? await this.readImage(imagePath) : ''

        return {
            clusterId: entity.clusterId,
            displayName: (entity.displayName ?? '').trim(),
            icon: this.iconOf(entity, kind === 'image' && imageUrl === '' ? 'initials' : kind, imageUrl),
            imagePath,
        }
    }

    private iconOf(entity: ClusterAppearanceEntity, kind: TClusterIcon['kind'], imageUrl: string): TClusterIcon {
        return {
            kind,
            initials: ClusterMonogram.normalize(entity.initials ?? '') || ClusterMonogram.initialsOf(entity.clusterId),
            color: ClusterIconColorCatalog.of(entity.color),
            glyph: ClusterIconGlyphCatalog.of(entity.glyph),
            imageUrl,
        }
    }

    private async importImage(clusterId: string, source: string, at: number): Promise<string> {
        await this.checkImage(source)

        const target = ClusterIconFile.pathFor(clusterId, source, at)
        await this.files.send<null>({ path: target, operation: 'copy', source })

        return target
    }

    private async checkImage(path: string): Promise<void> {
        if (!ClusterIconFile.isSupported(path)) {
            throw new ApiError(ClusterIconFile.unsupported, path)
        }

        const entry = await this.files.send<TFileEntry | null>({ path, operation: 'stat' })
        if (!entry || entry.isDir) {
            throw new ApiError(ClusterIconFile.missing, path)
        }
        if (entry.size > ClusterIconFile.maxBytes) {
            throw new ApiError(ClusterIconFile.tooLarge, `${path} is ${entry.size} bytes`)
        }
    }

    private async readImage(path: string): Promise<string> {
        const content = await this.files.send<string | null>({ path, operation: 'readBinary' })

        return content ? ClusterIconFile.urlOf(path, content) : ''
    }

    private async discardImage(path: string): Promise<void> {
        await this.files.send<null>({ path, operation: 'remove' })
    }
}
