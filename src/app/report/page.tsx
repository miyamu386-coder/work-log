"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Log = {
  id: string;
  date: string; // YYYY-MM-DD
  hours: number;
};

const STORAGE_KEY = "miyamu_time_logs_v1";

/** 合計時間からモフ画像（151以上で白目） */
function getMofuImage(total: number) {
  if (total <= 50) return "/mofu-add.jpg";        // ノーマル（0–50）
  if (total <= 100) return "/mofu-sweat.png";     // 汗（51–100）
  if (total <= 150) return "/mofu-pale.png";      // 青ざめ（101–150）
  return "/mofu-exhausted.png";                   // 白目（151以上）
}

/** 合計時間から一言 */
function getMofuMessage(total: number) {
  if (total <= 50) return "ちゃんと進んでるぞ。";
  if (total <= 100) return "今月もおつかれさま。";
  if (total <= 150) return "…やりすぎじゃないか？";
  return "…無理すんなよ…。";
}

/** 震えの強さ（0=なし, 1=弱, 2=強） */
function getShakeLevel(total: number): 0 | 1 | 2 {
  if (total <= 100) return 0;   // 静か
  if (total <= 150) return 1;   // 震え
  return 2;                     // 強震
}

export default function ReportPage() {
  const router = useRouter();

  const [logs, setLogs] = useState<Log[]>([]);
  const [month, setMonth] = useState("2026-01");

  // localStorage 読み込み
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      setLogs(parsed as Log[]);
    } catch {
      // 無視
    }
  }, []);

  const monthLogs = useMemo(
    () =>
      logs
        .filter((l) => l && typeof l.date === "string" && l.date.startsWith(month))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [logs, month]
  );

  const total = useMemo(
    () => monthLogs.reduce((sum, l) => sum + (Number.isFinite(l.hours) ? l.hours : 0), 0),
    [monthLogs]
  );

  const days = monthLogs.length;
  const shakeLevel = getShakeLevel(total);

  const mofuStyle: React.CSSProperties = {
    width: 240,
    maxWidth: "70vw",
    opacity: 0.95,
    display: "block",
    margin: "0 auto",
    animation:
      shakeLevel === 0
        ? "none"
        : shakeLevel === 1
        ? "mofu-shake 0.16s infinite"
        : "mofu-shake-strong 0.12s infinite",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "#f5f6f7",
      }}
    >
      {/* 震えアニメ */}
      <style jsx global>{`
        @keyframes mofu-shake {
          0% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(-2px, 1px) rotate(-0.4deg); }
          50% { transform: translate(2px, -1px) rotate(0.4deg); }
          75% { transform: translate(-1px, -2px) rotate(-0.2deg); }
          100% { transform: translate(1px, 2px) rotate(0.2deg); }
        }
        @keyframes mofu-shake-strong {
          0% { transform: translate(0, 0) rotate(0deg); }
          20% { transform: translate(-4px, 2px) rotate(-0.8deg); }
          40% { transform: translate(4px, -2px) rotate(0.8deg); }
          60% { transform: translate(-3px, -3px) rotate(-0.6deg); }
          80% { transform: translate(3px, 3px) rotate(0.6deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      {/* 上部操作 */}
      <div className="no-print" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          ← 記録ページへ戻る
        </button>

        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc" }}
        />

        <button
          onClick={() => window.print()}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          印刷 / PDF
        </button>
      </div>

      {/* 本体 */}
      <div
        style={{
          marginTop: 20,
          background: "#fff",
          borderRadius: 16,
          padding: 28,
          border: "1px solid #ddd",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>みやむLog 月次レポート</h1>

        <div style={{ marginTop: 6, color: "#555", fontSize: 18 }}>
          対象：{month.replace("-", "年")}月　
          日数：{days}日　
          合計：<b>{total.toFixed(1)}</b>時間
        </div>

        <div style={{ marginTop: 18, textAlign: "center" }}>
          <img src={getMofuImage(total)} alt="モフ" style={mofuStyle} />
          <div style={{ marginTop: 10, fontSize: 18, fontWeight: 800 }}>
            モフ「{getMofuMessage(total)}」
          </div>
          <div style={{ marginTop: 6, color: "#777", fontSize: 13 }}>
            （0–100：静か ／ 101–150：震え ／ 151+：強震）
          </div>
        </div>

        <table
          style={{
            width: "100%",
            marginTop: 24,
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th style={th}>日付</th>
              <th style={{ ...th, textAlign: "right" }}>作業時間（時間）</th>
            </tr>
          </thead>
          <tbody>
            {monthLogs.map((l) => (
              <tr key={l.id}>
                <td style={td}>{l.date}</td>
                <td style={{ ...td, textAlign: "right" }}>{Number(l.hours).toFixed(1)}</td>
              </tr>
            ))}

            <tr>
              <td style={{ ...td, fontWeight: 800 }}>合計</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 800 }}>
                {total.toFixed(1)}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 16, fontSize: 12, color: "#888" }}>
          Generated by みやむLog
        </div>
      </div>
    </main>
  );
}

const th: React.CSSProperties = {
  borderBottom: "2px solid #ccc",
  padding: 10,
  textAlign: "left",
};

const td: React.CSSProperties = {
  borderBottom: "1px solid #ddd",
  padding: 10,
};