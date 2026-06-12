import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Simple JWT validation middleware
function validateAuth() {
  const authHeader = headers().get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  // In production, validate the JWT properly
  try {
    // Extract and decode token
    return { userId: 'user-id', role: 'admin' };
  } catch {
    return null;
  }
}

export async function GET() {
  const auth = validateAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Example: Get data from database or cache
    const data = {
      success: true,
      data: {
        message: 'Dashboard data',
        stats: {
          totalProducts: 1250,
          activeInvoices: 45,
          totalCustomers: 320,
          revenueThisMonth: 125000,
        },
      },
      timestamp: new Date(),
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
