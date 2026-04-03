require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const crypto     = require("crypto");
const nodemailer = require("nodemailer");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json({ limit: "5mb" }));

// ── Supabase ────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET env variable is required");

// ── Email transporter (Gmail SMTP) ──────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,   // your Gmail address
    pass: process.env.EMAIL_PASS,   // Gmail App Password (not your real password)
  },
});

const APP_URL = process.env.APP_URL || "https://sheikhnazmulislam.cz/studyflow";

// ── Email helper ────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("⚠️  EMAIL_USER or EMAIL_PASS not set in Railway — skipping email to " + to);
    console.warn("    Add EMAIL_USER, EMAIL_PASS, APP_URL to Railway variables to enable emails.");
    return false;
  }
  try {
    await transporter.sendMail({
      from: `"StudyFlow 📚" <${process.env.EMAIL_USER}>`,
      to, subject, html,
    });
    console.log("✅ Email sent to " + to + ": " + subject);
    return true;
  } catch (err) {
    console.error("❌ Email error for " + to + ":", err.message);
    console.error("   Check: Gmail App Password correct? 2FA enabled? Less-secure apps?");
    return false;
  }
}

// ── Email templates ─────────────────────────────────────────────────
function verificationHTML(name, verifyUrl) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F7F8FF;font-family:'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#6C63FF,#A855F7);padding:36px 40px;text-align:center;">
    <div style="font-size:44px;margin-bottom:8px;">📚</div>
    <div style="font-size:26px;font-weight:800;color:#fff;">StudyFlow</div>
    <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">Your smart study companion</div>
  </div>
  <div style="padding:36px 40px;">
    <h2 style="font-size:22px;font-weight:700;color:#1E1B4B;margin:0 0 12px;">Welcome, ${name}! 🎉</h2>
    <p style="color:#6B7280;font-size:15px;line-height:1.7;margin:0 0 28px;">You're almost ready! Please verify your email address to activate your StudyFlow account.</p>
    <div style="text-align:center;margin:0 0 28px;">
      <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#6C63FF,#A855F7);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:15px;box-shadow:0 8px 22px rgba(108,99,255,0.35);">✅ Verify My Email</a>
    </div>
    <div style="background:#EEF0FF;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <p style="color:#6C63FF;font-size:13px;font-weight:700;margin:0 0 4px;">⏰ This link expires in 24 hours</p>
      <p style="color:#6B7280;font-size:12px;margin:0;">If you didn't create an account, you can safely ignore this email.</p>
    </div>
    <p style="color:#9CA3AF;font-size:12px;line-height:1.6;margin:0;">If the button doesn't work, copy and paste this link:<br><a href="${verifyUrl}" style="color:#6C63FF;word-break:break-all;">${verifyUrl}</a></p>
  </div>
  <div style="background:#F7F8FF;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB;">
    <p style="color:#9CA3AF;font-size:12px;margin:0;">StudyFlow · sheikhnazmulislam.cz/studyflow</p>
  </div>
</div></body></html>`;
}

function appreciationHTML(studentName, badge, message) {
  const COLORS = {
    "⭐ Star Student":        "#92400E,#FEF9C3",
    "🚀 Most Improved":       "#1E40AF,#DBEAFE",
    "🔥 On Fire":             "#991B1B,#FEE2E2",
    "📚 Subject Expert":      "#065F46,#D1FAE5",
    "🏆 Top Scorer":          "#5B21B6,#EDE9FE",
    "💪 Most Consistent":     "#7C2D12,#FFEDD5",
    "🌟 Outstanding":         "#9D174D,#FCE7F3",
    "🎓 Academic Excellence": "#155E75,#CFFAFE",
  };
  const [color, bg] = (COLORS[badge] || "#4338CA,#EEF0FF").split(",");
  const emoji = badge.split(" ")[0];
  const label = badge.split(" ").slice(1).join(" ");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F7F8FF;font-family:'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#6C63FF,#A855F7);padding:36px 40px;text-align:center;">
    <div style="font-size:44px;margin-bottom:8px;">📚</div>
    <div style="font-size:26px;font-weight:800;color:#fff;">StudyFlow</div>
  </div>
  <div style="padding:36px 40px;">
    <h2 style="font-size:22px;font-weight:700;color:#1E1B4B;margin:0 0 8px;">You've received an appreciation! 🎉</h2>
    <p style="color:#6B7280;font-size:15px;line-height:1.7;margin:0 0 24px;">Hey <strong style="color:#1E1B4B;">${studentName}</strong>, your teacher has sent you a special recognition on StudyFlow!</p>
    <div style="background:${bg};border:2px solid ${color}33;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:10px;">${emoji}</div>
      <div style="font-size:20px;font-weight:800;color:${color};margin-bottom:16px;">${label}</div>
      <div style="background:#fff;border-radius:10px;padding:16px 20px;border-left:4px solid ${color};text-align:left;">
        <div style="color:#9CA3AF;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Message from your teacher</div>
        <div style="color:${color};font-size:15px;font-weight:600;font-style:italic;line-height:1.6;">"${message}"</div>
        <div style="color:#9CA3AF;font-size:12px;margin-top:8px;">— Admin</div>
      </div>
    </div>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#6C63FF,#A855F7);color:#fff;text-decoration:none;padding:13px 32px;border-radius:12px;font-weight:700;font-size:14px;box-shadow:0 8px 22px rgba(108,99,255,0.3);">📊 View My Progress</a>
    </div>
    <p style="color:#6B7280;font-size:13px;line-height:1.7;text-align:center;margin:0;">Keep up the amazing work! Your dedication is being noticed. 💪</p>
  </div>
  <div style="background:#F7F8FF;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB;">
    <p style="color:#9CA3AF;font-size:12px;margin:0;">StudyFlow · sheikhnazmulislam.cz/studyflow</p>
  </div>
</div></body></html>`;
}

// ── Auth middleware ──────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid or expired token" }); }
}

// ════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════

// POST /api/register — create unverified account + send verification email
app.post("/api/register", async (req, res) => {
  const { name, email, password, grade } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email and password are required." });

  const { data: existing } = await supabase
    .from("users").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (existing) return res.status(400).json({ error: "Email already registered." });

  const password_hash = await bcrypt.hash(password, 10);
  const verifyToken   = crypto.randomBytes(32).toString("hex");
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("users")
    .insert({ name, email: email.toLowerCase(), password_hash, grade: grade||null,
              email_verified: false, verify_token: verifyToken, verify_expires: verifyExpires })
    .select("id, name, email, grade")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const verifyUrl = `${APP_URL}/?verify=${verifyToken}`;
  sendEmail({ to: data.email, subject: "📚 Verify your StudyFlow account", html: verificationHTML(data.name, verifyUrl) });

  res.json({ message: "Account created! Check your email to verify before logging in.", email: data.email, needsVerification: true });
});

// GET /api/verify-email?token=XXX — verify token, return JWT
app.get("/api/verify-email", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Token is required." });

  const { data: user } = await supabase
    .from("users")
    .select("id, name, email, grade, avatar, verify_expires, email_verified")
    .eq("verify_token", token).maybeSingle();

  if (!user) return res.status(400).json({ error: "Invalid or expired verification link." });
  if (user.email_verified) return res.json({ message: "Email already verified! You can log in.", alreadyVerified: true });
  if (new Date() > new Date(user.verify_expires))
    return res.status(400).json({ error: "Verification link has expired. Please register again." });

  await supabase.from("users")
    .update({ email_verified: true, verify_token: null, verify_expires: null })
    .eq("id", user.id);

  const jwtToken = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ message: "Email verified! Welcome to StudyFlow! 🎉", token: jwtToken,
             user: { id: user.id, name: user.name, email: user.email, grade: user.grade, avatar: user.avatar } });
});

// POST /api/resend-verification
app.post("/api/resend-verification", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });

  const { data: user } = await supabase.from("users")
    .select("id, name, email, email_verified").eq("email", email.toLowerCase()).maybeSingle();
  if (!user) return res.status(404).json({ error: "No account found with this email." });
  if (user.email_verified) return res.json({ message: "Email already verified! You can log in." });

  const verifyToken   = crypto.randomBytes(32).toString("hex");
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("users").update({ verify_token: verifyToken, verify_expires: verifyExpires }).eq("id", user.id);

  const verifyUrl = `${APP_URL}/?verify=${verifyToken}`;
  sendEmail({ to: user.email, subject: "📚 StudyFlow — New verification link", html: verificationHTML(user.name, verifyUrl) });
  res.json({ message: "New verification email sent! Check your inbox." });
});

// POST /api/login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

  const { data } = await supabase.from("users").select("*").eq("email", email.toLowerCase()).maybeSingle();
  if (!data) return res.status(401).json({ error: "No account found with this email." });

  const valid = await bcrypt.compare(password, data.password_hash);
  if (!valid) return res.status(401).json({ error: "Wrong password." });

  if (!data.email_verified)
    return res.status(403).json({ error: "Please verify your email first. Check your inbox for the verification link.", needsVerification: true, email: data.email });

  const token = jwt.sign({ id: data.id, name: data.name, email: data.email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: data.id, name: data.name, email: data.email, grade: data.grade, avatar: data.avatar } });
});

// GET /api/me
app.get("/api/me", auth, async (req, res) => {
  const { data, error } = await supabase.from("users")
    .select("id, name, email, grade, avatar").eq("id", req.user.id).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ════════════════════════════════════════════════════════════════════
// SUBJECTS
// ════════════════════════════════════════════════════════════════════

app.get("/api/subjects", auth, async (req, res) => {
  const { data, error } = await supabase.from("subjects").select("*").eq("user_id", req.user.id).order("created_at");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/subjects", auth, async (req, res) => {
  const { name, color_idx } = req.body;
  if (!name) return res.status(400).json({ error: "Subject name is required." });
  const { data, error } = await supabase.from("subjects")
    .insert({ user_id: req.user.id, name, color_idx: color_idx ?? 0 }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete("/api/subjects/:id", auth, async (req, res) => {
  const { error } = await supabase.from("subjects").delete().eq("id", req.params.id).eq("user_id", req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════
// STUDY SESSIONS
// ════════════════════════════════════════════════════════════════════

app.get("/api/sessions", auth, async (req, res) => {
  const { data, error } = await supabase.from("study_sessions").select("*").eq("user_id", req.user.id).order("date").order("hour");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/sessions", auth, async (req, res) => {
  const { subject_id, date, hour, duration, notes } = req.body;
  const { data, error } = await supabase.from("study_sessions")
    .insert({ user_id: req.user.id, subject_id, date, hour, duration, notes: notes||null }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put("/api/sessions/:id", auth, async (req, res) => {
  const { subject_id, date, hour, duration, notes } = req.body;
  const { data, error } = await supabase.from("study_sessions")
    .update({ subject_id, date, hour, duration, notes: notes||null })
    .eq("id", req.params.id).eq("user_id", req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete("/api/sessions/:id", auth, async (req, res) => {
  const { error } = await supabase.from("study_sessions").delete().eq("id", req.params.id).eq("user_id", req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════
// LEARNING LOGS
// ════════════════════════════════════════════════════════════════════

app.get("/api/logs", auth, async (req, res) => {
  const { data, error } = await supabase.from("learning_logs").select("*").eq("user_id", req.user.id)
    .order("date", { ascending: false }).order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/logs", auth, async (req, res) => {
  const { subject_id, date, topic, details, tags } = req.body;
  if (!topic) return res.status(400).json({ error: "Topic is required." });
  const { data, error } = await supabase.from("learning_logs")
    .insert({ user_id: req.user.id, subject_id, date, topic, details: details||null, tags: tags||[] }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put("/api/logs/:id", auth, async (req, res) => {
  const { subject_id, date, topic, details, tags } = req.body;
  const { data, error } = await supabase.from("learning_logs")
    .update({ subject_id, date, topic, details: details||null, tags: tags||[] })
    .eq("id", req.params.id).eq("user_id", req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete("/api/logs/:id", auth, async (req, res) => {
  const { error } = await supabase.from("learning_logs").delete().eq("id", req.params.id).eq("user_id", req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════
// PROFILE UPDATE
// ════════════════════════════════════════════════════════════════════

app.put("/api/profile", auth, async (req, res) => {
  const { name, grade, avatar } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required." });
  const { data, error } = await supabase.from("users")
    .update({ name, grade: grade||null, avatar: avatar||null })
    .eq("id", req.user.id).select("id, name, email, grade, avatar").single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ════════════════════════════════════════════════════════════════════
// STUDENTS — verified only, public rankings data
// ════════════════════════════════════════════════════════════════════

app.get("/api/students", async (req, res) => {
  const { data: users, error: uErr } = await supabase
    .from("users").select("id, name, grade, avatar");  // show all students in admin
  if (uErr) return res.status(500).json({ error: uErr.message });

  const { data: subjects }      = await supabase.from("subjects").select("*");
  const { data: sessions }      = await supabase.from("study_sessions").select("*");
  const { data: logs }          = await supabase.from("learning_logs").select("id,user_id,subject_id,date,topic,tags");
  const { data: appreciations } = await supabase.from("appreciations").select("*").order("sent_at", { ascending: false });

  const students = users.map(u => ({
    user:          u,
    subjects:      (subjects||[]).filter(s => s.user_id === u.id),
    sessions:      (sessions||[]).filter(s => s.user_id === u.id),
    logs:          (logs||[]).filter(l => l.user_id === u.id),
    appreciations: (appreciations||[]).filter(a => a.student_id === u.id),
  }));

  res.json(students);
});

// ════════════════════════════════════════════════════════════════════
// APPRECIATIONS — with email notification
// ════════════════════════════════════════════════════════════════════

app.post("/api/appreciations", async (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey) return res.status(401).json({ error: "Admin key required." });

  const { student_id, badge, message } = req.body;
  if (!student_id || !badge || !message)
    return res.status(400).json({ error: "student_id, badge, and message are required." });

  const { data, error } = await supabase.from("appreciations")
    .insert({ student_id, badge, message, sent_at: new Date().toISOString() }).select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Send email notification to student
  const { data: student } = await supabase.from("users")
    .select("name, email, email_verified").eq("id", student_id).maybeSingle();

  if (student?.email_verified) {
    sendEmail({
      to:      student.email,
      subject: `🌟 You received a "${badge}" appreciation on StudyFlow!`,
      html:    appreciationHTML(student.name, badge, message),
    });
  }

  res.json(data);
});

app.get("/api/appreciations", auth, async (req, res) => {
  const { data, error } = await supabase.from("appreciations").select("*")
    .eq("student_id", req.user.id).order("sent_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get("/api/appreciations/:student_id", async (req, res) => {
  const { data, error } = await supabase.from("appreciations").select("*")
    .eq("student_id", req.params.student_id).order("sent_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ── Start ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`StudyFlow API running on port ${PORT}`));
