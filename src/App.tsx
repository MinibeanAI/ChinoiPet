import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PetCharacter } from './components/PetCharacter';
import {
  animationDurationMs,
  animationsById,
  bubbleForAnimation,
  calendarAnimationFor,
  dailyAnimationPool,
  interactionAnimationPool,
  idleAnimation,
  longIdleAnimationPool,
  type AnimationId
} from './animationRegistry';
import type {
  CalendarEvent,
  NotificationAuthorizationStatus,
  PermissionActionResult,
  PermissionStatusSummary,
  PetSettings,
  SystemSettingsTarget,
  WindowBounds
} from './global';
import './styles.css';

const defaultSettings: PetSettings = {
  waterIntervalMinutes: 45,
  restIntervalMinutes: 60,
  calendarLeadMinutes: 10,
  dailyActionsEnabled: true,
  calendarEnabled: true,
  openAtLogin: false,
  onboardingDismissed: false
};

interface DragState {
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
  bounds: WindowBounds;
}

function minutesFromNow(minutes: number) {
  return Date.now() + minutes * 60_000;
}

function parseCalendarDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatEventTime(value: string) {
  const date = parseCalendarDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function pickDailyAnimation(lastAnimation: AnimationId): AnimationId {
  const candidates = dailyAnimationPool.filter((animation) => animation !== lastAnimation);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? 'wave_come_here';
}

function pickRandomAnimation(pool: AnimationId[], lastAnimation: AnimationId): AnimationId {
  const candidates = pool.filter((animation) => animation !== lastAnimation);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0] ?? 'wave_come_here';
}

function isAnimationId(value: unknown): value is AnimationId {
  return typeof value === 'string' && value in animationsById;
}

function numericInputValue(value: string, fallback: number) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function permissionLabel(result?: PermissionActionResult) {
  if (!result) return '未检测';
  return result.ok ? '正常' : '需要处理';
}

function notificationStatusLabel(status?: NotificationAuthorizationStatus) {
  switch (status) {
    case 'authorized':
      return '已允许';
    case 'provisional':
      return '临时允许';
    case 'ephemeral':
      return '临时允许';
    case 'denied':
      return '已关闭';
    case 'notDetermined':
      return '待授权';
    case 'supported':
      return '可用';
    case 'unsupported':
      return '不可用';
    default:
      return '未检测';
  }
}

function isNotificationGranted(status?: NotificationAuthorizationStatus) {
  return status === 'authorized' || status === 'provisional' || status === 'ephemeral' || status === 'supported';
}

export default function App() {
  const [settings, setSettings] = useState<PetSettings>(defaultSettings);
  const [activeAnimation, setActiveAnimation] = useState<AnimationId>(idleAnimation);
  const [bubble, setBubble] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [debugControlsOpen, setDebugControlsOpen] = useState(import.meta.env.DEV);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatusSummary | null>(null);
  const [permissionMessage, setPermissionMessage] = useState('');
  const dragRef = useRef<DragState | null>(null);
  const animationTimerRef = useRef<number | undefined>(undefined);
  const nextWaterAtRef = useRef(minutesFromNow(defaultSettings.waterIntervalMinutes));
  const nextRestAtRef = useRef(minutesFromNow(defaultSettings.restIntervalMinutes));
  const lastClickAtRef = useRef(Date.now());
  const notifiedCalendarIdsRef = useRef(new Set<string>());
  const sidePanelOpen = settingsOpen || onboardingOpen;

  useEffect(() => {
    window.petAPI.getSettings().then((savedSettings) => {
      setSettings(savedSettings);
      nextWaterAtRef.current = minutesFromNow(savedSettings.waterIntervalMinutes);
      nextRestAtRef.current = minutesFromNow(savedSettings.restIntervalMinutes);

      if (!savedSettings.onboardingDismissed) {
        setOnboardingOpen(true);
      }
    });
  }, []);

  useEffect(() => {
    window.petAPI.setWindowSize({ width: sidePanelOpen ? 520 : 260, height: sidePanelOpen ? 320 : 300 });
  }, [sidePanelOpen]);

  const refreshPermissionStatus = useCallback(async () => {
    const status = await window.petAPI.getPermissionStatus();
    setPermissionStatus(status);
    return status;
  }, []);

  useEffect(() => {
    if (settingsOpen || onboardingOpen) {
      void refreshPermissionStatus();
    }
  }, [refreshPermissionStatus, onboardingOpen, settingsOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'd') {
        setDebugControlsOpen((open) => !open);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const playAnimation = useCallback((animationId: AnimationId, message = bubbleForAnimation(animationId)) => {
    window.clearTimeout(animationTimerRef.current);
    setActiveAnimation(animationId);
    setBubble(message);

    if (animationId === idleAnimation) {
      return;
    }

    animationTimerRef.current = window.setTimeout(() => {
      setActiveAnimation(idleAnimation);
      setBubble('');
    }, animationDurationMs(animationId));
  }, []);

  useEffect(() => {
    const disposeToggleSettings = window.petAPI.onToggleSettings(() => {
      setSettingsOpen((open) => !open);
    });
    const disposePlayAnimation = window.petAPI.onPlayAnimation((_event, animationId) => {
      if (isAnimationId(animationId)) {
        playAnimation(animationId);
      }
    });

    return () => {
      disposeToggleSettings();
      disposePlayAnimation();
    };
  }, [playAnimation]);

  const updateSettings = useCallback(async (patch: Partial<PetSettings>) => {
    const next = await window.petAPI.setSettings({ ...settings, ...patch });
    setSettings(next);

    if (patch.waterIntervalMinutes) {
      nextWaterAtRef.current = minutesFromNow(next.waterIntervalMinutes);
    }

    if (patch.restIntervalMinutes) {
      nextRestAtRef.current = minutesFromNow(next.restIntervalMinutes);
    }
  }, [settings]);

  const testNotification = useCallback(async () => {
    setPermissionMessage('正在发送测试通知…');
    const result = await window.petAPI.testNotification();
    setPermissionMessage(result.message);
    await refreshPermissionStatus();
  }, [refreshPermissionStatus]);

  const requestCalendarAccess = useCallback(async () => {
    setPermissionMessage('正在开启日历权限…');
    const result = await window.petAPI.requestCalendarAccess();
    setPermissionMessage(result.message);
    if (!result.ok) {
      await window.petAPI.openSystemSettings('automation');
    }
    await refreshPermissionStatus();
  }, [refreshPermissionStatus]);

  const openSystemSettings = useCallback(async (target: SystemSettingsTarget) => {
    const result = await window.petAPI.openSystemSettings(target);
    setPermissionMessage(result.message);
  }, []);

  useEffect(() => {
    if (!onboardingOpen || !permissionStatus) return;

    const notificationOk = isNotificationGranted(permissionStatus.notifications);
    const calendarOk = !settings.calendarEnabled || permissionStatus.calendar.ok;
    if (!notificationOk || !calendarOk) return;

    void updateSettings({ onboardingDismissed: true });
    setOnboardingOpen(false);
  }, [onboardingOpen, permissionStatus, settings.calendarEnabled, updateSettings]);

  useEffect(() => {
    const reminderTimer = window.setInterval(() => {
      const now = Date.now();

      if (settings.waterIntervalMinutes > 0 && now >= nextWaterAtRef.current) {
        nextWaterAtRef.current = minutesFromNow(settings.waterIntervalMinutes);
        playAnimation('drink_reminder');
        window.petAPI.notify({ title: '喝水提醒', body: '补一点水吧。' });
      }

      if (settings.restIntervalMinutes > 0 && now >= nextRestAtRef.current) {
        nextRestAtRef.current = minutesFromNow(settings.restIntervalMinutes);
        playAnimation('rest_reminder');
        window.petAPI.notify({ title: '休息提醒', body: '站起来活动一下肩颈。' });
      }
    }, 10_000);

    return () => window.clearInterval(reminderTimer);
  }, [playAnimation, settings.restIntervalMinutes, settings.waterIntervalMinutes]);

  useEffect(() => {
    if (!settings.dailyActionsEnabled) return undefined;

    const dailyTimer = window.setInterval(() => {
      if (activeAnimation !== idleAnimation) return;
      const idleForMs = Date.now() - lastClickAtRef.current;
      const animationPool = idleForMs >= 120_000 ? longIdleAnimationPool : dailyAnimationPool;
      playAnimation(
        animationPool === longIdleAnimationPool
          ? pickRandomAnimation(animationPool, activeAnimation)
          : pickDailyAnimation(activeAnimation)
      );
    }, 50_000);

    return () => window.clearInterval(dailyTimer);
  }, [activeAnimation, playAnimation, settings.dailyActionsEnabled]);

  useEffect(() => {
    if (!settings.calendarEnabled) return undefined;

    async function pollCalendar() {
      const events = await window.petAPI.listUpcomingCalendarEvents();
      const now = Date.now();
      const leadMs = settings.calendarLeadMinutes * 60_000;

      const nextEvent = events.find((event: CalendarEvent) => {
        if (notifiedCalendarIdsRef.current.has(event.id)) return false;

        const start = parseCalendarDate(event.start);
        if (!start) return false;

        const msUntilStart = start.getTime() - now;
        return msUntilStart <= leadMs && msUntilStart >= -60_000;
      });

      if (!nextEvent) return;

      notifiedCalendarIdsRef.current.add(nextEvent.id);
      const animationId = calendarAnimationFor(nextEvent.category);
      const eventTime = formatEventTime(nextEvent.start);
      const message = eventTime ? `${eventTime} ${nextEvent.title}` : nextEvent.title;

      playAnimation(animationId, message);
      window.petAPI.notify({
        title: '日程提醒',
        body: message
      });
    }

    pollCalendar();
    const calendarTimer = window.setInterval(pollCalendar, 60_000);
    return () => window.clearInterval(calendarTimer);
  }, [playAnimation, settings.calendarEnabled, settings.calendarLeadMinutes]);

  const handlePointerDown = useCallback(async (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const bounds = await window.petAPI.getWindowBounds();

    dragRef.current = {
      startX: event.screenX,
      startY: event.screenY,
      offsetX: event.screenX - bounds.x,
      offsetY: event.screenY - bounds.y,
      moved: false,
      bounds
    };
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    window.petAPI.openContextMenu();
  }, []);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const dragState = dragRef.current;
      if (!dragState) return;

      const deltaX = Math.abs(event.screenX - dragState.startX);
      const deltaY = Math.abs(event.screenY - dragState.startY);

      if (deltaX > 4 || deltaY > 4) {
        dragState.moved = true;
      }

      if (!dragState.moved) return;

      window.petAPI.setWindowPosition({
        x: event.screenX - dragState.offsetX,
        y: event.screenY - dragState.offsetY
      });
    }

    function onPointerUp() {
      const dragState = dragRef.current;
      dragRef.current = null;

      if (!dragState) return;

      if (dragState.moved) {
        void window.petAPI.saveWindowBounds();
      } else {
        lastClickAtRef.current = Date.now();
        playAnimation(pickRandomAnimation(interactionAnimationPool, activeAnimation));
      }
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [activeAnimation, playAnimation]);

  const quickActions = useMemo<Array<{ id: AnimationId; label: string }>>(() => [
    { id: 'clingy_pout', label: '撒娇' },
    { id: 'blow_kiss', label: '亲吻' },
    { id: 'wave_come_here', label: '招手' },
    { id: 'listen_to_crowd', label: '听呐喊' },
    { id: 'sleeve_sweep_loop', label: '甩袖' },
    { id: 'robe_sweep_intro', label: '起势' },
    { id: 'robe_remove_stage', label: '脱外衫' },
    { id: 'skirt_release_spin', label: '撕马面裙' },
    { id: 'single_leg_knee_slide_backbend', label: '滑跪' }
  ], []);

  return (
    <main className={`desktop-pet-shell${sidePanelOpen ? ' side-panel-open' : ''}`} onContextMenu={handleContextMenu}>
      <section className="pet-wrap">
        {bubble ? <div className="speech-bubble">{bubble}</div> : null}
        <PetCharacter activeAnimation={activeAnimation} onPointerDown={handlePointerDown} />
      </section>

      {onboardingOpen ? (
        <aside className="onboarding-panel no-drag" aria-label="首次启动权限引导">
          <header>
            <strong>首次启动</strong>
            <span>把权限打开后提醒才会生效</span>
          </header>
          <div className="onboarding-row">
            <span>通知</span>
            <strong>{notificationStatusLabel(permissionStatus?.notifications)}</strong>
            <div className="onboarding-actions">
              <button type="button" onClick={testNotification}>
                测试
              </button>
              <button type="button" onClick={() => openSystemSettings('notifications')}>
                设置
              </button>
            </div>
          </div>
          <div className="onboarding-row">
            <span>日历</span>
            <strong>{permissionLabel(permissionStatus?.calendar)}</strong>
            <div className="onboarding-actions">
              <button type="button" onClick={requestCalendarAccess}>
                开启日历
              </button>
              <button type="button" onClick={() => openSystemSettings('automation')}>
                设置
              </button>
            </div>
          </div>
          {permissionMessage || permissionStatus?.calendar.message ? (
            <p>{permissionMessage || permissionStatus?.calendar.message}</p>
          ) : null}
          <footer>
            <button type="button" onClick={() => setOnboardingOpen(false)}>
              稍后
            </button>
            <button type="button" onClick={() => void updateSettings({ onboardingDismissed: true })}>
              不再提示
            </button>
          </footer>
        </aside>
      ) : null}

      {debugControlsOpen && import.meta.env.DEV ? (
        <nav className="pet-dock no-drag" aria-label="桌宠控制">
          {quickActions.map((action) => (
            <button key={action.id} type="button" onClick={() => playAnimation(action.id)}>
              {action.label}
            </button>
          ))}
          <button type="button" aria-label="设置" onClick={() => setSettingsOpen((open) => !open)}>
            设置
          </button>
        </nav>
      ) : null}

      {settingsOpen ? (
        <aside className="settings-panel no-drag">
          <label>
            喝水
            <input
              type="number"
              min="5"
              step="5"
              value={settings.waterIntervalMinutes}
              onChange={(event) => updateSettings({
                waterIntervalMinutes: numericInputValue(event.target.value, settings.waterIntervalMinutes)
              })}
            />
            <span>分钟</span>
          </label>

          <label>
            休息
            <input
              type="number"
              min="10"
              step="5"
              value={settings.restIntervalMinutes}
              onChange={(event) => updateSettings({
                restIntervalMinutes: numericInputValue(event.target.value, settings.restIntervalMinutes)
              })}
            />
            <span>分钟</span>
          </label>

          <label>
            日程提前
            <input
              type="number"
              min="1"
              step="5"
              value={settings.calendarLeadMinutes}
              onChange={(event) => updateSettings({
                calendarLeadMinutes: numericInputValue(event.target.value, settings.calendarLeadMinutes)
              })}
            />
            <span>分钟</span>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.dailyActionsEnabled}
              onChange={(event) => updateSettings({ dailyActionsEnabled: event.target.checked })}
            />
            日常动作
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.calendarEnabled}
              onChange={(event) => updateSettings({ calendarEnabled: event.target.checked })}
            />
            系统日历
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.openAtLogin}
              onChange={(event) => updateSettings({ openAtLogin: event.target.checked })}
            />
            开机启动
          </label>

          <section className="permission-block" aria-label="权限状态">
            <div className="permission-row">
              <span>通知</span>
              <strong>{notificationStatusLabel(permissionStatus?.notifications)}</strong>
              <button type="button" onClick={testNotification}>
                测试
              </button>
            </div>
            <div className="permission-row">
              <span>日历</span>
              <strong>{permissionLabel(permissionStatus?.calendar)}</strong>
              <button type="button" onClick={requestCalendarAccess}>
                开启日历
              </button>
            </div>
            <button type="button" className="permission-guide" onClick={() => setOnboardingOpen(true)}>
              权限引导
            </button>
            {permissionMessage || permissionStatus?.calendar.message ? (
              <p>{permissionMessage || permissionStatus?.calendar.message}</p>
            ) : null}
          </section>
        </aside>
      ) : null}
    </main>
  );
}
