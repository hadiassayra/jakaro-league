import { useStore } from '../store/useStore';
import { Empty, Marble, SectionTitle } from '../components/ui';

const fmt = new Intl.DateTimeFormat('ar', { dateStyle: 'short', timeStyle: 'medium' });

export default function LogPage() {
  const log = useStore((s) => s.t.log);
  return (
    <div>
      <SectionTitle rank="5" title="سجل النشاط" sub="كل نتيجة أُدخلت أو عُدّلت مع وقتها" />
      {!log.length && <Empty>لا يوجد نشاط بعد</Empty>}
      <ol className="board divide-y divide-ink/10">
        {log.map((e) => {
          const color = e.text.startsWith('نتيجة')
            ? 'green'
            : e.text.startsWith('تعديل')
              ? 'yellow'
              : e.text.startsWith('حذف')
                ? 'red'
                : 'blue';
          return (
            <li key={e.id} className="flex items-start gap-3 p-3">
              <Marble color={color} size={14} className="mt-1.5" />
              <span className="flex-1">{e.text}</span>
              <time className="shrink-0 text-xs text-ink/55" dateTime={new Date(e.at).toISOString()}>
                {fmt.format(e.at)}
              </time>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
