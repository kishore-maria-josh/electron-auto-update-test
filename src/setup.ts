import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import {
  CapElectronEventEmitter,
  CapacitorSplashScreen,
  setupCapacitorElectronPlugins,
} from '@capacitor-community/electron';
import chokidar from 'chokidar';
import type { MenuItemConstructorOptions } from 'electron';
import { app, BrowserWindow, Menu, MenuItem, nativeImage, Tray, session } from 'electron';
import electronIsDev from 'electron-is-dev';
import electronServe from 'electron-serve';
import windowStateKeeper from 'electron-window-state';
import { join } from 'path';
// import * as config from '../app/poker2/assets/js/app-config.dev.json';

// Define components for a watcher to detect when the webapp is changed so we can reload in Dev mode.
const reloadWatcher = {
  debouncer: null,
  ready: false,
  watcher: null,
};
export function setupReloadWatcher(electronCapacitorApp: ElectronCapacitorApp): void {
  reloadWatcher.watcher = chokidar
    .watch('https://fullhouse.adda52poker.com/poker2qa/')
    // .watch('http://localhost:4200/') // For development purpose
    .on('ready', () => {
      reloadWatcher.ready = true;
    })
    .on('all', (_event, _path) => {
      if (reloadWatcher.ready) {
        clearTimeout(reloadWatcher.debouncer);
        reloadWatcher.debouncer = setTimeout(async () => {
          electronCapacitorApp.getMainWindow().webContents.reload();
          reloadWatcher.ready = false;
          clearTimeout(reloadWatcher.debouncer);
          reloadWatcher.debouncer = null;
          reloadWatcher.watcher = null;
          setupReloadWatcher(electronCapacitorApp);
        }, 1500);
      }
    });
}

// Define our class to manage our app.
export class ElectronCapacitorApp {
  private MainWindow: BrowserWindow | null = null;
  private SplashScreen: CapacitorSplashScreen | null = null;
  private TrayIcon: Tray | null = null;
  private CapacitorFileConfig: CapacitorElectronConfig;
  private TrayMenuTemplate: (MenuItem | MenuItemConstructorOptions)[] = [
    new MenuItem({ label: 'Quit App', role: 'quit' }),
  ];
  private AppMenuBarMenuTemplate: (MenuItem | MenuItemConstructorOptions)[] = [
    { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
    { role: 'viewMenu' },
  ];
  private mainWindowState;
  private loadWebApp;
  private customScheme: string;
  private isHandleWindowDone: boolean = true;

  constructor(
    capacitorFileConfig: CapacitorElectronConfig,
    trayMenuTemplate?: (MenuItemConstructorOptions | MenuItem)[],
  appMenuBarMenuTemplate?: (MenuItemConstructorOptions | MenuItem)[]
  ) {
    this.CapacitorFileConfig = capacitorFileConfig;

    this.customScheme = this.CapacitorFileConfig.electron?.customUrlScheme ?? 'capacitor-electron';

    if (trayMenuTemplate) {
      this.TrayMenuTemplate = trayMenuTemplate;
    }

    if (appMenuBarMenuTemplate) {
      this.AppMenuBarMenuTemplate = appMenuBarMenuTemplate;
    }

    // Setup our web app loader, this lets us load apps like react, vue, and angular without changing their build chains.
    this.loadWebApp = electronServe({
      directory: join('https://fullhouse.adda52poker.com/poker2qa/'),
      // directory: join('http://localhost:4200/'), // For development purpose
      scheme: this.customScheme,
    });
  }

  // Helper function to load in the app.
  private async loadMainWindow(thisRef: any) {
    await thisRef.loadWebApp(thisRef.MainWindow);
  }

  // Expose the mainWindow ref for use outside of the class.
  getMainWindow(): BrowserWindow {
    return this.MainWindow;
  }

  getCustomURLScheme(): string {
    return this.customScheme;
  }

  async init(): Promise<void> {
    process.env.GOOGLE_API_KEY = 'AIzaSyCvIs_uHPrlEVwY8d51KL5N1rAEwtAaNtk';
    const icon = nativeImage.createFromPath(
      join(app.getAppPath(), 'src/assets', process.platform === 'win32' ? 'icons/appIcon.ico' : 'icons/appIcon.png')
    );
    this.mainWindowState = windowStateKeeper({
      defaultWidth: 1000,
      defaultHeight: 800,
    });
    // Setup preload script path and construct our main window.
    const preloadPath = join(app.getAppPath(), 'build', 'src', 'preload.js');
    this.MainWindow = new BrowserWindow({
      icon,
      show: false,
      x: this.mainWindowState.x,
      y: this.mainWindowState.y,
      width: this.mainWindowState.width,
      height: this.mainWindowState.height,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        // Use preload to inject the electron variant overrides for capacitor plugins.
        // preload: join(app.getAppPath(), "node_modules", "@capacitor-community", "electron", "dist", "runtime", "electron-rt.js"),
        preload: preloadPath,
      },
    });
    this.mainWindowState.manage(this.MainWindow);

    if (this.CapacitorFileConfig.backgroundColor) {
      this.MainWindow.setBackgroundColor(this.CapacitorFileConfig.electron.backgroundColor);
    }

    // If we close the main window with the splashscreen enabled we need to destroy the ref.
    this.MainWindow.on('closed', () => {
      if (this.SplashScreen?.getSplashWindow() && !this.SplashScreen.getSplashWindow().isDestroyed()) {
        this.SplashScreen.getSplashWindow().close();
      }
    });

    // When the tray icon is enabled, setup the options.
    if (this.CapacitorFileConfig.electron?.trayIconAndMenuEnabled) {
      this.TrayIcon = new Tray(icon);
      this.TrayIcon.on('double-click', () => {
        if (this.MainWindow) {
          if (this.MainWindow.isVisible()) {
            this.MainWindow.hide();
          } else {
            this.MainWindow.show();
            this.MainWindow.focus();
          }
        }
      });
      this.TrayIcon.on('click', () => {
        if (this.MainWindow) {
          if (this.MainWindow.isVisible()) {
            this.MainWindow.hide();
          } else {
            this.MainWindow.show();
            this.MainWindow.focus();
          }
        }
      });
      this.TrayIcon.setToolTip(app.getName());
      this.TrayIcon.setContextMenu(Menu.buildFromTemplate(this.TrayMenuTemplate));
    }

    // Setup the main menu bar at the top of our window.
    // Menu.setApplicationMenu(Menu.buildFromTemplate(this.AppMenuBarMenuTemplate));
    Menu.setApplicationMenu(null);

    // If the splashscreen is enabled, show it first while the main window loads then switch it out for the main window, or just load the main window from the start.
    if (this.CapacitorFileConfig.electron?.splashScreenEnabled) {
      this.SplashScreen = new CapacitorSplashScreen({
        imageFilePath: join(
          app.getAppPath(),
          'src/assets',
          this.CapacitorFileConfig.electron?.splashScreenImageName ?? 'icons/splash.png'
        ),
        windowWidth: 400,
        windowHeight: 400,
      });
      this.SplashScreen.init(this.loadMainWindow, this);
    } else {
      // this.loadMainWindow(this);
      this.MainWindow.loadURL('https://fullhouse.adda52poker.com/poker2qa/');
      // this.MainWindow.loadURL('http://localhost:4200/') // For development purpose
    }

    // Security
    this.MainWindow.webContents.setWindowOpenHandler((details) => {
      if (details.frameName === 'tnc') {
        this.MainWindow.loadURL(details.url);
        return { action: 'deny' }
      }
      this.isHandleWindowDone = false;
      const allWindows = BrowserWindow.getAllWindows();
      let isWindowFocused: boolean = false;
      allWindows.forEach(element => {
        // element.webContents.openDevTools()
        if (element.webContents.getURL().search(details.url) >= 0
          || (details.url.search('https://www.adda52.com/') >= 0
            && (element.webContents.getURL().search('https://fullhouse.adda52poker.com/') >= 0 || element.webContents.getURL().search('https://www.adda52.com/') >= 0))
          || (details.url.search('addcash') >= 0 && element.webContents.getURL().search('https://public.releases.juspay.in') >= 0)) {
          if (details.url === 'https://www.adda52.com/faq/tds' && element.webContents.getURL() !== 'https://www.adda52.com/faq/tds') {
            element.webContents.loadURL('https://www.adda52.com/faq/tds');
          } else if (details.url === 'https://www.adda52.com/compliance' && element.webContents.getURL() === 'https://www.adda52.com/faq/tds') {
            element.webContents.loadURL('https://www.adda52.com/compliance');
          }
          element.show();
          isWindowFocused = true;
        }
      });
      if (isWindowFocused) {
        return { action: 'deny' }
      }
      return { action: 'allow' }
    });

    app.on('web-contents-created', (event, contents) => {
      this.MainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
        // Strip away preload scripts if unused or verify their location is legitimate
        delete webPreferences.preload
    
        // Disable Node.js integration
        webPreferences.nodeIntegration = false

        // Verify URL being loaded
        // if (!params.src.startsWith('http://localhost:4200/')) { // For development purpose
        if (!params.src.startsWith('https://fullhouse.adda52poker.com/poker2qa/')) {
          event.preventDefault()
        }
      })
    })

    this.MainWindow.webContents.on('did-navigate-in-page', () => {
      this.MainWindow.webContents
        .executeJavaScript('localStorage.getItem("userLoggedIn");', true)
        .then(result => {
          if (!result) {
            const allWindows = BrowserWindow.getAllWindows();
            const mainWindowUrl: string = this.MainWindow.webContents.getURL();
            allWindows.forEach(window => {
              let _winUrl: string = window.webContents.getURL();
              const winUrl = _winUrl.split('//-');
              if (_winUrl !== mainWindowUrl && winUrl[winUrl.length - 1].search('https://fullhouse.adda52poker.com/') < 0) window.close();
            })
          }
        });
    });

    this.MainWindow.webContents.on('will-navigate', (event, _newURL) => {
      if (!this.MainWindow.webContents.getURL().includes(this.customScheme)) {
        event.preventDefault();
      }
    });

    this.MainWindow.once('closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Link electron plugins into the system.
    setupCapacitorElectronPlugins();

    // When the web app is loaded we hide the splashscreen if needed and show the main window.
    this.MainWindow.webContents.on('dom-ready', () => {
      if (this.CapacitorFileConfig.electron?.splashScreenEnabled) {
        this.SplashScreen.getSplashWindow().hide();
      }
      if (!this.CapacitorFileConfig.electron?.hideMainWindowOnLaunch) {
        this.MainWindow.show();
      }
      setTimeout(() => {
        if (electronIsDev) {
          this.MainWindow.webContents.openDevTools();
        }
        CapElectronEventEmitter.emit('CAPELECTRON_DeeplinkListenerInitialized', '');
      }, 400);
    });
  }

}

// Set a CSP up for our application based on the custom scheme
export function setupContentSecurityPolicy(customScheme: string): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          electronIsDev
            ? `default-src ${customScheme}://* 'unsafe-inline' devtools://* 'unsafe-eval' data:;
              style-src 'self' https://fonts.googleapis.com https://fullhouse.adda52poker.com https://cfreeimages.s3-ap-southeast-1.amazonaws.com/billpay/css/error.css https://use.typekit.net https://cashfreelogo.cashfree.com/ https://p.typekit.net/p.css 'unsafe-inline';
              font-src 'self' https://fonts.gstatic.com https://fullhouse.adda52poker.com/css/fonts/fontawesome-webfont.woff https://assets.juspay.in/hyper/assets/in.juspay.merchants/fonts/common/Roboto/ https://use.typekit.net/ 'unsafe-inline';
              script-src 'self' https://www.googletagmanager.com https://fullhouse.adda52poker.com https://maps.googleapis.com https://sandbox.juspay.in https://debug.logs.juspay.net https://public.releases.juspay.in/ https://assets.juspay.in/ https://cashfreelogo.cashfree.com/ 'unsafe-eval' 'unsafe-inline';
              connect-src 'self' https://fullhouseapi.adda52poker.com https://fullhouse.adda52poker.com https://analytics.google.com https://msg.onedirect.in/kong/mgateway wss://sfsfullhouse.adda52.com https://fullhouseapplication.adda52poker.com https://maps.googleapis.com https://fullhousegatewayapi.adda52poker.com
                https://37559fd32972498ab45aad98e22f331b.apm.ap-south-1.aws.elastic-cloud.com https://www.google-analytics.com https://sandbox.juspay.in https://public.releases.juspay.in https://assets.juspay.in/ https://debug.logs.juspay.net/godel/analytics https://use.typekit.net/jpk7bsf.css https://cashfreelogo.cashfree.com/
                wss://fullhouseanalytics.adda52poker.com/socket.io/ https://sandbox.assets.juspay.in/ https://p.typekit.net/p.css https://use.typekit.net/ 'unsafe-inline' 'unsafe-eval';
              img-src 'self' https://fullhouse.adda52poker.com https://www.google.co.in https://www.adda52.com/ https://assets.juspay.in https://public.releases.juspay.in data: https://cbwconline.com/ https://cashfreelogo.cashfree.com/ https://fullhousebanneradda.adda52poker.com/ 'unsafe-eval' 'unsafe-inline';
              manifest-src 'self' https://fullhouse.adda52poker.com/manifest.json https://assets.juspay.in https://sandbox.juspay.in https://sandbox.assets.juspay.in https://cashfreelogo.cashfree.com/ https://payments-test.cashfree.com/ 'unsafe-inline';
              worker-src 'self' blob: https://public.releases.juspay.in/;`
            : `default-src ${customScheme}://* 'unsafe-inline' data:;
              style-src 'self' https://fonts.googleapis.com https://fullhouse.adda52poker.com https://cfreeimages.s3-ap-southeast-1.amazonaws.com/billpay/css/error.css https://use.typekit.net https://cashfreelogo.cashfree.com/ https://p.typekit.net/p.css 'unsafe-inline';
              font-src 'self' https://fonts.gstatic.com https://fullhouse.adda52poker.com/css/fonts/fontawesome-webfont.woff https://assets.juspay.in/hyper/assets/in.juspay.merchants/fonts/common/Roboto/ https://use.typekit.net/ 'unsafe-inline';
              script-src 'self' https://www.googletagmanager.com https://fullhouse.adda52poker.com https://maps.googleapis.com https://sandbox.juspay.in https://debug.logs.juspay.net https://public.releases.juspay.in/ https://assets.juspay.in/ https://cashfreelogo.cashfree.com/ 'unsafe-eval' 'unsafe-inline';
              connect-src 'self' https://fullhouseapi.adda52poker.com https://fullhouse.adda52poker.com https://analytics.google.com https://msg.onedirect.in/kong/mgateway wss://sfsfullhouse.adda52.com https://fullhouseapplication.adda52poker.com https://maps.googleapis.com https://fullhousegatewayapi.adda52poker.com
                https://37559fd32972498ab45aad98e22f331b.apm.ap-south-1.aws.elastic-cloud.com https://www.google-analytics.com https://sandbox.juspay.in https://public.releases.juspay.in https://assets.juspay.in/ https://debug.logs.juspay.net/godel/analytics https://use.typekit.net/jpk7bsf.css https://cashfreelogo.cashfree.com/
                wss://fullhouseanalytics.adda52poker.com/socket.io/ https://sandbox.assets.juspay.in/ https://p.typekit.net/p.css https://use.typekit.net/ 'unsafe-inline' 'unsafe-eval';
              img-src 'self' https://fullhouse.adda52poker.com https://www.google.co.in https://www.adda52.com/ https://assets.juspay.in https://public.releases.juspay.in data: https://cbwconline.com/ https://cashfreelogo.cashfree.com/ https://fullhousebanneradda.adda52poker.com/ 'unsafe-eval' 'unsafe-inline';
              manifest-src 'self' https://fullhouse.adda52poker.com/manifest.json https://assets.juspay.in https://sandbox.juspay.in https://sandbox.assets.juspay.in https://cashfreelogo.cashfree.com/ https://payments-test.cashfree.com/ 'unsafe-inline';
              worker-src 'self' blob: https://public.releases.juspay.in/;`
        ],
      },
    });
  });
}
