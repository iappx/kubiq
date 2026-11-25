import type { TX509Validity } from '@/domain/models/certificate/types/TX509Validity'

export type TX509Certificate = {
    version: string
    serialNumber: string
    signatureAlgorithm: string
    issuer: string
    subject: string
    notBefore: string
    notAfter: string
    validity: TX509Validity
    subjectAltNames: string[]
    isSelfSigned: boolean
    isCa: boolean
}
