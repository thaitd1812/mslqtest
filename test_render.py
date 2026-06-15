from worker.render import render_pdf

data = {
    "THUC_TRANG_ROWS": r"Motivation & 100 & 80 \\ \hline",
    "DIEM_TOT": "Học khá",
    "DIEM_CAI_THIEN": "Hay quên",
    "NHAN_XET_CHUNG": "Tốt",
    "LO_TRINH_ROWS": r"Phase 1 & Học cơ bản \\ \hline",
    "KHUYEN_NGHI_PH": "Đồng hành cùng con."
}

render_pdf("worker/templates/motivation_template.tex", data, "test_output.pdf")
