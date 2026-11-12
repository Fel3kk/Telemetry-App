alter table public.user_track_data
  drop constraint if exists user_track_data_kind_check;

alter table public.user_track_data
  add constraint user_track_data_kind_check
  check (kind in ('racing_line', 'ers', 'quali_sim'));
