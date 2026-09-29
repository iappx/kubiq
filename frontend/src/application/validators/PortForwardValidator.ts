import { injectable } from 'tsyringe'
import type { TPortForwardDraft } from '@/application/services/portForward/types/TPortForwardDraft'
import { PortForwardRemotePort } from '@/domain/entities/portForward/PortForwardRemotePort'
import { PortForwardRestoreModeCatalog } from '@/domain/entities/portForward/PortForwardRestoreModeCatalog'
import type { TPortForwardRemotePort } from '@/domain/entities/portForward/types/TPortForwardRemotePort'
import type { TPortForwardRestoreMode } from '@/domain/entities/portForward/types/TPortForwardRestoreMode'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class PortForwardValidator {
    public static readonly maxPort: number = 65535

    public static readonly maxPortNameLength: number = 15

    private static readonly whole: RegExp = /^\d+$/

    private static readonly label: RegExp = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/

    private static readonly subdomain: RegExp = /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/

    private static readonly letter: RegExp = /[a-z]/

    public validate(draft: TPortForwardDraft, taken: readonly TPortForwardRemotePort[] = []): TValidationResult {
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
            errors.remotePort = 'Choose the port to forward, or type its number or name'
        } else if (PortForwardValidator.whole.test(remote)) {
            if (!PortForwardValidator.inRange(Number(remote), 1)) {
                errors.remotePort = `A port number is between 1 and ${PortForwardValidator.maxPort}`
            }
        } else if (!PortForwardValidator.isPortName(remote)) {
            errors.remotePort = `A port name is up to ${PortForwardValidator.maxPortNameLength} lowercase letters, digits and dashes`
        }

        if (!errors.remotePort && taken.some(port => PortForwardRemotePort.same(port, remote))) {
            errors.remotePort = 'Another port forward already uses this port — edit that one instead'
        }

        const local = draft.localPort.trim()
        if (local.length > 0 && (!PortForwardValidator.whole.test(local) || !PortForwardValidator.inRange(Number(local), 0))) {
            errors.localPort = `Leave this empty to be given a free port, or enter one between 1 and ${PortForwardValidator.maxPort}`
        }

        if (!PortForwardRestoreModeCatalog.has(draft.restoreMode)) {
            errors.restoreMode = 'Choose when the forward starts'
        }

        return { valid: Object.keys(errors).length === 0, errors }
    }

    public static parse(draft: TPortForwardDraft): {
        remotePort: TPortForwardRemotePort
        localPort: number
        restoreMode: TPortForwardRestoreMode
    } {
        const local = draft.localPort.trim()

        return {
            remotePort: PortForwardRemotePort.of(draft.remotePort),
            localPort: local === '' ? 0 : Number.parseInt(local, 10),
            restoreMode: PortForwardRestoreModeCatalog.of(draft.restoreMode),
        }
    }

    private static isPortName(value: string): boolean {
        return value.length <= PortForwardValidator.maxPortNameLength
            && PortForwardValidator.label.test(value)
            && PortForwardValidator.letter.test(value)
            && !value.includes('--')
    }

    private static inRange(value: number, lowest: number): boolean {
        return Number.isInteger(value) && value >= lowest && value <= PortForwardValidator.maxPort
    }
}
