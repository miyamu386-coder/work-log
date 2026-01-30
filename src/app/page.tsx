"use client";

import { useMemo, useState } from "react";

type Log = {
  id: string;
  date: string;  // "YYYY-MM-DD"
  hours: number; // 作業時間
};

function todayYYYYMMDD() {
  return new Date().toISOString().slice(0, 10);
}

export default function Home() {
  // 入力：日付 / 時間
  const [selectedDate, setSelectedDate] = useState<string>(todayYYYYMMDD());
  const [xcreamHours, setXcreamHours] = useState<number | "">("");

  // ログ
  const [logs, setLogs] = useState<Log[]>([]);

  // 編集状態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<number | "">("");

  // 全体合計
  const total = useMemo(
    () => logs.reduce((sum, v) => sum + v.hours, 0),
    [logs]
  );

  // 日付ごとにグループ化（表示用）
  const groupedLogs = useMemo(() => {
    const acc: Record<string, Log[]> = {};
    for (const log of logs) {
      if (!log?.date) continue;
      const h = Number(log.hours);
      if (!Number.isFinite(h) || h === 0) continue;

      if (!acc[log.date]) acc[log.date] = [];
      acc[log.date].push(log);
    }
    return acc;
  }, [logs]);

  // 日付は新しい順に並べる
  const groupedEntries = useMemo(() => {
    return Object.entries(groupedLogs).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [groupedLogs]);

  const addLog = () => {
    if (xcreamHours === "" || xcreamHours === 0) return;

    const date = selectedDate || todayYYYYMMDD();
    const hours = Number(xcreamHours);
    if (!Number.isFinite(hours) || hours === 0) return;

    const id = crypto.randomUUID();
    // 最新を上に
    setLogs((prev) => [{ id, date, hours }, ...prev]);

    // 日付は残して時間だけ消す（連続入力が楽）
    setXcreamHours("");
  };

  const removeLog = (id: string) => {
    // 編集中の行を消した場合の後処理
    if (editingId === id) {
      setEditingId(null);
      setEditingValue("");
    }
    setLogs((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <>
      {/* 印刷制御（PDF出力時はテーブルだけ表示） */}
      <style jsx global>{`
        @media print {
          .screen-only {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
        .print-only {
          display: none;
        }
      `}</style>

      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
        <main className="w-full max-w-md rounded-xl bg-white p-6 shadow">
          {/* 画面用UI */}
          <div className="screen-only">
            <h1 className="text-2xl font-bold text-center">
              みやむの数値管理アプリ（試作）
            </h1>

            <p className="mt-2 mb-6 text-center text-sm text-zinc-600">
              合計：{total} 時間
            </p>

            <div className="flex flex-col gap-2">
              {/* 日付 */}
              <label htmlFor="work-date" className="text-sm font-medium">
                日付
              </label>
              <input
                id="work-date"
                type="date"
                className="border rounded px-3 py-2"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />

              {/* 時間 */}
              <label htmlFor="xcream-hours" className="text-sm font-medium">
                作業時間（時間）
              </label>
              <input
                id="xcream-hours"
                type="number"
                className="border rounded px-3 py-2"
                placeholder="例：5"
                value={xcreamHours}
                onChange={(e) =>
                  setXcreamHours(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
              />

              <p className="text-sm text-zinc-500">
                入力中：{xcreamHours || 0} 時間
              </p>

              {/* 追加 */}
              <button
                className="mt-2 rounded bg-blue-600 px-4 py-2 text-white"
                onClick={addLog}
              >
                追加
              </button>

              {/* 記録一覧（日付ごとに枠表示） */}
              <div className="mt-4 text-sm text-zinc-700">
                <p className="font-medium mb-2">記録一覧</p>

                {groupedEntries.length === 0 ? (
                  <p className="text-zinc-400">まだ記録がありません</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {groupedEntries.map(([date, items]) => {
                      const dayTotal = items.reduce((s, it) => s + it.hours, 0);

                      return (
                        <div
                          key={date}
                          className="border rounded-md p-3 bg-zinc-50"
                        >
                          <p className="font-medium mb-1">📅 {date}</p>

                          <ul className="mb-1 space-y-2">
                            {items.map((it) => (
                              <li
                                key={it.id}
                                className="flex items-center justify-between gap-3"
                              >
                                {/* 左側：表示 or 編集 */}
                                <div className="min-w-0">
                                  {editingId === it.id ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        className="w-24 border rounded px-2 py-1 text-sm"
                                        value={editingValue}
                                        onChange={(e) =>
                                          setEditingValue(
                                            e.target.value === ""
                                              ? ""
                                              : Number(e.target.value)
                                          )
                                        }
                                      />

                                      <button
                                        className="text-xs text-green-700 hover:underline"
                                        onClick={() => {
                                          if (
                                            editingValue === "" ||
                                            editingValue === 0
                                          )
                                            return;

                                          setLogs((prev) =>
                                            prev.map((x) =>
                                              x.id === it.id
                                                ? {
                                                    ...x,
                                                    hours: Number(editingValue),
                                                  }
                                                : x
                                            )
                                          );

                                          setEditingId(null);
                                          setEditingValue("");
                                        }}
                                      >
                                        保存
                                      </button>

                                      <button
                                        className="text-xs text-zinc-600 hover:underline"
                                        onClick={() => {
                                          setEditingId(null);
                                          setEditingValue("");
                                        }}
                                      >
                                        キャンセル
                                      </button>
                                    </div>
                                  ) : (
                                    <span>・{it.hours} 時間</span>
                                  )}
                                </div>

                                {/* 右側：編集/削除 */}
                                <div className="flex items-center gap-3 shrink-0">
                                  {editingId !== it.id && (
                                    <button
                                      className="text-xs text-blue-600 hover:underline"
                                      onClick={() => {
                                        setEditingId(it.id);
                                        setEditingValue(it.hours);
                                      }}
                                    >
                                      編集
                                    </button>
                                  )}

                                  <button
                                    className="text-xs text-red-600 hover:underline"
                                    onClick={() => removeLog(it.id)}
                                  >
                                    削除
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>

                          <p className="text-right font-semibold">
                            合計：{dayTotal} 時間
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* クリア */}
              <button
                className="mt-3 rounded border px-4 py-2 text-sm"
                onClick={() => {
                  setLogs([]);
                  setEditingId(null);
                  setEditingValue("");
                }}
                disabled={logs.length === 0}
              >
                記録をクリア
              </button>
            </div>
          </div>

          {/* 印刷/PDF用テーブル（印刷時だけ表示） */}
          <div className="print-only">
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              みやむの数値管理アプリ（出力）
            </h1>
            <div style={{ marginBottom: 10, fontSize: 12 }}>
              合計：{total} 時間
            </div>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      border: "1px solid #999",
                      padding: 6,
                      textAlign: "left",
                      background: "#f3f4f6",
                    }}
                  >
                    日付
                  </th>
                  <th
                    style={{
                      border: "1px solid #999",
                      padding: 6,
                      textAlign: "left",
                      background: "#f3f4f6",
                    }}
                  >
                    稼働時間（内訳）
                  </th>
                  <th
                    style={{
                      border: "1px solid #999",
                      padding: 6,
                      textAlign: "right",
                      background: "#f3f4f6",
                    }}
                  >
                    合計
                  </th>
                </tr>
              </thead>

              <tbody>
                {groupedEntries.length === 0 ? (
                  <tr>
                    <td style={{ border: "1px solid #999", padding: 6 }} colSpan={3}>
                      まだ記録がありません
                    </td>
                  </tr>
                ) : (
                  groupedEntries.map(([date, items]) => {
                    const hoursList = items.map((it) => it.hours);
                    const dayTotal = hoursList.reduce((s, h) => s + h, 0);

                    return (
                      <tr key={date}>
                        <td style={{ border: "1px solid #999", padding: 6 }}>
                          {date}
                        </td>
                        <td style={{ border: "1px solid #999", padding: 6 }}>
                          {hoursList.join(", ")}
                        </td>
                        <td
                          style={{
                            border: "1px solid #999",
                            padding: 6,
                            textAlign: "right",
                          }}
                        >
                          {dayTotal}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              <tfoot>
                <tr>
                  <td
                    style={{
                      border: "1px solid #999",
                      padding: 6,
                      fontWeight: 700,
                      background: "#f9fafb",
                    }}
                    colSpan={2}
                  >
                    合計
                  </td>
                  <td
                    style={{
                      border: "1px solid #999",
                      padding: 6,
                      textAlign: "right",
                      fontWeight: 700,
                      background: "#f9fafb",
                    }}
                  >
                    {total}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div style={{ marginTop: 10, fontSize: 11, color: "#666" }}>
              ※印刷（⌘P）でPDF保存すると、このテーブルのみ出力されます。
            </div>
          </div>
        </main>
      </div>
    </>
  );
}