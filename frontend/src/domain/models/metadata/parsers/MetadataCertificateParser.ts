import { X509CertificateParser } from '@/domain/models/certificate'
import type { IMetadataValueParser } from '@/domain/models/metadata/interfaces/IMetadataValueParser'
import type { TMetadataParseContext } from '@/domain/models/metadata/types/TMetadataParseContext'
import type { TMetadataParsedValue } from '@/domain/models/metadata/types/TMetadataParsedValue'

export class MetadataCertificateParser implements IMetadataValueParser {
    public parse(_key: string, value: string, _context: TMetadataParseContext): TMetadataParsedValue | null {
        if (!X509CertificateParser.hasPemCertificate(value)) {
            return null
        }

        const chain = X509CertificateParser.parsePublicPem(value)
        if (!chain) {
            return null
        }

        return {
            kind: 'certificate',
            chain,
        }
    }
}
