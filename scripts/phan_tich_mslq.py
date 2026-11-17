#!/usr/bin/env python3
"""Phân tích thang đo MSLQ 44 câu từ file CSV đã ẩn danh.

    worker/.venv/bin/python scripts/phan_tich_mslq.py data_private/mslq_mathtech_andanh.csv

Đầu vào: CSV có cột c1..c44 (mức 1–5), co1..co44 (cờ OMR), trang_thai.
Đầu ra (in ra màn hình + ghi data_private/ket_qua/):
  1. Làm sạch: loại bài chưa duyệt, thiếu câu, trùng y hệt, trả lời một mức cho cả 44 câu.
  2. Độ tin cậy Cronbach's alpha từng nhóm + phân tích câu (tương quan câu–tổng hiệu chỉnh,
     alpha nếu bỏ câu).
  3. Thống kê mô tả 5 nhóm (TB, ĐLC) và phân bố 4 mức đánh giá.

Nhóm câu lấy đúng theo web/src/lib/mslq/groups.ts.
"""
import csv
import sys
from collections import Counter
from pathlib import Path

import numpy as np

GROUPS = [
    ("Niềm tin vào năng lực học tập", [1, 6, 7, 9, 11, 12, 15, 17, 18], False),
    ("Giá trị và hứng thú học tập", [2, 3, 4, 5, 8, 10, 13, 14, 16], False),
    ("Lo âu khi kiểm tra", [19, 20, 21, 22], True),
    ("Chiến lược học tập", [23, 24, 25, 28, 30, 31, 33, 34, 35, 37, 38, 39, 40], False),
    ("Khả năng tự điều chỉnh việc học", [26, 27, 29, 32, 36, 41, 42, 43, 44], False),
]
LEVELS = {False: ["Cần ưu tiên cải thiện", "Cần hỗ trợ", "Khá", "Tốt"],
          True: ["Áp lực thấp", "Áp lực trung bình", "Áp lực cao", "Áp lực rất cao"]}


def tier(avg):
    return 0 if avg <= 2.0 else 1 if avg <= 3.0 else 2 if avg <= 4.0 else 3


def cronbach(X):
    k = X.shape[1]
    return k / (k - 1) * (1 - X.var(axis=0, ddof=1).sum() / X.sum(axis=1).var(ddof=1))


def danh_gia_alpha(a):
    return ("rất tốt" if a >= 0.9 else "tốt" if a >= 0.8 else "chấp nhận được" if a >= 0.7
            else "tạm chấp nhận" if a >= 0.6 else "thấp")


def main(path):
    rows = list(csv.DictReader(open(path, encoding="utf-8-sig")))
    out_dir = Path(path).parent / "ket_qua"
    out_dir.mkdir(exist_ok=True)
    log = []

    def p(s=""):
        print(s)
        log.append(s)

    # ---------------- 1. Làm sạch
    p(f"# Phân tích MSLQ — {Path(path).name}\n")
    p("## 1. Làm sạch dữ liệu\n")
    p(f"- Tổng bản ghi: {len(rows)}")
    st = Counter(r["trang_thai"] for r in rows)
    keep = [r for r in rows if r["trang_thai"] == "completed"]
    p(f"- Loại {len(rows) - len(keep)} bài chưa được giáo viên duyệt (trạng thái {dict(st)})")

    def vec(r):
        try:
            v = [int(r[f"c{q}"]) for q in range(1, 45)]
        except ValueError:
            return None
        return v if all(1 <= x <= 5 for x in v) else None

    bad = [r for r in keep if vec(r) is None]
    keep = [r for r in keep if vec(r) is not None]
    p(f"- Loại {len(bad)} bài thiếu câu / giá trị ngoài 1–5")

    seen, dup = set(), 0
    uniq = []
    for r in keep:
        t = tuple(vec(r))
        if t in seen:
            dup += 1
            continue
        seen.add(t)
        uniq.append(r)
    p(f"- Loại {dup} bài trùng y hệt 44 câu (quét lặp)")
    flat = [r for r in uniq if len(set(vec(r))) == 1]
    uniq = [r for r in uniq if len(set(vec(r))) > 1]
    p(f"- Loại {len(flat)} bài tô một mức cho cả 44 câu (trả lời không nghiêm túc / phiếu thử)")

    flagged = Counter()
    for r in uniq:
        for q in range(1, 45):
            f = r.get(f"co{q}", "")
            if f and f != "ok":
                flagged[f] += 1
    p(f"- Cờ OMR còn lại trong các bài giữ lại (đã được duyệt): {dict(flagged) or 'không có'}")
    p("  Lưu ý: bộ chấm cũ ghi câu bỏ trống thành 3 — cờ 'blank' ở bài đã chốt nghĩa là GV đã duyệt mà có thể"
      " vẫn giữ giá trị 3.")
    X = np.array([vec(r) for r in uniq], dtype=float)
    p(f"\n**Mẫu phân tích: N = {len(X)}**\n")

    # ---------------- 2. Độ tin cậy
    p("## 2. Độ tin cậy Cronbach's alpha\n")
    p("| Nhóm | Số câu | α | Đánh giá |")
    p("|---|---|---|---|")
    items_rows = []
    for name, qs, rev in GROUPS:
        G = X[:, [q - 1 for q in qs]]
        a = cronbach(G)
        p(f"| {name} | {len(qs)} | {a:.3f} | {danh_gia_alpha(a)} |")
        for j, q in enumerate(qs):
            rest = np.delete(G, j, axis=1)
            r_it = np.corrcoef(G[:, j], rest.sum(axis=1))[0, 1]
            items_rows.append((name, q, G[:, j].mean(), G[:, j].std(ddof=1), r_it, cronbach(rest), a))
    p("\nNgưỡng thường dùng: ≥ 0,7 chấp nhận được; 0,6–0,7 tạm chấp nhận với thang ngắn / nghiên cứu thăm dò.\n")

    p("### Phân tích từng câu\n")
    p("| Nhóm | Câu | TB | ĐLC | r câu–tổng (hiệu chỉnh) | α nếu bỏ câu | Ghi chú |")
    p("|---|---|---|---|---|---|---|")
    for name, q, m, sd, r_it, a_del, a in items_rows:
        note = []
        if r_it < 0.3:
            note.append("r < 0,3")
        if a_del > a + 0.01:
            note.append("bỏ câu làm α tăng")
        p(f"| {name} | {q} | {m:.2f} | {sd:.2f} | {r_it:.3f} | {a_del:.3f} | {', '.join(note)} |")

    # ---------------- 3. Mô tả
    p("\n## 3. Thống kê mô tả 5 nhóm\n")
    p("| Nhóm | TB | ĐLC | Min | Max | " + " | ".join(f"Mức {i + 1}" for i in range(4)) + " |")
    p("|---|---|---|---|---|---|---|---|---|")
    for name, qs, rev in GROUPS:
        s = X[:, [q - 1 for q in qs]].mean(axis=1)
        cnt = Counter(tier(v) for v in s)
        dist = " | ".join(f"{LEVELS[rev][i]}: {cnt.get(i, 0)} ({cnt.get(i, 0) / len(s):.0%})" for i in range(4))
        p(f"| {name} | {s.mean():.2f} | {s.std(ddof=1):.2f} | {s.min():.2f} | {s.max():.2f} | {dist} |")
    p("\nMức theo điểm TB: 1,0–2,0 / 2,1–3,0 / 3,1–4,0 / 4,1–5,0 (nhóm Lo âu: điểm cao = áp lực cao).")

    (out_dir / "bao_cao_phan_tich.md").write_text("\n".join(log), encoding="utf-8")
    with open(out_dir / "du_lieu_sach.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["ma_andanh"] + [f"c{q}" for q in range(1, 45)] + [g[0] for g in GROUPS])
        for r, v in zip(uniq, X):
            w.writerow([r["ma_andanh"]] + [int(x) for x in v]
                       + [round(float(v[[q - 1 for q in qs]].mean()), 3) for _, qs, _ in GROUPS])
    print(f"\n→ Đã ghi {out_dir}/bao_cao_phan_tich.md và du_lieu_sach.csv")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data_private/mslq_mathtech_andanh.csv")
