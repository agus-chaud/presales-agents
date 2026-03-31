// Esquema SQLite para PresalesTeam.
// DECISIÓN DEC-001: SQLite para persistencia operacional (historial, empresas, sesiones).
// Engram se usa para artefactos SDD en openspec/, no para datos del bot.
// Tablas: sessions (por usuario) → messages (historial) + companies (datos presales)

export const CREATE_SESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL UNIQUE,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_MESSAGES_TABLE = `
  CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role        TEXT    NOT NULL CHECK(role IN ('system','user','assistant','tool')),
    content     TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;

// companies: captura datos de investigación y el draft de mensaje generado.
// priority_score (0.0-1.0): calculado por el LLM al analizar la empresa.
export const CREATE_COMPANIES_TABLE = `
  CREATE TABLE IF NOT EXISTS companies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    research_data   TEXT,
    draft_message   TEXT,
    priority_score  REAL,
    status          TEXT    NOT NULL DEFAULT 'pending'
                              CHECK(status IN ('pending','researching','done','error')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_companies_session ON companies(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
];
