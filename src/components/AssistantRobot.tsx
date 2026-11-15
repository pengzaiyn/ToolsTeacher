interface AssistantRobotProps {
  size?: 'sm' | 'lg';
  animated?: boolean;
  facingLeft?: boolean;
  dragging?: boolean;
  speaking?: boolean;
  listening?: boolean;
}

/**
 * Biểu tượng Robot AVC Connect bằng SVG sử dụng token màu dự án, có cử động vẫy tay, bước chân, nháy mắt, ăng-ten và miệng nói chuyện.
 */
export function AssistantRobot({
  size = 'lg',
  animated = true,
  facingLeft = false,
  dragging = false,
  speaking = false,
  listening = false,
}: AssistantRobotProps) {
  const sizeClass = size === 'sm' ? 'h-8 w-8' : 'h-16 w-16';
  const beaconAnim = animated
    ? speaking || listening
      ? 'robot-beacon-fast '
      : 'robot-beacon '
    : '';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center transition-transform duration-150 ${
        dragging ? 'scale-105 drop-shadow-md' : ''
      }`}
    >
      <svg
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${sizeClass} shrink-0 overflow-visible select-none transition-transform duration-150 ${
          facingLeft ? '-scale-x-100' : ''
        }`}
        aria-hidden="true"
      >
      {/* Đổ bóng dưới chân robot */}
      {size === 'lg' && (
        <ellipse
          cx="48"
          cy="89"
          rx="20"
          ry="4.5"
          className="fill-brand-navy/20 dark:fill-ink-card/50"
        />
      )}

      <g className={animated ? 'robot-body-bob' : undefined}>
        {/* Ăng-ten phát tín hiệu trên đỉnh đầu */}
        <g className={animated ? 'robot-antenna' : undefined}>
          <line
            x1="48"
            y1="24"
            x2="48"
            y2="12"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="stroke-brand-navy dark:stroke-brand-navyText"
          />
          <circle
            cx="48"
            cy="10"
            r="6.5"
            className={`${beaconAnim}fill-brand-red/30`}
          />
          <circle cx="48" cy="10" r="4.2" className="fill-brand-red" />
        </g>

        {/* Tay trái vẫy chào */}
        <g className={animated ? 'robot-arm-wave' : undefined}>
          <rect
            x="11"
            y="43"
            width="10"
            height="21"
            rx="5"
            strokeWidth="2.5"
            className="fill-surface-bright stroke-brand-navy dark:stroke-brand-navyText"
          />
          <circle cx="16" cy="43" r="4" className="fill-brand-red" />
        </g>

        {/* Tay phải đung đưa */}
        <g className={animated ? 'robot-arm-swing' : undefined}>
          <rect
            x="75"
            y="49"
            width="10"
            height="21"
            rx="5"
            strokeWidth="2.5"
            className="fill-surface-bright stroke-brand-navy dark:stroke-brand-navyText"
          />
          <circle cx="80" cy="49" r="4" className="fill-brand-navy dark:fill-brand-navyText" />
        </g>

        {/* Hai chân robot bước luân phiên */}
        <g className={animated ? 'robot-step-left' : undefined}>
          <rect
            x="33"
            y="72"
            width="11"
            height="13"
            rx="5"
            strokeWidth="2.5"
            className="fill-surface-bright stroke-brand-navy dark:stroke-brand-navyText"
          />
          <rect x="31" y="80" width="15" height="6" rx="3" className="fill-brand-navy" />
        </g>

        <g className={animated ? 'robot-step-right' : undefined}>
          <rect
            x="52"
            y="72"
            width="11"
            height="13"
            rx="5"
            strokeWidth="2.5"
            className="fill-surface-bright stroke-brand-navy dark:stroke-brand-navyText"
          />
          <rect x="50" y="80" width="15" height="6" rx="3" className="fill-brand-navy" />
        </g>

        {/* Thân robot */}
        <rect
          x="25"
          y="50"
          width="46"
          height="26"
          rx="11"
          strokeWidth="2.8"
          className="fill-surface-bright stroke-brand-navy dark:stroke-brand-navyText"
        />
        <rect
          x="35"
          y="57"
          width="26"
          height="12"
          rx="6"
          className="fill-brand-navySoft"
        />
        <circle cx="42" cy="63" r="3" className="fill-brand-red" />
        <rect x="48" y="61" width="9" height="4" rx="2" className="fill-brand-navy" />

        {/* Sóng âm khi robot đang nói */}
        {size === 'lg' && speaking && (
          <g className="robot-voice-wave">
            <path
              d="M14 31C11 34 11 40 14 43"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="stroke-brand-red"
            />
            <path
              d="M82 31C85 34 85 40 82 43"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="stroke-brand-red"
            />
          </g>
        )}

        {/* Tai nghe hai bên đầu */}
        <rect
          x="18"
          y="30"
          width="6"
          height="14"
          rx="3"
          className={`fill-brand-red ${listening ? 'robot-ear-listen' : ''}`}
        />
        <rect
          x="72"
          y="30"
          width="6"
          height="14"
          rx="3"
          className={`fill-brand-red ${listening ? 'robot-ear-listen' : ''}`}
        />

        {/* Đầu robot */}
        <rect
          x="22"
          y="21"
          width="52"
          height="32"
          rx="14"
          strokeWidth="2.8"
          className="fill-surface-bright stroke-brand-navy dark:stroke-brand-navyText"
        />

        {/* Màn hình khuôn mặt kính tối */}
        <rect x="28" y="27" width="40" height="20" rx="9" className="fill-brand-navy" />

        {/* Hai mắt LED chớp tự nhiên */}
        <g className={animated ? 'pet-blink' : undefined}>
          <rect
            x="36"
            y="32"
            width="7"
            height="8"
            rx="3.5"
            className="fill-brand-navySoft dark:fill-brand-navyText"
          />
          <rect
            x="53"
            y="32"
            width="7"
            height="8"
            rx="3.5"
            className="fill-brand-navySoft dark:fill-brand-navyText"
          />
        </g>

        {/* Miệng biểu cảm: mở đóng khi nói, tròn khi nghe, mỉm cười khi chờ */}
        {speaking ? (
          <rect
            x="42.5"
            y="40.5"
            width="11"
            height="4.8"
            rx="2.4"
            className="robot-mouth-speak fill-brand-redSoft dark:fill-brand-redText"
          />
        ) : listening ? (
          <rect
            x="45.5"
            y="40.8"
            width="5"
            height="4"
            rx="2"
            className="fill-brand-redSoft dark:fill-brand-redText"
          />
        ) : (
          <path
            d="M44 43C46 45 50 45 52 43"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="stroke-brand-redSoft dark:stroke-brand-redText"
          />
        )}
      </g>
      </svg>
    </span>
  );
}

