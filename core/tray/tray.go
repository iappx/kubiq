package tray

import (
	"sync/atomic"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

type Controller struct {
	app      *application.App
	window   *application.WebviewWindow
	title    string
	icon     []byte
	quitting atomic.Bool
}

func New(app *application.App, window *application.WebviewWindow, title string, icon []byte) *Controller {
	return &Controller{
		app:    app,
		window: window,
		title:  title,
		icon:   icon,
	}
}

func (c *Controller) Setup() {
	tray := c.app.SystemTray.New()
	tray.SetTooltip(c.title)
	if len(c.icon) > 0 {
		tray.SetIcon(c.icon)
	}
	tray.SetMenu(c.buildMenu())

	tray.OnClick(func() { c.showWindow() })

	// The hook runs before the default close listener, so cancelling the event
	// is what keeps the window and the process alive.
	c.window.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		if c.quitting.Load() {
			return
		}
		e.Cancel()
		c.window.Hide()
	})
}

func (c *Controller) buildMenu() *application.Menu {
	menu := application.NewMenu()
	menu.Add("Show " + c.title).OnClick(func(*application.Context) { c.showWindow() })
	menu.AddSeparator()
	menu.Add("Quit").OnClick(func(*application.Context) { c.quit() })
	return menu
}

func (c *Controller) showWindow() {
	c.window.Show()
	c.window.Focus()
}

func (c *Controller) quit() {
	c.quitting.Store(true)
	c.app.Quit()
}
