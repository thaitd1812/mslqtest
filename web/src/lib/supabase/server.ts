import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase dùng cho phía server (API routes, server components).
 *
 * BẮT BUỘC dùng service role key: RLS đã được bật để chặn mọi truy cập trực tiếp
 * từ trình duyệt, nên anon key không còn đọc/ghi được bảng nào. Chỉ service role
 * mới bypass được RLS.
 *
 * Tuyệt đối không đặt tên biến này là NEXT_PUBLIC_* — Next.js sẽ nhúng nó vào
 * bundle gửi cho trình duyệt và coi như mất toàn bộ tác dụng của RLS.
 */

function required(name: string, value: string | undefined): string {
    if (!value) {
        throw new Error(
            `Thiếu biến môi trường ${name}. ` +
            `Khai báo trong web/.env.local (chạy local) hoặc Settings > Environment Variables trên Vercel (production). ` +
            `Lấy service role key tại Supabase Dashboard > Project Settings > API.`
        );
    }
    return value;
}

let cached: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
    if (cached) return cached;

    const url = required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
    const key = required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);

    cached = createClient(url, key, { auth: { persistSession: false } });
    return cached;
}

type DbErrorLike = {
    message?: string;
    code?: string;
    hint?: string | null;
    details?: string | null;
};

/**
 * Biến lỗi Supabase thành câu tiếng Việt đọc được, kèm gợi ý cho các nguyên nhân
 * hay gặp (project bị pause, sai URL, RLS chặn) thay vì nuốt mất chi tiết.
 */
export function describeDbError(error: DbErrorLike | null | undefined): string {
    const message = error?.message?.trim() || 'lỗi không rõ';
    const parts: string[] = [message];

    if (error?.code) parts.push(`(code ${error.code})`);

    if (/fetch failed|network|ENOTFOUND|ECONNREFUSED|getaddrinfo|EAI_AGAIN/i.test(message)) {
        parts.push(
            '— không kết nối được tới Supabase. Kiểm tra project có đang bị pause trên dashboard không, ' +
            'và NEXT_PUBLIC_SUPABASE_URL đã đúng chưa.'
        );
    } else if (/row-level security|violates row-level/i.test(message)) {
        parts.push('— bị RLS chặn. Server phải chạy bằng SUPABASE_SERVICE_ROLE_KEY, kiểm tra biến môi trường.');
    } else if (/schema cache/i.test(message)) {
        parts.push('— bảng chưa tồn tại hoặc Supabase vừa khởi động lại, thử lại sau ít phút.');
    }

    if (error?.hint) parts.push(`Gợi ý: ${error.hint}`);

    return parts.join(' ');
}
