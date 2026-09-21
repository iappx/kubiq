import { parse, stringify } from 'yaml'
import { ApiError } from '@/domain/errors/ApiError'
import { YamlValue } from '@/application/services/resourceYaml/models/YamlValue'

export class YamlDocument {
    public static readonly notAMapping: string = 'A Kubernetes manifest is a mapping of fields'

    public static readonly notYaml: string = 'That is not valid YAML'

    // lineWidth 0 turns folding off: a wrapped annotation or a wrapped command
    // line is still the same YAML, but it is no longer the same text to read.
    public static text(document: Record<string, unknown>): string {
        return stringify(document, { indent: 2, lineWidth: 0 })
    }

    public static parse(text: string): Record<string, unknown> {
        const parsed = YamlDocument.tryParse(text)
        if (parsed.error !== '') {
            throw new ApiError(parsed.error, parsed.detail)
        }

        return parsed.document
    }

    public static tryParse(text: string): { document: Record<string, unknown>; error: string; detail: string } {
        let parsed: unknown
        try {
            parsed = parse(text)
        } catch (err) {
            return { document: {}, error: YamlDocument.notYaml, detail: YamlDocument.detailOf(err) }
        }

        if (!YamlValue.isMap(parsed)) {
            return { document: {}, error: YamlDocument.notAMapping, detail: '' }
        }

        return { document: parsed, error: '', detail: '' }
    }

    public static lines(text: string): string[] {
        return text.replace(/\r\n/g, '\n').split('\n')
    }

    private static detailOf(err: unknown): string {
        return err instanceof Error ? err.message : String(err)
    }
}
