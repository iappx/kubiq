import type { Component as VueComponent } from 'vue'
import {
    Archive,
    ArrowUpNarrowWide,
    Bell,
    Blocks,
    Box,
    CalendarClock,
    CircleDashed,
    CircleUser,
    Copy,
    Cpu,
    Database,
    Disc,
    FileText,
    FolderTree,
    Gauge,
    Globe,
    HardDrive,
    IdCard,
    KeyRound,
    Layers,
    Network,
    Play,
    Puzzle,
    Route,
    Server,
    Shield,
    ShieldAlert,
    ShieldCheck,
    ShieldHalf,
    SlidersHorizontal,
    SquareStack,
    Timer,
    TrendingUp,
    Users,
    Waypoints,
} from '@lucide/vue'

export class KubeIconResolver {
    public static readonly fallback: VueComponent = CircleDashed

    private static readonly icons: Record<string, VueComponent> = {
        Archive,
        ArrowUpNarrowWide,
        Bell,
        Blocks,
        Box,
        CalendarClock,
        CircleUser,
        Copy,
        Cpu,
        Database,
        Disc,
        FileText,
        FolderTree,
        Gauge,
        Globe,
        HardDrive,
        IdCard,
        KeyRound,
        Layers,
        Network,
        Play,
        Puzzle,
        Route,
        Server,
        Shield,
        ShieldAlert,
        ShieldCheck,
        ShieldHalf,
        SlidersHorizontal,
        SquareStack,
        Timer,
        TrendingUp,
        Users,
        Waypoints,
    }

    // Without the `has` guard a bare index resolves `constructor` and the other prototype members to a real function.
    public static resolve(name: string | null | undefined): VueComponent {
        return name && KubeIconResolver.has(name) ? KubeIconResolver.icons[name] : KubeIconResolver.fallback
    }

    public static has(name: string): boolean {
        return Object.prototype.hasOwnProperty.call(KubeIconResolver.icons, name)
    }
}
