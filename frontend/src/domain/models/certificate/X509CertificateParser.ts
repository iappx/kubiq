import type { TAsn1Node } from '@/domain/models/certificate/types/TAsn1Node'
import type { TX509Certificate } from '@/domain/models/certificate/types/TX509Certificate'
import type { TX509Chain } from '@/domain/models/certificate/types/TX509Chain'
import type { TX509Validity } from '@/domain/models/certificate/types/TX509Validity'
import { X509Asn1Reader } from '@/domain/models/certificate/X509Asn1Reader'
import { X509OidCatalog } from '@/domain/models/certificate/X509OidCatalog'
import { X509ValidityCatalog } from '@/domain/models/certificate/X509ValidityCatalog'

export class X509CertificateParser {
    public static readonly pemHeader: string = '-----BEGIN CERTIFICATE-----'

    public static readonly expiringWindowMs: number = 14 * 24 * 60 * 60 * 1000

    private static readonly pemBlockPattern: RegExp = /-----BEGIN CERTIFICATE-----\s*([\s\S]*?)\s*-----END CERTIFICATE-----/g

    private static readonly privateKeyPattern: RegExp = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/

    public static hasPemCertificate(text: string): boolean {
        return text.includes(X509CertificateParser.pemHeader)
    }

    public static hasPrivateKey(text: string): boolean {
        return X509CertificateParser.privateKeyPattern.test(text)
    }

    public static parsePublicPem(pem: string, now: number = Date.now()): TX509Chain | null {
        if (X509CertificateParser.hasPrivateKey(pem)) {
            return null
        }

        return X509CertificateParser.parsePem(pem, now)
    }

    public static parsePem(pem: string, now: number = Date.now()): TX509Chain | null {
        if (!X509CertificateParser.hasPemCertificate(pem)) {
            return null
        }

        const certificates: TX509Certificate[] = []
        const regex = new RegExp(X509CertificateParser.pemBlockPattern.source, 'g')

        let match = regex.exec(pem)
        while (match !== null) {
            const bytes = X509CertificateParser.decodeBase64(match[1])
            if (bytes) {
                const parsed = X509CertificateParser.parseDer(bytes, now)
                if (parsed) {
                    certificates.push(parsed)
                }
            }
            match = regex.exec(pem)
        }

        if (certificates.length === 0) {
            return null
        }

        const first = certificates[0]

        return {
            certificates,
            hasChain: certificates.length > 1,
            missingIssuerChain: certificates.length === 1 && !first.isSelfSigned && !first.isCa,
            worstValidity: X509ValidityCatalog.worst(certificates.map(cert => cert.validity)),
        }
    }

    public static formatRelative(iso: string, now: number = Date.now()): string {
        const target = Date.parse(iso)
        if (Number.isNaN(target)) {
            return ''
        }

        const diffMs = target - now
        const future = diffMs >= 0
        const absSec = Math.floor(Math.abs(diffMs) / 1000)

        if (absSec < 60) {
            return future ? 'in <1m' : '<1m ago'
        }

        if (absSec < 3600) {
            const minutes = Math.floor(absSec / 60)
            return future ? `in ${minutes}m` : `${minutes}m ago`
        }

        if (absSec < 86_400) {
            const hours = Math.floor(absSec / 3600)
            return future ? `in ${hours}h` : `${hours}h ago`
        }

        const days = Math.floor(absSec / 86_400)
        return future ? `in ${days}d` : `${days}d ago`
    }

    private static parseDer(bytes: Uint8Array, now: number): TX509Certificate | null {
        const root = X509Asn1Reader.readNode(bytes, 0, bytes.length)
        if (!root || root.tag !== X509Asn1Reader.tagSequence) {
            return null
        }

        const rootChildren = X509Asn1Reader.readChildren(bytes, root)
        if (!rootChildren || rootChildren.length < 1) {
            return null
        }

        const tbs = rootChildren[0]
        if (tbs.tag !== X509Asn1Reader.tagSequence) {
            return null
        }

        const fields = X509Asn1Reader.readChildren(bytes, tbs)
        if (!fields || fields.length < 6) {
            return null
        }

        let index = 0
        let version = 'V1'

        if (X509CertificateParser.isContextConstructed(fields[index], 0)) {
            const versionChildren = X509Asn1Reader.readChildren(bytes, fields[index])
            if (!versionChildren || versionChildren.length !== 1) {
                return null
            }

            const versionNumber = X509Asn1Reader.readSmallInteger(bytes, versionChildren[0])
            if (versionNumber === null) {
                return null
            }

            version = `V${versionNumber + 1}`
            index++
        }

        if (index + 6 > fields.length) {
            return null
        }

        const serialNumber = X509Asn1Reader.readIntegerHex(bytes, fields[index++])
        const signatureAlgorithm = X509CertificateParser.parseAlgorithm(bytes, fields[index++])
        const issuerNode = fields[index++]
        const validityNode = fields[index++]
        const subjectNode = fields[index++]
        index++

        if (serialNumber === null || signatureAlgorithm === null) {
            return null
        }

        const issuer = X509CertificateParser.parseName(bytes, issuerNode)
        const subject = X509CertificateParser.parseName(bytes, subjectNode)
        const validityDates = X509CertificateParser.parseValidity(bytes, validityNode)

        if (issuer === null || subject === null || !validityDates) {
            return null
        }

        let subjectAltNames: string[] = []
        let isCa = false

        for (let i = index; i < fields.length; i++) {
            if (X509CertificateParser.isContextConstructed(fields[i], 3)) {
                const extensions = X509CertificateParser.parseExtensions(bytes, fields[i])
                subjectAltNames = extensions.subjectAltNames
                isCa = extensions.isCa
            }
        }

        const isSelfSigned = X509CertificateParser.bytesEqual(
            X509Asn1Reader.sliceContent(bytes, issuerNode),
            X509Asn1Reader.sliceContent(bytes, subjectNode),
        )

        return {
            version,
            serialNumber,
            signatureAlgorithm,
            issuer,
            subject,
            notBefore: validityDates.notBefore,
            notAfter: validityDates.notAfter,
            validity: X509CertificateParser.computeValidity(validityDates.notBefore, validityDates.notAfter, now),
            subjectAltNames,
            isSelfSigned,
            isCa,
        }
    }

    private static parseAlgorithm(bytes: Uint8Array, node: TAsn1Node): string | null {
        if (node.tag !== X509Asn1Reader.tagSequence) {
            return null
        }

        const children = X509Asn1Reader.readChildren(bytes, node)
        if (!children || children.length < 1) {
            return null
        }

        const oid = X509Asn1Reader.readOid(bytes, children[0])

        return oid ? X509OidCatalog.signatureAlgorithmName(oid) : null
    }

    private static parseName(bytes: Uint8Array, node: TAsn1Node): string | null {
        if (node.tag !== X509Asn1Reader.tagSequence) {
            return null
        }

        const rdns = X509Asn1Reader.readChildren(bytes, node)
        if (!rdns) {
            return null
        }

        const parts: string[] = []
        for (const rdn of rdns) {
            if (rdn.tag !== X509Asn1Reader.tagSet) {
                return null
            }

            const avas = X509Asn1Reader.readChildren(bytes, rdn)
            if (!avas) {
                return null
            }

            const rdnParts: string[] = []
            for (const ava of avas) {
                if (ava.tag !== X509Asn1Reader.tagSequence) {
                    return null
                }

                const pair = X509Asn1Reader.readChildren(bytes, ava)
                if (!pair || pair.length < 2) {
                    return null
                }

                const oid = X509Asn1Reader.readOid(bytes, pair[0])
                const value = X509Asn1Reader.readString(bytes, pair[1])
                if (oid && value !== null) {
                    rdnParts.push(`${X509OidCatalog.attributeName(oid)}=${value}`)
                }
            }

            if (rdnParts.length > 0) {
                parts.push(rdnParts.join('+'))
            }
        }

        return parts.join(', ')
    }

    private static parseValidity(bytes: Uint8Array, node: TAsn1Node): { notBefore: string; notAfter: string } | null {
        if (node.tag !== X509Asn1Reader.tagSequence) {
            return null
        }

        const children = X509Asn1Reader.readChildren(bytes, node)
        if (!children || children.length !== 2) {
            return null
        }

        const notBefore = X509Asn1Reader.readTime(bytes, children[0])
        const notAfter = X509Asn1Reader.readTime(bytes, children[1])

        return notBefore && notAfter ? { notBefore, notAfter } : null
    }

    private static parseExtensions(
        bytes: Uint8Array,
        wrapper: TAsn1Node,
    ): { subjectAltNames: string[]; isCa: boolean } {
        const subjectAltNames: string[] = []
        let isCa = false

        const outer = X509Asn1Reader.readChildren(bytes, wrapper)
        if (!outer || outer.length !== 1 || outer[0].tag !== X509Asn1Reader.tagSequence) {
            return { subjectAltNames, isCa }
        }

        const list = X509Asn1Reader.readChildren(bytes, outer[0])
        if (!list) {
            return { subjectAltNames, isCa }
        }

        for (const ext of list) {
            if (ext.tag !== X509Asn1Reader.tagSequence) {
                continue
            }

            const parts = X509Asn1Reader.readChildren(bytes, ext)
            if (!parts || parts.length < 2) {
                continue
            }

            const oid = X509Asn1Reader.readOid(bytes, parts[0])
            const valueNode = parts[parts.length - 1]
            if (!oid || valueNode.tag !== X509Asn1Reader.tagOctetString) {
                continue
            }

            const content = X509Asn1Reader.sliceContent(bytes, valueNode)
            if (oid === X509OidCatalog.sanOid) {
                subjectAltNames.push(...X509CertificateParser.parseSanExtension(content))
            } else if (oid === X509OidCatalog.basicConstraintsOid) {
                isCa = X509CertificateParser.parseBasicConstraints(content)
            }
        }

        return { subjectAltNames, isCa }
    }

    private static parseSanExtension(bytes: Uint8Array): string[] {
        const seq = X509Asn1Reader.readNode(bytes, 0, bytes.length)
        if (!seq || seq.tag !== X509Asn1Reader.tagSequence) {
            return []
        }

        const entries = X509Asn1Reader.readChildren(bytes, seq)
        if (!entries) {
            return []
        }

        const names: string[] = []
        for (const entry of entries) {
            if (entry.tagClass !== X509Asn1Reader.classContextSpecific) {
                continue
            }

            if (entry.tagNumber === 1) {
                names.push(`Email(${X509Asn1Reader.readRawAscii(bytes, entry)})`)
            } else if (entry.tagNumber === 2) {
                names.push(`DNSName(${X509Asn1Reader.readRawAscii(bytes, entry)})`)
            } else if (entry.tagNumber === 6) {
                names.push(`URI(${X509Asn1Reader.readRawAscii(bytes, entry)})`)
            } else if (entry.tagNumber === 7) {
                const ip = X509CertificateParser.formatIpAddress(X509Asn1Reader.sliceContent(bytes, entry))
                if (ip) {
                    names.push(`IPAddress(${ip})`)
                }
            }
        }

        return names
    }

    private static parseBasicConstraints(bytes: Uint8Array): boolean {
        const seq = X509Asn1Reader.readNode(bytes, 0, bytes.length)
        if (!seq || seq.tag !== X509Asn1Reader.tagSequence) {
            return false
        }

        const children = X509Asn1Reader.readChildren(bytes, seq)
        if (!children || children.length === 0) {
            return false
        }

        return X509Asn1Reader.readBoolean(bytes, children[0]) === true
    }

    private static formatIpAddress(bytes: Uint8Array): string | null {
        if (bytes.length === 4) {
            return `${bytes[0]}.${bytes[1]}.${bytes[2]}.${bytes[3]}`
        }

        if (bytes.length !== 16) {
            return null
        }

        const groups: number[] = []
        for (let i = 0; i < 16; i += 2) {
            groups.push((bytes[i] << 8) | bytes[i + 1])
        }

        let bestStart = -1
        let bestLen = 0
        let curStart = -1
        let curLen = 0

        for (let i = 0; i < groups.length; i++) {
            if (groups[i] === 0) {
                if (curStart === -1) {
                    curStart = i
                    curLen = 1
                } else {
                    curLen++
                }
                if (curLen > bestLen) {
                    bestStart = curStart
                    bestLen = curLen
                }
            } else {
                curStart = -1
                curLen = 0
            }
        }

        if (bestLen < 2) {
            return groups.map(group => group.toString(16)).join(':')
        }

        const left = groups.slice(0, bestStart).map(group => group.toString(16)).join(':')
        const right = groups.slice(bestStart + bestLen).map(group => group.toString(16)).join(':')

        return `${left}::${right}`
    }

    private static computeValidity(notBefore: string, notAfter: string, now: number): TX509Validity {
        const start = Date.parse(notBefore)
        const end = Date.parse(notAfter)

        if (now > end) {
            return 'expired'
        }
        if (now < start) {
            return 'not-yet-valid'
        }
        if (end - now <= X509CertificateParser.expiringWindowMs) {
            return 'expiring'
        }

        return 'valid'
    }

    private static isContextConstructed(node: TAsn1Node, tagNumber: number): boolean {
        return node.tagClass === X509Asn1Reader.classContextSpecific
            && node.constructed
            && node.tagNumber === tagNumber
    }

    private static bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
        if (left.length === 0 || left.length !== right.length) {
            return false
        }

        for (let i = 0; i < left.length; i++) {
            if (left[i] !== right[i]) {
                return false
            }
        }

        return true
    }

    private static decodeBase64(body: string): Uint8Array | null {
        const cleaned = body.replace(/\s+/g, '')
        if (cleaned.length === 0) {
            return null
        }

        try {
            const binary = atob(cleaned)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i)
            }

            return bytes
        } catch {
            return null
        }
    }
}
