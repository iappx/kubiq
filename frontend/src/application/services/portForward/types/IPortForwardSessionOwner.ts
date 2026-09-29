import type { PortForwardSession } from '@/application/services/portForward/models/PortForwardSession'

export interface IPortForwardSessionOwner {
    onSessionError(session: PortForwardSession, details: string): void

    onSessionClosed(session: PortForwardSession, status: string): void
}
