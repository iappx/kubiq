import { inject } from 'tsyringe'
import { MenuItem } from '@/domain/models/menu/MenuItem'
import { MenuService } from '@/application/services/menu/MenuService'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class MenuStore extends StoreBase<MenuStore> {

    public menuItems: MenuItem[] = []

    public openedMenu = ''

    public selectedMenu = ''

    constructor(
        @inject(MenuService) private readonly menuService: MenuService,
    ) {
        super()
    }

    setup(): void {
        this.loadMenu()
    }

    public setSelectedSidebar(val: string): void {
        this.selectedMenu = val
    }

    public setOpenedMenu(val?: string): void {
        this.openedMenu = val ?? ''
    }

    public loadMenu(): void {
        this.menuItems = this.menuService.build('/app')
    }
}
