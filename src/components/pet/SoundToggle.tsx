import Icon from '@/components/ui/icon';
import { sfx, useSoundSettings } from './sound';

export function SoundToggle() {
  const { enabled, setEnabled } = useSoundSettings();

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    if (next) setTimeout(() => sfx.greet(), 30);
  };

  return (
    <button
      onClick={toggle}
      title={enabled ? 'Выключить звук' : 'Включить звук'}
      className={`icon-btn ${enabled ? '' : '!text-white/35'}`}
    >
      <Icon name={enabled ? 'Volume2' : 'VolumeX'} size={17} />
    </button>
  );
}
