-- Khoá truy cập trực tiếp từ trình duyệt vào database.
--
-- BỐI CẢNH
-- anon key được Next.js nhúng thẳng vào bundle JS gửi cho mọi khách truy cập,
-- nên nó là key công khai. Nó chỉ an toàn khi có RLS đứng sau — mà RLS đang TẮT.
-- Kiểm chứng ngày 2026-09-05 chỉ với anon key:
--   SELECT  -> đọc được 91/91 bản ghi (họ tên, năm sinh, SĐT phụ huynh)
--   UPDATE  -> HTTP 204 (được phép sửa)
--   DELETE  -> HTTP 204 (được phép xoá)
-- Basic auth ở middleware.ts không đỡ được vì Supabase REST nằm ở domain khác.
--
-- ⚠ THỨ TỰ THỰC HIỆN — làm sai là web trắng:
--   1. Đặt SUPABASE_SERVICE_ROLE_KEY trong .env.local và trên Vercel
--   2. Deploy code mới (trình duyệt đã hết gọi thẳng Supabase)
--   3. Mới chạy file này trong Supabase Dashboard > SQL Editor
--
-- service_role bypass RLS nên các API route của Next.js vẫn chạy bình thường.

-- 1. Bỏ policy cũ trong schema.sql (khai báo nhưng thực tế chưa từng được áp dụng).
DROP POLICY IF EXISTS "Tenant isolation for mslq_results" ON public.mslq_results;
DROP POLICY IF EXISTS "Tenant isolation for students" ON public.students;

-- 2. Bật RLS, không tạo policy nào => mọi truy cập bằng anon key đều bị từ chối.
ALTER TABLE public.mslq_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students     ENABLE ROW LEVEL SECURITY;

-- 3. Thu hồi quyền mặc định Supabase cấp cho anon. Lớp khoá thứ hai, phòng trường
--    hợp sau này ai đó lỡ tay tắt RLS.
REVOKE ALL ON public.mslq_results FROM anon;
REVOKE ALL ON public.students     FROM anon;

-- 4. Kiểm tra: cả hai dòng phải hiện rowsecurity = true
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public' AND tablename IN ('mslq_results', 'students');
