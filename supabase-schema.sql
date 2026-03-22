-- Run this entire file in your Supabase SQL editor (Database → SQL Editor → New query)
-- It creates all the tables Schedgio needs.

-- 1. Schedules table
create table if not exists schedules (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references auth.users(id) on delete cascade,
  owner_name   text,
  name         text not null default 'New schedule',
  is_private   boolean not null default false,
  feed_token   text not null unique,
  created_at   timestamptz not null default now()
);

-- 2. Events table
create table if not exists events (
  id           uuid primary key default gen_random_uuid(),
  schedule_id  uuid references schedules(id) on delete cascade,
  name         text not null default '',
  date         date,
  time         time,
  location     text default '',
  notes        text default '',
  sequence     integer not null default 0,
  photos       text[] default '{}',
  created_at   timestamptz not null default now()
);

-- 3. Subscribers table
create table if not exists subscribers (
  id           uuid primary key default gen_random_uuid(),
  schedule_id  uuid references schedules(id) on delete cascade,
  email        text not null,
  created_at   timestamptz not null default now(),
  unique(schedule_id, email)
);

-- 4. Row Level Security (keeps each user's data private)
alter table schedules  enable row level security;
alter table events     enable row level security;
alter table subscribers enable row level security;

-- Schedules: owner can do everything; anyone can read public ones
create policy "owner full access"
  on schedules for all
  using (auth.uid() = owner_id);

create policy "public read"
  on schedules for select
  using (is_private = false);

-- Events: follow the schedule's access rules
create policy "owner full access"
  on events for all
  using (
    exists (select 1 from schedules s where s.id = schedule_id and s.owner_id = auth.uid())
  );

create policy "public read"
  on events for select
  using (
    exists (select 1 from schedules s where s.id = schedule_id and s.is_private = false)
  );

-- Subscribers: owner can read; anyone can insert (to subscribe)
create policy "owner read"
  on subscribers for select
  using (
    exists (select 1 from schedules s where s.id = schedule_id and s.owner_id = auth.uid())
  );

create policy "anyone can subscribe"
  on subscribers for insert
  with check (true);

-- Attachments table (run this in Supabase SQL editor)
create table if not exists attachments (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid references events(id) on delete cascade,
  name         text not null,
  url          text not null,
  size         integer,
  mime_type    text,
  created_at   timestamptz not null default now()
);

alter table attachments enable row level security;

create policy "owner full access"
  on attachments for all
  using (
    exists (
      select 1 from events e
      join schedules s on s.id = e.schedule_id
      where e.id = event_id and s.owner_id = auth.uid()
    )
  );

create policy "public read attachments"
  on attachments for select
  using (true);

-- Storage bucket for attachments (run this too)
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict do nothing;

create policy "authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'attachments' and auth.role() = 'authenticated');

create policy "public read storage"
  on storage.objects for select
  using (bucket_id = 'attachments');
