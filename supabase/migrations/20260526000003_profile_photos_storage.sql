-- Storage bucket for profile photos (replaces Base44's UploadFile in EditProfile).
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

-- Public read; authenticated users may write only under their own uid folder
-- (paths are `<auth.uid>/<timestamp>.<ext>`).
create policy "profile_photos_public_read" on storage.objects
  for select using (bucket_id = 'profile-photos');

create policy "profile_photos_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile_photos_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
