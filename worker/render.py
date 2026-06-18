import os
import subprocess
import tempfile
import shutil

def generate_pdf(placeholders: dict) -> bytes:
    """
    Takes a dictionary of placeholders (e.g. {"__STUDENT_NAME__": "A", ...})
    and replaces them in the motivation_template.tex.
    Compiles it to PDF using xelatex and returns the PDF bytes.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.join(base_dir, "templates", "motivation_template.tex")
    
    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()

    for key, value in placeholders.items():
        template = template.replace(key, value)
        
    # Use a temporary directory for compilation to avoid clutter and race conditions
    with tempfile.TemporaryDirectory() as tmpdir:
        # Copy fonts into tmpdir/fonts
        shutil.copytree(os.path.join(base_dir, "assets", "fonts"), os.path.join(tmpdir, "fonts"))
        
        # Copy images into tmpdir
        shutil.copy(os.path.join(base_dir, "assets", "images", "Logo4.png"), tmpdir)
        shutil.copy(os.path.join(base_dir, "assets", "images", "Watermark_Opacity_20.png"), tmpdir)
        
        # Replace placeholders with local paths
        template = template.replace("__FONT_PATH__", "./fonts/")
        template = template.replace("../Logo4.png", "Logo4.png")
        template = template.replace("../Watermark_Opacity_20.png", "Watermark_Opacity_20.png")
        
        tex_path = os.path.join(tmpdir, "report.tex")
        pdf_path = os.path.join(tmpdir, "report.pdf")
        
        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(template)
            
        # xltabular (used in template) requires 2 passes to resolve column widths
        # and repeated headers across page breaks
        for _ in range(2):
            result = subprocess.run(
                ["xelatex", "-interaction=nonstopmode", "report.tex"],
                cwd=tmpdir,
                capture_output=True,
                text=True
            )
            if result.returncode != 0:
                print("XeLaTeX Error:", result.stdout)
                print("XeLaTeX Stderr:", result.stderr)
                raise RuntimeError("Failed to compile LaTeX template.")
                
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
            
    return pdf_bytes
