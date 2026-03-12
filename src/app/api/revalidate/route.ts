import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const slug = body?.slug;

    if (!slug) {
      return NextResponse.json({ message: 'Missing slug' }, { status: 400 });
    }

    revalidatePath(`/prodotto/${slug}`);

    return NextResponse.json({ revalidated: true, slug });
  } catch {
    return NextResponse.json({ message: 'Error parsing body' }, { status: 500 });
  }
}
