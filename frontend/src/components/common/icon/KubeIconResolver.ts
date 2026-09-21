import type { Component as VueComponent } from 'vue'
import {
    Archive,
    Bell,
    Blocks,
    Box,
    CalendarClock,
    CircleDashed,
    CircleUser,
    Copy,
    Database,
    Disc,
    FileText,
    FolderTree,
    Globe,
    HardDrive,
    IdCard,
    KeyRound,
    Layers,
    Network,
    Play,
    Puzzle,
    Server,
    Shield,
    ShieldCheck,
    SquareStack,
    Users,
} from '@lucide/vue'

export class KubeIconResolver {
    public static readonly fallback: VueComponent = CircleDashed

    private static readonly icons: Record<string, VueComponent> = {
        Archive,
        Bell,
        Blocks,
        Box,
        CalendarClock,
        CircleUser,
        Copy,
        Database,
        Disc,
        FileText,
        FolderTree,
        Globe,
        HardDrive,
        IdCard,
        KeyRound,
        Layers,
        Network,
        Play,
        Puzzle,
        Server,
        Shield,
        ShieldCheck,
        SquareStack,
        Users,
    }

    // Without the `has` guard a bare index resolves `constructor` and the other prototype members to a real function.
    public static resolve(name: string | null | undefined): VueComponent {
        return name && KubeIconResolver.has(name) ? KubeIconResolver.icons[name] : KubeIconResolver.fallback
    }

    public static has(name: string): boolean {
        return Object.prototype.hasOwnProperty.call(KubeIconResolver.icons, name)
    }
}
