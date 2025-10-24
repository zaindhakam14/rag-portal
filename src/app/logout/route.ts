//logout
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient(); // await the async helper
  await supabase.auth.signOut();
  return new Response(null, { status: 204 });
}

