import type { TX509Certificate } from '@/domain/models/certificate/types/TX509Certificate'
import type { TX509Validity } from '@/domain/models/certificate/types/TX509Validity'

export type TX509Chain = {
    certificates: TX509Certificate[]
    hasChain: boolean
    missingIssuerChain: boolean
    worstValidity: TX509Validity
}
