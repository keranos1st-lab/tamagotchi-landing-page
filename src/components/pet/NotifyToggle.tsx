import Icon from '@/components/ui/icon';
import { notifySupported, useNotifySettings } from './useNotifications';

export function NotifyToggle() {
  const { enabled, setEnabled } = useNotifySettings();

  const toggle = async () => {
    if (enabled) return setEnabled(false);
    if (notifySupported() && Notification.permission !== 'granted') {
      const res = await Notification.requestPermission();
      if (res === 'denied') {
        alert('Уведомления запрещены в браузере. Разрешите их в настройках сайта (значок замка в адресной строке).');
      }
    }
    setEnabled(true);
  };

  return (
    <button
      onClick={toggle}
      title={enabled ? 'Уведомления включены' : 'Включить уведомления'}
      className={`icon-btn relative ${enabled ? '!text-emerald-300 !border-emerald-400/30 !bg-emerald-400/10' : ''}`}
    >
      <Icon name={enabled ? 'BellRing' : 'BellOff'} size={17} />
      {enabled && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />}
    </button>
  );
}
