require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

// ── Supabase client (uses service role key — server-side only) ─────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET env variable is required");

// ── Auth middleware ────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════

// POST /api/register
app.post("/api/register", async (req, res) => {
  const { name, email, password, grade } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email and password are required." });

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (existing) return res.status(400).json({ error: "Email already registered." });

  const password_hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("users")
    .insert({ name, email: email.toLowerCase(), password_hash, grade: grade || null })
    .select("id, name, email, grade")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const token = jwt.sign({ id: data.id, name: data.name, email: data.email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: data });
});

// POST /api/login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (!data) return res.status(401).json({ error: "No account found with this email." });

  const valid = await bcrypt.compare(password, data.password_hash);
  if (!valid) return res.status(401).json({ error: "Wrong password." });

  const token = jwt.sign({ id: data.id, name: data.name, email: data.email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: data.id, name: data.name, email: data.email, grade: data.grade } });
});

// GET /api/me  — verify token & return fresh user
app.get("/api/me", auth, async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, grade")
    .eq("id", req.user.id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ════════════════════════════════════════════════════════════════════
// SUBJECTS
// ════════════════════════════════════════════════════════════════════

app.get("/api/subjects", auth, async (req, res) => {
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/subjects", auth, async (req, res) => {
  const { name, color_idx } = req.body;
  if (!name) return res.status(400).json({ error: "Subject name is required." });
  const { data, error } = await supabase
    .from("subjects")
    .insert({ user_id: req.user.id, name, color_idx: color_idx ?? 0 })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete("/api/subjects/:id", auth, async (req, res) => {
  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════
// STUDY SESSIONS
// ════════════════════════════════════════════════════════════════════

app.get("/api/sessions", auth, async (req, res) => {
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", req.user.id)
    .order("date")
    .order("hour");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/sessions", auth, async (req, res) => {
  const { subject_id, date, hour, duration, notes } = req.body;
  const { data, error } = await supabase
    .from("study_sessions")
    .insert({ user_id: req.user.id, subject_id, date, hour, duration, notes: notes || null })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put("/api/sessions/:id", auth, async (req, res) => {
  const { subject_id, date, hour, duration, notes } = req.body;
  const { data, error } = await supabase
    .from("study_sessions")
    .update({ subject_id, date, hour, duration, notes: notes || null })
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete("/api/sessions/:id", auth, async (req, res) => {
  const { error } = await supabase
    .from("study_sessions")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════
// LEARNING LOGS
// ════════════════════════════════════════════════════════════════════

app.get("/api/logs", auth, async (req, res) => {
  const { data, error } = await supabase
    .from("learning_logs")
    .select("*")
    .eq("user_id", req.user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/logs", auth, async (req, res) => {
  const { subject_id, date, topic, details, tags } = req.body;
  if (!topic) return res.status(400).json({ error: "Topic is required." });
  const { data, error } = await supabase
    .from("learning_logs")
    .insert({ user_id: req.user.id, subject_id, date, topic, details: details || null, tags: tags || [] })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put("/api/logs/:id", auth, async (req, res) => {
  const { subject_id, date, topic, details, tags } = req.body;
  const { data, error } = await supabase
    .from("learning_logs")
    .update({ subject_id, date, topic, details: details || null, tags: tags || [] })
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete("/api/logs/:id", auth, async (req, res) => {
  const { error } = await supabase
    .from("learning_logs")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════
// PROFILE UPDATE
// ════════════════════════════════════════════════════════════════════

app.put("/api/profile", auth, async (req, res) => {
  const { name, grade, avatar } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required." });
  const { data, error } = await supabase
    .from("users")
    .update({ name, grade: grade||null, avatar: avatar||null })
    .eq("id", req.user.id)
    .select("id, name, email, grade, avatar")
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ════════════════════════════════════════════════════════════════════
// STUDENTS — public rankings data
// ════════════════════════════════════════════════════════════════════

app.get("/api/students", async (req, res) => {
  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("id, name, grade, avatar");
  if (uErr) return res.status(500).json({ error: uErr.message });

  const { data: subjects } = await supabase.from("subjects").select("*");
  const { data: sessions } = await supabase.from("study_sessions").select("*");
  const { data: logs }     = await supabase.from("learning_logs").select("id,user_id,subject_id,date,topic,tags");

  const students = users.map(u => ({
    user:     u,
    subjects: (subjects||[]).filter(s => s.user_id === u.id),
    sessions: (sessions||[]).filter(s => s.user_id === u.id),
    logs:     (logs||[]).filter(l => l.user_id === u.id),
  }));

  res.json(students);
});

// ── Start ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅  StudyFlow API running on http://localhost:${PORT}`));
