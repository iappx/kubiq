type TSegment =
    | { kind: 'property'; key: string }
    | { kind: 'index'; index: number; raw: string }
    | { kind: 'wildcard' }
    | { kind: 'filter'; expression: string; raw: string }

type TOperand =
    | { ok: true; value: unknown }
    | { ok: false }

export class KubeJsonPath {
    public static read(source: unknown, jsonPath: string): unknown {
        const segments = KubeJsonPath.tokenize(jsonPath)
        if (segments === null) {
            return undefined
        }
        if (segments.length === 0) {
            return source
        }
        if (source === null || source === undefined) {
            return undefined
        }

        let current: unknown[] = [source]
        let isMulti = false

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i]
            if (segment.kind === 'wildcard' || segment.kind === 'filter') {
                isMulti = true
            }
            current = KubeJsonPath.step(current, segment)
            if (current.length === 0) {
                return undefined
            }
        }

        if (!isMulti) {
            return current[0]
        }
        return current.length === 1 ? current[0] : current
    }

    public static parse(jsonPath: string): string[] {
        const segments = KubeJsonPath.tokenize(jsonPath)
        if (segments === null) {
            return []
        }
        return segments.map((segment) => {
            if (segment.kind === 'property') {
                return segment.key
            }
            if (segment.kind === 'index') {
                return segment.raw
            }
            if (segment.kind === 'wildcard') {
                return '*'
            }
            return segment.raw
        })
    }

    private static step(items: unknown[], segment: TSegment): unknown[] {
        const next: unknown[] = []

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item === null || item === undefined) {
                continue
            }

            if (segment.kind === 'property') {
                if (typeof item === 'object') {
                    const value = (item as Record<string, unknown>)[segment.key]
                    if (value !== undefined) {
                        next.push(value)
                    }
                }
                continue
            }

            if (segment.kind === 'index') {
                let value: unknown
                if (Array.isArray(item)) {
                    value = item[segment.index]
                } else if (typeof item === 'object') {
                    value = (item as Record<string, unknown>)[segment.raw]
                }
                if (value !== undefined) {
                    next.push(value)
                }
                continue
            }

            if (segment.kind === 'wildcard') {
                if (Array.isArray(item)) {
                    for (let j = 0; j < item.length; j++) {
                        if (item[j] !== undefined) {
                            next.push(item[j])
                        }
                    }
                } else if (typeof item === 'object') {
                    const values = Object.values(item as Record<string, unknown>)
                    for (let j = 0; j < values.length; j++) {
                        if (values[j] !== undefined) {
                            next.push(values[j])
                        }
                    }
                }
                continue
            }

            if (Array.isArray(item)) {
                for (let j = 0; j < item.length; j++) {
                    if (KubeJsonPath.matchesFilter(item[j], segment.expression)) {
                        next.push(item[j])
                    }
                }
            }
        }

        return next
    }

    private static tokenize(jsonPath: string): TSegment[] | null {
        const input = jsonPath.trim()
        let i = input.startsWith('$') ? 1 : 0
        const segments: TSegment[] = []

        while (i < input.length) {
            if (input[i] === '.') {
                i++
                continue
            }

            if (input[i] === '[') {
                const close = KubeJsonPath.findClosingBracket(input, i)
                if (close === -1) {
                    return null
                }
                const raw = input.slice(i + 1, close).trim()
                const segment = KubeJsonPath.parseBracket(raw)
                if (segment === null) {
                    return null
                }
                segments.push(segment)
                i = close + 1
                continue
            }

            let key = ''
            while (i < input.length && input[i] !== '.' && input[i] !== '[') {
                if (input[i] === '\\' && i + 1 < input.length) {
                    key += input[i + 1]
                    i += 2
                    continue
                }
                key += input[i]
                i++
            }
            if (key.length > 0) {
                segments.push({ kind: 'property', key })
            }
        }

        return segments
    }

    private static findClosingBracket(input: string, openIndex: number): number {
        let depth = 0
        let quote: string | null = null

        for (let i = openIndex; i < input.length; i++) {
            const ch = input[i]
            if (quote !== null) {
                if (ch === '\\') {
                    i++
                    continue
                }
                if (ch === quote) {
                    quote = null
                }
                continue
            }
            if (ch === '\'' || ch === '"') {
                quote = ch
                continue
            }
            if (ch === '[') {
                depth++
            } else if (ch === ']') {
                depth--
                if (depth === 0) {
                    return i
                }
            }
        }

        return -1
    }

    private static parseBracket(raw: string): TSegment | null {
        if (raw.length === 0) {
            return null
        }
        if (raw === '*') {
            return { kind: 'wildcard' }
        }
        if (/^\d+$/.test(raw)) {
            return { kind: 'index', index: Number(raw), raw }
        }
        const quoted = KubeJsonPath.parseQuotedString(raw)
        if (quoted !== null) {
            return { kind: 'property', key: quoted }
        }
        if (raw.startsWith('?')) {
            const expression = KubeJsonPath.stripOuterParens(raw.slice(1).trim())
            if (expression.length === 0) {
                return null
            }
            return { kind: 'filter', expression, raw }
        }
        return null
    }

    private static parseQuotedString(raw: string): string | null {
        if (raw.length < 2) {
            return null
        }
        const quote = raw[0]
        if ((quote !== '\'' && quote !== '"') || raw[raw.length - 1] !== quote) {
            return null
        }

        let result = ''
        for (let i = 1; i < raw.length - 1; i++) {
            const ch = raw[i]
            if (ch === '\\') {
                if (i + 1 >= raw.length - 1) {
                    return null
                }
                result += raw[i + 1]
                i++
                continue
            }
            if (ch === quote) {
                return null
            }
            result += ch
        }
        return result
    }

    private static stripOuterParens(expression: string): string {
        let current = expression.trim()

        while (current.startsWith('(') && current.endsWith(')')) {
            let depth = 0
            let quote: string | null = null
            let wrapsAll = true

            for (let i = 0; i < current.length; i++) {
                const ch = current[i]
                if (quote !== null) {
                    if (ch === '\\') {
                        i++
                        continue
                    }
                    if (ch === quote) {
                        quote = null
                    }
                    continue
                }
                if (ch === '\'' || ch === '"') {
                    quote = ch
                    continue
                }
                if (ch === '(') {
                    depth++
                } else if (ch === ')') {
                    depth--
                    if (depth === 0 && i < current.length - 1) {
                        wrapsAll = false
                        break
                    }
                }
            }

            if (!wrapsAll || depth !== 0) {
                break
            }
            current = current.slice(1, -1).trim()
        }

        return current
    }

    private static matchesFilter(item: unknown, expression: string): boolean {
        const trimmed = KubeJsonPath.stripOuterParens(expression)
        if (trimmed.length === 0) {
            return false
        }

        const orParts = KubeJsonPath.splitLogical(trimmed, '||')
        if (orParts.length > 1) {
            return orParts.some(part => KubeJsonPath.matchesFilter(item, part))
        }

        const andParts = KubeJsonPath.splitLogical(trimmed, '&&')
        if (andParts.length > 1) {
            return andParts.every(part => KubeJsonPath.matchesFilter(item, part))
        }

        const comparison = KubeJsonPath.findComparison(trimmed)
        if (comparison !== null) {
            const left = KubeJsonPath.evaluateOperand(item, trimmed.slice(0, comparison.index))
            const right = KubeJsonPath.evaluateOperand(item, trimmed.slice(comparison.index + comparison.operator.length))
            if (!left.ok || !right.ok) {
                return false
            }
            return KubeJsonPath.compare(left.value, right.value, comparison.operator)
        }

        if (trimmed.startsWith('!')) {
            return !KubeJsonPath.matchesFilter(item, trimmed.slice(1))
        }

        if (!trimmed.startsWith('@')) {
            return false
        }
        const operand = KubeJsonPath.evaluateOperand(item, trimmed)
        return operand.ok && Boolean(operand.value)
    }

    private static splitLogical(expression: string, operator: '&&' | '||'): string[] {
        const parts: string[] = []
        let start = 0
        let quote: string | null = null
        let parenDepth = 0
        let bracketDepth = 0

        for (let i = 0; i < expression.length; i++) {
            const ch = expression[i]
            if (quote !== null) {
                if (ch === '\\') {
                    i++
                    continue
                }
                if (ch === quote) {
                    quote = null
                }
                continue
            }
            if (ch === '\'' || ch === '"') {
                quote = ch
                continue
            }
            if (ch === '(') {
                parenDepth++
            } else if (ch === ')') {
                parenDepth--
            } else if (ch === '[') {
                bracketDepth++
            } else if (ch === ']') {
                bracketDepth--
            } else if (parenDepth === 0 && bracketDepth === 0 && expression.slice(i, i + 2) === operator) {
                parts.push(expression.slice(start, i).trim())
                i++
                start = i + 1
            }
        }

        parts.push(expression.slice(start).trim())
        return parts
    }

    private static findComparison(expression: string): { operator: string; index: number } | null {
        let quote: string | null = null
        let parenDepth = 0
        let bracketDepth = 0

        for (let i = 0; i < expression.length; i++) {
            const ch = expression[i]
            if (quote !== null) {
                if (ch === '\\') {
                    i++
                    continue
                }
                if (ch === quote) {
                    quote = null
                }
                continue
            }
            if (ch === '\'' || ch === '"') {
                quote = ch
                continue
            }
            if (ch === '(') {
                parenDepth++
            } else if (ch === ')') {
                parenDepth--
            } else if (ch === '[') {
                bracketDepth++
            } else if (ch === ']') {
                bracketDepth--
            } else if (parenDepth === 0 && bracketDepth === 0) {
                const two = expression.slice(i, i + 2)
                if (two === '==' || two === '!=' || two === '<=' || two === '>=') {
                    return { operator: two, index: i }
                }
                if (ch === '<' || ch === '>') {
                    return { operator: ch, index: i }
                }
            }
        }

        return null
    }

    private static evaluateOperand(item: unknown, raw: string): TOperand {
        const trimmed = raw.trim()
        if (trimmed.length === 0) {
            return { ok: false }
        }
        if (trimmed.startsWith('@')) {
            const rest = trimmed.slice(1)
            if (rest.length > 0 && !rest.startsWith('.') && !rest.startsWith('[')) {
                return { ok: false }
            }
            return { ok: true, value: KubeJsonPath.read(item, rest) }
        }
        const quoted = KubeJsonPath.parseQuotedString(trimmed)
        if (quoted !== null) {
            return { ok: true, value: quoted }
        }
        if (trimmed === 'true') {
            return { ok: true, value: true }
        }
        if (trimmed === 'false') {
            return { ok: true, value: false }
        }
        if (trimmed === 'null') {
            return { ok: true, value: null }
        }
        if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
            return { ok: true, value: Number(trimmed) }
        }
        return { ok: false }
    }

    private static compare(left: unknown, right: unknown, operator: string): boolean {
        if (operator === '==') {
            return left === right
        }
        if (operator === '!=') {
            return left !== right
        }
        if (typeof left === 'number' && typeof right === 'number') {
            if (operator === '<') {
                return left < right
            }
            if (operator === '<=') {
                return left <= right
            }
            if (operator === '>') {
                return left > right
            }
            return left >= right
        }
        if (typeof left === 'string' && typeof right === 'string') {
            if (operator === '<') {
                return left < right
            }
            if (operator === '<=') {
                return left <= right
            }
            if (operator === '>') {
                return left > right
            }
            return left >= right
        }
        return false
    }
}
