-- trip2movie waitlist schema (Supabase Postgres).
-- The app auto-creates this via ensureSchema(); you can also paste it once into the
-- Supabase SQL Editor to set it up explicitly.

create table if not exists signups (
  id          bigserial primary key,
  email       text unique not null,
  price       numeric,                 -- the price tag the user selected (e.g. 19.99, 59, 0)
  kind        text,                    -- 'claim' or 'gift'
  created_at  timestamptz not null default now()
);

-- Handy reads:
--   select count(*) from signups;                                  -- real signups
--   select email, price, kind, created_at from signups order by created_at desc;
--   select kind, count(*) from signups group by kind;              -- claim vs gift
--   select price, count(*) from signups group by price order by price;  -- price distribution
