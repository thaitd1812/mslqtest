import re
with open("webapp_mvp_plan.md", "r") as f:
    text = f.read()

new_text = re.sub(
    r'- \*\*Tải phiếu\*\*:.*?\n\s*- \*\*Trạng thái\*\*:.*?\n',
    r'- **Tải phiếu**: Kéo thả / chọn ảnh từ máy / chụp từ điện thoại.\n  - **Nhập thông tin**: Form nhập "Họ và tên" và "Năm sinh" (gửi kèm ảnh để điền thẳng vào báo cáo PDF, bỏ qua OCR).\n  - **Trạng thái**: UI hiển thị tiến trình (Upload → Worker Xử lý OMR → Đọc điểm).\n',
    text,
    flags=re.MULTILINE
)

with open("webapp_mvp_plan.md", "w") as f:
    f.write(new_text)

print(text == new_text)
