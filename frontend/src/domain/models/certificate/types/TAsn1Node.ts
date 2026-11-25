export type TAsn1Node = {
    tag: number
    tagClass: number
    constructed: boolean
    tagNumber: number
    headerStart: number
    contentStart: number
    contentLength: number
    end: number
}
