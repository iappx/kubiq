import { injectable } from 'tsyringe'
import type { TPortForwardDraft } from '@/application/services/portForward/types/TPortForwardDraft'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class PortForwardValidator {
    public static readonly maxPort: number = 65535

    private static readonly whole: RegExp = /^\d+$/

    private static readonly label: RegExp = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/

    private static readonly subdomain: RegExp = /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/

    public validate(draft: TPortForwardDraft): TValidationResult {
        const errors: Record<string, string> = {}

        const namespace = draft.namespace.trim()
        if (namespace.length === 0) {
            errors.namespace = 'Choose the namespace the target lives in'
        } else if (!PortForwardValidator.label.test(namespace)) {
            errors.namespace = 'Use lowercase letters, digits and dashes'
        }

        const name = draft.name.trim()
        if (name.length === 0) {
            errors.name = 'Choose the pod or the service to forward from'
        } else if (!PortForwardValidator.subdomain.test(name)) {
            errors.name = 'Use lowercase letters, digits, dashes and dots'
        }

        const remote = draft.remotePort.trim()
        if (remote.length === 0) {
            errors.remotePort = 'Choose the port to forward'
        } else if (!PortForwardValidator.whole.test(remote) || !PortForwardValidator.inRange(Number(remote), 1)) {
            errors.remotePort = `A port is a whole number between 1 and ${PortForwardValidator.maxPort}`
        }

        const local = draft.localPort.trim()
        if (local.length > 0 && (!PortForwardValidator.whole.test(local) || !PortForwardValidator.inRange(Number(local), 0))) {
            errors.localPort = `Leave this empty to be given a free port, or enter one between 1 and ${PortForwardValidator.maxPort}`
        }

        return { valid: Object.keys(errors).length === 0, errors }
    }

    public static parse(draft: TPortForwardDraft): { remotePort: number, localPort: number } {
        const local = draft.localPort.trim()

        return {
            remotePort: Number.parseInt(draft.remotePort.trim(), 10),
            localPort: local === '' ? 0 : Number.parseInt(local, 10),
        }
    }

    private static inRange(value: number, lowest: number): boolean {
        return Number.isInteger(value) && value >= lowest && value <= PortForwardValidator.maxPort
    }
}
