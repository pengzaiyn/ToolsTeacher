// Lucian UX/UI Prompt #252 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#252
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Megaphone } from 'lucide-react';
import { getAnnouncementAudienceMeta } from '@/lib/announcements';
import { quickClassifyAnnouncement } from '@/lib/announcementClassifier';
import type { Announcement } from '@/types/database';
import { Badge } from '@/components/ui/Badge';
import './lucian-252.css';

interface SchoolAnnouncementPillProps {
  announcements: Announcement[];
  currentUserId: string | null;
  manageHref?: string;
}

function formatShortDayMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

export function SchoolAnnouncementPill({
  announcements,
  currentUserId,
  manageHref,
}: SchoolAnnouncementPillProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [shining, setShining] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  const latestItems = useMemo(() => announcements.slice(0, 5), [announcements]);
  const headlines = useMemo(() => latestItems.map((a) => a.title), [latestItems]);
  const rollingHeadlines = useMemo(
    () => (headlines.length > 1 ? [...headlines, headlines[0]] : headlines),
    [headlines]
  );

  useEffect(() => {
    const root = rootRef.current;
    const rs = railRef.current;
    if (!root || !rs || headlines.length === 0) return;

    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let k = 0;
    let vis = true;
    let tickTimer: number | undefined;
    let resetTimer: number | undefined;
    let shineTimer: number | undefined;

    rs.style.transition = 'none';
    rs.style.transform = 'translateY(0)';

    const observer =
      'IntersectionObserver' in window
        ? new IntersectionObserver((entries) => {
            vis = entries[0]?.isIntersecting ?? true;
          })
        : null;
    observer?.observe(root);

    const triggerShine = () => {
      setShining(false);
      window.clearTimeout(shineTimer);
      shineTimer = window.setTimeout(() => {
        setShining(true);
      }, 20);
    };

    const tick = () => {
      if (!root.isConnected) return;
      tickTimer = window.setTimeout(tick, 4000);
      if (openRef.current || !vis || rm) return;

      triggerShine();

      if (headlines.length > 1) {
        k += 1;
        rs.style.transition = '';
        rs.style.transform = `translateY(${-22 * k}px)`;
        if (k === headlines.length) {
          resetTimer = window.setTimeout(() => {
            if (!rs.isConnected) return;
            rs.style.transition = 'none';
            k = 0;
            rs.style.transform = 'translateY(0)';
          }, 560);
        }
      }
    };

    tickTimer = window.setTimeout(tick, 1600);

    return () => {
      window.clearTimeout(tickTimer);
      window.clearTimeout(resetTimer);
      window.clearTimeout(shineTimer);
      observer?.disconnect();
    };
  }, [headlines]);

  // Khi bấm mở rộng, tự động cuộn mượt để hiển thị trọn vẹn phần thông báo xổ xuống
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = rm ? 'auto' : 'smooth';

    const scrollPanelIntoView = () => {
      const rect = panel.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 16) {
        panel.scrollIntoView({ behavior, block: 'end' });
      }
    };

    const t1 = window.setTimeout(scrollPanelIntoView, 160);
    const t2 = window.setTimeout(scrollPanelIntoView, 470);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open]);

  if (latestItems.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className={`ux u252 ${open ? 'is-open' : ''} ${shining ? 'is-shine' : ''}`}
    >
      <div className="u252-wr">
        <button
          type="button"
          className="u252-pl"
          aria-expanded={open}
          aria-label={`Thông báo mới: ${latestItems[0].title} · Nhấn để ${open ? 'thu gọn' : 'mở rộng'}`}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="u252-tg">
            <Megaphone className="h-3 w-3" aria-hidden="true" />
            <span>Mới</span>
          </span>

          <span className="u252-rl">
            <span ref={railRef} className="u252-rs">
              {rollingHeadlines.map((title, idx) => (
                <span key={`${idx}-${title}`} className="u252-rs-item">
                  {title}
                </span>
              ))}
            </span>
          </span>

          <span className="u252-hint">
            {open ? 'Thu gọn' : `${latestItems.length} tin mới`}
          </span>

          <ArrowRight className="u252-ar" aria-hidden="true" />
        </button>

        <div ref={panelRef} className="u252-pn" aria-hidden={!open}>
          <div className="u252-pn-head">
            <span>Cập nhật mới nhất từ nhà trường</span>
            {manageHref && (
              <Link to={manageHref} className="u252-pn-link" tabIndex={open ? 0 : -1}>
                Quản lý thông báo
              </Link>
            )}
          </div>

          {latestItems.map((item, idx) => {
            const audience = getAnnouncementAudienceMeta(item, { currentUserId });
            const isWarning = quickClassifyAnnouncement(item.title, item.content) === 'warning';
            return (
              <div
                key={item.id}
                className="u252-it"
                style={{ transitionDelay: `${0.08 + idx * 0.07}s` }}
              >
                <time dateTime={item.created_at}>{formatShortDayMonth(item.created_at)}</time>
                <div>
                  <div className="u252-it-title">
                    <Badge tone={audience.tone}>{audience.label}</Badge>
                    {isWarning && (
                      <Badge tone="danger" className="gap-1">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        <span>Cảnh báo</span>
                      </Badge>
                    )}
                    <span>{item.title}</span>
                  </div>
                  {item.content && <span className="u252-it-body">{item.content}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

