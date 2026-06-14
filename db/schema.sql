-- trip2movie waitlist schema (Supabase Postgres).
-- The app auto-creates this via ensureSchema(); you can also paste it once into the
-- Supabase SQL Editor to set it up explicitly.

create table if not exists signups (
  id          bigserial primary key,
  email       text unique not null,
  wtp_price   numeric,                 -- the willingness-to-pay (WTP) chip price 
  kind        text,                    -- 'claim' or 'gift'
  created_at  timestamptz not null default now()
);

-- Handy reads:
--   select count(*) from signups;                                  -- real signups
--   select email, wtp_price, kind, created_at from signups order by created_at desc;
--   select kind, count(*) from signups group by kind;              -- claim vs gift
--   select wtp_price, count(*) from signups group by wtp_price order by wtp_price;  -- WTP distribution
