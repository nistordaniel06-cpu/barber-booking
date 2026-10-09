-- Feature retired from all member-facing pages; preserve historical feedback data.
revoke execute on function public.bc_salon_idea_submit(uuid,text,text) from authenticated;
