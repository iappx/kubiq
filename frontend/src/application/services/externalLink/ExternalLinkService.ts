import { inject, singleton } from 'tsyringe'
import { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'

@singleton()
export class ExternalLinkService {
    constructor(
        @inject(HostShellAdapter) private readonly host: HostShellAdapter,
    ) {}

    public async open(url: string): Promise<void> {
        const trimmed = url.trim()
        if (!trimmed) {
            return
        }

        if (this.host.isAvailable) {
            await this.host.openUri(trimmed)
            return
        }

        if (typeof window !== 'undefined') {
            window.open(trimmed, '_blank', 'noopener,noreferrer')
        }
    }
}
