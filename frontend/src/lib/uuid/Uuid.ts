import { NIL, v4 } from 'uuid'

export class Uuid {
    public static v4(): string {
        return v4()
    }

    public static empty(): string {
        return NIL
    }
}