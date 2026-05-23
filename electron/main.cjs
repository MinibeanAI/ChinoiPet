const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  nativeImage,
  ipcMain,
  screen,
  shell,
  systemPreferences
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { execFile } = require('node:child_process');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');
const defaultSettings = {
  waterIntervalMinutes: 45,
  restIntervalMinutes: 60,
  calendarLeadMinutes: 10,
  dailyActionsEnabled: true,
  calendarEnabled: true,
  openAtLogin: false,
  onboardingDismissed: false
};
const defaultWindowState = {
  width: 260,
  height: 300,
  x: undefined,
  y: 220
};

let mainWindow;
let tray;
let lastCalendarAccess = {
  ok: process.platform === 'darwin',
  message: process.platform === 'darwin' ? '尚未检测日历权限。' : '系统日历仅在 macOS 可用。'
};

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeSettings(settings = {}) {
  return {
    waterIntervalMinutes: clampNumber(settings.waterIntervalMinutes, 5, 240, defaultSettings.waterIntervalMinutes),
    restIntervalMinutes: clampNumber(settings.restIntervalMinutes, 10, 240, defaultSettings.restIntervalMinutes),
    calendarLeadMinutes: clampNumber(settings.calendarLeadMinutes, 1, 1440, defaultSettings.calendarLeadMinutes),
    dailyActionsEnabled:
      typeof settings.dailyActionsEnabled === 'boolean'
        ? settings.dailyActionsEnabled
        : defaultSettings.dailyActionsEnabled,
    calendarEnabled:
      typeof settings.calendarEnabled === 'boolean'
        ? settings.calendarEnabled
        : defaultSettings.calendarEnabled,
    openAtLogin:
      typeof settings.openAtLogin === 'boolean'
        ? settings.openAtLogin
        : defaultSettings.openAtLogin,
    onboardingDismissed:
      typeof settings.onboardingDismissed === 'boolean'
        ? settings.onboardingDismissed
        : defaultSettings.onboardingDismissed
  };
}

function syncLoginItemSettings(openAtLogin) {
  if (process.platform !== 'darwin') return;

  app.setLoginItemSettings({
    openAtLogin: Boolean(openAtLogin),
    openAsHidden: true
  });
}

function readSettings() {
  try {
    return normalizeSettings({ ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) });
  } catch {
    return normalizeSettings(defaultSettings);
  }
}

function writeSettings(settings) {
  const nextSettings = normalizeSettings({ ...defaultSettings, ...settings });
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(nextSettings, null, 2));
  syncLoginItemSettings(nextSettings.openAtLogin);
  return readSettings();
}

function normalizeWindowState(state, display) {
  const width = clampNumber(state?.width, 180, 520, defaultWindowState.width);
  const height = clampNumber(state?.height, 220, 620, defaultWindowState.height);
  const fallbackX = Math.max(24, display.workArea.x + display.workArea.width - width - 40);
  const fallbackY = Math.max(display.workArea.y + 24, defaultWindowState.y);
  const maxX = display.workArea.x + display.workArea.width - width;
  const maxY = display.workArea.y + display.workArea.height - height;

  return {
    width,
    height,
    x: clampNumber(state?.x, display.workArea.x, maxX, fallbackX),
    y: clampNumber(state?.y, display.workArea.y, maxY, fallbackY)
  };
}

function readWindowState() {
  const display = screen.getPrimaryDisplay();

  try {
    return normalizeWindowState(JSON.parse(fs.readFileSync(windowStatePath, 'utf8')), display);
  } catch {
    return normalizeWindowState(defaultWindowState, display);
  }
}

function writeWindowState(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const nextState = normalizeWindowState(bounds, display);

  fs.mkdirSync(path.dirname(windowStatePath), { recursive: true });
  fs.writeFileSync(windowStatePath, JSON.stringify(nextState, null, 2));
  return nextState;
}

function createWindow() {
  const windowState = readWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function sendToRenderer(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function showNotification(title, body) {
  if (!Notification.isSupported()) return;

  new Notification({
    title,
    body,
    silent: false
  }).show();
}

function actionMenuItems() {
  return [
    {
      label: '撒娇',
      click: () => sendToRenderer('animation:play', 'clingy_pout')
    },
    {
      label: '亲吻',
      click: () => sendToRenderer('animation:play', 'blow_kiss')
    },
    { type: 'separator' },
    {
      label: '招手',
      click: () => sendToRenderer('animation:play', 'wave_come_here')
    },
    {
      label: '听呐喊',
      click: () => sendToRenderer('animation:play', 'listen_to_crowd')
    },
    {
      label: '甩袖',
      click: () => sendToRenderer('animation:play', 'sleeve_sweep_loop')
    },
    { type: 'separator' },
    {
      label: '喝水提醒',
      click: () => sendToRenderer('animation:play', 'drink_reminder')
    },
    {
      label: '休息提醒',
      click: () => sendToRenderer('animation:play', 'rest_reminder')
    },
    { type: 'separator' },
    {
      label: '外衫起势',
      click: () => sendToRenderer('animation:play', 'robe_sweep_intro')
    },
    {
      label: '脱外衫',
      click: () => sendToRenderer('animation:play', 'robe_remove_stage')
    },
    {
      label: '撕马面裙',
      click: () => sendToRenderer('animation:play', 'skirt_release_spin')
    },
    {
      label: '滑跪后仰',
      click: () => sendToRenderer('animation:play', 'single_leg_knee_slide_backbend')
    }
  ];
}

async function detectCalendarAndNotify() {
  await listCalendarEvents();
  showNotification('日历权限', lastCalendarAccess.message);
}

function buildApplicationMenu() {
  return Menu.buildFromTemplate([
    {
      label: '国风桌宠',
      submenu: [
        {
          label: '设置',
          click: () => sendToRenderer('settings:toggle')
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '动作',
      submenu: actionMenuItems()
    },
    {
      label: '检测',
      submenu: [
        {
          label: '测试通知',
          click: () => showNotification('国风桌宠', '通知权限测试成功。')
        },
        {
          label: '开启日历',
          click: detectCalendarAndNotify
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭' }
      ]
    }
  ]);
}

function buildPetMenu() {
  const settings = readSettings();
  const actions = actionMenuItems();

  return Menu.buildFromTemplate([
    {
      label: '设置',
      click: () => sendToRenderer('settings:toggle')
    },
    { type: 'separator' },
    ...actions.slice(0, 2),
    { type: 'separator' },
    ...actions.slice(3, 6),
    { type: 'separator' },
    ...actions.slice(7, 9),
    {
      label: '测试通知',
      click: () => showNotification('国风桌宠', '通知权限测试成功。')
    },
    {
      label: '开启日历',
      click: detectCalendarAndNotify
    },
    { type: 'separator' },
    {
      label: '舞台动作',
      submenu: actions.slice(10)
    },
    {
      label: '开机启动',
      type: 'checkbox',
      checked: settings.openAtLogin,
      click: (menuItem) => {
        writeSettings({ ...settings, openAtLogin: menuItem.checked });
        tray?.setContextMenu(buildPetMenu());
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      role: 'quit'
    }
  ]);
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'src', 'assets', 'character-front-alpha.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip('国风桌宠');
  tray.setContextMenu(buildPetMenu());
  tray.on('click', () => sendToRenderer('settings:toggle'));
}

function classifyCalendarTitle(title = '') {
  const lower = title.toLowerCase();

  if (/(interview|面试)/i.test(title)) return 'interview';
  if (/(deadline|due|提交|截止)/i.test(title)) return 'deadline';
  if (/(meeting|meet|sync|call|会议|讨论|沟通|评审)/i.test(title)) return 'meeting';
  if (/(flight|train|travel|飞机|高铁|火车|出行)/i.test(title)) return 'travel';
  if (/(lunch|dinner|饭|聚餐|午餐|晚餐)/i.test(title)) return 'meal';
  if (/(birthday|anniversary|生日|纪念日)/i.test(title)) return 'celebration';
  if (/(show|stage|dance|演出|排练|跳舞)/i.test(title)) return 'stage';

  return lower.trim() ? 'general' : 'unknown';
}

function listCalendarEvents() {
  if (process.platform !== 'darwin') {
    lastCalendarAccess = { ok: false, message: '系统日历仅在 macOS 可用。' };
    return Promise.resolve([]);
  }

  const script = `
set nowDate to current date
set endDate to nowDate + (24 * hours)
set outputLines to {}
tell application "Calendar"
  repeat with calendarItem in calendars
    set calendarName to name of calendarItem
    try
      set eventItems to every event of calendarItem whose start date is greater than or equal to nowDate and start date is less than or equal to endDate
      repeat with eventItem in eventItems
        set eventTitle to summary of eventItem
        set eventStart to start date of eventItem
        set eventEnd to end date of eventItem
        set end of outputLines to eventTitle & tab & (eventStart as «class isot» as string) & tab & (eventEnd as «class isot» as string) & tab & calendarName
      end repeat
    end try
  end repeat
end tell
set AppleScript's text item delimiters to linefeed
return outputLines as text
`;

  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], { timeout: 8000 }, (error, stdout) => {
      if (error) {
        lastCalendarAccess = {
          ok: false,
          message: '无法读取日历，请在系统设置里允许本应用访问日历或控制 Calendar。'
        };
        resolve([]);
        return;
      }

      lastCalendarAccess = {
        ok: true,
        message: stdout.trim() ? '日历读取正常。' : '日历权限正常，未来 24 小时暂无日程。'
      };

      if (!stdout.trim()) {
        resolve([]);
        return;
      }

      const events = stdout
        .trim()
        .split('\n')
        .map((line, index) => {
          const [title, start, end, calendarName] = line.split('\t');
          return {
            id: `${start}-${index}-${title}`,
            title,
            start,
            end,
            calendarName,
            category: classifyCalendarTitle(title)
          };
        });

      resolve(events);
    });
  });
}

async function getPermissionStatus() {
  const notifications = (() => {
    if (!Notification.isSupported()) return 'unsupported';
    if (process.platform !== 'darwin') return 'supported';

    try {
      const settings = systemPreferences.getNotificationSettings();
      return settings?.authorizationStatus ?? 'unknown';
    } catch {
      return 'unknown';
    }
  })();

  return {
    platform: process.platform,
    packaged: app.isPackaged,
    notifications,
    calendar: lastCalendarAccess
  };
}

function openSystemSettings(target) {
  if (process.platform !== 'darwin') {
    return { ok: false, message: '仅支持在 macOS 打开系统设置。' };
  }

  const urls = {
    notifications: 'x-apple.systempreferences:com.apple.preference.notifications',
    automation: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'
  };

  const url = urls[target];
  if (!url) return { ok: false, message: '未知的系统设置入口。' };

  shell.openExternal(url);
  return { ok: true, message: '已打开系统设置。' };
}

app.whenReady().then(() => {
  syncLoginItemSettings(readSettings().openAtLogin);
  createWindow();
  createTray();
  Menu.setApplicationMenu(buildApplicationMenu());

  ipcMain.handle('settings:get', () => readSettings());
  ipcMain.handle('settings:set', (_event, settings) => writeSettings(settings));
  ipcMain.handle('window:get-bounds', () => mainWindow?.getBounds());
  ipcMain.handle('window:set-position', (_event, point) => {
    if (!mainWindow) return;
    mainWindow.setPosition(Math.round(point.x), Math.round(point.y), false);
  });
  ipcMain.handle('window:set-size', (_event, size) => {
    if (!mainWindow) return;
    mainWindow.setSize(Math.round(size.width), Math.round(size.height), false);
  });
  ipcMain.handle('window:save-bounds', () => {
    if (!mainWindow) return;
    return writeWindowState(mainWindow.getBounds());
  });
  ipcMain.handle('notify', (_event, payload) => {
    showNotification(payload.title, payload.body);
  });
  ipcMain.handle('calendar:list-upcoming', () => listCalendarEvents());
  ipcMain.handle('permissions:get-status', () => getPermissionStatus());
  ipcMain.handle('permissions:test-notification', () => {
    if (!Notification.isSupported()) {
      return { ok: false, message: '当前系统不支持桌面通知。' };
    }

    showNotification('国风桌宠', '通知权限测试成功。');
    return { ok: true, message: '已发送测试通知。' };
  });
  ipcMain.handle('permissions:request-calendar', async () => {
    await listCalendarEvents();
    return lastCalendarAccess;
  });
  ipcMain.handle('system:open-settings', (_event, target) => openSystemSettings(target));
  ipcMain.handle('context-menu:open', () => {
    buildPetMenu().popup({ window: mainWindow });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
