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

PREAMBLE = r"""\documentclass[14pt, a4paper]{extarticle}
\usepackage[a4paper,top=0.5in,bottom=2.0in,left=0.6in,right=0.6in,headsep=10pt,footskip=40pt]{geometry}
\setlength{\headheight}{50pt}

% \usepackage{fontspec}
% \setmainfont{Avenir Next}

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
\usepackage{tabularx}
\setlength{\parindent}{0pt}
\pagestyle{fancy}\fancyhf{}
\renewcommand{\headrulewidth}{0pt}\renewcommand{\footrulewidth}{0.5pt}
\fancyhead[L]{\includegraphics[height=1.5cm]{../Logo4.png}}
\fancyhead[C]{%
  \tikz[remember picture,overlay] \node[opacity=0.2,inner sep=0pt,rotate=60] at (current page.center){\includegraphics[width=0.8\paperwidth]{../Watermark_Opacity_20.png}};%
}
\fancyfoot[C]{%
  \fontsize{8pt}{10pt}\selectfont\color{muted}%
  \begin{minipage}{\linewidth}
    \textbf{CÔNG TY CỔ PHẦN GIÁO DỤC VÀ CÔNG NGHỆ MATHTECH}\\[3pt]
    Hotline: Kim Giang: 0986.482.343 | Minh Khai: 0917.551.881 | Long Biên: 0941.201.881 \\
    Mỹ Đình: 0911.301.881 | Hà Đông: 0886.541.881 | Hoàng Cầu: 0946.201.881 \\
    Nguyễn Thị Định: 0914.641.881 | Định Công: 0914.241.881 \\[2pt]
    Website: \underline{www.mathtech.vn}
    \hfill Trang \thepage
  \end{minipage}%
}

\newcolumntype{M}[1]{>{\centering\arraybackslash}m{#1}}
\newcolumntype{L}[1]{>{\RaggedRight\arraybackslash}m{#1}}

% Ô tròn to để tô tay (thu nhỏ chút)
\newcommand{\bub}{\tikz[baseline=-0.6ex]{\draw[line width=0.8pt,color=ink] (0,0) circle (1.6mm);}}
% Số có vòng tròn cho legend
\newcommand{\cnum}[1]{\tikz[baseline=-0.6ex]{\draw[line width=0.7pt,color=ink] (0,0) circle (1.6mm); \node[font=\bfseries\scriptsize]{#1};}}

\begin{document}

% ===== TIÊU ĐỀ =====
\begin{center}
{\footnotesize\color{muted}\textbf{PHIẾU TRẢ LỜI}}\\[1pt]
{\bfseries\large BÀI TRẮC NGHIỆM ĐÁNH GIÁ ĐỘNG LỰC VÀ CHIẾN LƯỢC HỌC TẬP}
\end{center}
\vspace{2pt}{\color{ink}\rule{\linewidth}{1pt}}
\vspace{2pt}

% ===== THÔNG TIN =====
{\small\textbf{Họ và tên:}~\rule[-2pt]{8.2cm}{0.5pt}\hfill\textbf{Năm sinh:}~\rule[-2pt]{3.1cm}{0.5pt}}
\par\vspace{2pt}

% ===== HƯỚNG DẪN =====
\noindent{\small \textbf{Đánh giá mức độ đồng tình của con với các phát biểu sau đây về động lực và chiến lược học tập. Con hãy chọn mức độ thể hiện ĐÚNG NHẤT ý kiến của mình ở mỗi dòng, theo thang mức dưới đây:}}
\vspace{-2pt}

% ===== LEGEND =====
\noindent{\footnotesize\textbf{Thang mức:}}
\par\vspace{2pt}
\bgroup
\footnotesize
\renewcommand{\arraystretch}{1.5}
\noindent\begin{tabularx}{\linewidth}{|>{\centering\arraybackslash}X|>{\centering\arraybackslash}X|>{\centering\arraybackslash}X|>{\centering\arraybackslash}X|>{\centering\arraybackslash}X|}
\hline
\textbf{1} & \textbf{2} & \textbf{3} & \textbf{4} & \textbf{5} \\ \hline
\textbf{Hoàn toàn không đúng}\par \textit{(Điều này gần như không giống con chút nào, hầu như chưa bao giờ xảy ra)} &
\textbf{Không đúng}\par \textit{(Thỉnh thoảng có nhưng nhìn chung không đúng với con)} &
\textbf{Đúng một phần}\par \textit{(Có lúc đúng, có lúc không; chỉ đúng ở một số trường hợp.)} &
\textbf{Đúng}\par \textit{(Phần lớn thời gian đều đúng với con, chỉ đôi khi mới khác)} &
\textbf{Hoàn toàn đúng với con}\par \textit{(Rất đúng với con, gần như lúc nào cũng như vậy)} \\ \hline
\end{tabularx}
\egroup
\vspace{1pt}
{\small\textbf{Lưu ý:}~mỗi dòng tô kín đúng \textbf{MỘT} ô tròn bằng bút mực hoặc bút chì đậm.}
\vspace{1pt}

% ===== BẢNG =====
\arrayrulecolor{ink}
\setlength{\arrayrulewidth}{0.5pt}
\setlength{\tabcolsep}{3pt}
\renewcommand{\arraystretch}{1.05}
\begin{longtable}{|M{0.8cm}|L{11.5cm}|M{0.8cm}|M{0.8cm}|M{0.8cm}|M{0.8cm}|M{0.8cm}|}
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
        rows.append(r"\textbf{\small %d} & %s & %s \\ \hline" % (i, _esc(q), bubbles))
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
