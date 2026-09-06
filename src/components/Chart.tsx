interface HBarDatum {
  label: string;
  value: number;
}

export function HorizontalBarChart({ data, max }: { data: HBarDatum[]; max?: number }) {
  const maxVal = max ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="hbar-chart">
      {data.map((d) => (
        <div className="hbar-row" key={d.label}>
          <div className="hbar-row-top">
            <span className="hbar-row-name">{d.label}</span>
            <span className="text-secondary">{d.value}%</span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(100, (d.value / maxVal) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface DonutDatum {
  label: string;
  value: number;
  color: string; // css var e.g. var(--color-blue)
}

export function DonutChart({ data, size = 140 }: { data: DonutDatum[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = size / 2;
  const stroke = size * 0.22;
  const innerRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * innerRadius;

  let offsetAcc = 0;
  const segments = data.map((d) => {
    const fraction = total > 0 ? d.value / total : 0;
    const dash = fraction * circumference;
    const seg = {
      ...d,
      dashArray: `${dash} ${circumference - dash}`,
      dashOffset: -offsetAcc,
    };
    offsetAcc += dash;
    return seg;
  });

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${radius} ${radius})`}>
          {total === 0 ? (
            <circle
              cx={radius}
              cy={radius}
              r={innerRadius}
              fill="none"
              stroke="var(--color-gray-200)"
              strokeWidth={stroke}
            />
          ) : (
            segments.map((seg) => (
              <circle
                key={seg.label}
                cx={radius}
                cy={radius}
                r={innerRadius}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={seg.dashArray}
                strokeDashoffset={seg.dashOffset}
                strokeLinecap="butt"
              />
            ))
          )}
        </g>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="20"
          fontWeight="600"
          fill="var(--color-text)"
        >
          {total}
        </text>
      </svg>
      <div className="donut-legend">
        {data.map((d) => (
          <div className="donut-legend-item" key={d.label}>
            <span className="donut-legend-swatch" style={{ background: d.color }} />
            <span>{d.label}</span>
            <span className="text-muted">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
