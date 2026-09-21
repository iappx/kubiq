export type TApiResourceDocument = {
    /** Plural resource name; a subresource carries a slash, as in `pods/log`. */
    name?: string
    singularName?: string
    kind?: string
    namespaced?: boolean
    verbs?: string[]
    shortNames?: string[]
    categories?: string[]
}
