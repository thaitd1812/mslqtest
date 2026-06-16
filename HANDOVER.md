# TÀI LIỆU BÀN GIAO & VẬN HÀNH DỰ ÁN `chambaionline`
*(Dành cho Maintainer & Antigravity/AI Agent)*

Tài liệu này cung cấp toàn cảnh kiến trúc dự án và các bước thiết lập môi trường để Maintainer mới (cùng với AI Agent hỗ trợ) có thể tiếp quản, vận hành và cập nhật hệ thống ngay lập tức.

---

## 1. TỔNG QUAN KIẾN TRÚC & TECH STACK

Dự án gồm 3 cụm chính:

1. **`web/` (Frontend & API Route)**
   - **Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS.
   - **Nhiệm vụ**: Giao diện upload ảnh, màn hình đối soát kết quả, tính toán điểm số (xác định, chạy trên server/edge qua `score.ts`), trả file PDF.
   - **Hosting**: Vercel.

2. **Supabase (Database, Auth, Storage)**
   - **Nhiệm vụ**:
     - `Auth`: Quản lý người dùng/tenant.
     - `Postgres Database`: Lưu dữ liệu học sinh (`students`) và kết quả (`mslq_results`).
     - `Storage`: Bucket `mslq-photos` (lưu ảnh WebP) và `mslq-reports` (lưu PDF đã render).

3. **`worker/` (Backend Xử lý Ảnh & Render PDF)**
   - **Stack**: Python 3.12 (FastAPI), OpenCV (OMR chấm điểm), XeLaTeX (render PDF báo cáo).
   - **Nhiệm vụ**: API nội bộ để xử lý ảnh (nhận diện OMR khung viền bảng, cắt dòng), fallback gọi Gemini, render PDF báo cáo.
   - **Hosting**: Render (Docker Free) hoặc Oracle Cloud/HF Spaces (do cần chạy binary native `texlive` và `opencv`, không chạy được trên serverless thuần túy như Cloudflare Workers).

---

## 2. CHỈ DẪN DÀNH CHO AI AGENT (ANTIGRAVITY)

**@Agent đọc kỹ các nguyên tắc bất biến (CRITICAL RULES) sau trước khi sửa code:**
1. **Kiến trúc phân tách rõ ràng:** `web/` chỉ làm UI và tính toán số học (`score.ts`). `worker/` chỉ xử lý computer vision (OpenCV) và compile LaTeX (`render.py`), không chứa logic tính điểm.
2. **Deterministic (Xác định) > AI:** Thuật toán chấm bài OMR là **thuật toán xác định** qua OpenCV. AI (Gemini 2.5 Flash) **chỉ là chốt cuối** được gọi để phân xử khi có "cờ đỏ" (ô bị mờ, tô đúp). Tuyệt đối không dùng AI để nhận diện toàn bộ phiếu.
3. **Template PDF:** Giao diện PDF (`motivation_template.tex`) phải khớp chuẩn. Worker chạy trong Docker Linux nên phải dùng font nhúng (`assets/fonts/`).
4. **Vấn đề Cold-start của Worker:** Worker host trên Render bản Free sẽ ngủ sau 15 phút. Vercel API Route bị timeout sau 10-15s. Hãy cẩn thận khi design API flow, cân nhắc pre-warm worker ngay ở client từ lúc user mở màn hình chụp ảnh.

---

## 3. CHECKLIST QUYỀN TRUY CẬP (ACCESS HANDOVER)

Chủ dự án cũ cần cấp quyền cho Maintainer mới các nền tảng sau:

- [ ] **GitHub**: Invite Collaborator vào repository chứa mã nguồn này.
- [ ] **Supabase**: Invite vào Organization/Project tương ứng.
- [ ] **Vercel**: Invite vào Team (để xem server logs, quản lý biến môi trường cho Web).
- [ ] **Render** (hoặc nền tảng host Worker hiện tại): Invite quản lý app Worker.
- [ ] **Domain / DNS (Cloudflare)**: (Tùy chọn) Nếu sau này cần trỏ subdomain.
- [ ] **Bàn giao File Biến Môi Trường (`.env`)**: Gửi tệp biến môi trường qua kênh bảo mật.

---

## 4. HƯỚNG DẪN SETUP MÔI TRƯỜNG LOCAL

### A. Chuẩn bị biến môi trường
Tạo file `.env.local` trong thư mục `web/` và `.env` trong thư mục `worker/` với các giá trị được bàn giao.

**File `web/.env.local`**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
WORKER_URL=http://127.0.0.1:8000
WORKER_SECRET=your_secret_token_for_worker_auth
GEMINI_API_KEYS=key1,key2  # Fallback
```

**File `worker/.env`**
```env
WORKER_SECRET=your_secret_token_for_worker_auth
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEYS=key1,key2
```

### B. Chạy Frontend (`web/`)
```bash
cd web
npm install
npm run dev
# App sẽ chạy ở http://localhost:3000
```

### C. Chạy Backend Worker (`worker/`)
Khuyến nghị dùng `uv` hoặc `venv`.
```bash
cd worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Chạy server FastAPI
uvicorn app:app --reload --port 8000
```

---

## 5. QUẢN LÝ DEPLOYMENT (PRODUCTION)

- **Cập nhật Frontend**: Code push lên nhánh `main` (hoặc nhánh prod) trên GitHub sẽ được Vercel tự động deploy.
- **Cập nhật Worker**: Render tự động build lại Docker image khi có code mới đẩy lên nhánh được liên kết. Hãy kiểm tra tab Deploy Logs trên Render nếu bị lỗi.
- **Cập nhật Database**: Đọc/Sửa Schema qua Supabase Dashboard. Mọi rule bảo mật đều dùng RLS theo `tenant_id`.

---
*Tài liệu được sinh bởi Antigravity AI - Hỗ trợ bởi Google DeepMind.*
