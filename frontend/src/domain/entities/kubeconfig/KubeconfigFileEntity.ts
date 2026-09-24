import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'

export class KubeconfigFileEntity extends RepoEntityBase<KubeconfigFileEntity> {
    public static readonly DefaultName = 'config'

    // Far above any real kubeconfig; keeps an archive dropped into the folder from being read whole.
    public static readonly MaxSize = 4 * 1024 * 1024

    @RepoEntityField({ isPrimaryKey: true })
    path: string

    @RepoEntityField()
    name: string

    @RepoEntityField()
    isDirectory: boolean

    @RepoEntityField()
    size: number

    @RepoEntityField()
    modifiedAt: number

    // Dotfiles in a kubeconfig folder are Finder metadata and editor swap files, never a config.
    get isCandidate(): boolean {
        return !this.isDirectory && !this.name.startsWith('.') && this.size <= KubeconfigFileEntity.MaxSize
    }

    get isDefault(): boolean {
        return this.name === KubeconfigFileEntity.DefaultName
    }

    get stamp(): string {
        return `${this.path}|${this.size}|${this.modifiedAt}`
    }
}
