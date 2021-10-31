CREATE TABLE sweep (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  address TEXT NOT NULL,
  amount NUMERIC,
  transactionID TEXT NOT NULL,
  result TEXT NOT NULL,
);