import { NextRequest, NextResponse } from 'next/server';
import { generateAllSubscriptionInvoices } from '@/app/actions';

/**
 * GET /api/cron/billing
 *
 * Generates monthly subscription invoices for all active companies.
 * Protected by CRON_SECRET environment variable.
 *
 * Schedule: run on the 1st of each month or daily (safe — skips already-billed companies).
 *
 * Vercel cron.json example:
 *   { "path": "/api/cron/billing", "schedule": "0 0 * * *" }
 *
 * cPanel / system cron example:
 *   0 0 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/billing
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await generateAllSubscriptionInvoices();
    const message = `Billing run complete: ${summary.created} created, ${summary.already_billed} already billed, ${summary.skipped} skipped, ${summary.errors} errors`;

    return NextResponse.json({
      ok: true,
      message,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[CRON/BILLING] Error:', err?.message);
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
