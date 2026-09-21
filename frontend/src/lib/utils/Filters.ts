import { DateTime } from 'luxon'

export class Filters {
    public static date(value: string): string {
        return DateTime.fromISO(value).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)
    }
}