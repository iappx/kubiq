import { inject, injectable } from 'tsyringe'
import { PastedKubeconfig } from '@/application/services/kubeconfigImport/models/PastedKubeconfig'
import { ApiError } from '@/domain/errors/ApiError'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'

@injectable()
export class KubeconfigImportService {
    public static readonly unsaved: string = 'Could not save the pasted kubeconfig'

    constructor(
        @inject(FileSystemTransport) private readonly files: FileSystemTransport,
        @inject(HostShellAdapter) private readonly host: HostShellAdapter,
    ) {}

    public async save(text: string): Promise<string> {
        const problem = PastedKubeconfig.problemWith(text)
        if (problem !== '') {
            throw new ApiError(problem)
        }

        const path = PastedKubeconfig.pathFor(text)
        await this.files.send<null>({ path, operation: 'write', content: text })

        const absolute = await this.host.absolutePath(path)
        if (absolute === '') {
            throw new ApiError(KubeconfigImportService.unsaved, `Kubiq could not write ${path}`)
        }

        return absolute
    }
}
