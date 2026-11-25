type TCertFixtureOptions = {
    version?: 1 | 2 | 3
    serial?: number[]
    signatureOid?: string
    issuer?: [string, string][]
    subject?: [string, string][]
    notBefore: string
    notAfter: string
    useGeneralizedTime?: boolean
    sans?: { type: 'dns' | 'email' | 'uri' | 'ipv4' | 'ipv6'; value: string }[]
    isCa?: boolean
}

const encodeLength = (len: number): number[] => {
    if (len < 0x80) {
        return [len]
    }
    const octets: number[] = []
    let remaining = len
    while (remaining > 0) {
        octets.unshift(remaining & 0xff)
        remaining = Math.floor(remaining / 256)
    }

    return [0x80 | octets.length, ...octets]
}

const tlv = (tag: number, content: number[]): number[] => [tag, ...encodeLength(content.length), ...content]

const encodeOid = (oid: string): number[] => {
    const arcs = oid.split('.').map(Number)
    const out = [arcs[0] * 40 + arcs[1]]
    for (let i = 2; i < arcs.length; i++) {
        let value = arcs[i]
        if (value === 0) {
            out.push(0)
            continue
        }
        const bytes: number[] = []
        while (value > 0) {
            bytes.unshift(value & 0x7f)
            value = Math.floor(value / 128)
        }
        for (let j = 0; j < bytes.length - 1; j++) {
            bytes[j] |= 0x80
        }
        out.push(...bytes)
    }

    return tlv(0x06, out)
}

const ascii = (text: string): number[] => Array.from(text, ch => ch.charCodeAt(0))

const encodeName = (entries: [string, string][]): number[] => {
    const rdns = entries.flatMap(([oid, value]) => {
        const valueBytes = Array.from(new TextEncoder().encode(value))
        const ava = tlv(0x30, [...encodeOid(oid), ...tlv(0x0c, valueBytes)])

        return tlv(0x31, ava)
    })

    return tlv(0x30, rdns)
}

const encodeTime = (iso: string, generalized: boolean): number[] => {
    const date = new Date(iso)
    const yyyy = String(date.getUTCFullYear()).padStart(4, '0')
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(date.getUTCDate()).padStart(2, '0')
    const hh = String(date.getUTCHours()).padStart(2, '0')
    const mi = String(date.getUTCMinutes()).padStart(2, '0')
    const ss = String(date.getUTCSeconds()).padStart(2, '0')

    if (generalized) {
        return tlv(0x18, ascii(`${yyyy}${mm}${dd}${hh}${mi}${ss}Z`))
    }

    return tlv(0x17, ascii(`${yyyy.slice(2)}${mm}${dd}${hh}${mi}${ss}Z`))
}

const encodeIpv6 = (value: string): number[] => {
    const parts = value.split(':')
    const out: number[] = []
    for (const part of parts) {
        const num = parseInt(part, 16)
        out.push((num >> 8) & 0xff, num & 0xff)
    }

    return out
}

const encodeSanExtension = (sans: NonNullable<TCertFixtureOptions['sans']>): number[] => {
    const entries = sans.flatMap((entry) => {
        if (entry.type === 'email') {
            return tlv(0x81, ascii(entry.value))
        }
        if (entry.type === 'dns') {
            return tlv(0x82, ascii(entry.value))
        }
        if (entry.type === 'uri') {
            return tlv(0x86, ascii(entry.value))
        }
        if (entry.type === 'ipv4') {
            return tlv(0x87, entry.value.split('.').map(Number))
        }

        return tlv(0x87, encodeIpv6(entry.value))
    })

    const sanSeq = tlv(0x30, entries)

    return tlv(0x30, [...encodeOid('2.5.29.17'), ...tlv(0x04, sanSeq)])
}

const encodeBasicConstraintsExtension = (isCa: boolean): number[] => {
    const bcSeq = tlv(0x30, isCa ? tlv(0x01, [0xff]) : [])

    return tlv(0x30, [...encodeOid('2.5.29.19'), ...tlv(0x01, [0xff]), ...tlv(0x04, bcSeq)])
}

export const buildCertDer = (options: TCertFixtureOptions): Uint8Array => {
    const version = options.version ?? 3
    const tbsParts: number[] = []

    if (version !== 1) {
        tbsParts.push(...tlv(0xa0, tlv(0x02, [version - 1])))
    }

    const serial = options.serial ?? [0x05, 0x98, 0xec, 0x10]
    const signatureOid = options.signatureOid ?? '1.2.840.113549.1.1.11'
    const algSeq = tlv(0x30, [...encodeOid(signatureOid), ...tlv(0x05, [])])
    const issuer = options.issuer ?? [['2.5.4.6', 'US'], ['2.5.4.10', 'Example CA'], ['2.5.4.3', 'Example Intermediate']]
    const subject = options.subject ?? [['2.5.4.3', 'api.example.com']]
    const generalized = options.useGeneralizedTime === true
    const validity = tlv(0x30, [
        ...encodeTime(options.notBefore, generalized),
        ...encodeTime(options.notAfter, generalized),
    ])
    const spki = tlv(0x30, [
        ...tlv(0x30, [...encodeOid('1.2.840.113549.1.1.1'), ...tlv(0x05, [])]),
        ...tlv(0x03, [0x00, 0x01, 0x02, 0x03]),
    ])

    tbsParts.push(
        ...tlv(0x02, serial),
        ...algSeq,
        ...encodeName(issuer),
        ...validity,
        ...encodeName(subject),
        ...spki,
    )

    const extItems: number[] = []
    if (options.sans && options.sans.length > 0) {
        extItems.push(...encodeSanExtension(options.sans))
    }
    if (options.isCa !== undefined) {
        extItems.push(...encodeBasicConstraintsExtension(options.isCa))
    }
    if (extItems.length > 0) {
        tbsParts.push(...tlv(0xa3, tlv(0x30, extItems)))
    }

    const tbs = tlv(0x30, tbsParts)
    const sigValue = tlv(0x03, [0x00, 0xaa, 0xbb, 0xcc])

    return new Uint8Array(tlv(0x30, [...tbs, ...algSeq, ...sigValue]))
}

export const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
    }

    return btoa(binary)
}

export const textToBase64 = (text: string): string => bytesToBase64(new TextEncoder().encode(text))

export const derToPem = (der: Uint8Array, label = 'CERTIFICATE'): string => {
    const b64 = bytesToBase64(der)
    const lines = b64.match(/.{1,64}/g) ?? []

    return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

export const buildCertPem = (options: TCertFixtureOptions): string => derToPem(buildCertDer(options))
