import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Briefcase,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  MapPin,
  Shuffle,
  UserCheck,
} from 'lucide-react';
import {
  SESSION_LABELS,
  formatDateVi,
  getEntrySession,
  getEntryTimeStatus,
  type DaySession,
  type EntryTimeStatus,
  type WeekDayInfo,
  type WeekExamNotice,
} from '@/lib/week';
import type { TimetableEntry } from '@/types/database';
import { Badge } from '@/components/ui/Badge';

const SESSIONS: DaySession[] = ['morning', 'afternoon', 'evening'];

function LessonStatusPill({ status }: { status: EntryTimeStatus }) {
  if (status === 'ongoing') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-status-successBorder bg-status-successBg px-2 py-0.5 text-[11px] font-bold text-status-successText">
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-successText"
          aria-hidden="true"
        />
        <span>Đang học</span>
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        <span>Đã học</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand-navy/20 bg-surface-card px-2 py-0.5 text-[11px] font-semibold text-brand-navy">
      <Clock className="h-3 w-3" aria-hidden="true" />
      <span>Chưa học</span>
    </span>
  );
}

interface TimetableWeekViewProps {
  weekDays: WeekDayInfo[];
  entriesByWeekday: Map<number, TimetableEntry[]>;
  todayIso: string;
  mode: 'class' | 'teacher';
  classIdByKey?: ReadonlyMap<string, string>;
  activeInternships?: readonly TimetableEntry[];
  examsInWeek?: readonly WeekExamNotice[];
}

function SessionTimeLabel({ item }: { item: TimetableEntry }) {
  if (item.time_range) {
    return <>{item.time_range}</>;
  }
  return (
    <>
      Tiết {item.period_start}
      {item.period_end > item.period_start ? `–${item.period_end}` : ''}
    </>
  );
}

export function TimetableWeekView({
  weekDays,
  entriesByWeekday,
  todayIso,
  mode,
  classIdByKey,
  activeInternships = [],
  examsInWeek = [],
}: TimetableWeekViewProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Lịch thi dự kiến & Đợt thực tập đang diễn ra trong tuần */}
      {(examsInWeek.length > 0 || activeInternships.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {examsInWeek.length > 0 && (
            <section className="flex flex-col gap-3 rounded-xl border border-brand-red/30 bg-brand-redSoft/40 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-brand-red">
                <CalendarCheck2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Lịch thi dự kiến trong tuần ({examsInWeek.length})</span>
              </div>
              <div className="flex flex-col gap-2">
                {examsInWeek.map((exam) => (
                  <div
                    key={exam.key}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-red/20 bg-surface-card px-3 py-2 text-xs"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-ink-primary">{exam.subject}</span>
                      <span className="text-ink-secondary">
                        {mode === 'teacher' ? `Lớp ${exam.className}` : ''}
                        {mode === 'teacher' && exam.room ? ' • ' : ''}
                        {exam.room ? `Phòng ${exam.room}` : ''}
                        {exam.teacherName && mode === 'class' ? `GV: ${exam.teacherName}` : ''}
                      </span>
                    </div>
                    <Badge tone="red">Thi: {formatDateVi(exam.examDate)}</Badge>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeInternships.length > 0 && (
            <section className="flex flex-col gap-3 rounded-xl border border-brand-navy/25 bg-brand-navySoft/50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-brand-navy">
                <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Đợt thực tập đang diễn ra ({activeInternships.length})</span>
              </div>
              <div className="flex flex-col gap-2">
                {activeInternships.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-navy/15 bg-surface-card px-3 py-2 text-xs"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-ink-primary">{item.subject}</span>
                        {item.semester && <Badge tone="navy">{item.semester}</Badge>}
                      </div>
                      <span className="text-ink-secondary">
                        {item.room ? `Địa điểm: ${item.room}` : 'Theo kế hoạch khoa / doanh nghiệp'}
                        {item.teacher_name ? ` • GVHD: ${item.teacher_name}` : ''}
                      </span>
                    </div>
                    <span className="whitespace-nowrap font-semibold text-brand-navy">
                      {item.date_from ? formatDateVi(item.date_from) : '...'} –{' '}
                      {item.date_to ? formatDateVi(item.date_to) : '...'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Giao diện lưới theo buổi cho màn hình từ tablet/desktop trở lên */}
      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface-card lg:block">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-subtle">
              <th className="w-36 border-r border-line p-4 text-left text-xs font-bold uppercase text-ink-secondary">
                Buổi / Giờ học
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
                      (e) => getEntrySession(e) === sessionKey
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
                            const timeStatus = getEntryTimeStatus(item, day.isoDate, now);
                            const cardToneClass =
                              timeStatus === 'ongoing'
                                ? 'border-status-successBorder bg-status-successBg/60 ring-1 ring-status-successBorder'
                                : timeStatus === 'completed'
                                  ? 'border-line bg-surface-page/80 opacity-85'
                                  : 'border-brand-navy/20 bg-brand-navySoft';
                            return (
                              <div
                                key={item.id}
                                className={`flex flex-col gap-2 rounded-lg border p-2 text-left transition-colors ${cardToneClass}`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <Badge tone="red">
                                    <SessionTimeLabel item={item} />
                                  </Badge>
                                  {item.room && (
                                    <span className="text-xs font-semibold text-brand-navy">
                                      P.{item.room}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <LessonStatusPill status={timeStatus} />
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
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-navy hover:underline"
                                        title="Điều phối lớp học này"
                                      >
                                        <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                                        <span>Điều phối</span>
                                      </Link>
                                      {linkedClassId && (
                                        <Link
                                          to={`/classes/${linkedClassId}`}
                                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline"
                                          title="Mở lớp học"
                                        >
                                          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
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
                                {(item.semester || item.exam_date) && (
                                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-ink-muted">
                                    {item.semester && (
                                      <span className="rounded bg-surface-card px-1.5 py-0.5 font-semibold text-brand-navy">
                                        {item.semester}
                                      </span>
                                    )}
                                    {item.exam_date && (
                                      <span>Thi: {formatDateVi(item.exam_date)}</span>
                                    )}
                                  </div>
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
                  const timeStatus = getEntryTimeStatus(item, day.isoDate, now);
                  const mobileCardTone =
                    timeStatus === 'ongoing'
                      ? 'border-status-successBorder bg-status-successBg/50 ring-1 ring-status-successBorder'
                      : timeStatus === 'completed'
                        ? 'border-line bg-surface-page/70 opacity-85'
                        : 'border-line bg-surface-page';
                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col gap-2 rounded-lg border p-4 ${mobileCardTone}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-2 text-xs font-bold text-brand-red">
                            <Clock className="h-4 w-4" aria-hidden="true" />
                            <SessionTimeLabel item={item} />
                          </span>
                          <LessonStatusPill status={timeStatus} />
                        </div>
                        <div className="flex items-center gap-2">
                          {item.semester && <Badge tone="navy">{item.semester}</Badge>}
                          {item.room && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-navy">
                              <MapPin className="h-4 w-4" aria-hidden="true" />
                              {item.room}
                            </span>
                          )}
                        </div>
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
                      {item.exam_date && (
                        <p className="text-xs font-semibold text-brand-red">
                          Dự kiến thi: {formatDateVi(item.exam_date)}
                        </p>
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
    </div>
  );
}
