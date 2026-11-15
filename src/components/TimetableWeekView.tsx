import { Link } from 'react-router-dom';
import { BookOpen, Clock, MapPin, Shuffle, UserCheck } from 'lucide-react';
import {
  SESSION_LABELS,
  getPeriodSession,
  type DaySession,
  type WeekDayInfo,
} from '@/lib/week';
import type { TimetableEntry } from '@/types/database';
import { Badge } from '@/components/ui/Badge';

const SESSIONS: DaySession[] = ['morning', 'afternoon', 'evening'];

interface TimetableWeekViewProps {
  weekDays: WeekDayInfo[];
  entriesByWeekday: Map<number, TimetableEntry[]>;
  todayIso: string;
  mode: 'class' | 'teacher';
  classIdByKey?: ReadonlyMap<string, string>;
}

function PeriodLabel({ start, end }: { start: number; end: number }) {
  return (
    <>
      Tiết {start}
      {end > start ? `–${end}` : ''}
    </>
  );
}

export function TimetableWeekView({
  weekDays,
  entriesByWeekday,
  todayIso,
  mode,
  classIdByKey,
}: TimetableWeekViewProps) {
  return (
    <>
      {/* Giao diện lưới theo buổi cho màn hình từ tablet/desktop trở lên */}
      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface-card lg:block">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-subtle">
              <th className="w-36 border-r border-line p-4 text-left text-xs font-bold uppercase text-ink-secondary">
                Buổi / Tiết
              </th>
              {weekDays.map((day) => {
                const isToday = day.isoDate === todayIso;
                return (
                  <th
                    key={day.weekday}
                    className={`border-r border-line p-4 text-center last:border-r-0 ${
                      isToday ? 'bg-brand-redSoft' : ''
                    }`}
                  >
                    <div
                      className={`text-sm font-bold ${
                        isToday ? 'text-brand-red' : 'text-brand-navy'
                      }`}
                    >
                      {day.label}
                    </div>
                    <div className="text-xs font-normal text-ink-muted">{day.dateLabel}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {SESSIONS.map((sessionKey) => {
              const meta = SESSION_LABELS[sessionKey];
              return (
                <tr key={sessionKey}>
                  <td className="border-r border-line bg-surface-page p-4 align-top">
                    <div className="text-sm font-bold text-brand-navy">{meta.title}</div>
                    <div className="text-xs font-normal text-ink-muted">{meta.range}</div>
                  </td>
                  {weekDays.map((day) => {
                    const cellItems = (entriesByWeekday.get(day.weekday) ?? []).filter(
                      (e) => getPeriodSession(e.period_start) === sessionKey
                    );
                    const isToday = day.isoDate === todayIso;
                    return (
                      <td
                        key={day.weekday}
                        className={`border-r border-line p-2 align-top last:border-r-0 ${
                          isToday ? 'bg-brand-redSoft/30' : ''
                        }`}
                      >
                        <div className="flex min-h-[96px] flex-col gap-2">
                          {cellItems.map((item) => {
                            const linkedClassId = classIdByKey?.get(item.class_key);
                            return (
                              <div
                                key={item.id}
                                className="flex flex-col gap-2 rounded-lg border border-brand-navy/20 bg-brand-navySoft p-2 text-left"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <Badge tone="red">
                                    <PeriodLabel start={item.period_start} end={item.period_end} />
                                  </Badge>
                                  {item.room && (
                                    <span className="text-xs font-semibold text-brand-navy">
                                      {item.room}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-bold leading-snug text-ink-primary">
                                  {item.subject}
                                </p>
                                {mode === 'teacher' ? (
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Badge tone="navy">{item.class_name}</Badge>
                                    <div className="flex items-center gap-2">
                                      <Link
                                        to={`/teacher/classroom-kit?class=${encodeURIComponent(
                                          item.class_key
                                        )}`}
                                        className="inline-flex items-center gap-2 text-xs font-semibold text-brand-navy hover:underline"
                                        title="Điều phối lớp học này"
                                      >
                                        <Shuffle className="h-4 w-4" aria-hidden="true" />
                                        <span>Điều phối</span>
                                      </Link>
                                      {linkedClassId && (
                                        <Link
                                          to={`/classes/${linkedClassId}`}
                                          className="inline-flex items-center gap-2 text-xs font-semibold text-brand-red hover:underline"
                                          title="Mở lớp học"
                                        >
                                          <BookOpen className="h-4 w-4" aria-hidden="true" />
                                          <span>Lớp</span>
                                        </Link>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  item.teacher_name && (
                                    <p className="text-xs font-normal text-ink-secondary">
                                      GV: {item.teacher_name}
                                    </p>
                                  )
                                )}
                                {item.note && (
                                  <p className="text-xs font-normal text-ink-muted">{item.note}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Giao diện thẻ theo ngày thân thiện trên điện thoại */}
      <div className="flex flex-col gap-4 lg:hidden">
        {weekDays.map((day) => {
          const dayItems = entriesByWeekday.get(day.weekday) ?? [];
          if (dayItems.length === 0) return null;
          const isToday = day.isoDate === todayIso;
          return (
            <section
              key={day.weekday}
              className={`rounded-xl border bg-surface-card p-4 ${
                isToday ? 'border-brand-red' : 'border-line'
              }`}
            >
              <div className="mb-4 flex items-center justify-between border-b border-line pb-2">
                <h3
                  className={`text-base font-bold ${
                    isToday ? 'text-brand-red' : 'text-brand-navy'
                  }`}
                >
                  {day.label} ({day.dateLabel})
                </h3>
                {isToday && <Badge tone="red">Hôm nay</Badge>}
              </div>
              <div className="flex flex-col gap-2">
                {dayItems.map((item) => {
                  const linkedClassId = classIdByKey?.get(item.class_key);
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2 rounded-lg border border-line bg-surface-page p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-xs font-bold text-brand-red">
                          <Clock className="h-4 w-4" aria-hidden="true" />
                          <PeriodLabel start={item.period_start} end={item.period_end} />
                        </span>
                        {item.room && (
                          <span className="inline-flex items-center gap-2 text-xs font-semibold text-brand-navy">
                            <MapPin className="h-4 w-4" aria-hidden="true" />
                            {item.room}
                          </span>
                        )}
                      </div>
                      <p className="text-base font-bold text-ink-primary">{item.subject}</p>
                      {mode === 'teacher' ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge tone="navy">Lớp {item.class_name}</Badge>
                          <div className="flex items-center gap-4">
                            <Link
                              to={`/teacher/classroom-kit?class=${encodeURIComponent(
                                item.class_key
                              )}`}
                              className="inline-flex items-center gap-2 text-xs font-semibold text-brand-navy hover:underline"
                            >
                              <Shuffle className="h-4 w-4" aria-hidden="true" />
                              <span>Điều phối</span>
                            </Link>
                            {linkedClassId && (
                              <Link
                                to={`/classes/${linkedClassId}`}
                                className="inline-flex items-center gap-2 text-xs font-semibold text-brand-red hover:underline"
                              >
                                <BookOpen className="h-4 w-4" aria-hidden="true" />
                                <span>Vào lớp</span>
                              </Link>
                            )}
                          </div>
                        </div>
                      ) : (
                        item.teacher_name && (
                          <p className="inline-flex items-center gap-2 text-sm font-normal text-ink-secondary">
                            <UserCheck className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                            {item.teacher_name}
                          </p>
                        )
                      )}
                      {item.note && (
                        <p className="text-xs font-normal text-ink-muted">{item.note}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
