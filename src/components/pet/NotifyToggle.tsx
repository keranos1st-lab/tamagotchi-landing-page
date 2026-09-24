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
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        enabled ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30' : 'bg-slate-800 text-purple-200 hover:bg-slate-700'
      }`}
    >
      <Icon name={enabled ? 'BellRing' : 'BellOff'} size={16} />
      <span className="hidden md:inline">{enabled ? 'Уведомления вкл' : 'Уведомления'}</span>
    </button>
  );
}
