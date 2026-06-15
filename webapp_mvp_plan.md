# KẾ HOẠCH MVP WEB APP: CHỤP PHIẾU MSLQ → BÁO CÁO

> Tư vấn tuyển sinh **chụp phiếu trắc nghiệm động lực (giấy)** → hệ thống đọc → trả ra
> **ảnh gốc để đối chiếu + báo cáo đánh giá** (đúng layout `latex_prototype/`).
> Tài liệu này đủ chi tiết để **giao cho AI agent (Gemini Pro 3.1) thực thi**.
>
> **Ràng buộc cốt lõi:** (1) **hoàn toàn free**; (2) **Gemini chỉ là chốt cuối, dùng tối thiểu**;
> (3) người dùng **không kỹ thuật**; (4) **đánh giá tâm lý — sai là hậu quả nặng** → ưu tiên
> phương pháp **xác định (deterministic), audit được** hơn AI.

## ★ TRẠNG THÁI & BÀN GIAO (ĐỌC TRƯỚC)

**Đã xong — prototype chạy được trong `latex_prototype/` (dùng làm nguồn chuẩn để port, KHÔNG làm lại từ đầu):**
- `test_parser.py` — engine chấm 5 nhóm (TB 1–5, Lo âu đảo chiều) + sinh nội dung rule-based (`build_strengths/improvements/overall_comment/roadmap/parent_advice`) + render báo cáo. Chạy `python3 test_parser.py` → `motivation_report.pdf` (2 trang). **→ PORT nguyên logic sang `web/lib/mslq/score.ts`.**
- `motivation_template.tex` — template báo cáo 2 trang (đã đẹp, khớp `MẪU BÁO CÁO`). **→ COPY sang `worker/templates/`, đổi sang font nhúng (xem §11).**
- `make_omr_sheet.py` → `omr_sheet.pdf` — **phiếu trả lời chuẩn OMR ĐEN TRẮNG** (ô tròn to, KHÔNG mốc góc; canh bằng khung viền bảng + dải header xám). In cho HS điền. Sinh từ ngân hàng 44 câu của engine.
- `mslq_scoring_criteria.md` — tiêu chí chấm chuẩn (5 nhóm, câu diễn giải nguyên văn). **Logic chấm phải khớp file này.**
- 3 PDF nguồn chuẩn: `BÀI TRẮC NGHIỆM...pdf` (44 câu gốc), `THANG ĐÁNH GIÁ...pdf` (cách chấm), `MẪU BÁO CÁO.docx.pdf` (bố cục báo cáo).

**Gemini Pro làm tiếp — theo thứ tự §10 (bước 1 ✅ đã xong):** dựng `worker/` (Docker texlive+opencv, `/omr` `/render`) → port `score.ts` + golden test → Supabase schema/RLS → Next.js UI (upload + đối soát + kết quả) → Gemini fallback đa key.

**Bất biến (KHÔNG được phá):** ① chấm điểm = xác định, khớp `mslq_scoring_criteria.md`, có golden test; ② báo cáo khớp `MẪU BÁO CÁO` 2 trang; ③ đọc ảnh = OMR xác định trước, Gemini chỉ là fallback hiếm (đa key); ④ luôn có bước người-duyệt cờ đỏ; ⑤ toàn bộ hosting free (Render/Oracle/HF — KHÔNG Cloudflare/GCR/Fly/Railway cho engine).

## 0. Quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Hình thức thu | **Phiếu giấy, chụp ảnh** (không làm digital) |
| Thiết kế phiếu | **Chuẩn OMR (đen trắng)**: ô tròn to, lưới đậm, header xám; KHÔNG ô mốc góc — canh chỉnh bằng KHUNG VIỀN BẢNG + dải header xám nhận hướng. ĐÃ DỰNG: `latex_prototype/make_omr_sheet.py` → `omr_sheet.pdf` |
| Đọc ảnh — chính | **OpenCV OMR xác định** (free, không API, audit được) |
| Đọc ảnh — chốt cuối | **Gemini 2.5 Flash (Vision API)** chỉ cho **dòng OMR không chắc** (tốc độ cực nhanh, siêu rẻ, tự xoay key) |
| Chặn lỗi | **Người duyệt 1-chạm** dòng cờ đỏ (kèm ảnh cắt dòng) |
| Chấm điểm | **TypeScript trong Next.js** (xác định, golden test) |
| Render PDF | **Worker Docker (texlive)** |
| FE/Auth/DB/Storage | **Next.js (Vercel hoặc Cloudflare Pages) + Supabase** |
| Host worker | **Render free** (MVP) / **Oracle Always Free** (không cold-start) / **HF Spaces** |

## 1. Hosting free — xác minh 6/2026

> ❗ **Cloudflare KHÔNG chạy được engine free**: Workers là V8 isolate (không chạy native binary
> như xelatex/OpenCV); Cloudflare Containers bắt buộc Workers Paid **$5/tháng**. Cloudflare chỉ
> hợp vai **Pages (FE) / R2 (storage) / CDN** — không phải nơi chạy engine.
> ❗ **Google Cloud Run, Fly.io, Railway**: KHÔNG còn free thực tế (đổi chính sách / bỏ free tier).

| Tầng | Cụ thể |
|---|---|
| Frontend | **Vercel Hobby** (hoặc Cloudflare Pages) | free, không thẻ |
| Auth/DB/Storage/Realtime | **Supabase free** | DB 500MB, Storage 1GB → nén WebP + dọn định kỳ |
| Worker (OMR+LaTeX) | **Render free** | Docker hạng nhất, 750h/tháng, không thẻ, **ngủ sau 15' (cold-start ~1')** |
| Worker (nâng cấp) | **Oracle Cloud Always Free** | VM ARM Ampere, **always-on không cold-start**, cần thẻ đăng ký |
| Worker (thay thế) | **HF Spaces free** | 2 vCPU/16GB, Docker, ngủ sau 48h |
| Gemini 2.5 Flash | **free tier + đa key** | tốc độ nhanh, rẻ, xoay key khi 429/quota |

> ⚠️ **CẢNH BÁO CRITICAL KHI DEPLOY (Vercel + Render Free):**
> Vercel Hobby có giới hạn timeout cho API Route là **10-15 giây**. Trong khi đó, Render Free mất **~1 phút (60s)** để khởi động lại (cold-start) sau khi ngủ.
> **Hậu quả:** Lần quét phiếu đầu tiên trong ngày, Vercel gọi Render → Render đang ngủ → Vercel bị timeout 504 trước khi Render kịp dậy.
> **Cách xử lý (Agent cần lưu ý):**
> - **Cách 1 (Pre-warm ở FE):** Ở màn hình "Chụp phiếu/Upload", viết code FE (React) tự động gọi `GET <WORKER_URL>/health` ngầm dưới background ngay khi màn hình vừa load để "đánh thức" worker sớm, trước khi user kịp chụp xong.
> - **Cách 2:** Chuyển ngay sang Oracle Cloud Always Free (không bao giờ ngủ) nếu có thẻ tín dụng.

## 2. Kiến trúc

```
[Trình duyệt tư vấn viên — điện thoại/desktop]
   └─ Next.js (Vercel): UI · upload · màn đối soát · CHẤM ĐIỂM (TS) · cổng gọi API
        ├─ Supabase: Auth · Postgres · Storage (ảnh WebP + PDF) · Realtime
        └─ Worker (Render, Docker):
             ├─ /omr    OpenCV: ảnh → 44 đáp án + density + cờ      [XÁC ĐỊNH, free]
             ├─ /gemini (đa key): ảnh cắt dòng mơ hồ → phân xử       [chốt cuối, hiếm]
             └─ /render xelatex: payload → .tex → PDF → Supabase
```

## 3. Đảm bảo độ chính xác (4 tầng)

| Tầng | Cách | Gemini |
|---|---|---|
| 1. OMR xác định | dò khung viền bảng → deskew (perspective) → adaptive threshold → đo density từng ô | 0 |
| 2. Guardrail (TS) | đủ 44 câu, mỗi câu ∈ [1,5]; dòng 0/≥2 ô tô hoặc density sát ngưỡng → **cờ đỏ** | 0 |
| 3. Gemini phân xử | CHỈ ảnh cắt dòng cờ đỏ (thường 0–2 dòng/phiếu) | tối thiểu |
| 4. Người duyệt 1-chạm | dòng còn cờ → ảnh cắt dòng cạnh radio → liếc & chạm | 0 |

- **Chấm điểm**: số học thuần (`mslq_scoring_criteria.md`) → **golden test khóa lại** → 100%.
- **Eval trước launch**: chạy OMR trên batch phiếu thật có ground-truth, đo accuracy theo ô, chỉnh ngưỡng.
- **Trung thực**: tầng 1–2 + chấm điểm = xác định; phần sót → cờ đỏ + người duyệt. Không có "tự động 100% khỏi nhìn".

## 4. CẤU TRÚC REPO (handoff)

```
/
├─ web/                          # Next.js 15 (Node 22+) + TypeScript → Vercel
│  ├─ app/api/scan/route.ts      # {photo_url} → gọi worker /omr → lưu mslq_results(status=review)
│  ├─ app/api/gemini/route.ts    # {result_id, cau} → cắt ảnh dòng → worker /gemini (đa key)
│  ├─ app/api/finalize/route.ts  # {result_id, answers[44]} → score.ts → worker /render → PDF url
│  ├─ app/review/[id]/page.tsx   # màn đối soát (ảnh trái + 44 radio phải + cờ đỏ)
│  ├─ app/result/[id]/page.tsx   # màn kết quả (ảnh gốc + preview PDF + link Zalo)
│  ├─ lib/mslq/groups.ts         # 5 nhóm: câu, max, reversed, 4 mức, diễn giải nguyên văn
│  ├─ lib/mslq/score.ts          # grade(44) + build_* (port từ test_parser.py) + payload LaTeX
│  ├─ lib/gemini/pool.ts         # đa key + tự xoay key
│  ├─ lib/supabase/*             # client + queries
│  └─ tests/score.test.ts        # GOLDEN TEST (input mẫu → điểm/mức kỳ vọng)
├─ worker/                       # Python 3.12 FastAPI → Render (Docker)
│  ├─ app.py                     # /health · /omr · /gemini · /render  (Bearer WORKER_SECRET)
│  ├─ omr.py                     # OpenCV pipeline (mục 6)
│  ├─ render.py                  # str.replace placeholder → xelatex → pdf bytes
│  ├─ templates/motivation_template.tex   # COPY từ latex_prototype (đổi font nhúng)
│  ├─ assets/fonts/              # serif + geometric sans (ưu tiên Be Vietnam Pro)
│  └─ Dockerfile                 # texlive-xetex + opencv-python-headless + fonts
└─ latex_prototype/              # ĐÃ CÓ, đã chạy — nguồn tham chiếu cho port
   ├─ test_parser.py             # engine chấm + render (logic chuẩn để port sang score.ts)
   ├─ motivation_template.tex     # template báo cáo 2 trang (đã đẹp)
   └─ make_omr_sheet.py           # sinh phiếu OMR
```

## 5. HỢP ĐỒNG API worker (Bearer `WORKER_SECRET`)

- `GET /health` → `{ok:true}`
- `POST /omr` ← `{ "image_url": "..." }` *(lưu ý: phải là Signed URL vì bucket private)* → `{ "answers":[{ "cau":1, "chon":4, "confidence":"high|med|low", "density":[0.1,0.1,0.1,0.8,0.1] }...44], "flags":[19,33], "orientation_ok":true }`
- `POST /gemini` ← `{ "image_url": "...", "cau": 1, "crop_bbox": [...] }` → `{ "cau": 1, "chon": 3, "confidence": "high" }` *(worker tự xoay key; có thể đặt pool ở web thay vì worker — chọn 1 nơi)*
- `POST /render` ← `{ "placeholders": { "__STUDENT_NAME__":"..." }, "upload_path": "tenant_1/result_123.pdf" }` → `{ "pdf_url": "..." }` 
  > **Bắt buộc:** Worker tải trực tiếp PDF lên Supabase Storage thông qua `SUPABASE_SERVICE_ROLE_KEY` và trả về URL. **Tuyệt đối không** trả file bytes (application/pdf) về cho Next.js API vì sẽ làm Next.js bị nghẽn và dính lỗi Timeout 10s của Vercel.

> `score.ts` (web) sinh TOÀN BỘ giá trị placeholder (gồm cả chuỗi LaTeX cho hàng/pill/bullet, y như `generate_pdf_report` hiện tại) → worker chỉ `replace` + `xelatex`. Worker "ngu", không chứa logic chấm.

## 6. Thuật toán OMR (`omr.py`)

1. Đọc ảnh → grayscale → GaussianBlur khử nhiễu.
2. **Phát hiện khung viền bảng** (hình chữ nhật lớn nhất): lấy 4 góc làm mốc. Hướng phiếu nhận qua **dải header xám** ở đầu bảng (bất đối xứng trên/dưới) → xoay nếu lật.
3. **Perspective transform** theo 4 góc khung bảng về khung chuẩn (sửa nghiêng/méo).
4. Adaptive threshold (chống bóng) → ảnh nhị phân.
5. **Cắt dòng**: dò grid line ngang của bảng → 44 băng dòng (x của 5 ô tròn là CỐ ĐỊNH theo cột).
6. Mỗi dòng: lấy mẫu 5 vùng ô → tính **density** (tỉ lệ pixel đen). Chọn ô đậm nhất.
7. **Cờ đỏ** nếu: max density < ngưỡng (bỏ trống) HOẶC ô đậm nhì gần ô đậm nhất (tô đúp/mơ hồ).
8. Trả answers + density + flags. *(Dùng so sánh tương đối trong dòng, không ngưỡng tuyệt đối, để bền với ánh sáng + chữ số mờ trong ô.)*

## 7. ENV

- **web**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_URL`, `WORKER_SECRET`, `GEMINI_API_KEYS` (CSV nhiều key).
- **worker**: `WORKER_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (để worker tự upload PDF lên bucket private), `GEMINI_API_KEYS` (nếu pool đặt ở worker). Worker cần cài thêm thư viện HTTP client (`httpx` hoặc `requests`) để tải ảnh từ Signed URL.

## 8. Schema Supabase

- `students(id, tenant_id, full_name, dob, parent_phone)`
- `mslq_results(id, tenant_id, student_id, photo_url, answers_jsonb, omr_meta_jsonb, scores_jsonb, report_pdf_url, status['reading'|'review'|'done'], created_at)`
- Buckets: `mslq-photos`, `mslq-reports`. **Bật RLS theo `tenant_id`**.

## 9. Luồng người dùng

1. Chụp/upload → **Nhập "Họ và tên" & "Năm sinh" (để chèn thẳng vào báo cáo in)** → nén WebP tại client → đẩy thẳng Supabase Storage.
2. `POST /api/scan` → worker `/omr` → lưu `mslq_results(status=review)`.
3. **Màn đối soát**: trái ảnh gốc (zoom/pan) · phải 44 radio; chỉ dòng cờ đỏ nổi bật + ảnh cắt dòng. (Tùy chọn) bấm "AI phân xử" → `/api/gemini`.
4. Bấm **"Chốt"** → `/api/finalize`: `score.ts` chấm → tạo payload → worker `/render` → PDF → Storage → `status=done`.
5. **Màn kết quả**: ảnh gốc (đối chiếu) + preview PDF + nút tải/sao chép link (Zalo).

## 10. Trình tự build + tiêu chí nghiệm thu

| # | Việc | Nghiệm thu |
|---|---|---|
| 1 | ✅ Phiếu OMR (`make_omr_sheet.py`) | In thử, chụp đọc rõ 4 fiducial + ô tròn |
| 2 | OMR reader (`worker/omr.py`) | Chụp 5 phiếu đã tô → đọc đúng 100% ô rõ, cờ đúng ô mờ |
| 3 | Golden test + port `score.ts` | Test khớp output Python hiện tại |
| 4 | Worker `/render` (Docker + **font nhúng**) | Render mock → khớp `latex_prototype/motivation_report.pdf` |
| 5 | Supabase schema + RLS + buckets | Tenant A không đọc được data tenant B |
| 6 | Next.js: upload + đối soát + kết quả | Luồng full 1 bài chạy được end-to-end |
| 7 | Gemini fallback đa key + eval | Lệch key tự xoay; eval batch đạt ngưỡng accuracy |

## 11. Việc bắt buộc trước khi containerize

Template hiện dùng font macOS (Times New Roman, Avenir Next) — **Docker Linux không có** → **nhúng file font** vào `worker/assets/fonts/` và trỏ path (kiểu `design.md`): 1 serif + 1 geometric sans, ưu tiên **Be Vietnam Pro**. Render trong Docker phải khớp bản macOS.

## 12. Chưa làm trong MVP
Multi-mã-đề, BullMQ/Redis queue, PWA offline sync (xem `plan.md` §3/§7).
