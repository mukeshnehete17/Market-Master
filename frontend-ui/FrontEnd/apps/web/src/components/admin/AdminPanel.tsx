import { useState, useEffect } from 'react';
import { adminApi } from '../../api/admin';

type Section =
  | 'dashboard'
  | 'students'
  | 'questions'
  | 'games'
  | 'players'
  | 'leaderboard'
  | 'history'
  | 'settings';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'students', label: 'Students', icon: '🎓' },
  { id: 'questions', label: 'Questions', icon: '❓' },
  { id: 'games', label: 'Games', icon: '🎮' },
  { id: 'players', label: 'Players', icon: '👥' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
  { id: 'history', label: 'History', icon: '📜' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #eaeaea',
  borderRadius: '16px',
  padding: '18px',
  marginBottom: '14px',
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: '10px',
  background: '#000',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontWeight: '800',
  fontSize: '12px',
};

const btnGhost: React.CSSProperties = {
  ...btnPrimary,
  background: '#f0f0f0',
  color: '#000',
  border: '1px solid #ddd',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #ddd',
  fontSize: '13px',
  width: '100%',
  boxSizing: 'border-box',
};

function Err({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div className="login-error" style={{ margin: '10px 0' }}>{msg}</div>;
}

function Loading({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '30px', color: '#666', fontWeight: '800' }}>
      {label}...
    </div>
  );
}

// ---------------- Dashboard ----------------

function Dashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.overview();
      setMetrics(data.metrics);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Loading label="LOADING DASHBOARD" />;
  if (error) return <Err msg={error} />;
  if (!metrics) return null;

  const cards = [
    ['Total Students', metrics.total_students],
    ['Active Students', metrics.active_students],
    ['Disabled Students', metrics.disabled_students],
    ['Total Questions', metrics.total_questions],
    ['Total Games', metrics.total_games],
    ['Active Games', metrics.active_games],
    ['Players In Active Game', metrics.players_in_active_game],
  ];

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '10px',
          marginBottom: '14px',
        }}
      >
        {cards.map(([label, value]) => (
          <div key={label as string} style={{ ...card, marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '800' }}>{value as number}</div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#666' }}>{label as string}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 8px' }}>Current Game</h3>
        {metrics.current_game ? (
          <div style={{ fontSize: '13px', fontWeight: '700' }}>
            {metrics.current_game.name} ({metrics.current_game.game_pin}) —{' '}
            {metrics.current_game.status}
            {metrics.current_round && (
              <span>
                {' '}· Round {metrics.current_round.round_number} ({metrics.current_round.status})
              </span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: '#666' }}>No live game right now.</div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 8px' }}>Live Leaderboard</h3>
        {metrics.leaderboard?.length ? (
          metrics.leaderboard.slice(0, 5).map((p: any, i: number) => (
            <div key={i} style={{ fontSize: '13px', fontWeight: '700', padding: '4px 0' }}>
              #{p.rank || i + 1} {p.name} — ₹{Number(p.capital).toLocaleString()}
            </div>
          ))
        ) : (
          <div style={{ fontSize: '13px', color: '#666' }}>No players yet.</div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 8px' }}>Recent Admin Actions</h3>
        {metrics.recent_actions?.length ? (
          metrics.recent_actions.map((a: any, i: number) => (
            <div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
              <strong>{a.action}</strong> · {a.entity_type}
              {a.entity_id ? ` · ${String(a.entity_id).slice(0, 8)}` : ''}
            </div>
          ))
        ) : (
          <div style={{ fontSize: '13px', color: '#666' }}>No admin actions recorded.</div>
        )}
      </div>

      <button type="button" style={btnGhost} onClick={load}>
        🔄 Refresh
      </button>
    </div>
  );
}

// ---------------- Students ----------------

function Students() {
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'participant' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = `?search=${encodeURIComponent(search)}&status=${status}`;
      const data = await adminApi.students(params);
      setList(data.students);
    } catch (err: any) {
      setError(err?.message || 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (id: string) => {
    try {
      const data = await adminApi.student(id);
      setDetail(data.student);
    } catch (err: any) {
      setError(err?.message || 'Failed to load profile.');
    }
  };

  const toggleStatus = async (id: string, cur: string) => {
    try {
      if (cur === 'active') await adminApi.disableStudent(id);
      else await adminApi.enableStudent(id);
      await load();
      if (detail?.id === id) await openDetail(id);
    } catch (err: any) {
      setError(err?.message || 'Status change failed.');
    }
  };

  const addStudent = async () => {
    try {
      await adminApi.createStudent(form);
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', role: 'participant' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Create failed.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input
          style={{ ...inputStyle, maxWidth: '220px' }}
          placeholder="Search name/email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select style={{ ...inputStyle, maxWidth: '150px' }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="banned">Banned</option>
        </select>
        <button type="button" style={btnGhost} onClick={load}>Search</button>
        <button type="button" style={btnPrimary} onClick={() => setShowAdd(!showAdd)}>
          + Add Student
        </button>
      </div>
      <Err msg={error} />

      {showAdd && (
        <div style={card}>
          <h3 style={{ margin: '0 0 8px' }}>Add Student</h3>
          <div style={{ display: 'grid', gap: '8px', maxWidth: '340px' }}>
            <input style={inputStyle} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input style={inputStyle} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input style={inputStyle} placeholder="Password (min 8)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select style={inputStyle} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="participant">participant</option>
              <option value="admin">admin</option>
            </select>
            <button type="button" style={btnPrimary} onClick={addStudent}>Create</button>
          </div>
        </div>
      )}

      {loading ? (
        <Loading label="LOADING STUDENTS" />
      ) : list.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#666', fontWeight: '700' }}>No students found.</div>
      ) : (
        list.map((s) => (
          <div key={s.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px' }}>
              <strong>{s.name}</strong> · {s.email} · {s.role} · {s.status}
              <div style={{ color: '#666' }}>
                Games: {s.games_played} · P/L: ₹{Number(s.total_pl).toLocaleString()} · Score: {s.total_score}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" style={btnGhost} onClick={() => openDetail(s.id)}>View</button>
              <button type="button" style={btnGhost} onClick={() => toggleStatus(s.id, s.status)}>
                {s.status === 'active' ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))
      )}

      {detail && (
        <div style={card}>
          <h3 style={{ margin: '0 0 8px' }}>Profile: {detail.name}</h3>
          <div style={{ fontSize: '13px', marginBottom: '8px' }}>
            {detail.email} · {detail.role} · {detail.status} · Games: {detail.games_played} ·
            P/L: ₹{Number(detail.total_pl).toLocaleString()}
          </div>
          <h4>Game History ({detail.history?.length || 0})</h4>
          {(detail.history || []).slice(0, 30).map((h: any, i: number) => (
            <div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
              [{h.game_pin}] R{h.round} {h.is_correct ? '✅' : '❌'} {h.selected_option} ·
              Bid ₹{h.bid_amount} · {h.financial_change} · Cap ₹{h.capital_after}
            </div>
          ))}
          <div style={{ marginTop: '8px' }}>
            <button type="button" style={btnGhost} onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Questions ----------------

const EMPTY_Q = {
  question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
  correct_option: '', explanation: '', category: 'Market Intelligence',
  duration_seconds: 15, is_active: true,
};

function Questions() {
  const [list, setList] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ ...EMPTY_Q });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.questions();
      setList(data.questions);
    } catch (err: any) {
      setError(err?.message || 'Failed to load questions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (q: any) => {
    setEditing(q);
    setForm({ ...EMPTY_Q, ...q });
  };

  const save = async () => {
    try {
      if (editing) await adminApi.updateQuestion(String(editing.id), form);
      else await adminApi.createQuestion(form);
      setEditing(null);
      setForm({ ...EMPTY_Q });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Save failed.');
    }
  };

  const archive = async (id: string) => {
    try {
      await adminApi.archiveQuestion(id);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Archive failed.');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this question? Only safe when unused.')) return;
    try {
      await adminApi.deleteQuestion(id);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Delete failed (likely used in a game — archive instead).');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '12px' }}>
        <button type="button" style={btnPrimary} onClick={() => { setEditing(null); setForm({ ...EMPTY_Q }); }}>
          + Add Question
        </button>
      </div>
      <Err msg={error} />

      <div style={card}>
        <h3 style={{ margin: '0 0 8px' }}>{editing ? 'Edit Question' : 'New Question'}</h3>
        <div style={{ display: 'grid', gap: '8px' }}>
          <textarea
            style={{ ...inputStyle, minHeight: '60px' }}
            placeholder="Question text"
            value={form.question_text}
            onChange={(e) => setForm({ ...form, question_text: e.target.value })}
          />
          {(['option_a', 'option_b', 'option_c', 'option_d'] as const).map((k) => (
            <input
              key={k}
              style={inputStyle}
              placeholder={k.replace('_', ' ').toUpperCase()}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          ))}
          <input style={inputStyle} placeholder="Correct answer (must match an option)" value={form.correct_option} onChange={(e) => setForm({ ...form, correct_option: e.target.value })} />
          <input style={inputStyle} placeholder="Explanation" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input style={{ ...inputStyle, maxWidth: '220px' }} placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <input style={{ ...inputStyle, maxWidth: '140px' }} placeholder="Timer (s)" type="number" value={form.duration_seconds} onChange={(e) => setForm({ ...form, duration_seconds: Number(e.target.value) })} />
            <label style={{ fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
          </div>
          <div>
            <button type="button" style={btnPrimary} onClick={save}>{editing ? 'Save' : 'Create'}</button>
          </div>
        </div>
      </div>

      {loading ? (
        <Loading label="LOADING QUESTIONS" />
      ) : (
        list.map((q) => (
          <div key={q.id} style={{ ...card, opacity: q.is_active ? 1 : 0.6 }}>
            <div style={{ fontSize: '13px', fontWeight: '800' }}>
              [{q.is_active ? 'ACTIVE' : 'ARCHIVED'}] {String(q.question_text).slice(0, 120)}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {q.category} · {q.duration_seconds}s · Answer: {q.correct_option}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button type="button" style={btnGhost} onClick={() => startEdit(q)}>Edit</button>
              {q.is_active && <button type="button" style={btnGhost} onClick={() => archive(String(q.id))}>Archive</button>}
              <button type="button" style={btnGhost} onClick={() => remove(String(q.id))}>Delete</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ---------------- Games ----------------

const OPS = ['start', 'pause', 'resume', 'open-question', 'close-market', 'reveal', 'settle', 'next', 'end', 'cancel'];

function Games() {
  const [games, setGames] = useState<any[]>([]);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<any>({
    name: '', game_pin: '', starting_capital: 10000, min_risk: 10, max_risk: 75,
    default_question_duration: 15, status: 'draft', question_ids: [] as string[],
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [g, q] = await Promise.all([adminApi.games(), adminApi.questions()]);
      setGames(g.games);
      setAllQuestions(q.questions.filter((x: any) => x.is_active));
    } catch (err: any) {
      setError(err?.message || 'Failed to load games.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDetail = async (id: string) => {
    try {
      const data = await adminApi.game(id);
      setDetail(data.game);
    } catch (err: any) {
      setError(err?.message || 'Failed to load game.');
    }
  };

  const create = async () => {
    try {
      const data = await adminApi.createGame(form);
      setShowCreate(false);
      await load();
      await openDetail(data.game.id);
    } catch (err: any) {
      setError(err?.message || 'Create failed.');
    }
  };

  const control = async (id: string, op: string) => {
    try {
      const data = await adminApi.controlGame(id, op);
      setDetail(data.game);
      await load();
    } catch (err: any) {
      setError(err?.message || `Operation ${op} failed.`);
    }
  };

  const toggleQ = (qid: string) => {
    const ids: string[] = form.question_ids || [];
    setForm({ ...form, question_ids: ids.includes(qid) ? ids.filter((x) => x !== qid) : [...ids, qid] });
  };

  const saveQuestions = async () => {
    if (!detail) return;
    try {
      const ids = (detail.questions || []).map((q: any) => String(q.question_id));
      const data = await adminApi.setGameQuestions(detail.id, ids);
      setDetail(data.game);
    } catch (err: any) {
      setError(err?.message || 'Question order update failed.');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '12px' }}>
        <button type="button" style={btnPrimary} onClick={() => setShowCreate(!showCreate)}>
          + Create Game
        </button>
      </div>
      <Err msg={error} />

      {showCreate && (
        <div style={card}>
          <h3 style={{ margin: '0 0 8px' }}>New Game</h3>
          <div style={{ display: 'grid', gap: '8px', maxWidth: '420px' }}>
            <input style={inputStyle} placeholder="Game name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input style={inputStyle} placeholder="PIN (blank = auto)" value={form.game_pin} onChange={(e) => setForm({ ...form, game_pin: e.target.value.toUpperCase() })} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <input style={inputStyle} type="number" placeholder="Capital" value={form.starting_capital} onChange={(e) => setForm({ ...form, starting_capital: Number(e.target.value) })} />
              <input style={inputStyle} type="number" placeholder="Timer" value={form.default_question_duration} onChange={(e) => setForm({ ...form, default_question_duration: Number(e.target.value) })} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input style={inputStyle} type="number" placeholder="Min risk %" value={form.min_risk} onChange={(e) => setForm({ ...form, min_risk: Number(e.target.value) })} />
              <input style={inputStyle} type="number" placeholder="Max risk %" value={form.max_risk} onChange={(e) => setForm({ ...form, max_risk: Number(e.target.value) })} />
            </div>
            <div style={{ fontSize: '12px', fontWeight: '800' }}>Questions ({(form.question_ids || []).length} selected)</div>
            <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px', padding: '8px' }}>
              {allQuestions.map((q: any) => (
                <label key={q.id} style={{ display: 'flex', gap: '6px', fontSize: '12px', padding: '3px 0' }}>
                  <input type="checkbox" checked={(form.question_ids || []).includes(String(q.id))} onChange={() => toggleQ(String(q.id))} />
                  {String(q.question_text).slice(0, 70)}
                </label>
              ))}
            </div>
            <button type="button" style={btnPrimary} onClick={create}>Create Game</button>
          </div>
        </div>
      )}

      {loading ? (
        <Loading label="LOADING GAMES" />
      ) : (
        games.map((g) => (
          <div key={g.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '13px' }}>
              <strong>{g.name}</strong> ({g.game_pin}) · {g.status}
              <div style={{ color: '#666' }}>Rounds: {g.rounds} · Players: {g.players} · Cap ₹{g.starting_capital}</div>
            </div>
            <button type="button" style={btnGhost} onClick={() => openDetail(g.id)}>Manage</button>
          </div>
        ))
      )}

      {detail && (
        <div style={card}>
          <h3 style={{ margin: '0 0 4px' }}>
            {detail.name} ({detail.game_pin}) · {detail.status}
          </h3>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
            Cap ₹{detail.starting_capital} · Risk {detail.min_risk}%–{detail.max_risk}% ·{' '}
            {detail.default_question_duration}s · Rounds {(detail.questions || []).length} ·
            Players {(detail.players || []).length}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {OPS.map((op) => (
              <button key={op} type="button" style={btnGhost} onClick={() => control(detail.id, op)}>
                {op}
              </button>
            ))}
          </div>
          <h4 style={{ margin: '8px 0' }}>Questions (ordered)</h4>
          {(detail.questions || []).map((q: any, i: number) => (
            <div key={q.id} style={{ fontSize: '12px', padding: '3px 0' }}>
              {i + 1}. {String(q.question_id).slice(0, 8)}... ({q.duration_seconds}s)
            </div>
          ))}
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
            <button type="button" style={btnGhost} onClick={saveQuestions}>Refresh Order</button>
            <button type="button" style={btnGhost} onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Players / Leaderboard / History ----------------

function GamePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [games, setGames] = useState<any[]>([]);
  useEffect(() => {
    adminApi.games().then((d) => {
      setGames(d.games);
      if (d.games.length && !value) onChange(d.games[0].id);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <select style={{ ...inputStyle, maxWidth: '280px', marginBottom: '12px' }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select game</option>
      {games.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name} ({g.game_pin}) — {g.status}
        </option>
      ))}
    </select>
  );
}

function Players() {
  const [gameId, setGameId] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = async (id: string) => {
    if (!id) return;
    setError('');
    try {
      const data = await adminApi.gameLeaderboard(id);
      setRows(data.leaderboard);
    } catch (err: any) {
      setError(err?.message || 'Failed to load players.');
    }
  };

  useEffect(() => {
    if (gameId) load(gameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  return (
    <div>
      <GamePicker value={gameId} onChange={setGameId} />
      <Err msg={error} />
      {rows.map((p: any) => (
        <div key={p.user_id || p.name} style={{ ...card, fontSize: '13px' }}>
          <strong>{p.name}</strong> · Capital ₹{Number(p.capital).toLocaleString()} ·
          P/L ₹{Number(p.profit_loss).toLocaleString()} · Score {p.score} ·
          Rounds {p.rounds_played}
        </div>
      ))}
      {gameId && rows.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#666' }}>No players in this game yet.</div>
      )}
    </div>
  );
}

function Board() {
  const [gameId, setGameId] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!gameId) return;
    adminApi.gameLeaderboard(gameId).then((d) => setRows(d.leaderboard)).catch((err: any) => setError(err?.message || 'Failed.'));
  }, [gameId]);

  return (
    <div>
      <GamePicker value={gameId} onChange={setGameId} />
      <Err msg={error} />
      {rows.map((p: any) => (
        <div key={p.user_id || p.name} style={{ ...card, display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700' }}>
          <span>#{p.rank} {p.avatar} {p.name}</span>
          <span>₹{Number(p.capital).toLocaleString()} ({Number(p.profit_loss) >= 0 ? '+' : ''}₹{Number(p.profit_loss).toLocaleString()})</span>
        </div>
      ))}
      {gameId && rows.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#666' }}>Leaderboard is empty.</div>
      )}
    </div>
  );
}

function GameHistory() {
  const [gameId, setGameId] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!gameId) return;
    adminApi.gameTrades(gameId).then((d) => setRows(d.trades)).catch((err: any) => setError(err?.message || 'Failed.'));
  }, [gameId]);

  return (
    <div>
      <GamePicker value={gameId} onChange={setGameId} />
      <Err msg={error} />
      {rows.slice(0, 200).map((t: any, i: number) => (
        <div key={i} style={{ fontSize: '12px', padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>
          R{t.round_number} · <strong>{t.player_name}</strong> · {t.is_correct ? '✅' : '❌'}
          {t.timed_out ? ' (timeout)' : ''} · {t.selected_option} · Risk {t.risk_percent}% ·
          Bid ₹{t.bid_amount} · {t.financial_change} · Cap ₹{t.capital_after}
        </div>
      ))}
      {gameId && rows.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#666' }}>No trades recorded yet.</div>
      )}
    </div>
  );
}

// ---------------- Settings ----------------

function Settings() {
  const [settings, setSettings] = useState<any>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    adminApi.settings().then((d) => setSettings(d.settings)).catch((err: any) => setError(err?.message || 'Failed.'));
  }, []);

  const save = async () => {
    setError('');
    setMsg('');
    try {
      const data = await adminApi.updateSettings(settings);
      setSettings(data.settings);
      setMsg('Settings saved.');
    } catch (err: any) {
      setError(err?.message || 'Save failed.');
    }
  };

  if (!settings) return <Loading label="LOADING SETTINGS" />;
  return (
    <div style={{ ...card, maxWidth: '420px' }}>
      <h3 style={{ margin: '0 0 8px' }}>Default Game Settings</h3>
      <Err msg={error} />
      {msg && <div style={{ color: '#16a34a', fontWeight: '800', fontSize: '13px', marginBottom: '8px' }}>{msg}</div>}
      {Object.keys(settings).filter((k) => k.startsWith('default_')).map((k) => (
        <div key={k} style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: '700' }}>{k}</label>
          <input
            style={inputStyle}
            type="number"
            value={settings[k]}
            onChange={(e) => setSettings({ ...settings, [k]: Number(e.target.value) })}
          />
        </div>
      ))}
      <button type="button" style={btnPrimary} onClick={save}>Save Settings</button>
    </div>
  );
}

// ---------------- Shell ----------------

export function AdminPanel() {
  const [section, setSection] = useState<Section>('dashboard');
  return (
    <div className="profile-container">
      <div className="profile-card" style={{ maxWidth: '880px' }}>
        <div className="profile-header">
          <div className="profile-avatar" style={{ fontSize: '24px' }}>🛡️</div>
          <div>
            <h2 className="profile-heading">Admin Console</h2>
            <span style={{ fontSize: '12px', color: '#666', fontWeight: '700' }}>
              MARKET MASTER OPERATIONS
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              style={{
                ...(section === s.id ? btnPrimary : btnGhost),
                borderRadius: '999px',
              }}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {section === 'dashboard' && <Dashboard />}
        {section === 'students' && <Students />}
        {section === 'questions' && <Questions />}
        {section === 'games' && <Games />}
        {section === 'players' && <Players />}
        {section === 'leaderboard' && <Board />}
        {section === 'history' && <GameHistory />}
        {section === 'settings' && <Settings />}
      </div>
    </div>
  );
}
