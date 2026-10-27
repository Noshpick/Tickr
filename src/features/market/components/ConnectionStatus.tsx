import { useStore } from '../../../shared/createStore';
import { useFeed } from '../useMarketFeed';

const LABELS = {
  connecting: 'Подключение',
  open: 'Онлайн',
  reconnecting: 'Переподключение',
  closed: 'Отключено',
} as const;

export function ConnectionStatus() {
  const { status } = useFeed();
  const value = useStore(status, (s) => s);
  return (
    <span className={`status status--${value}`} role="status" title="Состояние WebSocket-соединения">
      <i className="status__dot" />
      {LABELS[value]}
    </span>
  );
}
