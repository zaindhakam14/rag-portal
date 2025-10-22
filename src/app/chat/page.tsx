import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChatClient from './ChatClient';

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // fetch user's primary account id (first membership)
  const { data: membership } = await supabase
    .from('account_users')
    .select('account_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const accountId = membership?.account_id ?? 'public';
  return <ChatClient accountId={accountId} />;
}
