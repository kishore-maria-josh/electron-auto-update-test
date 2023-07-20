"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupContentSecurityPolicy = exports.ElectronCapacitorApp = exports.setupReloadWatcher = void 0;
const tslib_1 = require("tslib");
const electron_1 = require("@capacitor-community/electron");
const chokidar_1 = tslib_1.__importDefault(require("chokidar"));
const electron_2 = require("electron");
const electron_is_dev_1 = tslib_1.__importDefault(require("electron-is-dev"));
const electron_serve_1 = tslib_1.__importDefault(require("electron-serve"));
const electron_window_state_1 = tslib_1.__importDefault(require("electron-window-state"));
const path_1 = require("path");
// import * as config from '../app/poker2/assets/js/app-config.dev.json';
// Define components for a watcher to detect when the webapp is changed so we can reload in Dev mode.
const reloadWatcher = {
    debouncer: null,
    ready: false,
    watcher: null,
};
function setupReloadWatcher(electronCapacitorApp) {
    reloadWatcher.watcher = chokidar_1.default
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
exports.setupReloadWatcher = setupReloadWatcher;
// Define our class to manage our app.
class ElectronCapacitorApp {
    constructor(capacitorFileConfig, trayMenuTemplate, appMenuBarMenuTemplate) {
        var _a, _b;
        this.MainWindow = null;
        this.SplashScreen = null;
        this.TrayIcon = null;
        this.TrayMenuTemplate = [
            new electron_2.MenuItem({ label: 'Quit App', role: 'quit' }),
        ];
        this.AppMenuBarMenuTemplate = [
            { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
            { role: 'viewMenu' },
        ];
        this.isHandleWindowDone = true;
        this.CapacitorFileConfig = capacitorFileConfig;
        this.customScheme = (_b = (_a = this.CapacitorFileConfig.electron) === null || _a === void 0 ? void 0 : _a.customUrlScheme) !== null && _b !== void 0 ? _b : 'capacitor-electron';
        if (trayMenuTemplate) {
            this.TrayMenuTemplate = trayMenuTemplate;
        }
        if (appMenuBarMenuTemplate) {
            this.AppMenuBarMenuTemplate = appMenuBarMenuTemplate;
        }
        // Setup our web app loader, this lets us load apps like react, vue, and angular without changing their build chains.
        this.loadWebApp = electron_serve_1.default({
            directory: path_1.join('https://fullhouse.adda52poker.com/poker2qa/'),
            // directory: join('http://localhost:4200/'), // For development purpose
            scheme: this.customScheme,
        });
    }
    // Helper function to load in the app.
    async loadMainWindow(thisRef) {
        await thisRef.loadWebApp(thisRef.MainWindow);
    }
    // Expose the mainWindow ref for use outside of the class.
    getMainWindow() {
        return this.MainWindow;
    }
    getCustomURLScheme() {
        return this.customScheme;
    }
    async init() {
        var _a, _b, _c, _d;
        process.env.GOOGLE_API_KEY = 'AIzaSyCvIs_uHPrlEVwY8d51KL5N1rAEwtAaNtk';
        const icon = electron_2.nativeImage.createFromPath(path_1.join(electron_2.app.getAppPath(), 'src/assets', process.platform === 'win32' ? 'icons/appIcon.ico' : 'icons/appIcon.png'));
        this.mainWindowState = electron_window_state_1.default({
            defaultWidth: 1000,
            defaultHeight: 800,
        });
        // Setup preload script path and construct our main window.
        const preloadPath = path_1.join(electron_2.app.getAppPath(), 'build', 'src', 'preload.js');
        this.MainWindow = new electron_2.BrowserWindow({
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
            var _a;
            if (((_a = this.SplashScreen) === null || _a === void 0 ? void 0 : _a.getSplashWindow()) && !this.SplashScreen.getSplashWindow().isDestroyed()) {
                this.SplashScreen.getSplashWindow().close();
            }
        });
        // When the tray icon is enabled, setup the options.
        if ((_a = this.CapacitorFileConfig.electron) === null || _a === void 0 ? void 0 : _a.trayIconAndMenuEnabled) {
            this.TrayIcon = new electron_2.Tray(icon);
            this.TrayIcon.on('double-click', () => {
                if (this.MainWindow) {
                    if (this.MainWindow.isVisible()) {
                        this.MainWindow.hide();
                    }
                    else {
                        this.MainWindow.show();
                        this.MainWindow.focus();
                    }
                }
            });
            this.TrayIcon.on('click', () => {
                if (this.MainWindow) {
                    if (this.MainWindow.isVisible()) {
                        this.MainWindow.hide();
                    }
                    else {
                        this.MainWindow.show();
                        this.MainWindow.focus();
                    }
                }
            });
            this.TrayIcon.setToolTip(electron_2.app.getName());
            this.TrayIcon.setContextMenu(electron_2.Menu.buildFromTemplate(this.TrayMenuTemplate));
        }
        // Setup the main menu bar at the top of our window.
        // Menu.setApplicationMenu(Menu.buildFromTemplate(this.AppMenuBarMenuTemplate));
        electron_2.Menu.setApplicationMenu(null);
        // If the splashscreen is enabled, show it first while the main window loads then switch it out for the main window, or just load the main window from the start.
        if ((_b = this.CapacitorFileConfig.electron) === null || _b === void 0 ? void 0 : _b.splashScreenEnabled) {
            this.SplashScreen = new electron_1.CapacitorSplashScreen({
                imageFilePath: path_1.join(electron_2.app.getAppPath(), 'src/assets', (_d = (_c = this.CapacitorFileConfig.electron) === null || _c === void 0 ? void 0 : _c.splashScreenImageName) !== null && _d !== void 0 ? _d : 'icons/splash.png'),
                windowWidth: 400,
                windowHeight: 400,
            });
            this.SplashScreen.init(this.loadMainWindow, this);
        }
        else {
            // this.loadMainWindow(this);
            this.MainWindow.loadURL('https://fullhouse.adda52poker.com/poker2qa/');
            // this.MainWindow.loadURL('http://localhost:4200/') // For development purpose
        }
        // Security
        this.MainWindow.webContents.setWindowOpenHandler((details) => {
            if (details.frameName === 'tnc') {
                this.MainWindow.loadURL(details.url);
                return { action: 'deny' };
            }
            this.isHandleWindowDone = false;
            const allWindows = electron_2.BrowserWindow.getAllWindows();
            let isWindowFocused = false;
            allWindows.forEach(element => {
                // element.webContents.openDevTools()
                if (element.webContents.getURL().search(details.url) >= 0
                    || (details.url.search('https://www.adda52.com/') >= 0
                        && (element.webContents.getURL().search('https://fullhouse.adda52poker.com/') >= 0 || element.webContents.getURL().search('https://www.adda52.com/') >= 0))
                    || (details.url.search('addcash') >= 0 && element.webContents.getURL().search('https://public.releases.juspay.in') >= 0)) {
                    if (details.url === 'https://www.adda52.com/faq/tds' && element.webContents.getURL() !== 'https://www.adda52.com/faq/tds') {
                        element.webContents.loadURL('https://www.adda52.com/faq/tds');
                    }
                    else if (details.url === 'https://www.adda52.com/compliance' && element.webContents.getURL() === 'https://www.adda52.com/faq/tds') {
                        element.webContents.loadURL('https://www.adda52.com/compliance');
                    }
                    element.show();
                    isWindowFocused = true;
                }
            });
            if (isWindowFocused) {
                return { action: 'deny' };
            }
            return { action: 'allow' };
        });
        electron_2.app.on('web-contents-created', (event, contents) => {
            this.MainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
                // Strip away preload scripts if unused or verify their location is legitimate
                delete webPreferences.preload;
                // Disable Node.js integration
                webPreferences.nodeIntegration = false;
                // Verify URL being loaded
                // if (!params.src.startsWith('http://localhost:4200/')) { // For development purpose
                if (!params.src.startsWith('https://fullhouse.adda52poker.com/poker2qa/')) {
                    event.preventDefault();
                }
            });
        });
        this.MainWindow.webContents.on('did-navigate-in-page', () => {
            this.MainWindow.webContents
                .executeJavaScript('localStorage.getItem("userLoggedIn");', true)
                .then(result => {
                if (!result) {
                    const allWindows = electron_2.BrowserWindow.getAllWindows();
                    const mainWindowUrl = this.MainWindow.webContents.getURL();
                    allWindows.forEach(window => {
                        let _winUrl = window.webContents.getURL();
                        const winUrl = _winUrl.split('//-');
                        if (_winUrl !== mainWindowUrl && winUrl[winUrl.length - 1].search('https://fullhouse.adda52poker.com/') < 0)
                            window.close();
                    });
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
                electron_2.app.quit();
            }
        });
        // Link electron plugins into the system.
        electron_1.setupCapacitorElectronPlugins();
        // When the web app is loaded we hide the splashscreen if needed and show the main window.
        this.MainWindow.webContents.on('dom-ready', () => {
            var _a, _b;
            if ((_a = this.CapacitorFileConfig.electron) === null || _a === void 0 ? void 0 : _a.splashScreenEnabled) {
                this.SplashScreen.getSplashWindow().hide();
            }
            if (!((_b = this.CapacitorFileConfig.electron) === null || _b === void 0 ? void 0 : _b.hideMainWindowOnLaunch)) {
                this.MainWindow.show();
            }
            setTimeout(() => {
                if (electron_is_dev_1.default) {
                    this.MainWindow.webContents.openDevTools();
                }
                electron_1.CapElectronEventEmitter.emit('CAPELECTRON_DeeplinkListenerInitialized', '');
            }, 400);
        });
    }
}
exports.ElectronCapacitorApp = ElectronCapacitorApp;
// Set a CSP up for our application based on the custom scheme
function setupContentSecurityPolicy(customScheme) {
    electron_2.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: Object.assign(Object.assign({}, details.responseHeaders), { 'Content-Security-Policy': [
                    electron_is_dev_1.default
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
                ] }),
        });
    });
}
exports.setupContentSecurityPolicy = setupContentSecurityPolicy;
