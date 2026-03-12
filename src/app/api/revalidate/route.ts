import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // body vuoto o non JSON (es. test WooCommerce) — non è un errore
  }

  const slug = body?.slug as string | undefined;

  if (!slug) {
    // Nessuno slug = probabilmente test webhook WooCommerce, rispondiamo OK
    return NextResponse.json({ revalidated: false, message: 'No slug provided' });
  }

  revalidatePath(`/prodotto/${slug}`);

  return NextResponse.json({ revalidated: true, slug });
}
