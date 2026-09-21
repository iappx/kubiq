export type TValidationResult = {
    valid: boolean
    /** Field name → message shown under that field. */
    errors: Record<string, string>
}
