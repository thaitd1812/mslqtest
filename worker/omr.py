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

CANON_W, CANON_H = 1000, 1414
ANSWER_X_MIN = 680

def _find_corner_markers(gray):
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
            if not (0.6 < w/float(h) < 1.6):
                continue
            if a/float(w*h) < 0.7:
                continue
            ccx, ccy = x + w/2.0 + x0, y + h/2.0 + y0
            d = (ccx-cx0)**2 + (ccy-cy0)**2
            if d < bestdist:
                bestdist, best = d, (ccx, ccy, a)
        if best:
            found[k] = (best[0], best[1]); areas[k] = best[2]
    return found, areas

def _warp_canonical(img, found, areas):
    src = np.array([found['tl'], found['tr'], found['br'], found['bl']], dtype="float32")
    dst = np.array([[0, 0], [CANON_W, 0], [CANON_W, CANON_H], [0, CANON_H]], dtype="float32")
    warped = cv2.warpPerspective(img, cv2.getPerspectiveTransform(src, dst), (CANON_W, CANON_H))
    top_area = areas['tl'] + areas['tr']
    bot_area = areas['bl'] + areas['br']
    if bot_area > top_area * 1.3:
        warped = cv2.rotate(warped, cv2.ROTATE_180)
    return warped

CLEAN_YS_BY_PAGE = [
    [702.0, 765.0, 828.0, 891.0, 954.0, 1017.0, 1080.0, 1143.0], # These are approximate
    [140.5, 204.0, 268.0, 331.5, 395.1, 458.5, 522.0, 585.0, 648.5, 712.0, 775.0, 838.0, 901.0, 963.9, 1027.0, 1090.0, 1153.0],
    [156.0, 235.0, 298.5, 362.1, 441.0, 520.0, 598.1, 677.1, 740.0, 803.0, 881.1, 974.4, 1053.0, 1115.9, 1178.0],
    [156.0, 250.0, 344.1, 438.5]
]
PAGE_STARTS = [1, 9, 26, 41]
CLEAN_COLS = [769.0, 822.0, 875.0, 927.0, 978.5]

def _detect_grid(warped, page_idx):
    warped_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    _, th = cv2.threshold(warped_gray, 130, 255, cv2.THRESH_BINARY_INV)
    roi = th[:, 10:80]
    cnts, _ = cv2.findContours(roi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    marks_y = []
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        area = cv2.contourArea(c)
        if 50 < area < 1000 and 0.4 < w/h < 2.5:
            marks_y.append(y + h/2.0)
    marks_y.sort()
    
    filtered = []
    for y in marks_y:
        if not filtered or y - filtered[-1] > 20:
            filtered.append(y)
            
    expected_rows = len(CLEAN_YS_BY_PAGE[page_idx])
    if len(filtered) >= expected_rows:
        rows_detected = filtered[-expected_rows:]
        rows = [my - 22.5 for my in rows_detected]
    else:
        rows = CLEAN_YS_BY_PAGE[page_idx]

    cols = CLEAN_COLS
    return cols, rows, PAGE_STARTS[page_idx]

def _read_page(warped, cols, rows, r=14):
    b, g, r_chan = cv2.split(warped)
    blue_diff = cv2.subtract(b, r_chan)
    _, th_blue = cv2.threshold(blue_diff, 20, 255, cv2.THRESH_BINARY)
    
    warped_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    _, th_gray = cv2.threshold(warped_gray, 130, 255, cv2.THRESH_BINARY_INV)
    
    out = []
    for ry in rows:
        fills = []
        for cx in cols:
            cell_gray = th_gray[max(0, int(ry-r)):int(ry+r), max(0, int(cx-r)):int(cx+r)]
            cell_blue = th_blue[max(0, int(ry-r)):int(ry+r), max(0, int(cx-r)):int(cx+r)]
            f_gray = cell_gray.mean()/255.0 if cell_gray.size else 0.0
            f_blue = cell_blue.mean()/255.0 if cell_blue.size else 0.0
            fills.append(max(f_gray, f_blue * 20))
            
        fills = np.array(fills)
        baseline = np.min(fills)
        adjusted_fills = fills - baseline
        order = np.argsort(adjusted_fills)[::-1]
        
        top = float(adjusted_fills[order[0]])
        second = float(adjusted_fills[order[1]]) if len(fills) > 1 else 0.0
        
        if top < 0.02:
            out.append({"v": 3, "flag": "blank"})
        elif second > 0.7*top and second > 0.04:
            out.append({"v": int(order[0])+1, "flag": "multi"})
        else:
            out.append({"v": int(order[0])+1, "flag": "ok"})
    return out

def process_omr_markers(jpeg_images, expected=44):
    all_rows = []
    for idx, img_bytes in enumerate(jpeg_images):
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return False, []
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        found, areas = _find_corner_markers(gray)
        if len(found) != 4:
            return False, []
        warped = _warp_canonical(img, found, areas)
        
        page_idx = min(idx, 3) 
        cols, rows, q_start = _detect_grid(warped, page_idx)
        if len(cols) != 5:
            return False, []
        page_rows = _read_page(warped, cols, rows)
        for j, a in enumerate(page_rows):
            a['q'] = q_start + j
        all_rows.extend(page_rows)

    if len(all_rows) != expected:
        return False, []
    uncertain = sum(1 for a in all_rows if a["flag"] != "ok")
    if uncertain > 10:
        return False, []
        
    all_rows.sort(key=lambda x: x.get('q', 0))
    answers = [{"q": a["q"], "v": a["v"], "flag": a.get("flag", "ok")} for a in all_rows]
    return True, answers

# Gemini code and endpoints are kept identical...
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
        "You are an expert Optical Mark Recognition (OMR) system.\n"
        "Below are images of a 44-question student survey answer sheet.\n"
        "Each question (from 1 to 44) has 5 circular answer bubbles labeled 1, 2, 3, 4, and 5 from left to right.\n\n"
        "Your task is to carefully scan EVERY single row across all the provided pages and determine which bubble is visibly filled, checked, or crossed out by the student.\n"
        "Pay very close attention to each row. Do not hallucinate or output the same value repeatedly. You must look at the actual images.\n"
        "If a question is left blank or has multiple marks, output 3.\n\n"
        "Output ONLY a valid JSON array containing exactly 44 objects. "
        "Each object must have the format: {\"q\": <question_number>, \"v\": <selected_value>}.\n"
        "Ensure the question numbers go strictly from 1 to 44 in order."
    )

    parts = [{"text": prompt}]
    for img_bytes in jpeg_images:
        b64_img = base64.b64encode(img_bytes).decode("utf-8")
        parts.append({"inlineData": {"mimeType": "image/jpeg", "data": b64_img}})

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.0,
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
    found_qs = {a["q"]: a for a in answers if "q" in a}
    for q_idx in range(1, 45):
        ans = found_qs.get(q_idx, {"v": 3, "flag": "blank"})
        final_answers.append({
            "q": q_idx,
            "v": ans.get("v", 3),
            "flag": ans.get("flag", "blank")
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
