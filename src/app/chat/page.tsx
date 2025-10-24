//page
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Client from './Client';

export default async function ChatPage() {
  const supabase = await createClient(); // <= await here
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <Client />;
}

