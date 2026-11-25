import { YamlDiff } from '@/application/services/resourceYaml/models/YamlDiff'
import { YamlDocument } from '@/application/services/resourceYaml/models/YamlDocument'
import { YamlValue } from '@/application/services/resourceYaml/models/YamlValue'
import type { TLastAppliedDiffResult } from '@/application/services/resourceYaml/types/TLastAppliedDiffResult'

export class LastAppliedDiff {
    private static readonly lastAppliedAnnotation: string = 'kubectl.kubernetes.io/last-applied-configuration'

    private static readonly volatileMetadataFields: ReadonlySet<string> = new Set([
        'managedFields',
        'resourceVersion',
        'uid',
        'generation',
        'creationTimestamp',
        'selfLink',
    ])

    public static compare(
        lastApplied: unknown,
        currentObject: Record<string, unknown>,
    ): TLastAppliedDiffResult | null {
        if (!YamlValue.isMap(lastApplied) || !YamlValue.isMap(currentObject)) {
            return null
        }

        const cleanedApplied = LastAppliedDiff.normalizeMap(LastAppliedDiff.stripApplied(lastApplied))
        const cleanedCurrent = LastAppliedDiff.normalizeMap(LastAppliedDiff.stripCurrent(currentObject))

        const appliedYaml = YamlDocument.text(cleanedApplied)
        const currentYaml = YamlDocument.text(cleanedCurrent)
        const lines = YamlDiff.of(appliedYaml, currentYaml)

        return {
            lines,
            condensedLines: YamlDiff.condense(lines),
            summary: YamlDiff.summary(lines),
            hasChanges: YamlDiff.hasChanges(lines),
            appliedYaml,
            currentYaml,
        }
    }

    private static stripCurrent(source: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {}

        for (const [key, value] of Object.entries(source)) {
            if (key === 'status') {
                continue
            }

            if (key === 'metadata' && YamlValue.isMap(value)) {
                result[key] = LastAppliedDiff.stripMetadata(value, true)
                continue
            }

            result[key] = value
        }

        return result
    }

    private static stripApplied(source: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {}

        for (const [key, value] of Object.entries(source)) {
            if (key === 'metadata' && YamlValue.isMap(value)) {
                result[key] = LastAppliedDiff.stripMetadata(value, false)
                continue
            }

            result[key] = value
        }

        return result
    }

    private static stripMetadata(
        metadata: Record<string, unknown>,
        stripVolatile: boolean,
    ): Record<string, unknown> {
        const result: Record<string, unknown> = {}

        for (const [key, value] of Object.entries(metadata)) {
            if (stripVolatile && LastAppliedDiff.volatileMetadataFields.has(key)) {
                continue
            }

            if (key === 'annotations' && YamlValue.isMap(value)) {
                const cleanedAnnotations = LastAppliedDiff.stripLastAppliedAnnotation(value)
                if (Object.keys(cleanedAnnotations).length > 0) {
                    result[key] = cleanedAnnotations
                }
                continue
            }

            result[key] = value
        }

        return result
    }

    private static stripLastAppliedAnnotation(
        annotations: Record<string, unknown>,
    ): Record<string, unknown> {
        const result: Record<string, unknown> = {}

        for (const [key, value] of Object.entries(annotations)) {
            if (key === LastAppliedDiff.lastAppliedAnnotation) {
                continue
            }
            result[key] = value
        }

        return result
    }

    private static normalizeValue(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map(item => LastAppliedDiff.normalizeValue(item))
        }

        if (YamlValue.isMap(value)) {
            return LastAppliedDiff.normalizeMap(value)
        }

        return value
    }

    private static normalizeMap(map: Record<string, unknown>): Record<string, unknown> {
        const sortedKeys = Object.keys(map).sort((left, right) => (left < right ? -1 : (left > right ? 1 : 0)))
        const result: Record<string, unknown> = {}

        for (const key of sortedKeys) {
            result[key] = LastAppliedDiff.normalizeValue(map[key])
        }

        return result
    }
}
