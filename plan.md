# KẾ HOẠCH KIẾN TRÚC & TRIỂN KHAI DỰ ÁN: HỆ THỐNG ANTIGRAVITY

**Hệ thống số hóa đề thi, chấm bài trắc nghiệm tự động & Quản lý đánh giá năng lực**

---

## 1. THIẾT KẾ CƠ SỞ DỮ LIỆU TỐI ƯU (SUPABASE JSONB SCHEMA)

Để đảm bảo hệ thống vận hành siêu nhẹ và linh hoạt cho nhiều định dạng đề thi mà không phải thay đổi cấu trúc bảng liên tục, kiến trúc lưu trữ sẽ tận dụng tối đa kiểu dữ liệu `JSONB` của PostgreSQL.

### Bảng 1: `exam_bank` (Quản lý ngân hàng đề gốc)

- `id`: `UUID` (Primary Key, Auto-generated)
- `tenant_id`: `UUID` (Mã Trung tâm / Chi nhánh - Dùng cho Multi-tenant & RLS)
- `exam_code`: `VARCHAR(50)` (Unique, Index - ví dụ: `GROWX-2026-02`)
- `title`: `TEXT` (Tên đề thi - ví dụ: _Đề đánh giá năng lực đầu vào khối 8_)

### Bảng 1.1: `exam_versions` (Quản lý các Mã Đề xáo trộn)
*Đề thi trắc nghiệm bắt buộc phải có nhiều mã đề (101, 102...) để chống gian lận. Bảng này lưu từng phiên bản của đề thi gốc.*
- `id`: `UUID` (Primary Key)
- `exam_id`: `UUID` (Foreign Key -> `exam_bank`)
- `version_code`: `VARCHAR(10)` (ví dụ: `101`, `102`)
- `structure_json`: `JSONB`  
   _Cấu trúc bên trong (Bổ sung `image_url` để giữ lại biểu đồ/hình ảnh từ PDF gốc):_
  ```json
  {
    "total_questions": 44,
    "questions": [
      {
        "cau_so": 1,
        "noi_dung": "Look at the chart below...",
        "image_url": "https://supabase.co/.../q1_chart.png",
        "cac_lua_chon": ["cat", "bag", "hate", "map"],
        "dap_an_dung": 3,
        "tag": "Phat_am",
        "level": "co_ban"
      }
    ]
  }
  ```

### Bảng 2: `students` (Hồ sơ học sinh)

- `id`: `UUID` (Primary Key)
- `tenant_id`: `UUID` (Mã Trung tâm / Chi nhánh)
- `full_name`: `VARCHAR(255)`
- `dob`: `DATE`
- `parent_phone`: `VARCHAR(15)`
- `target`: `VARCHAR(50)` (Enum: 'thi_cap_3', 'thi_chuyen', 'hsg', 'cai_thien')

### Bảng 3: `test_results` (Lịch sử chấm bài & Đối soát)

- `id`: `UUID` (Primary Key)
- `tenant_id`: `UUID` (Mã Trung tâm / Chi nhánh)
- `student_id`: `UUID` (Foreign Key -> `students` - Trích xuất tự động từ phần tô SBD)
- `exam_version_id`: `UUID` (Foreign Key -> `exam_versions` - Trích xuất tự động từ phần tô Mã Đề)
- `compressed_image_url`: `TEXT` (Đường dẫn ảnh bài làm dạng WebP siêu nhẹ lưu trên Supabase Storage)
- `status`: `VARCHAR(20)` (Enum: 'pending_review', 'reviewed', 'failed')
- `ai_raw_data`: `JSONB` (Kết quả mảng đáp án thô do thuật toán OpenCV đọc được ban đầu)
- `score_details`: `JSONB` (Lưu thông tin đánh giá chung, tổng điểm tự động sinh ra)
- `created_at`: `TIMESTAMPTZ`

### Bảng 4: `student_answers` (Thống kê & Analytics chi tiết)
*Được tách ra từ `test_results` để giải quyết vấn đề nghẽn cổ chai khi truy vấn Analytics diện rộng.*
- `id`: `UUID` (Primary Key)
- `test_result_id`: `UUID` (Foreign Key -> `test_results`)
- `question_number`: `INT`
- `is_correct`: `BOOLEAN`
- `tag`: `VARCHAR(50)`
- `level`: `VARCHAR(50)`

---

## 2. QUY TRÌNH SỐ HÓA ĐỀ THI (PDF ➔ STRUCTURED JSON)

Giải quyết bài toán triệt tiêu việc lưu trữ file PDF đề gốc cồng kềnh bằng cách trích xuất dữ liệu thông minh qua Gemini Flash 2.5.

[Upload PDF Đề Gốc] ➔ [Node.js Backend] ➔ [Gemini Flash API + Zod Schema]
│
▼
[JSON Dữ Liệu Sạch] ➔ [Hiển thị Preview] ➔ [Lưu DB & Xóa PDF]

### Chi tiết các bước xử lý:

1.  **Frontend:** Giáo viên chọn file PDF đề thi gốc và nhấn Upload.
2.  **Backend (Node.js):** Tiếp nhận file và gửi trực tiếp luồng byte sang API Gemini Flash 2.5.
3.  **Bịt lỗ hổng Ảo giác (Hallucination) & Timeout:** 
    - Cấu hình tham số API bắt buộc: `responseMimeType: "application/json"`.
    - **Xử lý đề chứa Toán/Hình vẽ:** Chia nhỏ file PDF và kết hợp OCR hoặc xử lý multimodal chặt chẽ, tránh lỗi LLM bị ảo giác khi đọc công thức Toán học/hình học phức tạp.
    - Sử dụng thư viện `zod` để định nghĩa một cấu trúc JSON nghiêm ngặt (`ZodSchema`). Khuôn mẫu này ép AI phải nhả dữ liệu chính xác theo kiểu: `cau_so` phải là số, `dap_an_dung` nằm trong khoảng `[1, 5]`.
    - **Cơ chế Tự sửa (Retry Mechanism):** Nếu chuỗi JSON trả về bị lỗi hoặc không khớp với màng lọc `zod`, hệ thống tự động bắt lỗi (catch), đính kèm lý do lỗi vào prompt mới và gọi lại Gemini tối đa 3 lần trước khi bắn lỗi về màn hình giáo viên.
    - **Xử lý Timeout API:** Đưa tiến trình gọi Gemini vào Background Worker thay vì gọi API đồng bộ, phòng lỗi `504 Gateway Timeout` với các file PDF dài.
4.  **Frontend Preview & Xác nhận:** 
    - Dữ liệu JSON sạch được hiển thị dưới dạng một bảng (Table) giao diện cho giáo viên kiểm tra nhanh trong 5 giây (Các câu hỏi đã nhận diện đúng chưa? Gắn tag phân loại đã chuẩn ngữ pháp/phát âm chưa?).
    - Khi ấn **"Xác nhận"**, hệ thống đẩy JSON vào `exam_versions`. **KHÔNG XÓA FILE PDF GỐC:** Thay vì xóa hoàn toàn (gây mất biểu đồ, hình học), Backend sẽ chạy thêm luồng tự động cắt (Crop) hình ảnh của các câu hỏi có chứa biểu đồ/công thức phức tạp và lưu lên Supabase Storage, sau đó nhúng `image_url` vào cấu trúc JSON để phục vụ việc in báo cáo cuối tháng cho Phụ huynh.

---

## 3. CORE PIPELINE: TIỀN XỬ LÝ ẢNH & THUẬT TOÁN OMR

Để loại bỏ tình trạng ảnh "xấu điên", đen ngòm do bóng tay hoặc mờ nhòe, bức ảnh chụp bài thi phải chạy qua luồng xử lý 4 bước nghiêm ngặt bằng OpenCV. **Lưu ý Vận hành Cốt lõi:** Việc xử lý OMR ngốn rất nhiều CPU, do đó **tuyệt đối không chạy `opencv.js` ở Client (Trình duyệt của giáo viên)** để tránh treo máy. Thuật toán OMR phải được đẩy lên một Backend Python Worker biệt lập (sử dụng `opencv-python` chạy trên C++ core) để đạt tốc độ nhanh nhất.

### Luồng xử lý ảnh 4 bước (OpenCV Pipeline):

1.  **Bước 1: Grayscale (Chuyển ảnh xám)**
    - _Hàm:_ `cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY)`
    - _Mục đích:_ Loại bỏ các kênh màu không cần thiết (R, G, B), đưa ảnh về dạng cường độ sáng đơn kênh để tăng tốc độ tính toán cho các bước sau.
2.  **Bước 2: Gaussian Blur (Khử nhiễu hạt)**
    - _Hàm:_ `cv.GaussianBlur(src, dst, new cv.Size(5, 5), 0)`
    - _Mục đích:_ Làm mịn và triệt tiêu các hạt nhiễu kỹ thuật số (noise) li ti do cảm biến camera điện thoại gây ra ở điều kiện thiếu sáng. Thiếu bước này, các hạt nhiễu sẽ biến thành đốm đen bẩn khi chạy bộ lọc tiếp theo.
3.  **Bước 3: Adaptive Thresholding (Ngưỡng thích ứng cục bộ)**
    - _Hàm:_ `cv.adaptiveThreshold(src, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2)`
    - _Mục đích:_ Đây là cốt lõi loại bỏ bóng râm. Thuật toán không quét toàn bộ bức ảnh theo một mức cố định, mà chia nhỏ ảnh thành các vùng 11x11 pixel để tính toán độ tương phản riêng. Vùng bị bóng tay che khuất sẽ tự động được bù sáng. Kết quả: Nền giấy biến thành màu trắng phao tuyệt đối, mực viết tay biến thành màu đen đậm sắc nét.
4.  **Bước 4: Morphological Operations (Phép toán Hình thái học)**
    - _Hàm:_ `cv.morphologyEx(src, dst, cv.MORPH_CLOSE, kernel)`
    - _Mục đích:_ Sử dụng phép toán `MORPH_CLOSE` (Đóng) giúp làm mịn rìa chữ viết tay, lấp đầy các khoảng trống đứt nét do học sinh tô bút nhạt hoặc camera bị mờ, đồng thời làm đầy các ô tròn trắc nghiệm bị tô lỡ cỡ.

### Thuật toán Căn phẳng ảnh & Đọc kết quả trắc nghiệm OMR:

- **Khắc phục Lỗi Lật Ngược & Méo Ống Kính (Orientation & Lens Distortion):** 
  - *Điểm neo bất đối xứng:* Thay vì 4 ô vuông giống nhau ở 4 góc khiến thuật toán bị nhầm lẫn khi ảnh chụp lật ngược 180 độ, hệ thống sẽ thiết kế **Góc trên bên trái là Hình Tròn (hoặc vạch Barcode)**, 3 góc còn lại là Hình Vuông. OpenCV quét qua để tự động xoay ảnh (Deskew) đúng chiều.
  - *Timing Tracks:* Bổ sung các vạch canh lề màu đen (Timing Tracks) ở mép dọc của giấy thi. Thay vì chỉ căn phẳng 4 góc (Perspective Transform) - vốn không sửa được lỗi phình to ở giữa do méo thấu kính Camera điện thoại, hệ thống sẽ map lưới tọa độ chéo qua từng vạch canh lề này để định vị chính xác từng dòng câu hỏi, bất chấp giấy bị cong viền.
- **Quét Số Báo Danh (SBD) & Mã Đề:** Thuật toán OMR được thiết kế chia làm 3 phân khu rõ rệt: Khu vực SBD (6 cột số), Khu vực Mã Đề (3 cột số) và Khu vực Đáp án. Dữ liệu SBD và Mã đề quét được sẽ dùng để tự động lookup ID học sinh và đáp án `exam_versions` tương ứng, loại bỏ hoàn toàn việc giáo viên phải nhập tay. Bức ảnh sau khi xử lý phải được **lưu lại ở trạng thái ĐÃ CĂN PHẲNG** để Frontend làm Overlay.
- **Thuật toán Mật độ Pixel (Pixel Density) & Phát Hiện Dấu X:** 
  - Khắc phục lỗi Pixel cứng nhắc: Hạ ngưỡng đen xuống `~30-40%` để bắt được các trường hợp tô bút chì nhạt, đánh dấu "X", hoặc "V". Lý tưởng nhất dài hạn là tích hợp AI nhẹ (YOLOv8 nano) để quét chính xác ô tròn.
  - Phát hiện Cờ Đỏ (Flag): Câu hỏi có >1 ô tô (tô đúp) hoặc 0 ô tô (bỏ trống) ➔ `confidence_score = low`, tự động bôi đỏ trên màn hình giáo viên.

---

## 4. GIAI ĐOẠN ĐỐI SOÁT MULTI-VIEW "DỄ SOI" CHO GIÁO VIÊN

Tính năng sống còn quyết định độ mượt và tính thực tế khi giáo viên chấm bài hàng loạt tại trung tâm.

### 1. Nén ảnh tại Client (Front-end Compression)

- Khi giáo viên tải ảnh chụp lên (thường nặng từ 3MB - 5MB), React sử dụng thư viện xử lý ảnh phía client (như `browser-image-compression`) để tự động chuyển đổi định dạng và hạ độ phân giải xuống chuẩn **WebP** siêu nén với dung lượng tối ưu chỉ từ **100KB - 150KB**.
- **Giải quyết nghẽn Browser & Offline Sync (PWA):** Giáo viên thường thu bài và chụp ngay tại lớp học (nơi WiFi có thể chập chờn). Web App được cấu hình chuẩn Progressive Web App (PWA). Khi giáo viên chụp liên tục 40 bài, ảnh sẽ được nén nhanh bằng Web Worker và **lưu tạm vào `IndexedDB` dưới Local (Trải nghiệm Zero-Latency)**. Khi có mạng ổn định, cơ chế **Background Sync** sẽ ngầm đẩy tuần tự các ảnh này lên Server OpenCV Python, loại bỏ hoàn toàn cảm giác "xoay tít chờ tải" gây ức chế.
- Ảnh này vừa đủ độ sắc nét để mắt người đọc rõ mồn một khi đối soát, nhưng dung lượng cực kỳ nhỏ, giúp trang lịch sử xem lại bài chấm tải ngay tức thì và không lo tốn không gian Supabase Storage.

### 2. Thiết kế Màn hình Kiểm duyệt Split-View (Chia đôi không gian)

- **Nửa bên trái (Khung soi ảnh):** Hiển thị **file ảnh WebP ĐÃ ĐƯỢC CĂN PHẲNG** từ luồng OpenCV (không dùng ảnh gốc bị nghiêng). Tích hợp thư viện điều hướng chuột `react-zoom-pan-pinch`. Giáo viên có thể lăn con cuộn chuột để phóng to sát vào từng câu hỏi, hoặc nhấn giữ chuột để kéo (Pan) di chuyển vùng ảnh mượt mà, không giật lag. Hệ thống tự động vẽ một lớp phủ (Overlay) gồm các ô vuông đỏ đè lên các đáp án mà thuật toán OMR đã đọc được trên ảnh giấy.
- **Nửa bên phải (Form chốt kết quả kỹ thuật số):** Hiển thị danh sách 44 câu dạng Radio button từ 1 đến 5. Toàn bộ kết quả OMR tự động điền sẵn vào đây.
- **Cơ chế Bắt lỗi thông minh (Flagging Highlight):** Những câu hỏi bị dính cờ cảnh báo `confidence_score = low` (do học sinh tô mờ, tẩy xóa lem nhem hoặc bỏ trống) sẽ bị **bôi đỏ rực** trên form kỹ thuật số. Giáo viên chỉ cần đảo mắt nhìn qua các tiêu điểm đỏ, liếc sang ảnh gốc đối chiếu và click đúp chuột sửa lại đúng thực tế chỉ trong 1 giây. Khi giáo viên bấm nút **"Chốt Điểm"**, dữ liệu lưu vào bảng `test_results` với trạng thái `reviewed`.

### 6.3. Tương tác Chống Lỗi (Error Prevention)
- Nút "Hoàn tất & Xuất PDF LaTeX" sử dụng thao tác "Trượt để chốt" (Swipe to confirm) giống trên iOS để tránh tuyệt đối việc giáo viên chạm nhầm khi đang cuộn màn hình.

### 6.4. WIREFRAME MOCKUP (DEMO GIAO DIỆN SPLIT-VIEW)

Dưới đây là bản nháp UI trực quan cho màn hình quan trọng nhất: **ĐỐI SOÁT CHẤM BÀI** trên giao diện Desktop.

<div align="center">
  <img src="/Users/admin/Documents/thaitd/Code/chambaionline/logoGrowX.png" width="200" alt="GrowX Logo"/>
</div>

---

**[ 🏠 Bảng điều khiển ]**  **[ 📝 Ngân hàng đề ]**  **[ 📊 Lớp 8A1 ]**  **[ ⚙️ Cài đặt ]**  |  👤 *Giáo viên: Ms. Diễm*

---

> **BÀI THI: TRƯƠNG TRIẾT KHÔI (SBD: 689) - TRẠNG THÁI: CHỜ DUYỆT LỖI** 

| 🖼️ KHUNG TRÁI: ẢNH BÀI THI (ZOOMABLE) | 📋 KHUNG PHẢI: FORM CHẤM MÁY (EDITABLE) |
|:---|:---|
| `[+] Zoom In`  `[-] Zoom Out`  `[⛶] Fit` | **ĐIỂM: 25/34** - ⏳ *Thời gian AI quét: 0.8s* |
| ![Bài thi mô phỏng](https://placehold.co/400x450/e0e7ff/312e81?text=Ảnh+Bài+Làm\n(Hỗ+Trợ+Kếo+Thả+Để+Pan)) | **SBD:** `[ 689 ]` 🟢 <br> **MÃ ĐỀ:** `[ 101 ]` 🟢 |
| *(Vùng ảnh hỗ trợ thao tác kéo thả chuột mượt mà để giáo viên soi các góc giấy bị nhiễu)* | --- |
| | **Câu 1:** `(A)` `(B)` `[X]` `(D)`  `[✓]` <br> **Câu 2:** `[X]` `(B)` `(C)` `(D)`  `[✓]` <br> **Câu 3:** `(A)` `(B)` `(C)` `[X]`  `[✓]` <br> **Câu 4:** `[X]` `(B)` `[X]` `(D)`  🚨 **[CẢNH BÁO TÔ ĐÚP]** <br> **Câu 5:** `[X]` `(B)` `(C)` `(D)`  `[✓]` |
| | --- |
| | `[ ↩ Undo (Ctrl+Z) ]` <br><br> `[ ⚡ TRƯỢT ĐỂ LƯU & XUẤT PDF ➔ ]` |

**Quy chuẩn Hệ thống Nút bấm (Button System):**
1. **Primary Action (Call to Action):** Gradient Tím/Xanh `[ ⚡ CHẤM NGAY ]`. Dùng hiệu ứng bóng nổi đa tầng (multi-layer shadow).
2. **Secondary/Ghost:** Nút viền trong suốt `[ 📤 Tải lại ảnh ]` (Glassmorphism).
3. **Danger State (Chớp Đỏ):** Ô vuông `🚨 [CẢNH BÁO TÔ ĐÚP]` sẽ nhấp nháy (pulse animation) đập vào mắt người dùng để chống bỏ sót lỗi của AI.
4. **Swipe to Action:** Nút thanh trượt dài ở cuối cùng để xác nhận.

---

## 5. PIPELINE LOGIC TÍNH ĐIỂM & XUẤT BÁO CÁO PDF

### 1. Hàm So khớp JSON & Thống kê

Khi giáo viên bấm nút "Chốt Điểm", Node.js Backend lập tức gọi dữ liệu `final_data` vừa chốt đối chiếu chéo với dữ liệu cấu trúc đề chuẩn `structure_json` lưu trong bảng `exam_bank`. Hệ thống sẽ chạy thuật toán phân nhóm:

- Tính tổng điểm, đếm số câu cơ bản đúng trên tổng số câu cơ bản, số câu nâng cao đúng trên tổng số câu nâng cao.
- Gom nhóm các câu bị sai theo thuộc tính `tag` (Ví dụ: Đọc hiểu sai bao nhiêu câu, Phát âm sai bao nhiêu câu).
- Ánh xạ tỷ lệ câu đúng/sai theo tag vào một bộ luật (Rules mapping) cấu hình sẵn để tự động sinh ra chuỗi văn bản nhận xét cá nhân hóa (Ví dụ: _"Kỹ năng Phát âm còn yếu do sai 2/3 câu, cần cải thiện..."_).

#**Màn hình 3: Trạm Chụp Bài (Mobile PWA Scanner)**
- *Mobile Only:* Giao diện biến điện thoại thành máy Scan. Mở full Camera.
- *Trải nghiệm:* Có khung ngắm chéo (Overlay) hướng dẫn giáo viên căn mép giấy. Nút chụp lớn ở đáy màn hình. Chụp xong số lượng cập nhật ngay (1/40) mà không có bất kì độ trễ mạng nào nhờ PWA IndexedDB.

**Màn hình 4: Bắt tên Học sinh tự động (Auto-Identify)**
- Sau khi tải ảnh lên, giáo viên bấm nút **"Chấm Bài"**, AI sẽ chạy ngầm phân tích.
- Thuật toán (OCR) sẽ cắt riêng Vùng viết tên trên tờ giấy, tự động đọc chữ viết tay và trích xuất thành văn bản.
- Hiển thị pop-up nhỏ: *"Có phải bài của Trương Triết Khôi không?"*. Giáo viên có thể gõ sửa lại nếu nét chữ học sinh quá xấu làm OCR đọc sai, sau đó bấm Xác nhận để vào luồng xuất Báo cáo.

**Màn hình 5: Đối soát Báo cáo & Bài thi (Split-View PDF Verification)**
- Đây là màn hình nghiệm thu cuối cùng cực kỳ ngầu của hệ thống.
- *Desktop Layout:* Chia đôi màn hình (50/50).
  - **Nửa Trái:** Ảnh chụp bài thi thực tế của học sinh (Hỗ trợ cuộn chuột Zoom, kéo thả Pan hình để soi kỹ bài làm).
  - **Nửa Phải:** Bản Preview PDF Kết Quả (Báo cáo LaTeX) vừa được hệ thống sinh ra. Ngay bên cạnh (hoặc nổi đè lên trên) là Form đáp án máy chấm. Các câu AI chấm độ tin cậy thấp (Tô mờ, tô đúp) sẽ **nhấp nháy viền Đỏ**.
  - *Tương tác Live:* Nếu giáo viên sửa kết quả 1 câu trong form, bản PDF bên phải sẽ được tự động Compile lại và thay đổi điểm số ngay lập tức!
- *Mobile Layout:* Ảnh bài thi sẽ hiện ở định dạng Pop-up, nửa dưới là bản Preview báo cáo có thể cuộn độc lập.

### 2. Trình kết xuất PDF Chuyên nghiệp bằng LaTeX (thay vì Puppeteer)

- **Lý do chuyển đổi:** Puppeteer ngốn cực nhiều RAM (~150-300MB/luồng) và dễ gây sập Server (OOM). Hơn nữa, việc xuất bằng HTML sang PDF thường không hoàn hảo về phân trang và dàn trang in ấn. **LaTeX** là giải pháp "vàng" giải quyết triệt để vấn đề này: Sinh file PDF siêu nhẹ, chạy bằng command-line cực nhanh ít tốn RAM, và chất lượng dàn trang/typography đạt chuẩn xuất bản chuyên nghiệp.
- **Luồng xử lý LaTeX Backend:** 
  - Tạo một file template `.tex` chuẩn hóa form báo cáo của học viện GrowX.
  - Sử dụng template engine (VD: Jinja2 trên Python) để fill dữ liệu JSON (thông tin học sinh, điểm số, đánh giá) vào file `.tex`.
  - Gọi subprocess chạy lệnh `xelatex` (hỗ trợ tốt font Unicode/Tiếng Việt) để biên dịch `.tex` thành `.pdf`.
- **Thiết lập Môi trường Server:** Docker container cài đặt sẵn bản phân phối TeX nhẹ (`texlive-xetex`) và các bộ font cần thiết để đảm bảo hiển thị Tiếng Việt hoàn hảo không bị vỡ font.
- **Lưu trữ & Chia sẻ:** File báo cáo PDF sau khi LaTeX kết xuất thành công sẽ được đẩy trực tiếp lên một bucket riêng trên Supabase Storage. Link liên kết dạng chuỗi (URL) được ghi nhận vào cột `score_details` của kết quả bài thi để giáo viên có thể nhấn nút tải xuống nhanh hoặc sao chép liên kết chia sẻ trực tiếp tới phụ huynh thông qua Zalo.

---

## 6. KIẾN TRÚC & GIAO DIỆN WEB APP (FRONTEND EXPERIENCES)

Hệ thống yêu cầu tương tác và xử lý nhiều tác vụ phức tạp ở phía Client (Upload ảnh hàng loạt, Image Viewer zoom/pan, Live Form Edit). 

### 6.1. Technology Stack
- **Core Framework:** React 19 (via Next.js hoặc Vite) cho tốc độ render cực nhanh nhờ Virtual DOM và thư viện hệ sinh thái phong phú.
- **Styling:** Vanilla CSS kết hợp với các bộ UI components chất lượng cao (như Radix UI) nhằm tạo sự nhất quán, tránh vỡ layout ở các thiết bị khác nhau. Có thể sử dụng Tailwind CSS nếu cần thiết kế tùy chỉnh nhanh, nhưng ưu tiên Vanilla CSS để kiểm soát toàn diện.
- **State Management:** Zustand hoặc React Query để quản lý luồng dữ liệu API (cache dữ liệu bài chấm, quản lý tiến trình upload ảnh background).

### 6.2. Thiết Kế UX/UI Chuẩn Premium & Hiện Đại (Modern Aesthetics)
- **Vibrant & Glassmorphism:** Các giao diện popup hướng dẫn, modal xử lý loading, và sidebar điều hướng sẽ sử dụng hiệu ứng kính mờ (Backdrop-filter blur), kết hợp màu sắc có độ tương phản cao, hiện đại giúp ứng dụng "wow" ngay từ cái nhìn đầu tiên. Tuyệt đối tránh sử dụng các gam màu đơn điệu (đỏ chót, xanh trơn).
- **Micro-Animations & Motion:** Đưa các vi chuyển động (micro-animations) vào những thao tác chờ (VD: khi ảnh chụp bài thi đang quét OpenCV, hiển thị tia quét lướt ngang hình ảnh bài làm mượt mà). Việc này giúp lấp đầy khoảng thời gian trống của giáo viên, giảm cảm giác sốt ruột.
- **Responsive Layout Chuyên Biệt:** 
  - *Màn hình Mobile:* Tối ưu lại luồng upload nhanh từ camera điện thoại. Chức năng đối soát Split-View sẽ hiển thị dạng cuộn linh hoạt thay vì chia đôi (hoặc dùng Pop-up Drawer) để đảm bảo ngón tay giáo viên không chạm nhầm. Cấu trúc HTML ngữ nghĩa (Semantic HTML) và Typography (Google Fonts như Inter, Outfit) sẽ được áp dụng triệt để.

---

## 7. KIẾN TRÚC BACKEND CHUYÊN SÂU (ENTERPRISE SCALABILITY)

Sau khi định hình các luồng cơ bản, tầng Backend cần được tái cấu trúc để chịu tải thực tế (tránh sập RAM, Timeout, Kẹt luồng) khi hàng chục giáo viên chấm bài cùng lúc:

### 7.1. Tránh "Tắc nghẽn" Node.js bằng Direct Upload
- **Vấn đề:** Đẩy hàng chục ảnh (hoặc PDF nặng) trực tiếp qua API Node.js sẽ làm kẹt luồng (Single Thread) và rò rỉ bộ nhớ (Memory Leak).
- **Giải pháp:** Sử dụng **Pre-signed URLs**. Frontend gọi API lấy link upload tạm thời từ Supabase Storage, sau đó tự đẩy file **TRỰC TIẾP** thẳng lên Cloud (bỏ qua Node.js). Xong xuôi mới gửi URL về cho DB.

### 7.2. Giao tiếp Event-Driven (Chống Timeout OMR)
- **Vấn đề:** Node.js gọi API sang Python Worker (để chạy OpenCV) và `await` chờ kết quả sẽ gây ra HTTP Timeout (vì 40 ảnh quét mất 40-120s).
- **Giải pháp:** Dùng Message Queue (BullMQ/Redis). Node.js nhận yêu cầu ➔ Bắn Event `omr.start` vào Queue ➔ Trả về `200 OK` cho Frontend ngay lập tức. Python Worker nhặt Job chạy dưới nền, chạy xong bắn Event qua **WebSockets/SSE** cập nhật Realtime lên màn hình giáo viên.

### 7.3. Tránh chấm đúp & Quản lý kẹt Job (Idempotency & DLQ)
- **Vấn đề:** Mạng lag giáo viên ấn "Chấm" 2 lần, hoặc Python sập RAM chết dở chừng khiến Job kẹt vĩnh viễn.
- **Giải pháp:** 
  - Tạo `Idempotency Key` (VD: `submission_id`) từ Frontend để DB chặn các luồng gửi đúp.
  - Cấu hình **Dead Letter Queue (DLQ)**. Bất cứ ảnh nào chạy OpenCV lỗi quá 3 lần sẽ bị tống vào DLQ và báo đỏ về Frontend: *"Bài thi SBD X bị nhiễu nặng, vui lòng chấm tay"*.

### 7.4. Bảo mật Đa Trung Tâm (Multi-tenant & RLS)
- **Vấn đề:** Không có gì ngăn cản Giáo viên trung tâm A đổi API sửa điểm của lớp trung tâm B.
- **Giải pháp:** Schema DB được bổ sung `tenant_id` trên mọi bảng. Bật **Row Level Security (RLS)** trên Supabase với Policy ép buộc query chỉ lấy đúng data của `tenant_id` thuộc phiên đăng nhập đó. DB sẽ từ chối mọi lệnh vi phạm, dù Node.js có code lỗi.

### 7.5. Quản trị Chi phí & Rate Limit cho AI (Gemini)
- **Vấn đề:** Gửi PDF 10 trang bừa bãi sẽ bị Gemini block do vượt Rate Limit (RPM) và tốn bộn tiền Token.
- **Giải pháp:** Cài đặt Queue Rate Limiter (giới hạn số request/phút). Bắt buộc trích xuất Text thô tại Backend (qua `pdf-parse`) để đếm Token ước tính (`tiktoken`) trước khi ném cho Gemini. Nếu vượt ngưỡng, báo lỗi chặn lại từ đầu.

> **TÓM LẠI KIẾN TRÚC DEPLOYMENT KHUYẾN NGHỊ:**
> 1. **Frontend:** Vercel / Netlify.
> 2. **API Gateway (Node.js):** VPS Linux chạy Docker / Render / Railway (Để duy trì kết nối WebSocket).
> 3. **Worker OMR (Python + OpenCV):** VPS riêng tối ưu CPU/RAM, chỉ đọc Queue Redis, không mở port HTTP.
> 4. **DB + Storage + Auth:** Supabase.
> 5. **Message Broker:** Redis.

---

## 8. LỘ TRÌNH PROTOTYPE ĐẦU TIÊN: CHẤM MSLQ & XUẤT BÁO CÁO LATEX

Prototype MVP (thư mục `latex_prototype/`) chứng minh luồng Báo cáo MSLQ, bỏ qua các bước Web/DB. **Toàn bộ logic phải bám đúng 3 tài liệu nguồn chuẩn (single source of truth):**

| Tài liệu nguồn | Vai trò |
|---|---|
| `BÀI TRẮC NGHIỆM ĐÁNH GIÁ ĐỘNG LỰC VÀ PHƯƠNG PHÁP HỌC TẬP.pdf` | 44 câu hỏi gốc (đúng thứ tự số câu) |
| `THANG ĐÁNH GIÁ ĐỘNG LỰC VÀ CHIẾN LƯỢC HỌC TẬP.pdf` | Cách chấm điểm: 5 nhóm, 4 mức, câu diễn giải |
| `MẪU BÁO CÁO.docx.pdf` | Bố cục báo cáo đầu ra (2 trang) phải khớp 1-1 |

> ⚠️ File `GrowX_Kết quả...pdf` và bộ "hồ sơ tâm lý 4 nhóm" trong `mslq_scoring_criteria.md` (bản cũ) **KHÔNG còn là chuẩn** — đã được thay bằng 3 tài liệu trên.

### 8.1. Mô hình chấm điểm (đúng `THANG ĐÁNH GIÁ`)

5 nhóm, mỗi nhóm tính **điểm trung bình = tổng / số câu** (thang 1.0–5.0), phân 4 mức:

| Nhóm | Số câu | Câu | Tối đa |
|---|---|---|---|
| Niềm tin vào năng lực học tập (Self-Efficacy) | 9 | 1,6,7,9,11,12,15,17,18 | 45 |
| Giá trị và hứng thú học tập (Intrinsic Value) | 9 | 2,3,4,5,8,10,13,14,16 | 45 |
| Lo âu khi kiểm tra (Test Anxiety) | 4 | 19,20,21,22 | 20 |
| Chiến lược học tập (Cognitive Strategy) | 13 | 23,24,25,28,30,31,33,34,35,37,38,39,40 | 65 |
| Khả năng tự điều chỉnh việc học (Self-Regulation) | 9 | 26,27,29,32,36,41,42,43,44 | 45 |

- 4 mức theo TB: `1.0–2.0` / `2.1–3.0` / `3.1–4.0` / `4.1–5.0`. Nhóm thuận: Cần ưu tiên cải thiện → Cần hỗ trợ → Khá → Tốt. **Riêng Lo âu đảo chiều** (điểm cao = xấu): Áp lực thấp → trung bình → cao → rất cao.
- Mỗi mức dùng **nguyên văn câu "Diễn giải"** trong tài liệu (không tự chế).
- **Logic đổ vào báo cáo** (trang 3 của thang): nhóm ≥ 4.1 → *Điểm tốt*; nhóm 2.1–3.0 → *cần hỗ trợ*; nhóm 1.0–2.0 → *ưu tiên cải thiện 4 tuần đầu*; Lo âu ≥ 3.1 → *lưu ý phụ huynh & giáo viên*.

### 8.2. Bố cục báo cáo đầu ra (đúng `MẪU BÁO CÁO`, 2 trang)

`I. THỰC TRẠNG` (bảng 5 nhóm: Nhóm | Điểm tối đa | Điểm học sinh = tổng thô + TB + mức) → `II. ĐÁNH GIÁ / 2.1 Tổng quan` (Điểm tốt | Điểm cần cải thiện | Nhận xét chung) → `III. ĐỀ XUẤT / 3.1 Lộ trình học` (3 giai đoạn) + `3.2 Khuyến nghị cho phụ huynh` + ô ký **GIÁO VIÊN ĐÁNH GIÁ**. Giữ nhận diện MathTech (logo, watermark, viền 4 góc, footer hotline). **Không** chèn bảng 44 câu / hồ sơ tâm lý / phỏng vấn.

### 8.3. Hiện trạng code (`latex_prototype/`)

- `test_parser.py`: ngân hàng 44 câu gốc + định nghĩa 5 nhóm/thang điểm + hàm `grade()` + các hàm sinh nội dung **rule-based** (`build_strengths` / `build_improvements` / `build_overall_comment` / `build_roadmap` / `build_parent_advice`) + render LaTeX (thay placeholder `__...__`) + gọi `xelatex`.
- `motivation_template.tex`: template 2 trang, font hệ thống **Arial**, logo/watermark lấy từ thư mục gốc dự án. Chạy: `cd latex_prototype && python3 test_parser.py`.

### 8.4. Sinh nội dung: rule-based trước, Gemini sau

- **Phase 1 (đang dùng):** Rule-based xác định — an toàn, đúng giọng MathTech (dùng câu diễn giải chuẩn), không cần API. Phù hợp cho tư vấn viên đọc trực tiếp với HS/PH.
- **Phase 2 (nâng cấp):** Cắm Gemini vào đúng 3 hàm prose mềm (`build_overall_comment`, `build_roadmap`, `build_parent_advice`) để cá nhân hóa, giữ rule-based làm fallback/guardrail — không phải sửa lại layout.

> [!WARNING]
> **Yêu cầu môi trường Local:** Cần cài LaTeX hệ thống. Khuyến nghị `brew install --cask basictex` cho `xelatex`. Đã xác nhận `xelatex` có sẵn tại `/Library/TeX/texbin/xelatex`. Môi trường Docker sau này đóng gói tương tự (`texlive-xetex`).
