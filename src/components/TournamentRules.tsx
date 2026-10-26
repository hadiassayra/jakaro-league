import type { Settings } from '../lib/types';

export function TournamentRules({ settings }: { settings: Settings }) {
  return <section className="board p-5">
    <h2 className="mb-4 text-2xl">تعليمات البطولة</h2>
    <ol className="list-inside list-decimal space-y-3 text-ink/80">
      <li>تُوزّع الفرق على مجموعتين، ويلعب كل فريق ضد فرق مجموعته.</li>
      <li>الفوز بنقطة واحدة، والخسارة بدون نقاط.</li>
      <li>عند التعادل يُحسب فرق الكرات: كرات الخصوم المتبقية عند الفوز ناقص كرات الفريق المتبقية عند الخسارة، ثم المواجهة المباشرة، ثم قرار المنظّم أو القرعة.</li>
      <li>يتأهل أول {settings.qualifiersPerGroup} فرق من كل مجموعة إلى الأدوار الإقصائية بعد اعتماد نتائج المجموعات.</li>
      <li>يُسجّل الفريق الفائز وعدد كرات الخاسر المتبقية، من صفر إلى {settings.maxMarbles}.</li>
      <li>تُعرض مواعيد المباريات بتوقيت فلسطين. المباراة التي لا يظهر لها موعد لم يُحدّد وقتها بعد.</li>
      <li>يوم اللعب مقسوم إلى جولة أولى وجولة ثانية منفصلتين. لكل فريق مباراة واحدة كحد أقصى في كل جولة، بهدف مباراتين في اليوم. إذا كان عدد الفرق فردياً يرتاح فريق في كل جولة.</li>
      {settings.matchTimeLimitMin > 0 && <li>الوقت المحدد للمباراة: {settings.matchTimeLimitMin} دقيقة.</li>}
      {settings.thirdPlaceMatch && <li>تتضمن البطولة مباراة لتحديد المركز الثالث.</li>}
    </ol>
  </section>;
}
