import os
import cv2
import numpy as np
import urllib.request
import json
import base64
import asyncio
import httpx
import fitz # PyMuPDF
from PIL import Image
from pillow_heif import register_heif_opener
import io

register_heif_opener()

# ============================================================
# Marker-anchored OMR (CPU-only, KHÔNG dùng AI)
# Phiếu sinh bởi latex_prototype/make_omr_sheet.py:
#   - 4 ô đen định vị ở 4 góc (mốc TRÊN 6mm > DƯỚI 4mm để nhận chiều)
#   - cột timing-mark đen bên trái mỗi câu
#   - mỗi câu 5 bubble tròn (1..5)
# Luồng: tìm 4 mốc góc -> warp phối cảnh về canvas chuẩn -> Hough tìm bubble
#        -> cluster thành lưới 5 cột x N hàng -> đo độ tô từng ô -> chọn đáp án.
# Xử lý nhiều trang: đọc tuần tự, nối các hàng theo thứ tự câu.
# ============================================================

CANON_W, CANON_H = 1000, 1414  # canvas chuẩn, giới hạn bởi 4 mốc góc (tỷ lệ ~A4)
ANSWER_X_MIN = 680             # vùng bubble đáp án bắt đầu từ x này (loại legend bên trái)

def _find_corner_markers(gray):
    """Tìm 4 ô đen vuông gần 4 góc ảnh. Trả về tâm + diện tích từng mốc."""
    H, W = gray.shape
    _, th = cv2.threshold(gray, 110, 255, cv2.THRESH_BINARY_INV)
    frac = 0.16
    corners = {'tl': (0, 0), 'tr': (W, 0), 'br': (W, H), 'bl': (0, H)}
    rois = {
        'tl': (0, 0, int(W*frac), int(H*frac)),
        'tr': (W-int(W*frac), 0, W, int(H*frac)),
        'br': (W-int(W*frac), H-int(H*frac), W, H),
        'bl': (0, H-int(H*frac), int(W*frac), H),
    }
    found, areas = {}, {}
    for k, (x0, y0, x1, y1) in rois.items():
        sub = th[y0:y1, x0:x1]
        cnts, _ = cv2.findContours(sub, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cx0, cy0 = corners[k]
        best, bestdist = None, 1e18
        for c in cnts:
            a = cv2.contourArea(c)
            if a < 100:
                continue
            x, y, w, h = cv2.boundingRect(c)
            if not (0.6 < w/float(h) < 1.6):     # gần vuông
                continue
            if a/float(w*h) < 0.7:               # đặc, không rỗng
                continue
            ccx, ccy = x + w/2.0 + x0, y + h/2.0 + y0
            d = (ccx-cx0)**2 + (ccy-cy0)**2      # ưu tiên ô sát góc nhất
            if d < bestdist:
                bestdist, best = d, (ccx, ccy, a)
        if best:
            found[k] = (best[0], best[1]); areas[k] = best[2]
    return found, areas

def _warp_canonical(img, found, areas):
    """Warp phối cảnh theo 4 mốc; tự lật 180 nếu phiếu bị chụp ngược."""
    src = np.array([found['tl'], found['tr'], found['br'], found['bl']], dtype="float32")
    dst = np.array([[0, 0], [CANON_W, 0], [CANON_W, CANON_H], [0, CANON_H]], dtype="float32")
    warped = cv2.warpPerspective(img, cv2.getPerspectiveTransform(src, dst), (CANON_W, CANON_H))
    top_area = areas['tl'] + areas['tr']
    bot_area = areas['bl'] + areas['br']
    if bot_area > top_area * 1.3:   # mốc "trên" nhỏ hơn "dưới" => ảnh đang lật ngược
        warped = cv2.rotate(warped, cv2.ROTATE_180)
    return warped

def _cluster_1d(vals, gap):
    vals = sorted(vals)
    groups = [[vals[0]]]
    for v in vals[1:]:
        if v - groups[-1][-1] <= gap:
            groups[-1].append(v)
        else:
            groups.append([v])
    return groups

CLEAN_YS = [
    [730.0, 793.0, 856.0, 919.0, 982.1, 1045.0, 1108.0, 1170.9],
    [140.5, 204.0, 268.0, 331.5, 395.1, 458.5, 522.0, 585.0, 648.5, 712.0, 775.0, 838.0, 901.0, 963.9, 1027.0, 1090.0, 1153.0],
    [156.0, 235.0, 298.5, 362.1, 441.0, 520.0, 598.1, 677.1, 740.0, 803.0, 881.1, 974.4, 1053.0, 1115.9, 1178.0],
    [156.0, 250.0, 344.1, 438.5]
]
PAGE_STARTS = [1, 9, 26, 41]
CLEAN_COLS = [721.0, 775.0, 829.0, 882.0, 936.0]

def _detect_grid(warped_gray, page_idx):
    """Tìm timing-mark bằng template matching để xác định chính xác vị trí hàng. Tìm cột bằng HoughCircles."""
    _, th = cv2.threshold(warped_gray, 130, 255, cv2.THRESH_BINARY_INV)
    
    # 1. TÌM CỘT BẰNG HOUGH CIRCLES
    circles = cv2.HoughCircles(warped_gray, cv2.HOUGH_GRADIENT, dp=1, minDist=18,
                               param1=120, param2=22, minRadius=8, maxRadius=20)
    cols = CLEAN_COLS
    if circles is not None:
        pts = [(float(x), float(y)) for (x, y, r) in circles[0] if x > ANSWER_X_MIN]
        col_groups = [g for g in _cluster_1d([p[0] for p in pts], 25) if len(g) >= 3]
        if len(col_groups) == 5:
            cols = sorted(float(np.mean(g)) for g in col_groups)
            
    # 2. TÌM HÀNG BẰNG TEMPLATE MATCHING (ANCHOR)
    template = np.zeros((25, 25), dtype=np.uint8)
    template[5:20, 5:20] = 255 
    
    roi = th[:, 30:120]
    res = cv2.matchTemplate(roi, template, cv2.TM_CCOEFF_NORMED)
    threshold = 0.4
    loc = np.where(res >= threshold)
    
    marks = []
    for pt in zip(*loc[::-1]):
        marks.append((pt[1] + 25/2.0, res[pt[1], pt[0]]))
        
    if not marks:
        return cols, [], 1
        
    marks.sort(key=lambda x: x[0])
    groups = [[marks[0]]]
    for m in marks[1:]:
        if m[0] - groups[-1][-1][0] <= 15:
            groups[-1].append(m)
        else:
            groups.append([m])
            
    peaks = []
    for g in groups:
        best_peak = max(g, key=lambda x: x[1])
        peaks.append(best_peak)
        
    # Only search in the expected page's coordinates
    expected_ys = CLEAN_YS[page_idx]
    
    valid_anchors = []
    for p_y, p_score in peaks:
        diffs = [abs(p_y - ey) for ey in expected_ys]
        best_k = np.argmin(diffs)
        if diffs[best_k] < 45:
            valid_anchors.append((p_y, p_score, best_k, expected_ys[best_k]))
                
    if not valid_anchors:
        return cols, [], PAGE_STARTS[page_idx]
        
    best_anchor = max(valid_anchors, key=lambda x: x[1])
    best_y, best_score, best_k, exp_y = best_anchor
    
    shift = best_y - exp_y
    rows = [ey + shift for ey in expected_ys]
    return cols, rows, PAGE_STARTS[page_idx]

def _read_page(warped_gray, cols, rows, r=12):
    """Đo độ tô từng ô; chọn ô đậm nhất. Gắn cờ blank/multi để biết độ tin cậy."""
    _, th = cv2.threshold(warped_gray, 130, 255, cv2.THRESH_BINARY_INV)
    out = []
    for ry in rows:
        fills = []
        for cx in cols:
            cell = th[max(0, int(ry-r)):int(ry+r), max(0, int(cx-r)):int(cx+r)]
            fills.append(cell.mean()/255.0 if cell.size else 0.0)
        fills = np.array(fills)
        order = np.argsort(fills)[::-1]
        top = float(fills[order[0]])
        second = float(fills[order[1]]) if len(fills) > 1 else 0.0
        
        if top < 0.025:                                  # không ô nào được tô rõ
            out.append({"v": 3, "flag": "blank"})
        elif second > 0.7*top and second > 0.025:        # tô >1 ô
            out.append({"v": int(order[0])+1, "flag": "multi"})
        else:
            out.append({"v": int(order[0])+1, "flag": "ok"})
    return out

def process_omr_markers(jpeg_images, expected=44):
    """OMR truyền thống dựa trên mốc định vị, cho 1..N trang theo thứ tự. CPU, không AI."""
    all_rows = []
    for idx, img_bytes in enumerate(jpeg_images):
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            print(f"[OMR] marker: page {idx+1} decode failed")
            return False, []
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        found, areas = _find_corner_markers(gray)
        if len(found) != 4:
            print(f"[OMR] marker: page {idx+1} found {len(found)}/4 corners")
            return False, []
        warped = _warp_canonical(img, found, areas)
        wg = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        
        # We need page_idx to be strictly bounded if idx >= 4
        page_idx = min(idx, 3) 
        cols, rows, q_start = _detect_grid(wg, page_idx)
        if len(cols) != 5:
            print(f"[OMR] marker: page {idx+1} found {len(cols)} cols (expected 5)")
            return False, []
        page_rows = _read_page(wg, cols, rows)
        for j, a in enumerate(page_rows):
            a['q'] = q_start + j
        print(f"[OMR] marker: page {idx+1} -> {len(page_rows)} rows")
        all_rows.extend(page_rows)

    if len(all_rows) != expected:
        print(f"[OMR] marker: total rows {len(all_rows)} != {expected}")
        return False, []
    uncertain = sum(1 for a in all_rows if a["flag"] != "ok")
    if uncertain > 45:
        print(f"[OMR] marker: too many uncertain rows ({uncertain}) -> fallback to AI")
        return False, []
        
    all_rows.sort(key=lambda x: x.get('q', 0))
    answers = [{"q": a["q"], "v": a["v"]} for a in all_rows]
    print(f"[OMR] marker: OK -> {expected} answers ({uncertain} uncertain)")
    return True, answers

async def process_omr_gemini_async(jpeg_images: list[bytes]):
    print(f"[OMR] Using Gemini Vision for {len(jpeg_images)} images...")
    
    api_keys = []
    for i in range(1, 4):
        k = os.getenv(f"GEMINI_API_KEY_{i}")
        if k:
            api_keys.append(k)
            
    # Fallback back to standard GEMINI_API_KEY if none of the numbered ones exist
    if not api_keys:
        k = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEYS")
        if k:
            api_keys.append(k)
            
    if not api_keys:
        print("[OMR] Error: No GEMINI_API_KEY found")
        return False, []
        
    prompt = (
        "This is an OMR answer sheet for a 44-question student motivation survey (MSLQ, scale 1-5).\n\n"
        "Sheet layout:\n"
        "- Questions 1 to 44 are listed vertically, top to bottom.\n"
        "- Each question has 5 answer bubbles (labeled 1, 2, 3, 4, 5) arranged as columns on the RIGHT side of the sheet.\n"
        "- Column order left-to-right: 1, 2, 3, 4, 5.\n"
        "- Exactly ONE bubble per row is filled/darkened by the student.\n"
        "- If multiple pages are provided, read questions sequentially across all pages.\n\n"
        "Task: For each of the 44 questions, identify which bubble (1-5) is filled or darkened.\n"
        "If a row has no clearly filled bubble, default to 3.\n\n"
        "Return a JSON array of exactly 44 objects. Each object: {\"q\": <question_number>, \"v\": <selected_value>}.\n"
        "Example: [{\"q\":1,\"v\":3},{\"q\":2,\"v\":5},...,{\"q\":44,\"v\":2}]"
    )

    parts = [{"text": prompt}]
    for img_bytes in jpeg_images:
        b64_img = base64.b64encode(img_bytes).decode("utf-8")
        parts.append({"inlineData": {"mimeType": "image/jpeg", "data": b64_img}})

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json"
        }
    }

    max_retries = 3
    for attempt in range(max_retries):
        for key_idx, api_key in enumerate(api_keys):
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 429:
                        print(f"[OMR] Rate limited on Key {key_idx + 1}. Switching to next key...")
                        continue
                    resp.raise_for_status()
                    res_data = resp.json()
                    text_res = res_data['candidates'][0]['content']['parts'][0]['text']

                    answers = json.loads(text_res.strip())

                    if not isinstance(answers, list) or len(answers) < 40:
                        print(f"[OMR] Gemini returned {len(answers) if isinstance(answers, list) else 'invalid'} answers, expected 44. Retrying...")
                        continue

                    return True, answers
            except Exception as e:
                print(f"[OMR] Gemini API error with Key {key_idx + 1}: {e}")
                continue

        print(f"[OMR] All keys failed on attempt {attempt+1}/{max_retries}. Waiting 2s...")
        await asyncio.sleep(2)

    return False, []

def build_final_result(answers):
    final_answers = []
    found_qs = {a["q"]: a["v"] for a in answers if "q" in a and "v" in a}
    for q_idx in range(1, 45):
        final_answers.append({
            "q": q_idx,
            "v": found_qs.get(q_idx, 3) # default 3
        })
    return {
        "success": True,
        "answers": final_answers,
        "raw_image_processed": True
    }

async def process_files_async(files_data):
    """
    files_data: list of dict {"filename": str, "content": bytes}
    """
    jpeg_images = []
    
    for f in files_data:
        fname = f["filename"].lower()
        content = f["content"]
        
        try:
            if fname.endswith(".pdf"):
                doc = fitz.open(stream=content, filetype="pdf")
                for page in doc:
                    pix = page.get_pixmap(dpi=150)
                    img_bytes = pix.tobytes("jpeg")
                    jpeg_images.append(img_bytes)
            elif fname.endswith(".heic") or fname.endswith(".heif"):
                image = Image.open(io.BytesIO(content))
                image = image.convert("RGB")
                out_io = io.BytesIO()
                image.save(out_io, format="JPEG")
                jpeg_images.append(out_io.getvalue())
            else:
                nparr = np.frombuffer(content, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if img is not None:
                    _, buffer = cv2.imencode('.jpg', img)
                    jpeg_images.append(buffer.tobytes())
        except Exception as e:
            print(f"Error parsing file {fname}: {e}")
            
    if len(jpeg_images) == 0:
        return {"success": False, "error": "No valid images found"}

    # Primary: OMR truyền thống dựa trên mốc định vị (CPU, không AI), cho mọi số trang
    success, answers = process_omr_markers(jpeg_images)
    if success and len(answers) == 44:
        return build_final_result(answers)

    # Fallback: Gemini khi pipeline mốc thất bại (ảnh quá xấu, thiếu mốc, v.v.)
    success, answers = await process_omr_gemini_async(jpeg_images)

    if not success:
         return {"success": False, "error": "Hệ thống AI đang quá tải hoặc cạn kiệt API Limit. Vui lòng chờ 1 lát rồi thử lại!"}

    return build_final_result(answers)
