import { inject, injectable } from 'tsyringe'
import { ClipboardService } from '@/application/services/clipboard/ClipboardService'
import { ResourceDataYaml } from '@/application/services/resourceData/models/ResourceDataYaml'
import type { TResourceDataPair } from '@/application/services/resourceData/types/TResourceDataPair'

@injectable()
export class ResourceDataService {
    constructor(
        @inject(ClipboardService) private readonly clipboardService: ClipboardService,
    ) {}

    public copyValue(pair: TResourceDataPair): Promise<void> {
        return this.clipboardService.write(pair.value)
    }

    public async copyAll(pairs: readonly TResourceDataPair[]): Promise<number> {
        await this.clipboardService.write(ResourceDataYaml.of(pairs))

        return pairs.length
    }
}
