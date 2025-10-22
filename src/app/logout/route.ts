
import { createClient } from '@/lib/supabase/server';
export async function POST() {
  const supabase = createClient();
  await supabase.auth.signOut();
  return new Response(null, { status: 204 });
}
