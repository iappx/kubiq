import type { EntityAttribute } from '@iappx/entity-repo'
import { YamlValue } from '@/application/services/resourceYaml/models/YamlValue'
import type { TYamlApplyPlan } from '@/application/services/resourceYaml/types/TYamlApplyPlan'

// setDataValue drops a key the entity does not declare and serialize drops a readonly one,
// both silently — so the plan is built from the attribute map and refuses to lose a field.
export class YamlApplyPlanner {
    public static plan(
        current: Record<string, unknown>,
        edited: Record<string, unknown>,
        attributes: Record<string, EntityAttribute>,
        canPatch: boolean,
        canUpdate: boolean,
    ): TYamlApplyPlan {
        const clusterOwned = YamlApplyPlanner.clusterOwned(attributes)
        const changed = YamlApplyPlanner.changedFields(current, edited)
        const ignored = changed.filter(field => clusterOwned.has(field))
        const fields = changed.filter(field => !clusterOwned.has(field))

        if (fields.length === 0) {
            return { mode: 'noop', fields: [], unsupported: [], ignored }
        }

        const dropped = YamlApplyPlanner.droppedFields(current, edited, clusterOwned)
        const replacing = canUpdate && (dropped.length > 0 || !canPatch)

        return replacing
            ? {
                mode: 'replace',
                fields: [],
                unsupported: YamlApplyPlanner.unknown(Object.keys(edited), attributes),
                ignored,
            }
            : {
                mode: 'patch',
                fields,
                unsupported: [...new Set([...YamlApplyPlanner.unknown(fields, attributes), ...dropped])],
                ignored,
            }
    }

    public static changedFields(current: Record<string, unknown>, edited: Record<string, unknown>): string[] {
        const keys = [...new Set([...Object.keys(current), ...Object.keys(edited)])]

        return keys.filter(key => !YamlValue.equal(current[key], edited[key]))
    }

    // A merge patch says nothing about a key it omits, so a deletion at any depth can only
    // go through a whole-object replace; getting this wrong loses a removed label silently.
    public static droppedFields(
        current: Record<string, unknown>,
        edited: Record<string, unknown>,
        clusterOwned: ReadonlySet<string>,
    ): string[] {
        return Object.keys(current)
            .filter(key => !clusterOwned.has(key))
            .filter(key => !(key in edited) || YamlApplyPlanner.hasRemoval(current[key], edited[key]))
    }

    public static clusterOwned(attributes: Record<string, EntityAttribute>): Set<string> {
        return new Set(Object.keys(attributes).filter(key => attributes[key].isReadonly === true))
    }

    // A merge patch replaces an array whole, so only mappings can lose a key.
    private static hasRemoval(current: unknown, edited: unknown): boolean {
        if (!YamlValue.isMap(current) || !YamlValue.isMap(edited)) {
            return false
        }

        return Object.keys(current).some(
            key => !(key in edited) || YamlApplyPlanner.hasRemoval(current[key], edited[key]),
        )
    }

    private static unknown(fields: readonly string[], attributes: Record<string, EntityAttribute>): string[] {
        return fields.filter(field => attributes[field] === undefined)
    }
}
