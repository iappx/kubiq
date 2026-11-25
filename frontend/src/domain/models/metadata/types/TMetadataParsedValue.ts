import type { TX509Chain } from '@/domain/models/certificate'
import type { TMetadataReferenceTarget } from '@/domain/models/metadata/types/TMetadataReferenceTarget'
import type { TMetadataStructuredField } from '@/domain/models/metadata/types/TMetadataStructuredField'

export type TMetadataParsedValue =
    | { kind: 'plain'; text: string }
    | { kind: 'boolean'; value: boolean }
    | { kind: 'timestamp'; iso: string; epochMs: number }
    | { kind: 'url'; href: string; protocol: string; clickable: boolean }
    | { kind: 'json'; value: unknown; isArray: boolean; itemCount: number; byteSize: number; isLastApplied: boolean }
    | { kind: 'multiline'; text: string; lineCount: number; byteSize: number; syntaxHint: 'yaml' | 'nginx' | 'ini' | 'text' }
    | { kind: 'list'; items: string[]; separator: string; itemKind: 'cidr' | 'domain' | 'text' }
    | { kind: 'kvList'; pairs: Array<{ key: string; value: string }> }
    | { kind: 'certificate'; chain: TX509Chain }
    | { kind: 'reference'; label: string; target: TMetadataReferenceTarget }
    | { kind: 'structured'; badge: string; summary: string; fields: TMetadataStructuredField[] }
