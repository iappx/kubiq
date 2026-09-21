export class YamlValue {
    public static equal(left: unknown, right: unknown): boolean {
        if (left === right) {
            return true
        }
        if (Array.isArray(left) || Array.isArray(right)) {
            return YamlValue.arraysEqual(left, right)
        }
        if (YamlValue.isMap(left) && YamlValue.isMap(right)) {
            return YamlValue.mapsEqual(left, right)
        }

        return false
    }

    public static isMap(value: unknown): value is Record<string, unknown> {
        return !!value && typeof value === 'object' && !Array.isArray(value)
    }

    private static arraysEqual(left: unknown, right: unknown): boolean {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
            return false
        }

        return left.every((item, index) => YamlValue.equal(item, right[index]))
    }

    private static mapsEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
        const keys = Object.keys(left)
        if (keys.length !== Object.keys(right).length) {
            return false
        }

        return keys.every(key => key in right && YamlValue.equal(left[key], right[key]))
    }
}
