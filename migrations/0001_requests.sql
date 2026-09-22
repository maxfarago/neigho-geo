CREATE TABLE requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  preset_id TEXT NOT NULL,
  body TEXT NOT NULL,
  credit INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX requests_ip_created ON requests(ip, created_at);
