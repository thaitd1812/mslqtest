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

def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)] # Top-left
    rect[2] = pts[np.argmax(s)] # Bottom-right
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)] # Top-right
    rect[3] = pts[np.argmax(diff)] # Bottom-left
    return rect

def four_point_transform(image, pts):
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]], dtype="float32")
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    return warped, maxWidth, maxHeight

def process_omr_opencv(image_path):
    img = cv2.imread(image_path)
    if img is None:
        return False, []
        
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    doc_cnt = None
    if contours:
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        for c in contours:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            if len(approx) == 4:
                doc_cnt = approx
                break
                
    if doc_cnt is None:
        print("[OMR] OpenCV failed: no 4-point contour found")
        return False, []
        
    warped, w, h = four_point_transform(img, doc_cnt.reshape(4, 2))
    warped_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    thresh = cv2.adaptiveThreshold(warped_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 10)
    
    expected_rows = 45 
    row_height = h / expected_rows
    
    answers = []
    cols = [
        (0.6917, 0.7533),
        (0.7533, 0.8150),
        (0.8150, 0.8766),
        (0.8766, 0.9383),
        (0.9383, 1.0000)
    ]
    
    for i in range(1, expected_rows):
        y_start = int(i * row_height)
        y_end = int((i + 1) * row_height)
        row_thresh = thresh[y_start:y_end, :]
        H, W = row_thresh.shape
        if H == 0: continue
        
        densities = []
        for (start_pct, end_pct) in cols:
            x_start = int(start_pct * W)
            x_end = int(end_pct * W)
            cell = row_thresh[:, x_start:x_end]
            cell_h, cell_w = cell.shape
            inner_cell = cell[int(cell_h*0.2):int(cell_h*0.8), int(cell_w*0.2):int(cell_w*0.8)]
            total_pixels = inner_cell.shape[0] * inner_cell.shape[1]
            if total_pixels == 0:
                density = 0
            else:
                black_pixels = cv2.countNonZero(inner_cell)
                density = black_pixels / total_pixels
            densities.append(density)
            
        chosen = np.argmax(densities) + 1
        max_d = max(densities)
        if max_d > 0.05:
            answers.append({"q": i, "v": int(chosen)})
        else:
            answers.append({"q": i, "v": 3})
            
    print(f"[OMR] OpenCV extracted {len(answers)} answers")
    if len(answers) == 44:
        return True, answers
    return False, answers

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
        
    if len(jpeg_images) == 1:
        temp_path = "/tmp/temp_cv2.jpg"
        with open(temp_path, "wb") as f_out:
            f_out.write(jpeg_images[0])
            
        success, answers = process_omr_opencv(temp_path)
        if success and len(answers) == 44:
            return build_final_result(answers)
            
    # Fallback to Gemini for multiple images or OpenCV failure
    success, answers = await process_omr_gemini_async(jpeg_images)
    
    if not success:
         return {"success": False, "error": "Hệ thống AI đang quá tải hoặc cạn kiệt API Limit. Vui lòng chờ 1 lát rồi thử lại!"}
         
    return build_final_result(answers)
