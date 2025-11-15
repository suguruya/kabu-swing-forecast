import { useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import "./App.css";

type IntervalOption = "daily" | "weekly" | "monthly";

type Daily = {
  Date: string;
  Close?: number;
  Open?: number;
  High?: number;
  Low?: number;
  Volume?: number;
  TurnoverValue?: number;
  interval: IntervalOption;
  ma5?: number | null;
  ma25?: number | null;
  ma75?: number | null;
  volume_ma25?: number | null;
};

function App() {
  const [code, setCode] = useState("4828");
  const [data, setData] = useState<Daily[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [timeframe, setTimeframe] = useState<IntervalOption>("daily");
  const [showMa5, setShowMa5] = useState(true);
  const [showMa25, setShowMa25] = useState(true);
  const [showMa75, setShowMa75] = useState(false);
  const [showVolume, setShowVolume] = useState(true);

  async function fetchDaily(selectedInterval: IntervalOption = timeframe) {
    if (!code.trim()) {
      setError("銘柄コードを入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const search = new URLSearchParams({
        interval: selectedInterval,
      });
      const res = await fetch(
        `http://localhost:8000/daily/${code.trim()}?${search.toString()}`
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `${res.status} ${res.statusText}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データ取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function handleTimeframeChange(next: IntervalOption) {
    setTimeframe(next);
    if (code.trim()) {
      fetchDaily(next);
    }
  }

  return (
    <>
      <h1>スイングトレード用株価予測</h1>

      <section>
        <h2>銘柄コードで直近1年の株価データを取得</h2>
        <label>
          コード
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="例: 4828"
          />
        </label>
        <button onClick={() => fetchDaily()} disabled={loading}>
          {loading ? "取得中…" : "取得する"}
        </button>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginTop: "0.5rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span>時間軸:</span>
          {(
            [
              { label: "日次", value: "daily" },
              { label: "週次", value: "weekly" },
              { label: "月次", value: "monthly" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              onClick={() => handleTimeframeChange(option.value)}
              disabled={timeframe === option.value || loading}
            >
              {option.label}
            </button>
          ))}
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        {data && (
          <div>
            <div
              style={{
                marginBottom: "0.5rem",
                display: "flex",
                gap: "0.5rem",
              }}
            >
              <button
                onClick={() => setViewMode("table")}
                disabled={viewMode === "table"}
              >
                表示（テーブル）
              </button>
              <button
                onClick={() => setViewMode("chart")}
                disabled={viewMode === "chart"}
              >
                表示（チャート）
              </button>
            </div>

            {viewMode === "table" && (
              <table>
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>始値</th>
                    <th>高値</th>
                    <th>安値</th>
                    <th>終値</th>
                    <th>出来高</th>
                    <th>MA5</th>
                    <th>MA25</th>
                    <th>MA75</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr key={item.Date}>
                      <td>{item.Date}</td>
                      <td>{item.Open ?? "-"}</td>
                      <td>{item.High ?? "-"}</td>
                      <td>{item.Low ?? "-"}</td>
                      <td>{item.Close ?? "-"}</td>
                      <td>{item.Volume ?? "-"}</td>
                      <td>{item.ma5 ?? "-"}</td>
                      <td>{item.ma25 ?? "-"}</td>
                      <td>{item.ma75 ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {viewMode === "chart" && (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    marginBottom: "0.75rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={showMa5}
                      onChange={() => setShowMa5((prev) => !prev)}
                    />{" "}
                    MA5
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={showMa25}
                      onChange={() => setShowMa25((prev) => !prev)}
                    />{" "}
                    MA25
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={showMa75}
                      onChange={() => setShowMa75((prev) => !prev)}
                    />{" "}
                    MA75
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={showVolume}
                      onChange={() => setShowVolume((prev) => !prev)}
                    />{" "}
                    出来高バー
                  </label>
                </div>
                <PriceChart
                  data={data}
                  options={{
                    ma5: showMa5,
                    ma25: showMa25,
                    ma75: showMa75,
                    showVolume,
                  }}
                />
              </>
            )}
          </div>
        )}
        {!data && !loading && !error && (
          <p>銘柄コードを入力して「取得する」を押してください。</p>
        )}
      </section>
    </>
  );
}

type ChartOptions = {
  ma5: boolean;
  ma25: boolean;
  ma75: boolean;
  showVolume: boolean;
};

type PriceChartProps = { data: Daily[]; options: ChartOptions };

const INDICATOR_COLORS: Record<"ma5" | "ma25" | "ma75", string> = {
  ma5: "#f97316",
  ma25: "#facc15",
  ma75: "#a855f7",
};

function PriceChart({ data, options }: PriceChartProps) {
  const series = data.filter((item) => typeof item.Close === "number");

  if (series.length === 0) {
    return <p>チャート描画に必要な終値データがありません。</p>;
  }

  const indicatorKeys = ["ma5", "ma25", "ma75"] as const;
  const indicatorValues = indicatorKeys
    .map((key) =>
      series
        .map((item) => item[key])
        .filter((value): value is number => typeof value === "number")
    )
    .flat();

  const closes = series.map((item) => item.Close ?? 0);
  let minPrice = Math.min(...closes);
  let maxPrice = Math.max(...closes);

  if (indicatorValues.length) {
    minPrice = Math.min(minPrice, Math.min(...indicatorValues));
    maxPrice = Math.max(maxPrice, Math.max(...indicatorValues));
  }

  const range = maxPrice - minPrice || 1;
  const chartWidth = 720;
  const chartHeight = 360;
  const horizontalTicks = 6;
  const verticalTicks = 4;
  const volumeMaxHeight = chartHeight * 0.25;
  const volumeSpace = options.showVolume ? volumeMaxHeight : 0;
  const priceHeight = chartHeight - volumeSpace;

  const valueToY = (value: number) => {
    const normalized = (value - minPrice) / range;
    return priceHeight - normalized * priceHeight;
  };

  const chartPoints = series.map((item, index) => {
    const x =
      series.length > 1
        ? (chartWidth * index) / (series.length - 1)
        : chartWidth / 2;
    const y = valueToY(item.Close ?? minPrice);
    return { x, y };
  });

  const linePath = chartPoints
    .map((point, index) =>
      index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`
    )
    .join(" ");

  const areaPath = `${linePath} L ${
    chartPoints[chartPoints.length - 1].x
  } ${priceHeight} L ${chartPoints[0].x} ${priceHeight} Z`;

  const indicatorPaths = indicatorKeys.map((key) => {
    if (!options[key]) {
      return null;
    }
    let path = "";
    let started = false;
    series.forEach((item, index) => {
      const value = item[key];
      if (typeof value !== "number") {
        started = false;
        return;
      }
      const x = chartPoints[index].x;
      const y = valueToY(value);
      path += started ? ` L ${x} ${y}` : `M ${x} ${y}`;
      started = true;
    });
    return path ? { key, path } : null;
  });

  const volumes = series.map((item) => item.Volume ?? 0);
  const maxVolume = Math.max(...volumes, 1);
  const barWidth = Math.max(2, chartWidth / series.length - 2);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const relativeX = event.clientX - left;
    if (relativeX < 0 || relativeX > width) return;
    if (chartPoints.length === 1) {
      setActiveIndex(0);
      return;
    }
    const ratio = relativeX / width;
    const index = Math.min(
      chartPoints.length - 1,
      Math.max(0, Math.round(ratio * (chartPoints.length - 1)))
    );
    setActiveIndex(index);
  }

  const activePoint =
    activeIndex !== null ? chartPoints[activeIndex] : undefined;
  const activeItem =
    activeIndex !== null ? series[activeIndex] : undefined;

  return (
    <div style={{ marginTop: "1rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
          fontWeight: "bold",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <span>高値: {maxPrice.toLocaleString()}</span>
        <span>安値: {minPrice.toLocaleString()}</span>
      </div>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        width="100%"
        height={chartHeight}
        role="img"
        aria-label="株価の終値推移"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setActiveIndex(null)}
        style={{
          background:
            "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,1) 100%)",
          borderRadius: 16,
        }}
      >
        <defs>
          <linearGradient id="chartAreaGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(56,189,248,0.35)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0)" />
          </linearGradient>
        </defs>

        {[...Array(verticalTicks + 1)].map((_, index) => {
          const y = (priceHeight / verticalTicks) * index;
          return (
            <line
              key={`h-${index}`}
              x1={0}
              x2={chartWidth}
              y1={y}
              y2={y}
              stroke="rgba(148,163,184,0.08)"
            />
          );
        })}

        {[...Array(horizontalTicks + 1)].map((_, index) => {
          const x = (chartWidth / horizontalTicks) * index;
          return (
            <line
              key={`v-${index}`}
              x1={x}
              x2={x}
              y1={0}
              y2={chartHeight}
              stroke="rgba(148,163,184,0.05)"
            />
          );
        })}

        {options.showVolume &&
          series.map((item, index) => {
            const barHeight = ((item.Volume ?? 0) / maxVolume) * volumeMaxHeight;
            const x = chartPoints[index].x - barWidth / 2;
            return (
              <rect
                key={`volume-${item.Date}`}
                x={x}
                y={chartHeight - barHeight}
                width={barWidth}
                height={barHeight}
                fill="rgba(94,234,212,0.35)"
              />
            );
          })}

        <path d={areaPath} fill="url(#chartAreaGradient)" stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={3}
          strokeLinejoin="round"
        />

        {indicatorPaths.map((pathInfo) => {
          if (!pathInfo) return null;
          return (
            <path
              key={pathInfo.key}
              d={pathInfo.path}
              fill="none"
              stroke={INDICATOR_COLORS[pathInfo.key]}
              strokeWidth={2}
              strokeDasharray={pathInfo.key === "ma75" ? "8 4" : "4 2"}
            />
          );
        })}

        {activePoint && (
          <>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={0}
              y2={chartHeight}
              stroke="rgba(56,189,248,0.5)"
              strokeDasharray="4 4"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r={6}
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth={3}
            />
          </>
        )}
      </svg>
      {activeItem ? (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            borderRadius: 12,
            background: "#0f172a",
            color: "#e2e8f0",
          }}
        >
          <strong>
            {activeItem.Date}（{activeItem.interval.toUpperCase()}）
          </strong>
          <div>終値: {activeItem.Close?.toLocaleString() ?? "-"}</div>
          <div>
            始値: {activeItem.Open?.toLocaleString() ?? "-"} / 高値:{" "}
            {activeItem.High?.toLocaleString() ?? "-"} / 安値:{" "}
            {activeItem.Low?.toLocaleString() ?? "-"}
          </div>
          <div>出来高: {activeItem.Volume?.toLocaleString() ?? "-"}</div>
          <div style={{ marginTop: "0.5rem" }}>
            {indicatorKeys.map((key) => {
              if (!options[key]) return null;
              const value = activeItem[key];
              return (
                <div key={key}>
                  {key.toUpperCase()}:{" "}
                  {typeof value === "number" ? value.toLocaleString() : "-"}
                </div>
              );
            })}
            {options.showVolume && (
              <div>
                出来高MA25:{" "}
                {typeof activeItem.volume_ma25 === "number"
                  ? activeItem.volume_ma25.toLocaleString()
                  : "-"}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p style={{ marginTop: "0.75rem", color: "#64748b" }}>
          チャートにカーソルを合わせると詳細を表示します。
        </p>
      )}
    </div>
  );
}

export default App;
