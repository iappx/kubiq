import { IoService } from '../../../../../bindings/iappx_k8s_admin/core/services/io'
import { IOOptions } from '../../../../../bindings/iappx_k8s_admin/core/services/io/models'
import { ApiError } from '@/domain/errors/ApiError'

export class HelmValuesFile {
    public static readonly directory: string = 'userdata:tmp'

    private static readonly options = new IOOptions({ Mode: 'Text', Range: '' })

    private static sequence = 0

    public static async write(content: string): Promise<string> {
        const path = `${HelmValuesFile.directory}/values-${Date.now()}-${++HelmValuesFile.sequence}.yaml`
        const written = await IoService.WriteFile(path, content, HelmValuesFile.options)

        if (!written.success) {
            throw new ApiError('Could not hand the values over to helm', written.data)
        }

        const absolute = await IoService.AbsolutePath(path)
        if (!absolute.success) {
            await HelmValuesFile.remove(path)
            throw new ApiError('Could not hand the values over to helm', absolute.data)
        }

        return absolute.data
    }

    // Values can carry credentials, so the file never outlives the command that needed it.
    public static async remove(path: string): Promise<void> {
        if (path === '') {
            return
        }

        await IoService.RemoveFile(path).catch(() => undefined)
    }
}
