const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8099;
const DATA_DIR = process.env.DATA_DIR || "/data";
const DATA_FILE = path.join(DATA_DIR, "reminders.json");
const BACKUP_FILE = path.join(DATA_DIR, "reminders.backup.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ---- Lưu trữ dữ liệu (file JSON dùng chung cho mọi thiết bị) ----

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readReminders() {
  ensureDataDir();
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    if (!raw.trim()) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Lỗi đọc reminders.json, thử khôi phục từ bản sao lưu:", err.message);
    try {
      if (fs.existsSync(BACKUP_FILE)) {
        const raw = fs.readFileSync(BACKUP_FILE, "utf8");
        return JSON.parse(raw);
      }
    } catch (err2) {
      console.error("Bản sao lưu cũng lỗi:", err2.message);
    }
    return [];
  }
}

// Ghi an toàn: ghi ra file tạm rồi đổi tên (tránh hỏng file khi mất điện giữa chừng),
// đồng thời giữ 1 bản backup của trạng thái trước đó.
function writeReminders(list) {
  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      fs.copyFileSync(DATA_FILE, BACKUP_FILE);
    } catch (e) {}
  }
  const tmpFile = DATA_FILE + ".tmp";
  fs.writeFileSync(tmpFile, JSON.stringify(list, null, 2), "utf8");
  fs.renameSync(tmpFile, DATA_FILE);
}

function isValidReminder(r) {
  return (
    r &&
    typeof r.title === "string" &&
    r.title.trim().length > 0 &&
    Number.isInteger(r.lunarDay) &&
    r.lunarDay >= 1 &&
    r.lunarDay <= 30 &&
    Number.isInteger(r.lunarMonth) &&
    r.lunarMonth >= 1 &&
    r.lunarMonth <= 12 &&
    typeof r.time === "string"
  );
}

// ---- API ----

app.get("/api/reminders", (req, res) => {
  res.json(readReminders());
});

app.post("/api/reminders", (req, res) => {
  const body = req.body || {};
  if (!isValidReminder(body)) {
    return res.status(400).json({ error: "Dữ liệu nhắc nhở không hợp lệ." });
  }
  const list = readReminders();
  const reminder = {
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    title: body.title.trim(),
    lunarDay: body.lunarDay,
    lunarMonth: body.lunarMonth,
    time: body.time,
    repeat: !!body.repeat,
    leadDays: Number.isInteger(body.leadDays) ? body.leadDays : 0,
    targetLunarYear: body.targetLunarYear || null,
    lastNotifiedKey: "",
  };
  list.push(reminder);
  writeReminders(list);
  res.status(201).json(reminder);
});

app.delete("/api/reminders/:id", (req, res) => {
  const list = readReminders();
  const next = list.filter((r) => r.id !== req.params.id);
  if (next.length === list.length) {
    return res.status(404).json({ error: "Không tìm thấy nhắc nhở." });
  }
  writeReminders(next);
  res.json({ ok: true });
});

// Cập nhật lastNotifiedKey sau khi 1 thiết bị đã bắn thông báo,
// để các thiết bị khác không bắn lại trùng.
app.patch("/api/reminders/:id", (req, res) => {
  const list = readReminders();
  const idx = list.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Không tìm thấy nhắc nhở." });
  if (typeof req.body.lastNotifiedKey === "string") {
    list[idx].lastNotifiedKey = req.body.lastNotifiedKey;
  }
  writeReminders(list);
  res.json(list[idx]);
});

// Nhập hàng loạt từ file sao lưu cũ (localStorage export) — gộp, không đè.
app.post("/api/reminders/import", (req, res) => {
  const incoming = Array.isArray(req.body) ? req.body : [];
  const valid = incoming.filter(isValidReminder);
  const list = readReminders();
  const existingIds = new Set(list.map((r) => r.id));
  let added = 0;
  valid.forEach((r) => {
    const id = r.id && !existingIds.has(r.id) ? r.id : Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    existingIds.add(id);
    list.push({
      id,
      title: r.title.trim(),
      lunarDay: r.lunarDay,
      lunarMonth: r.lunarMonth,
      time: r.time,
      repeat: !!r.repeat,
      leadDays: Number.isInteger(r.leadDays) ? r.leadDays : 0,
      targetLunarYear: r.targetLunarYear || null,
      lastNotifiedKey: "",
    });
    added++;
  });
  writeReminders(list);
  res.json({ ok: true, added });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Lịch Âm Dương server đang chạy ở cổng ${PORT}, dữ liệu lưu tại ${DATA_FILE}`);
});
