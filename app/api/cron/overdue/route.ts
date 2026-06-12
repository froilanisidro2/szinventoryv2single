import { NextRequest, NextResponse } from 'next/server';
import { markOverdueInvoices } from '@/app/actions';

/**
 * GET /api/cron/overdue
 *
 * Marks all past-due unpaid invoices as "overdue".
 * Protected by CRON_SECRET environment variable.
 *
 * Schedule: run daily.
 *
 * Vercel cron.json example:
 *   { "path": "/api/cron/overdue", "schedule": "0 1 * * *" }
 *
 * cPanel / system cron example:
 *   0 1 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/overdue
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await markOverdueInvoices();

    return NextResponse.json({
      ok: true,
      message: result.error
        ? `Overdue marking failed: ${result.error}`
        : `${result.updated} invoice${result.updated !== 1 ? 's' : ''} marked as overdue`,
      updated: result.updated,
      error: result.error,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[CRON/OVERDUE] Error:', err?.message);
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
