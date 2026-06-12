import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password required' },
        { status: 400 }
      );
    }

    // TODO: Verify credentials against database
    // For now, return mock response
    const mockUser = {
      id: 'user-123',
      email,
      firstName: 'John',
      lastName: 'Doe',
      role: 'admin',
    };

    const tokens = {
      access_token: 'mock-jwt-token', // Replace with actual JWT
      refresh_token: 'mock-refresh-token',
      expires_in: 86400,
      token_type: 'Bearer',
    };

    return NextResponse.json({
      success: true,
      data: {
        user: mockUser,
        ...tokens,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 401 }
    );
  }
}
