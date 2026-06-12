import { redirect } from 'next/navigation';

// This route is no longer active.
// Password resets are handled by contacting the system administrator.
export default function ForgotPasswordPage() {
  redirect('/auth/login');
}
