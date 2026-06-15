import { NextResponse } from 'next/server';

const GEMINI_API_KEYS = (process.env.GEMINI_API_KEYS || "").split(",").filter(k => k.trim() !== "");
let currentKeyIndex = 0;

function getNextKey() {
    if (GEMINI_API_KEYS.length === 0) return null;
    const key = GEMINI_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
    return key;
}

export async function POST(req: Request) {
    try {
        const { image_base64, cau } = await req.json();
        
        if (!image_base64 || !cau) {
            return NextResponse.json({ error: 'Missing image or cau' }, { status: 400 });
        }

        const apiKey = getNextKey();
        if (!apiKey) {
            return NextResponse.json({ error: 'No Gemini API keys configured' }, { status: 500 });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [
                {
                    parts: [
                        { text: `Nhìn vào ảnh cắt dòng của Câu ${cau} trên phiếu trắc nghiệm. Xác định ô tròn nào được học sinh tô đậm nhất trong 5 ô tròn (từ 1 đến 5). Chỉ trả về một con số duy nhất từ 1 đến 5. Nếu hoàn toàn không có ô nào tô, trả về 0.` },
                        { inlineData: { mimeType: "image/jpeg", data: image_base64.replace(/^data:image\/\w+;base64,/, "") } }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 10
            }
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            return NextResponse.json({ error: 'Gemini API failed', details: await res.text() }, { status: 500 });
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "0";
        const chon = parseInt(text, 10);

        return NextResponse.json({
            cau,
            chon: isNaN(chon) ? 0 : chon,
            confidence: 'gemini_fallback'
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
