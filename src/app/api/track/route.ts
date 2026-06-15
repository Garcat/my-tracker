import { NextRequest, NextResponse } from 'next/server';

const AUODO_ENDPOINT = 'http://sys-new-api.auodexpress.com/api/tms/userSys/client/getRouterList';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(AUODO_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: '/',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Track proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch tracking data' }, { status: 500 });
  }
}
