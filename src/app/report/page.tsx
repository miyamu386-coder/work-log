"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Log = {
  id: string;
  date: string; // YYYY-MM-DD
  hours: number;
};

const STORAGE_KEY_BASE = "miyamu_time_logs_v1";

/** localStorage のキーから「YYYY-MM」を取り出す */
function extractYmFromKey(key: string): string | null {
  // 例: miyamu_time_logs_v1_2026-02
  const prefix = `${STORAGE_KEY_BASE}_`;
  if (!key.startsWith(prefix)) return null;
  const ym = key.slice(prefix.length);
  return /^\d{4}-\d{2}$/.test(ym) ? ym : null;
}

/** みやむLogに存在する月一覧を取得（降順） */
function getAvailableMonths(): string[] {
  const months: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    const ym = extractYmFromKey(k);
    if (ym) months.push(ym);
  }
  // 新しい月が上
  months.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  return months;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
}

function getStorageKey(ym: string): string {
  return `${STORAGE_KEY_BASE}_${ym}`;
}

/** 合計時間からモフ画像（151以上で白目） */
function getMofuImage(total: number) {
  if (total <= 50) return "/mofu-add.jpg";        // ノーマル
  if (total <= 100) return "/mofu-sweat.png";     // 汗
  if (total <= 150) return "/mofu-pale.png";      // 青ざめ
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

  const [months, setMonths] = useState<string[]>([]);
  const [selectedYm, setSelectedYm] = useState<string>(""); // "2026-02"
  const [logs, setLogs] = useState<Log[]>([]);

  // 初回：月一覧読み込み & 初期月を決める
  useEffect(() => {
    const ms = getAvailableMonths();
    setMonths(ms);

    // まずは「最新月」を表示（なければ今月）
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const initial = ms[0] ?? currentYm;
    setSelectedYm(initial);
  }, []);

  // 選んだ月のデータを読む
  useEffect(() => {
    if (!selectedYm) return;

    try {
      const key = getStorageKey(selectedYm);
      const raw = localStorage.getItem(key);
      if (!raw) {
        setLogs([]);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setLogs([]);
        return;
      }
      setLogs(parsed as Log[]);
    } catch {
      setLogs([]);
    }
  }, [selectedYm]);

  const monthLogs = useMemo(() => {
    // 念のため date の月でもフィルタ（キーは月別だが保険）
    return logs
      .filter((l) => l && typeof l.date === "string" && l.date.startsWith(selectedYm))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [logs, selectedYm]);

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
    <main style={{ minHeight: "100vh", padding: 24, background: "#f5f6f7" }}>
      {/* 震えアニメ + 印刷で操作バー隠す */}
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

        {/* 月選択：保存済み月があれば一覧、なければ入力可 */}
        {months.length > 0 ? (
          <select
            value={selectedYm}
            onChange={(e) => setSelectedYm(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#fff",
            }}
          >
            {months.map((ym) => (
              <option key={ym} value={ym}>
                {monthLabel(ym)}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="month"
            value={selectedYm}
            onChange={(e) => setSelectedYm(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#fff",
            }}
          />
        )}

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
          対象：{selectedYm ? monthLabel(selectedYm) : "-"}　
          日数：{days}日　
          合計：<b>{total.toFixed(1)}</b>時間
        </div>

        {/* モフ */}
        <div style={{ marginTop: 18, textAlign: "center" }}>
          <img src={getMofuImage(total)} alt="モフ" style={mofuStyle} />
          <div style={{ marginTop: 10, fontSize: 18, fontWeight: 800 }}>
            モフ「{getMofuMessage(total)}」
          </div>
          <div style={{ marginTop: 6, color: "#777", fontSize: 13 }}>
            （0–100：静か ／ 101–150：震え ／ 151+：強震）
          </div>
        </div>

        {/* テーブル */}
        <table style={{ width: "100%", marginTop: 24, borderCollapse: "collapse" }}>
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