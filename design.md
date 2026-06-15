Khung thiết kế LaTeX của MathTech
Dưới đây là tổng hợp toàn bộ ngôn ngữ thiết kế (Design Language) và một tệp mẫu (Template) LaTeX độc lập chứa các cấu hình header, footer, watermark để bạn dễ dàng sử dụng cho các mục đích khác.

1. Ngôn ngữ thiết kế (Design Language)
   Typography (Font chữ)
   MathTech sử dụng XeLaTeX với thư viện fontspec và unicode-math để tuỳ chỉnh font:

Font thân bài (Body Text): STIXTwoText (Serif, trang trọng, hỗ trợ tốt tiếng Việt).
Font tiêu đề & nhãn: BeVietnamPro (Sans-serif hình học, hiện đại).
Font công thức Toán: STIXTwoMath-Regular (Đồng bộ với font thân bài).
Bảng màu (Color Palette)
Màu sắc được sử dụng tạo sự nhận diện thống nhất, cấu hình qua xcolor (mã HTML):

Brand (Màu thương hiệu chính): #C0392B (Đỏ trầm - Dùng cho viền, tiêu đề chính, header/footer line).
Ink (Chữ chính): #1B1B2A (Đen chì - Giảm mỏi mắt so với đen tuyền).
Neutral (Nền phụ): #F4F6F8 (Xám nhạt).
Màu các chặng học tập:
Khám phá: #0E8A7B
Khái niệm: #6C5CE7
Luyện tập: #E08A1E
Vận dụng: #C0392B
Tổng kết: #1E8E5A
Layout & Page
Kích thước: A4 (a4paper).
Căn lề: top=0.85in, bottom=1.5in, left=0.75in, right=0.75in.
Giãn dòng (setstretch): 1.16. 2. Tệp Template LaTeX Mẫu
Bạn có thể lưu đoạn code dưới đây thành một file template.tex. Lưu ý: bạn cần có thư mục ./assets chứa các font chữ (STIXTwoText, BeVietnamPro), logo (Logo4.png), và watermark (Watermark_Opacity_20.png).

latex

% Tệp template mẫu dựa trên khung thiết kế của MathTech
\documentclass[12pt]{article}
\usepackage[a4paper,top=0.85in,bottom=1.5in,left=0.75in,right=0.75in,headsep=8pt,footskip=30pt]{geometry}
\setlength{\headheight}{26pt}
% --- 1. FONT CHỮ ---
\usepackage{fontspec}
\usepackage{unicode-math}
% Đặt đường dẫn đến thư mục chứa font của bạn
\def\FONTDIR{./assets/fonts/}
\setmainfont{STIXTwoText}[Path=\FONTDIR, Extension=.otf, UprightFont=*-Regular, BoldFont=*-Bold, ItalicFont=*-Italic, BoldItalicFont=*-BoldItalic]
\setsansfont{BeVietnamPro}[Path=\FONTDIR, Extension=.ttf, UprightFont=*-Regular, BoldFont=*-Bold, ItalicFont=*-Italic, FontFace={sb}{n}{*-SemiBold}]
\setmathfont{STIXTwoMath-Regular.otf}[Path=\FONTDIR]
% --- 2. MÀU SẮC ---
\usepackage{xcolor}
\definecolor{ink}{HTML}{1B1B2A}
\definecolor{brand}{HTML}{C0392B}
\definecolor{neutral}{HTML}{F4F6F8}
\definecolor{rule}{HTML}{E1E4EA}
\definecolor{muted}{HTML}{6B7280}
\definecolor{gold}{HTML}{F39C12}
\color{ink}
% --- 3. PACKAGES ---
\usepackage{enumitem}
\usepackage{ragged2e}
\usepackage{fancyhdr}
\usepackage[most]{tcolorbox}
\usepackage{amsmath}
\usepackage{tabularx}
\usepackage{adjustbox}
\usepackage{pifont}
\usepackage{setspace}\setstretch{1.16}
\setlength{\parindent}{0pt}
\setlength{\parskip}{4pt}
\usepackage{tikz}
\usetikzlibrary{calc,positioning}
% --- 4. HEADER, FOOTER & WATERMARK ---
\usepackage[colorlinks=true,linkcolor=blue,urlcolor=blue]{hyperref}
\usepackage{eso-pic}
\AddToShipoutPictureBG{%
\begin{tikzpicture}[remember picture,overlay]
% Watermark
\node[rotate=60,opacity=1.0] at (current page.center) {\includegraphics[scale=1.2]{./assets/Watermark_Opacity_20.png}};

        % Khung viền bao quanh trang
        \draw[line width=0.5pt,color=rule]
          ([xshift=8mm,yshift=-8mm]current page.north west) rectangle ([xshift=-8mm,yshift=8mm]current page.south east);

        % 4 Góc viền trang (Brand color)
        \draw[line width=1.5pt,color=brand] ([xshift=8.5mm,yshift=-8.5mm]current page.north west) -- ([xshift=18mm,yshift=-8.5mm]current page.north west);
        \draw[line width=1.5pt,color=brand] ([xshift=8.5mm,yshift=-8.5mm]current page.north west) -- ([xshift=8.5mm,yshift=-18mm]current page.north west);

        \draw[line width=1.5pt,color=brand] ([xshift=-8.5mm,yshift=-8.5mm]current page.north east) -- ([xshift=-18mm,yshift=-8.5mm]current page.north east);
        \draw[line width=1.5pt,color=brand] ([xshift=-8.5mm,yshift=-8.5mm]current page.north east) -- ([xshift=-8.5mm,yshift=-18mm]current page.north east);

        \draw[line width=1.5pt,color=brand] ([xshift=8.5mm,yshift=8.5mm]current page.south west) -- ([xshift=18mm,yshift=8.5mm]current page.south west);
        \draw[line width=1.5pt,color=brand] ([xshift=8.5mm,yshift=8.5mm]current page.south west) -- ([xshift=8.5mm,yshift=18mm]current page.south west);

        \draw[line width=1.5pt,color=brand] ([xshift=-8.5mm,yshift=8.5mm]current page.south east) -- ([xshift=-18mm,yshift=8.5mm]current page.south east);
        \draw[line width=1.5pt,color=brand] ([xshift=-8.5mm,yshift=8.5mm]current page.south east) -- ([xshift=-8.5mm,yshift=18mm]current page.south east);

\end{tikzpicture}%
}
\pagestyle{fancy}\fancyhf{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{1.0pt}
% Header
\fancyhead[L]{\includegraphics[scale=0.32]{./assets/Logo4.png}}
\fancyhead[R]{\raisebox{7pt}{\small\textit{Tiêu đề tài liệu mẫu • Tên mục phụ}}}
% Footer
\fancyfoot[LE,LO]{\footnotesize {\textbf{\color{red}{CÔNG TY CỔ PHẦN GIÁO DỤC \& CÔNG NGHỆ MATHTECH}}\\[1pt] Hotline:\quad {\renewcommand{\arraystretch}{0.9}\begin{tabular}{@{}l l l@{}}
Kim Giang: 0986.482.343 & Minh Khai: 0917.551.881 & Long Biên: 0941.201.881\\
Mỹ Đình: 0911.301.881 & Hà Đông: 0886.541.881 & Hoàng Cầu: 0946.201.881
\end{tabular}}\\[1pt] Website: \href{http://www.mathtech.vn}{\underline{www.mathtech.vn}}\quad•\quad Biên soạn: \textbf{Thầy Thái MathTech} -- ĐT 0386969199\hfill Trang~\thepage}}
\fancyfoot[RE,RO]{}
% Màu của đường gạch ngang footer
\futurelet\TMPfootrule\def\footrule{{\color{red}\TMPfootrule}}
% --- 5. TIỆN ÍCH BỔ SUNG ---
\newcommand{\titlefit}[1]{\adjustbox{max width=\linewidth}{#1}}
\newcommand{\blank}[1][5cm]{\tikz[baseline]{\draw[rule,line width=.6pt,dotted](0,0)--(\dimexpr#1-2pt,0);}}
% ==================== BẮT ĐẦU TÀI LIỆU ====================
\begin{document}
% KHỐI TIÊU ĐỀ TRANG
\begin{tcolorbox}[
enhanced, colback=neutral, colframe=brand!40, boxrule=0.8pt, arc=4pt,
top=6pt, bottom=6pt, left=10pt, right=10pt, boxsep=0pt,
before=\vspace{2pt}, after=\vspace{10pt}
]
\sffamily
{\bfseries\fontsize{12pt}{14pt}\selectfont\color{ink}LOẠI TÀI LIỆU (Vd: BÀI KIỂM TRA)}\hfill{\footnotesize\color{muted}Thông tin phụ / Lớp}\par\vspace{6pt}
\titlefit{\bfseries\fontsize{18pt}{21pt}\selectfont\color{brand}TIÊU ĐỀ CHÍNH CỦA TÀI LIỆU VIẾT HOA}\par\vspace{9pt}
{Họ và tên:~\blank[6cm]\hfill Thông tin khác:~\blank[3.2cm]}
\end{tcolorbox}
\vspace{1pt}
% NỘI DUNG TÀI LIỆU
\section\*{1. Giới thiệu}
Đây là nội dung thử nghiệm với khung sườn được bóc tách từ dự án MathTech. Khung sườn này bao gồm các yếu tố nhận diện thương hiệu như Watermark, 4 góc viền trang, cấu trúc header, footer thông tin công ty và màu đỏ nhận diện (Brand).
\end{document}
