package tray

import (
	"sync/atomic"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// Controller keeps the application resident in the system tray. Closing the
// window hides it to the tray instead of terminating the process; the app is
// only really quit through the tray menu.
type Controller struct {
	app      *application.App
	window   *application.WebviewWindow
	title    string
	icon     []byte
	quitting atomic.Bool
}

// New creates a tray Controller for the given window. title is used for the
// tray tooltip and menu labels; icon is the tray icon (PNG bytes) and may be
// nil, in which case no icon is set.
func New(app *application.App, window *application.WebviewWindow, title string, icon []byte) *Controller {
	return &Controller{
		app:    app,
		window: window,
		title:  title,
		icon:   icon,
	}
}

// Setup registers the tray icon, its menu and the close-to-tray behaviour.
// Call it after the window is created and before app.Run().
func (c *Controller) Setup() {
	tray := c.app.SystemTray.New()
	tray.SetTooltip(c.title)
	if len(c.icon) > 0 {
		tray.SetIcon(c.icon)
	}
	tray.SetMenu(c.buildMenu())

	// Left click on the tray icon reveals the window; right click opens the menu.
	tray.OnClick(func() { c.showWindow() })

	// Closing the window hides it to the tray instead of quitting the app.
	// The hook runs before the default close listener, so cancelling the event
	// keeps the window (and the process) alive. During a real quit the guard
	// lets the close proceed untouched.
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
