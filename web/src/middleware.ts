import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE = 'mslq_dash';
const VALID_USER = 'admin';

function validPassword() {
  // Mật khẩu mặc định để chạy được ngay; đặt DASHBOARD_PASSWORD để đổi.
  return process.env.DASHBOARD_PASSWORD || 'Mathtech123456';
}

/** Token đặt trong cookie — hash của thông tin đăng nhập, không phải mật khẩu thô. */
async function sessionToken(): Promise<string> {
  const data = new TextEncoder().encode(`${VALID_USER}:${validPassword()}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hasValidBasicHeader(req: NextRequest): boolean {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Basic ')) return false;
  try {
    const [user, pwd] = atob(header.split(' ')[1]).split(':');
    return user === VALID_USER && pwd === validPassword();
  } catch {
    return false;
  }
}

async function isAuthed(req: NextRequest): Promise<boolean> {
  if (hasValidBasicHeader(req)) return true;
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  return !!cookie && cookie === (await sessionToken());
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Thao tác thay đổi dữ liệu (xoá bài) — chỉ người đã đăng nhập dashboard.
  //    GET vẫn mở vì phụ huynh xem kết quả qua link chứa UUID không đoán được.
  //    /api/scan-sheet (nhập phiếu hàng loạt) ghi thẳng vào dữ liệu nghiên cứu nên cũng khoá.
  if (
    (pathname.startsWith('/api/results') && req.method !== 'GET') ||
    pathname.startsWith('/api/scan-sheet')
  ) {
    if (!(await isAuthed(req))) {
      return NextResponse.json(
        { error: 'Không có quyền thực hiện thao tác này. Hãy đăng nhập lại trang quản trị.' },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  // 2. Trang quản trị và xuất CSV — basic auth như cũ.
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/export')) {
    if (await isAuthed(req)) {
      const res = NextResponse.next();
      // Ghi cookie phiên: trình duyệt không tự gửi header Basic sang /api/results,
      // nên nút Xoá trên dashboard cần cookie này để được xác thực.
      if (hasValidBasicHeader(req)) {
        res.cookies.set(AUTH_COOKIE, await sessionToken(), {
          httpOnly: true,
          sameSite: 'strict',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 60 * 60 * 8,
        });
      }
      return res;
    }

    return new NextResponse('Auth required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/export/:path*', '/api/results/:path*', '/api/scan-sheet/:path*'],
};
