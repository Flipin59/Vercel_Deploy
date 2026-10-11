// An entirely absent configuration enables the local, non-persistent demo.
// A partial configuration is a deployment error, never a reason to bypass auth.
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (Boolean(url) !== Boolean(key)) throw new Error('Incomplete Supabase configuration');
  return Boolean(url && key);
}
