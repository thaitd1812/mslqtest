# -*- coding: utf-8 -*-
"""
Sinh PHIẾU TRẢ LỜI chuẩn OMR (in giấy ĐEN TRẮNG) từ ngân hàng 44 câu trong test_parser.py.

Thiết kế cho thực tế IN–TÔ–SCAN:
  - Thuần đen trắng, tương phản cao (nét đậm sống sót khi in laser / photocopy / chụp điện thoại).
  - Ô tròn TO (~5.4mm) dễ tô tay cho học sinh 11–15.
  - KHÔNG dùng ô mốc đen ở góc. OMR canh chỉnh bằng KHUNG VIỀN BẢNG (hình chữ nhật rõ);
    hướng phiếu nhận qua DẢI HEADER XÁM ở đầu bảng (bất đối xứng trên/dưới).
  - Tích hợp câu hỏi + ô trên cùng phiếu để HS đỡ lạc dòng.

Chạy:  python3 make_omr_sheet.py   (cần xelatex)
"""

import subprocess
from test_parser import MSLQ_QUESTIONS

PREAMBLE = r"""\documentclass[11pt, a4paper]{article}
\usepackage[a4paper,top=0.6in,bottom=0.5in,left=0.6in,right=0.6in,headsep=10pt]{geometry}
\setlength{\headheight}{40pt}

\usepackage{fontspec}
\setmainfont{Avenir Next}

\usepackage[table]{xcolor}
\definecolor{ink}{HTML}{1A1A1A}
\definecolor{headfill}{HTML}{E6E6E6}   % nền header xám nhạt (sống sót khi in B&W)
\definecolor{muted}{HTML}{555B63}
\color{ink}

\usepackage{array}
\usepackage{longtable}
\usepackage{colortbl}
\usepackage{ragged2e}
\usepackage{fancyhdr}
\usepackage{tikz}
\setlength{\parindent}{0pt}

\pagestyle{fancy}\fancyhf{}
\renewcommand{\headrulewidth}{0pt}\renewcommand{\footrulewidth}{0pt}
\fancyhead[L]{\includegraphics[scale=0.36]{../Logo4.png}}
\fancyhead[R]{\raisebox{16pt}{\footnotesize\color{muted}Trang \thepage}}

\newcolumntype{M}[1]{>{\centering\arraybackslash}m{#1}}
\newcolumntype{L}[1]{>{\RaggedRight\arraybackslash}m{#1}}

% Ô tròn to để tô tay (thu nhỏ chút)
\newcommand{\bub}{\tikz{\draw[line width=0.8pt,color=ink] (0,0) circle (1.8mm);}}
% Số có vòng tròn cho legend
\newcommand{\cnum}[1]{\tikz[baseline=-0.6ex]{\draw[line width=0.7pt,color=ink] (0,0) circle (1.8mm); \node[font=\bfseries\scriptsize]{#1};}}

\begin{document}

% ===== TIÊU ĐỀ =====
\begin{center}
{\footnotesize\color{muted}\textbf{PHIẾU TRẢ LỜI}}\\[3pt]
{\bfseries\large BÀI TRẮC NGHIỆM ĐÁNH GIÁ ĐỘNG LỰC VÀ CHIẾN LƯỢC HỌC TẬP}
\end{center}
\vspace{4pt}{\color{ink}\rule{\linewidth}{1pt}}
\vspace{9pt}

% ===== THÔNG TIN =====
{\textbf{Họ và tên:}~\rule[-2pt]{8.2cm}{0.5pt}\hfill\textbf{Năm sinh:}~\rule[-2pt]{3.1cm}{0.5pt}}
\vspace{4pt}

% ===== HƯỚNG DẪN =====
\noindent{\small \textbf{Đánh giá mức độ đồng tình của con với các phát biểu sau đây về động lực và chiến lược học tập. Con hãy chọn mức độ thể hiện ĐÚNG NHẤT ý kiến của mình ở mỗi dòng, theo thang mức dưới đây:}}
\par\vspace{7pt}

% ===== LEGEND =====
\noindent{\footnotesize\textbf{Thang mức:}\hspace{8pt}\cnum{1}~Hoàn toàn không đúng\hfill\cnum{2}~Không đúng\hfill\cnum{3}~Đúng một phần\hfill\cnum{4}~Đúng\hfill\cnum{5}~Hoàn toàn đúng}
\par\vspace{6pt}
{\small\textbf{Lưu ý:}~mỗi dòng tô kín đúng \textbf{MỘT} ô tròn bằng bút mực hoặc bút chì đậm.}
\vspace{9pt}

% ===== BẢNG =====
\arrayrulecolor{ink}
\setlength{\arrayrulewidth}{0.5pt}
\setlength{\tabcolsep}{3pt}
\renewcommand{\arraystretch}{1.05}
\begin{longtable}{|M{0.6cm}|L{9.5cm}|M{0.65cm}|M{0.65cm}|M{0.65cm}|M{0.65cm}|M{0.65cm}|}
\hline
\rowcolor{headfill}
\textbf{\small Câu} & \textbf{\small Nội dung} & \textbf{\small 1} & \textbf{\small 2} & \textbf{\small 3} & \textbf{\small 4} & \textbf{\small 5} \\ \hline
\endfirsthead
\hline
\rowcolor{headfill}
\textbf{\small Câu} & \textbf{\small Nội dung} & \textbf{\small 1} & \textbf{\small 2} & \textbf{\small 3} & \textbf{\small 4} & \textbf{\small 5} \\ \hline
\endhead
\hline
\endfoot
\hline
\endlastfoot
__ROWS__
\end{longtable}

\end{document}
"""


def _esc(s):
    return s.replace("&", r"\&").replace("%", r"\%").replace("#", r"\#")


def build_rows():
    rows = []
    bubbles = " & ".join([r"\bub"] * 5)
    for i, q in enumerate(MSLQ_QUESTIONS, start=1):
        rows.append(r"%d & \footnotesize %s & %s \\ \hline" % (i, _esc(q), bubbles))
    return "\n".join(rows)


def main():
    tex = PREAMBLE.replace("__ROWS__", build_rows())
    with open("omr_sheet.tex", "w", encoding="utf-8") as f:
        f.write(tex)
    print(">> Đã tạo omr_sheet.tex")
    for _ in range(2):
        subprocess.run(["xelatex", "-interaction=nonstopmode", "omr_sheet.tex"], check=True)
    print(">> HOÀN TẤT: omr_sheet.pdf")


if __name__ == "__main__":
    main()
