import { parseDocument } from 'yaml'

export class HelmValuesDocument {
    public static readonly empty: string = '{}\n'

    public static error(text: string): string {
        if (text.trim() === '') {
            return ''
        }

        const document = parseDocument(text)
        if (document.errors.length > 0) {
            const failure = document.errors[0]
            const line = failure.linePos?.[0]?.line

            return line === undefined
                ? 'The values are not valid YAML'
                : `The values are not valid YAML — line ${line}`
        }

        const parsed = document.toJS()

        return parsed === null || (typeof parsed === 'object' && !Array.isArray(parsed))
            ? ''
            : 'Chart values are a mapping of keys to values, not a list or a single value'
    }

    public static orEmpty(text: string): string {
        return text.trim() === '' ? HelmValuesDocument.empty : text
    }
}
