FROM python:3.11-slim

# Cài đặt các thư viện hệ thống cần thiết cho pdflatex
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-fonts-recommended \
    texlive-latex-extra \
    texlive-lang-english \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy file requirements trước để tận dụng Docker cache
COPY requirements.txt .

# Nâng cấp pip và cài đặt thư viện Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ mã nguồn Worker vào Docker
COPY . .

# Expose port (Render/Koyeb thường dùng port từ biến môi trường PORT)
EXPOSE 8000

# Chạy FastAPI bằng Uvicorn
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
