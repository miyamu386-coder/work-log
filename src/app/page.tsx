"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Log = {
  id: string;
  date: string; // YYYY-MM-DD
  hours: number;
};

const STORAGE_KEY_BASE = "miyamu_time_logs_v1";

/** YYYY-MM-DD から YYYY-MM を作る */
function ymFromISO(dateISO: string): string {
  return dateISO.slice(0, 7);
}

/** 今日の YYYY-MM-DD */
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
}

function toSlashDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[1]}/${m[2]}/${m[3]}`;
}

/** 全角→半角など「数値入力としてありがちな文字」を正規化 */
function normalizeNumberString(raw: string): string {
  return raw
    .trim()
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, ".")
    .replace(/[，、]/g, ".")
    .replace(/[－]/g, "-")
    .replace(/[\s　]/g, "");
}

function parseHours(raw: string): number {
  const t = normalizeNumberString(raw);
  if (!t) return Number.NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

function uid(): string {
  // @ts-ignore
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Page() {
  // 日付は自由に選択（過去月OK）
  const [dateISO, setDateISO] = useState<string>(todayISO());

  const ym = useMemo(() => ymFromISO(dateISO), [dateISO]);
  const storageKey = useMemo(() => `${STORAGE_KEY_BASE}_${ym}`, [ym]);

  const [hoursInput, setHoursInput] = useState<string>("");

  // その月のログだけを state として持つ（=月を跨ぐと入れ替わる）
  const [logs, setLogs] = useState<Log[]>([]);

  // 編集
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHoursInput, setEditHoursInput] = useState<string>("");

  // 初回ロード完了フラグ（キーごとに管理）
  const hasLoadedForKeyRef = useRef<string | null>(null);

  // 瞬き
  const [isBlink, setIsBlink] = useState(false);

  // 追加完了トースト
  const [justAdded, setJustAdded] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI
  const hoursRef = useRef<HTMLInputElement | null>(null);
  const [isMofuHover, setIsMofuHover] = useState(false);

  /* 月キーが変わったら、その月のデータを読み込む */
  useEffect(() => {
    // キーが変わるたびロード扱いにする
    hasLoadedForKeyRef.current = null;
    setEditingId(null);
    setEditHoursInput("");

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setLogs([]);
        hasLoadedForKeyRef.current = storageKey;
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setLogs([]);
        hasLoadedForKeyRef.current = storageKey;
        return;
      }
      setLogs(parsed as Log[]);
    } catch {
      setLogs([]);
    } finally {
      hasLoadedForKeyRef.current = storageKey;
    }
  }, [storageKey]);

  /* 保存：現在の月キーに保存（ロード完了後のみ） */
  useEffect(() => {
    if (hasLoadedForKeyRef.current !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(logs));
    } catch {
      // ignore
    }
  }, [logs, storageKey]);

  /* 合計（選択中の月だけ） */
  const total = useMemo(() => logs.reduce((sum, l) => sum + l.hours, 0), [logs]);

  /* 入力中プレビュー */
  const inputPreviewHours = useMemo(() => {
    if (!hoursInput.trim()) return 0;
    const n = parseHours(hoursInput);
    return Number.isFinite(n) ? n : 0;
  }, [hoursInput]);

  /* 追加できるか */
  const canAdd = useMemo(() => {
    const h = parseHours(hoursInput);
    return !!dateISO && Number.isFinite(h) && h > 0;
  }, [hoursInput, dateISO]);

  /* 瞬きタイマー */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      const next = 2500 + Math.random() * 3500; // 2.5〜6秒
      timer = setTimeout(() => {
        setIsBlink(true);
        setTimeout(() => setIsBlink(false), 150);
        schedule();
      }, next);
    };

    schedule();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  /* トースト掃除 */
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  /* 追加 */
  const addLog = () => {
    const h = parseHours(hoursInput);
    if (!Number.isFinite(h) || h <= 0) return;

    // dateISO の月に保存される（storageKeyがym由来なので）
    const next: Log = { id: uid(), date: dateISO, hours: h };

    setLogs((prev) => {
      const merged = [next, ...prev];
      merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      return merged;
    });

    setHoursInput("");
    requestAnimationFrame(() => hoursRef.current?.focus());

    setJustAdded(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setJustAdded(false), 1800);
  };

  /* 編集開始 */
  const startEdit = (log: Log) => {
    setEditingId(log.id);
    setEditHoursInput(String(log.hours));
  };

  /* 編集キャンセル */
  const cancelEdit = () => {
    setEditingId(null);
    setEditHoursInput("");
  };

  /* 編集保存 */
  const saveEdit = (id: string) => {
    const n = parseHours(editHoursInput);
    if (!Number.isFinite(n) || n <= 0) return;

    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, hours: n } : l)));
    cancelEdit();
  };

  /* 削除 */
  const removeLog = (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    if (editingId === id) cancelEdit();
  };

  /* この月を全消去 */
  const clearAll = () => {
    setLogs([]);
    cancelEdit();
  };

  const mofuButtonImg = isBlink ? "/mofu-blink.png" : "/mofu-add.jpg";

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
      {/* 追加完了！アニメ */}
      <style jsx global>{`
        @keyframes fadeUp {
          0% { opacity: 0; transform: translate(-50%, 10px); }
          15% { opacity: 1; transform: translate(-50%, 0px); }
          100% { opacity: 0; transform: translate(-50%, -12px); }
        }
      `}</style>

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
        <h1 style={{ fontSize: 34, margin: 0, textAlign: "center" }}>
          みやむの数値管理アプリ
        </h1>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <Link
            href="/report"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,.15)",
              background: "#fff",
              textDecoration: "none",
              fontWeight: 800,
              boxShadow: "0 6px 16px rgba(0,0,0,.08)",
            }}
          >
            📊 月次レポートを見る
          </Link>
        </div>

        <div style={{ marginTop: 10, textAlign: "center", color: "#666", fontSize: 14 }}>
          対象月：{monthLabel(ym)}（この月に保存されます）
        </div>

        <div style={{ marginTop: 8, textAlign: "center", fontSize: 20 }}>
          <span style={{ color: "#666" }}>合計：</span>
          <b>{total.toFixed(1)}</b>
          <span style={{ marginLeft: 6 }}>時間</span>
        </div>

        {/* ✅ 日付選択（過去月OK / 選んだ月に保存先が切り替わる） */}
        <label style={{ display: "block", fontSize: 16, marginTop: 18, marginBottom: 10 }}>
          日付
        </label>

        <input
          type="date"
          value={dateISO}
          onChange={(e) => setDateISO(e.target.value)}
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

        {/* ✅ 記録するボタン＝モフ */}
        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            onClick={addLog}
            disabled={!canAdd}
            aria-label="記録する"
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 16,
              border: "2px solid #333",
              background: "#fff",
              cursor: canAdd ? "pointer" : "not-allowed",
              opacity: canAdd ? 1 : 0.4,
            }}
          >
            <div style={{ position: "relative", textAlign: "center" }}>
              <img
                src={mofuButtonImg}
                alt="記録する"
                onMouseEnter={() => setIsMofuHover(true)}
                onMouseLeave={() => setIsMofuHover(false)}
                style={{
                  width: isMofuHover ? 240 : 220,
                  height: isMofuHover ? 240 : 220,
                  objectFit: "contain",
                  display: "block",
                  margin: "0 auto",
                  transition: "all 0.15s ease",
                }}
              />

              {justAdded && (
                <div
                  style={{
                    position: "absolute",
                    top: "-6px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.75)",
                    color: "#fff",
                    padding: "6px 10px",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 800,
                    pointerEvents: "none",
                    animation: "fadeUp 1.8s ease-out",
                    whiteSpace: "nowrap",
                  }}
                >
                  追加完了！
                </div>
              )}
            </div>
          </button>
        </div>

        <div style={{ marginTop: 10, color: "#888", fontSize: 14 }}>
          ※保存はローカルストレージ（月ごとに自動で分かれます）
        </div>

        {/* ✅ 記録一覧（修正・消去） */}
        <div style={{ marginTop: 28, fontSize: 18, fontWeight: 800 }}>
          記録一覧（{monthLabel(ym)}）
        </div>

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
                    <div style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 10 }}>
                      <span aria-hidden="true">📅</span>
                      <b>{toSlashDate(log.date)}</b>
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
                          <b>{log.hours.toFixed(1)}</b> 時間
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
                            fontWeight: 700,
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
                            fontWeight: 700,
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
                            fontWeight: 800,
                          }}
                        >
                          修正
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
                            fontWeight: 800,
                          }}
                        >
                          消去
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
            fontWeight: 800,
          }}
        >
          この月の記録を全部消去
        </button>
      </div>
    </main>
  );
}