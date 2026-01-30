"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Log = {
  id: string;
  date: string; // YYYY-MM-DD
  hours: number;
};

const STORAGE_KEY = "miyamu_time_logs_v1";

/** 全角→半角など「数値入力としてありがちな文字」を正規化 */
function normalizeNumberString(raw: string): string {
  return raw
    .trim()
    // 全角数字→半角数字
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    // 小数点の揺れ
    .replace(/[．。]/g, ".")
    .replace(/[，、]/g, ".")
    // マイナスの揺れ（基本使わない想定だけど安全のため）
    .replace(/[－]/g, "-")
    // 全角/半角スペース除去
    .replace(/[\s　]/g, "");
}

function parseHours(raw: string): number {
  const t = normalizeNumberString(raw);
  if (!t) return Number.NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** 入力：YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD → ISO(YYYY-MM-DD) */
function toISODate(input: string): string {
  const s = input.trim().replace(/\./g, "/").replace(/-/g, "/");
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return "";
  if (mo < 1 || mo > 12) return "";
  if (d < 1 || d > 31) return "";
  const mm = String(mo).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function toSlashDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[1]}/${m[2]}/${m[3]}`;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Page() {
  const [dateInput, setDateInput] = useState<string>("2026/01/01");
  const [hoursInput, setHoursInput] = useState<string>("");

  const [logs, setLogs] = useState<Log[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHoursInput, setEditHoursInput] = useState<string>("");

  const hoursRef = useRef<HTMLInputElement | null>(null);

  // 初回ロード：localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;

      const safe: Log[] = parsed
        .filter(
          (x: any) =>
            x &&
            typeof x.id === "string" &&
            typeof x.date === "string" &&
            typeof x.hours === "number" &&
            Number.isFinite(x.hours)
        )
        .map((x: any) => ({ id: x.id, date: x.date, hours: x.hours }));

      setLogs(safe);
    } catch {
      // 破損データ等は無視
    }
  }, []);

  // 変更保存：localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch {
      // ストレージ制限などは無視
    }
  }, [logs]);

  const total = useMemo(() => logs.reduce((sum, l) => sum + l.hours, 0), [logs]);

  const inputPreviewHours = useMemo(() => {
    if (!hoursInput.trim()) return 0;
    const n = parseHours(hoursInput);
    return Number.isFinite(n) ? n : 0;
  }, [hoursInput]);

  const canAdd = useMemo(() => {
    const iso = toISODate(dateInput);
    const n = parseHours(hoursInput);
    return !!iso && Number.isFinite(n) && n > 0;
  }, [dateInput, hoursInput]);

  const handleAdd = () => {
    const iso = toISODate(dateInput);
    const n = parseHours(hoursInput);

    if (!iso) return;
    if (!Number.isFinite(n) || n <= 0) return;

    const next: Log = {
      id: uid(),
      date: iso,
      hours: n,
    };

    setLogs((prev) => {
      const merged = [next, ...prev];
      // 日付の降順
      merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      return merged;
    });

    setHoursInput("");
    requestAnimationFrame(() => hoursRef.current?.focus());
  };

  const startEdit = (log: Log) => {
    setEditingId(log.id);
    setEditHoursInput(String(log.hours));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditHoursInput("");
  };

  const saveEdit = (id: string) => {
    const n = parseHours(editHoursInput);
    if (!Number.isFinite(n) || n <= 0) return;

    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, hours: n } : l)));
    cancelEdit();
  };

  const removeLog = (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    if (editingId === id) cancelEdit();
  };

  const clearAll = () => {
    setLogs([]);
    cancelEdit();
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        display: "flex",
        justifyContent: "center",
        background: "#f5f6f7",
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          background: "#fff",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          border: "1px solid #eee",
        }}
      >
        <h1 style={{ fontSize: 34, margin: 0, textAlign: "center" }}>みやむの数値管理アプリ（試作）</h1>

        <div style={{ marginTop: 14, textAlign: "center", fontSize: 20 }}>
          <span style={{ color: "#666" }}>合計：</span>
          <b>{total}</b>
          <span style={{ marginLeft: 6 }}>時間</span>
        </div>

        {/* ここが肝：Enterでもクリックでも必ず動作（submit + preventDefault） */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
          style={{ marginTop: 28 }}
        >
          <label style={{ display: "block", fontSize: 16, marginBottom: 10 }}>日付</label>
          <input
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            placeholder="例：2026/01/01"
            inputMode="numeric"
            style={{
              width: "100%",
              padding: "14px 16px",
              fontSize: 22,
              borderRadius: 10,
              border: "2px solid #333",
              outline: "none",
            }}
          />

          <label style={{ display: "block", fontSize: 16, marginTop: 18, marginBottom: 10 }}>
            作業時間（時間）
          </label>
          <input
            ref={hoursRef}
            value={hoursInput}
            onChange={(e) => setHoursInput(normalizeNumberString(e.target.value))}
            placeholder="例：5 / 2.5"
            inputMode="decimal"
            style={{
              width: "100%",
              padding: "14px 16px",
              fontSize: 22,
              borderRadius: 10,
              border: "2px solid #333",
              outline: "none",
            }}
          />

          <div style={{ marginTop: 12, color: "#666", fontSize: 18 }}>
            入力中：{inputPreviewHours} 時間
          </div>

          <button
            type="submit"
            disabled={!canAdd}
            style={{
              width: "100%",
              marginTop: 18,
              padding: "16px 16px",
              fontSize: 22,
              borderRadius: 10,
              border: "none",
              background: canAdd ? "#1f66ff" : "#9db7ff",
              color: "#fff",
              cursor: canAdd ? "pointer" : "not-allowed",
            }}
          >
            追加
          </button>
        </form>

        <div style={{ marginTop: 28, fontSize: 18, fontWeight: 700 }}>記録一覧</div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {logs.length === 0 ? (
            <div style={{ color: "#666" }}>まだ記録がありません</div>
          ) : (
            logs.map((log) => {
              const isEditing = editingId === log.id;

              return (
                <div
                  key={log.id}
                  style={{
                    border: "2px solid #333",
                    borderRadius: 12,
                    padding: 14,
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 20, display: "flex", alignItems: "center", gap: 10 }}>
                      <span aria-hidden="true">📅</span>
                      <b>{log.date}</b>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 18, color: "#333" }}>
                      ・{" "}
                      {isEditing ? (
                        <input
                          value={editHoursInput}
                          onChange={(e) => setEditHoursInput(normalizeNumberString(e.target.value))}
                          inputMode="decimal"
                          style={{
                            width: 140,
                            padding: "6px 8px",
                            fontSize: 18,
                            borderRadius: 8,
                            border: "2px solid #333",
                          }}
                        />
                      ) : (
                        <span>
                          <b>{log.hours}</b> 時間
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: 10, fontSize: 16, color: "#666" }}>
                      （入力表示：{toSlashDate(log.date)}）
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(log.id)}
                          style={{
                            border: "none",
                            background: "#1f66ff",
                            color: "#fff",
                            padding: "8px 12px",
                            borderRadius: 10,
                            cursor: "pointer",
                            fontSize: 16,
                          }}
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          style={{
                            border: "2px solid #333",
                            background: "#fff",
                            color: "#333",
                            padding: "8px 12px",
                            borderRadius: 10,
                            cursor: "pointer",
                            fontSize: 16,
                          }}
                        >
                          キャンセル
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(log)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#1f66ff",
                            cursor: "pointer",
                            fontSize: 18,
                          }}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLog(log.id)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#ff2d2d",
                            cursor: "pointer",
                            fontSize: 18,
                          }}
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={clearAll}
          style={{
            width: "100%",
            marginTop: 18,
            padding: "14px 16px",
            fontSize: 18,
            borderRadius: 10,
            border: "2px solid #333",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          記録をクリア
        </button>

        <div style={{ marginTop: 10, color: "#888", fontSize: 14 }}>
          ※保存はブラウザのローカルストレージです（同じ端末・同じブラウザで保持）
        </div>
      </div>
    </main>
  );
}

