-- W3-S1: accepting is exclusively through forum_accept_reply(). A permissive
-- UPDATE policy also allows editing content, so thread ownership must not grant it.
drop policy if exists "thread authors accept replies" on public.forum_replies;
