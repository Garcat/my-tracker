CREATE TABLE app.tracker_state (
  id text PRIMARY KEY,
  inputs jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  last_updated timestamptz NOT NULL DEFAULT now(),
  last_tracking_fetch_at timestamptz
);
