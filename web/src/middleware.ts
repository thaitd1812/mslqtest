import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Only protect /dashboard and /api/export
  if (req.nextUrl.pathname.startsWith('/dashboard') || req.nextUrl.pathname.startsWith('/api/export')) {
    const basicAuth = req.headers.get('authorization');
    const url = req.nextUrl;

    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      const [user, pwd] = atob(authValue).split(':');

      const validUser = 'admin';
      // Khởi tạo Mật khẩu cứng (Không cần cấu hình Vercel)
      // Bạn có thể đổi chữ 'matkhau123' thành bất cứ pass nào bạn muốn
      const validPassword = process.env.DASHBOARD_PASSWORD || 'Mathtech123456';

      if (user === validUser && pwd === validPassword) {
        return NextResponse.next();
      }
    }
    
    url.pathname = '/api/auth'; // Not actually used, just standard basic auth trigger
    
    return new NextResponse('Auth required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/export/:path*'],
};
