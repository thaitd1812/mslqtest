import os
import base64
from dotenv import load_dotenv
load_dotenv()
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
import httpx
from pydantic import BaseModel

import omr
import render

app = FastAPI(title="MSLQ Worker", version="1.0.0")

WORKER_SECRET = os.getenv("WORKER_SECRET", "dev_secret")

def verify_token(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = auth_header.split(" ")[1]
    if token != WORKER_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

class FileData(BaseModel):
    filename: str
    content_b64: str

class OMRRequest(BaseModel):
    files: Optional[List[FileData]] = None
    file_urls: Optional[List[str]] = None

class RenderRequest(BaseModel):
    placeholders: Dict[str, str]
    upload_path: str

@app.get("/health")
def health_check():
    return {"ok": True}

@app.post("/omr", dependencies=[Depends(verify_token)])
async def process_omr(req: OMRRequest):
    try:
        files_data = []
        if req.files:
            for f in req.files:
                content = base64.b64decode(f.content_b64)
                files_data.append({"filename": f.filename, "content": content})
        elif req.file_urls:
            async with httpx.AsyncClient() as client:
                for f_url in req.file_urls:
                    if f_url.startswith("file://"):
                        path = f_url.replace("file://", "")
                        with open(path, "rb") as f:
                            content = f.read()
                        filename = os.path.basename(path)
                        files_data.append({"filename": filename, "content": content})
                    else:
                        resp = await client.get(f_url)
                        resp.raise_for_status()
                        filename = f_url.split('/')[-1]
                        files_data.append({"filename": filename, "content": resp.content})
        else:
            raise HTTPException(status_code=400, detail="No files or file_urls provided")

        result = await omr.process_files_async(files_data)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/render", dependencies=[Depends(verify_token)])
async def process_render(req: RenderRequest):
    try:
        # Generate PDF
        pdf_bytes = render.generate_pdf(req.placeholders)
        
        # Upload to Supabase Storage
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise Exception("Missing Supabase credentials in environment")
            
        upload_endpoint = f"{supabase_url}/storage/v1/object/mslq-reports/{req.upload_path}"
        
        headers = {
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/pdf",
            "x-upsert": "true"
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(upload_endpoint, content=pdf_bytes, headers=headers)
            resp.raise_for_status()
            
        # Return public URL or path
        pdf_url = f"{supabase_url}/storage/v1/object/public/mslq-reports/{req.upload_path}"
        return {"pdf_url": pdf_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
