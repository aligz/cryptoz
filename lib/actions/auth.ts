'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function loginAction(prevState: any, formData: FormData) {
  const code = formData.get('code') as string;
  const correctCode = process.env.APP_AUTH_CODE;

  if (code === correctCode) {
    const cookieStore = await cookies();
    cookieStore.set('auth_session', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    redirect('/');
  }

  return { error: 'Invalid access code' };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_session');
  redirect('/login');
}
