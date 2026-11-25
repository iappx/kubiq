export class X509OidCatalog {
    public static readonly sanOid: string = '2.5.29.17'

    public static readonly basicConstraintsOid: string = '2.5.29.19'

    private static readonly attributes: Record<string, string> = {
        '2.5.4.3': 'CN',
        '2.5.4.5': 'serialNumber',
        '2.5.4.6': 'C',
        '2.5.4.7': 'L',
        '2.5.4.8': 'ST',
        '2.5.4.9': 'STREET',
        '2.5.4.10': 'O',
        '2.5.4.11': 'OU',
        '1.2.840.113549.1.9.1': 'emailAddress',
        '0.9.2342.19200300.100.1.25': 'DC',
    }

    private static readonly signatureAlgorithms: Record<string, string> = {
        '1.2.840.113549.1.1.4': 'md5WithRSAEncryption',
        '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption',
        '1.2.840.113549.1.1.10': 'RSASSA-PSS',
        '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
        '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
        '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
        '1.2.840.113549.1.1.14': 'sha224WithRSAEncryption',
        '1.2.840.10045.4.3.1': 'ecdsa-with-SHA224',
        '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
        '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
        '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512',
        '1.3.101.112': 'Ed25519',
        '1.3.101.113': 'Ed448',
    }

    public static attributeName(oid: string): string {
        return X509OidCatalog.attributes[oid] ?? oid
    }

    public static signatureAlgorithmName(oid: string): string {
        return X509OidCatalog.signatureAlgorithms[oid] ?? oid
    }
}
