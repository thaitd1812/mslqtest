"""
Đọc phiếu trả lời MSLQ 1 trang (latex_prototype/phieu_tra_loi_mslq_1trang.tex).

Mỗi ảnh/trang = một học sinh. Trả về mã học sinh, lần khảo sát và 44 câu kèm cờ:
  ok      — đọc chắc chắn
  blank   — không tô ô nào (v = None, KHÔNG tự điền giá trị)
  multi   — tô nhiều ô ngang nhau (v = None)
  dominant— có vết bẩn nhưng một ô trội rõ (v = ô trội, nên soát lại)
  check   — có ô tô mờ sát ngưỡng (v = ô được chọn, nên soát lại)

Thuật toán nắn hình và chọn ngưỡng kế thừa bộ chấm phiếu 40 câu đã chạy thật trên
50 học sinh (DLDGTGD/01_ACT_CaNhan/Cham_Phieu_OMR/src/omr_lib.py, run_omr.py):
cùng 4 ô định vị và khung cột, chỉ khác lưới ô tô.
"""
import io
import itertools

import cv2
import numpy as np

# ---------------------------------------------------------------- hình học phiếu
DPI = 200.0
PXCM = DPI / 2.54          # px/cm của ảnh đầu vào giả định (chỉ dùng để lọc kích thước ô định vị)
S = 80.0                   # px/cm của ảnh đã nắn
W_CM, H_CM = 21.0, 29.7
CW, CH = int(W_CM * S), int(H_CM * S)

FID_CM = [(1.5, 17.3), (19.5, 17.3), (19.5, 2.3), (1.5, 2.3)]   # tâm ô định vị TL, TR, BR, BL

N_Q, N_OPT = 44, 5
R_BUBBLE = 0.14            # bán kính vùng lấy mẫu (ô in có bán kính 0.18cm)


def cm2can(x, y):
    return (x * S, (H_CM - y) * S)


FID_CAN = np.float32([cm2can(*p) for p in FID_CM])


def bubble_cm(q, k):
    """Tâm ô mức k (1..5) của câu q (1..44)."""
    col, r = (q - 1) // 11, (q - 1) % 11
    return (2.1 + col * 4.25 + 1.10 + (k - 1) * 0.66, 15.9 - (r + 0.5) * 13 / 11)


def digit_cm(c, d):
    """Tâm ô chữ số d (0..9) ở cột c (0..2) của Mã học sinh."""
    return (11.895 + c * 0.68, 24.85 - d * 0.69)


ROUND_CM = {1: (14.75, 24.5), 2: (14.75, 23.5)}


# ---------------------------------------------------------------- tìm ô định vị
def _comps(bw, lo, hi):
    n, _, stats, cent = cv2.connectedComponentsWithStats(bw, 8)
    out = []
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if not (lo <= w <= hi and lo <= h <= hi):
            continue
        if not (0.68 <= w / float(h) <= 1.47):
            continue
        fill = a / float(w * h)
        if fill < 0.76:
            continue
        out.append((float(cent[i][0]), float(cent[i][1]), float(w + h) / 2, fill))
    return out


def _candidates(gray, minfill=0.87, pxcm=PXCM):
    """Nhiều kiểu nhị phân hoá, vì ảnh có thể từ máy scan phẳng tới ảnh chụp trên bàn."""
    lo, hi = 0.34 * pxcm, 1.05 * pxcm
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    white = float(np.percentile(blur, 95))
    outs = []
    _, b = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    outs.append(b)
    for f in (0.35, 0.45, 0.55, 0.65):
        _, b = cv2.threshold(blur, white * f, 255, cv2.THRESH_BINARY_INV)
        outs.append(b)
    seen, cands = set(), []
    for b in outs:
        for c in _comps(b, lo, hi):
            if c[3] < minfill:
                continue
            k = (round(c[0] / 8), round(c[1] / 8))
            if k in seen:
                continue
            seen.add(k)
            cands.append(c)
    return cands


def _order_quad(pts):
    pts = np.array(pts, np.float32)
    c = pts.mean(0)
    pts = pts[np.argsort(np.arctan2(pts[:, 1] - c[1], pts[:, 0] - c[0]))]
    return np.roll(pts, -int(np.argmin(pts[:, 0] + pts[:, 1])), axis=0)


def _plausible_quads(cands, minside=250, k=8):
    pool, out = sorted(cands, key=lambda t: -t[2])[:16], []
    for combo in itertools.combinations(pool, 4):
        q = _order_quad([(c[0], c[1]) for c in combo])
        tl, tr, br, bl = q
        top, bot = np.linalg.norm(tr - tl), np.linalg.norm(br - bl)
        lef, rig = np.linalg.norm(bl - tl), np.linalg.norm(br - tr)
        if min(top, bot, lef, rig) < minside:
            continue
        if abs(top - bot) / max(top, bot) > 0.08:
            continue
        if abs(lef - rig) / max(lef, rig) > 0.08:
            continue
        asp = ((top + bot) / 2) / ((lef + rig) / 2)
        if not (1.02 <= asp <= 1.40):
            continue
        sz = np.array([c[2] for c in combo])
        out.append((abs(asp - 1.20) * 6 + sz.std() / sz.mean() - (top + bot + lef + rig) / 4000.0, q))
    out.sort(key=lambda t: t[0])
    return [q for _, q in out[:k]]


def _mean(can, x0, y0, x1, y1):
    (a, b), (c, d) = cm2can(x0, y1), cm2can(x1, y0)
    r = can[int(b):int(d), int(a):int(c)]
    return float(r.mean()) if r.size else 255.0


def _verify(can):
    """4 thanh tiêu đề cột phải đen, 3 khe giữa các cột phải sáng."""
    bars = [_mean(can, 2.1 + c * 4.25 + 0.1, 15.95, 2.1 + c * 4.25 + 3.95, 16.60) for c in range(4)]
    gaps = [_mean(can, 2.1 + c * 4.25 + 4.07, 4.0, 2.1 + c * 4.25 + 4.23, 15.0) for c in range(3)]
    bm, gm = float(np.mean(bars)), float(np.mean(gaps))
    ok = (gm - bm) > 55 and bm < 0.70 * gm and max(bars) < 0.80 * gm
    return ok, (gm - bm)


def _rectify(gray, minfill=0.87):
    """Thử các hướng xoay x các kiểu nhị phân; giữ phép nắn qua được kiểm tra tốt nhất."""
    h, w = gray.shape
    # Ước lượng px/cm từ khổ ảnh (giả định ảnh chứa gần trọn trang A4).
    pxcm = max(h, w) / H_CM
    best = (None, -1e9)
    rots = [0, 90, 270, 180] if w > h else [0, 180, 90, 270]
    for rot in rots:
        g = gray if rot == 0 else cv2.rotate(gray, {90: cv2.ROTATE_90_CLOCKWISE,
                                                     180: cv2.ROTATE_180,
                                                     270: cv2.ROTATE_90_COUNTERCLOCKWISE}[rot])
        # 2 ô định vị trên/dưới cách nhau 15cm = ~50% chiều cao trang; ảnh chụp có viền bàn
        # (trang chỉ chiếm ~60% khung) vẫn phải lọt ngưỡng này.
        minside = 0.20 * max(g.shape)
        for q in _plausible_quads(_candidates(g, minfill, pxcm), minside=minside):
            H = cv2.getPerspectiveTransform(np.float32(q), FID_CAN)
            can = cv2.warpPerspective(g, H, (CW, CH), flags=cv2.INTER_AREA,
                                      borderMode=cv2.BORDER_CONSTANT, borderValue=255)
            ok, sc = _verify(can)
            if ok and sc > best[1]:
                best = (can, sc)
        if best[0] is not None:
            break
    if best[0] is None:
        if minfill > 0.80:
            return _rectify(gray, 0.76)   # ảnh mờ: nới tiêu chí ô định vị
        return None
    return best[0]


# ---------------------------------------------------------------- lấy mẫu ô tô
def _normalise(can):
    grid = can[int(cm2can(0, 16.0)[1]):int(cm2can(0, 3.0)[1]), int(2.0 * S):int(19.0 * S)]
    white = float(np.percentile(grid, 92)) or 255.0
    return np.clip(can.astype(np.float32) * (235.0 / white), 0, 255).astype(np.uint8)


def _ink(can, xc, yc, r_cm, dark=150):
    """(tỉ lệ điểm tối, độ xám trung bình) trong hình tròn bán kính r_cm."""
    cx, cy = cm2can(xc, yc)
    r = int(round(r_cm * S))
    y0, x0 = int(round(cy)) - r, int(round(cx)) - r
    patch = can[max(0, y0):y0 + 2 * r + 1, max(0, x0):x0 + 2 * r + 1]
    if patch.size == 0:
        return 0.0, 255.0
    m = np.zeros(patch.shape, np.uint8)
    cv2.circle(m, (patch.shape[1] // 2, patch.shape[0] // 2), r, 255, -1)
    v = patch[m > 0]
    if not v.size:
        return 0.0, 255.0
    return float((v < dark).mean()), float(v.mean())


def _page_threshold(vals):
    """Otsu trên chính các giá trị của trang này (hai đỉnh: ô trống và ô tô)."""
    v = np.sort(np.asarray(vals, np.float64))
    lo, hi = 0.12, 0.92
    band = v[(v >= lo) & (v <= hi)]
    if band.size < 2:
        return 0.45
    best_t, best_var = 0.45, -1
    for t in np.arange(lo, hi, 0.01):
        a, b = v[v < t], v[v >= t]
        if a.size < 5 or b.size < 5:
            continue
        var = a.size * b.size * (a.mean() - b.mean()) ** 2
        if var > best_var:
            best_var, best_t = var, t
    return float(np.clip(best_t, 0.25, 0.65))


def _norm(a, direction):
    """Đưa số đo về thang 0 (ô trống) .. ~1 (ô tô điển hình của trang này)."""
    E = float(np.median(a))
    d = a - E if direction == 'up' else E - a
    dmax = max(float(d.max()), 1e-6)
    t = _page_threshold(np.clip(d, 0, None).flatten() / dmax)
    top = d[d >= t * dmax]
    F = float(np.median(top)) if top.size >= 10 else float(np.percentile(d, 85))
    return d / max(F, 1e-6), E, F


MIN_FRAC, MAX_GREY = 0.35, 165.0


def _marked(frac, grey):
    """Mặt nạ 0/1: ô có đủ mực tuyệt đối để được coi là đã tô."""
    return ((np.asarray(frac) >= MIN_FRAC) | (np.asarray(grey) <= MAX_GREY)).astype(np.float64)


# ---------------------------------------------------------------- đọc một trang
def _decode(img_bytes):
    arr = np.frombuffer(img_bytes, np.uint8)
    gray = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if gray is not None:
        return gray
    try:   # HEIC từ iPhone
        from PIL import Image
        from pillow_heif import register_heif_opener
        register_heif_opener()
        return np.array(Image.open(io.BytesIO(img_bytes)).convert('L'))
    except Exception:
        return None


def read_sheet(img_bytes):
    gray = _decode(img_bytes)
    if gray is None:
        return {"success": False, "error": "Không đọc được file ảnh."}

    can = _rectify(gray)
    if can is None:
        return {"success": False,
                "error": "Không tìm thấy đủ 4 ô vuông đen ở góc khung trả lời. "
                         "Chụp lại thẳng, đủ sáng, thấy rõ cả 4 ô."}
    nz = _normalise(can)

    meas = np.array([[_ink(nz, *bubble_cm(q, k), R_BUBBLE) for k in range(1, N_OPT + 1)]
                     for q in range(1, N_Q + 1)])          # (44, 5, 2)
    zf, Ef, Ff = _norm(meas[:, :, 0], 'up')     # tỉ lệ điểm tối — hợp với ô tô đậm
    zg, Eg, Fg = _norm(meas[:, :, 1], 'down')   # độ xám trung bình — hợp với ô tô nhạt
    # Ngưỡng chỉ so các ô trong cùng trang nên phiếu trắng sẽ "đọc" ra nhiễu.
    # Chặn thêm bằng mức tuyệt đối: ô in sẵn (kể cả chữ số bên trong) đo được
    # tỉ lệ tối <= 0.18 và độ xám >= 198; ô tô kín ~1.0 và ~33.
    Z = np.maximum(zf, zg) * _marked(meas[:, :, 0], meas[:, :, 1])

    answers = []
    for qi in range(N_Q):
        zz = Z[qi]
        on = [k for k in range(N_OPT) if zz[k] >= 0.40]
        order = np.argsort(zz)[::-1]
        if len(on) == 1:
            v, flag = on[0] + 1, "ok"
        elif len(on) == 0 and zz[order[0]] > 0.25:
            # Tô rất mờ (dưới ngưỡng nhưng rõ hơn nền): đoán ô đậm nhất, buộc soát lại.
            v, flag = int(order[0]) + 1, "check"
        elif len(on) == 0:
            v, flag = None, "blank"
        elif zz[order[0]] >= 2.0 * zz[order[1]]:
            v, flag = int(order[0]) + 1, "dominant"
        else:
            v, flag = None, "multi"
        if flag == "ok" and any(0.25 < x < 0.70 for x in zz):
            flag = "check"
        answers.append({"q": qi + 1, "v": v, "flag": flag})

    def pick(points, r):
        m = np.array([_ink(nz, x, y, r) for x, y in points])
        ok = _marked(m[:, 0], m[:, 1])
        # Dùng cả hai kênh như phần câu trả lời: bút chì nhạt có thể ít "điểm tối" nhưng xám rõ.
        z = np.maximum((m[:, 0] - Ef) / max(Ff, 1e-6), (Eg - m[:, 1]) / max(Fg, 1e-6))
        return [i for i in range(len(points)) if ok[i] and z[i] >= 0.45]

    digits = []
    for c in range(3):
        hit = pick([digit_cm(c, d) for d in range(10)], 0.13)
        digits.append(str(hit[0]) if len(hit) == 1 else "?")
    code = "".join(digits)

    hit = pick([ROUND_CM[1], ROUND_CM[2]], 0.13)
    rnd = hit[0] + 1 if len(hit) == 1 else None

    return {
        "success": True,
        "studentCode": code if "?" not in code else None,
        "studentCodeRaw": code,
        "round": rnd,
        "answers": answers,
        "needsReview": code.count("?") > 0 or rnd is None
                       or any(a["flag"] != "ok" for a in answers),
    }
