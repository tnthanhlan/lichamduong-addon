const $ = (id) => document.getElementById(id);
const MONTH_VN = ["Tháng Một","Tháng Hai","Tháng Ba","Tháng Tư","Tháng Năm","Tháng Sáu",
  "Tháng Bảy","Tháng Tám","Tháng Chín","Tháng Mười","Tháng Mười Một","Tháng Chạp"];

let today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth() + 1; // 1-12
let selected = { d: today.getDate(), m: today.getMonth() + 1, y: today.getFullYear() };

// ---- Đồng bộ dữ liệu qua server (dùng chung cho mọi thiết bị) ----
let remindersCache = [];
let syncing = false;

function loadReminders() {
  return remindersCache;
}

async function fetchReminders() {
  try {
    const res = await fetch("/api/reminders");
    if (!res.ok) throw new Error("fetch failed");
    remindersCache = await res.json();
    setSyncStatus("ok");
  } catch (e) {
    setSyncStatus("error");
  }
}

async function addReminderApi(reminder) {
  const res = await fetch("/api/reminders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reminder),
  });
  if (!res.ok) throw new Error("add failed");
  const saved = await res.json();
  remindersCache.push(saved);
  return saved;
}

async function deleteReminderApi(id) {
  const res = await fetch("/api/reminders/" + encodeURIComponent(id), { method: "DELETE" });
  if (!res.ok) throw new Error("delete failed");
  remindersCache = remindersCache.filter((r) => r.id !== id);
}

async function patchReminderApi(id, patch) {
  const res = await fetch("/api/reminders/" + encodeURIComponent(id), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (res.ok) {
    const idx = remindersCache.findIndex((r) => r.id === id);
    if (idx !== -1) Object.assign(remindersCache[idx], patch);
  }
}

async function importRemindersApi(list) {
  const res = await fetch("/api/reminders/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(list),
  });
  if (!res.ok) throw new Error("import failed");
  const result = await res.json();
  await fetchReminders();
  return result;
}

function setSyncStatus(state) {
  const el = $("syncStatus");
  if (!el) return;
  if (state === "ok") {
    el.textContent = "Đã đồng bộ · " + pad2(new Date().getHours()) + ":" + pad2(new Date().getMinutes());
    el.style.color = "";
  } else {
    el.textContent = "Không kết nối được máy chủ — đang hiển thị dữ liệu cũ.";
    el.style.color = "var(--lacquer)";
  }
}

function pad2(n) { return n < 10 ? "0" + n : "" + n; }

function isSameSolar(a, b) { return a.d === b.d && a.m === b.m && a.y === b.y; }

function renderCalendar() {
  const grid = $("grid");
  grid.innerHTML = "";

  const firstOfMonth = new Date(viewYear, viewMonth - 1, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth - 1, 0).getDate();

  const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1;
  const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear;
  const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1;
  const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear;

  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ d: daysInPrevMonth - i, m: prevMonth, y: prevYear, other: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ d, m: viewMonth, y: viewYear, other: false });
  }
  let nd = 1;
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({ d: nd, m: nextMonth, y: nextYear, other: true });
    nd++;
    if (cells.length >= 42) break;
  }

  cells.forEach((c) => {
    const [ld, lm] = convertSolar2Lunar(c.d, c.m, c.y);
    const div = document.createElement("div");
    div.className = "day-cell" + (c.other ? " other-month" : "");
    const isToday = isSameSolar({ d: c.d, m: c.m, y: c.y }, { d: today.getDate(), m: today.getMonth() + 1, y: today.getFullYear() });
    if (isToday) div.classList.add("today");
    const dow = new Date(c.y, c.m - 1, c.d).getDay();
    if (dow === 0) div.classList.add("sunday");
    if (ld === 1) div.classList.add("mung1");
    if (ld === 15) div.classList.add("ram");
    if (isSameSolar({ d: c.d, m: c.m, y: c.y }, selected)) div.classList.add("selected");

    div.innerHTML = `<div class="solar">${c.d}</div><div class="lunar">${ld}/${lm}</div>`;

    if (hasReminderOn(c.d, c.m, c.y)) {
      const dot = document.createElement("div");
      dot.className = "dot";
      div.appendChild(dot);
    }

    div.addEventListener("click", () => {
      if (c.other) {
        viewMonth = c.m; viewYear = c.y;
      }
      selected = { d: c.d, m: c.m, y: c.y };
      renderCalendar();
      renderPanel();
    });

    grid.appendChild(div);
  });

  $("monthLabel").textContent = MONTH_VN[viewMonth - 1];
  $("monthSub").textContent = "Năm " + viewYear;

  const [, , midLunarYear] = convertSolar2Lunar(15, viewMonth, viewYear);
  $("yearCanChi").textContent = "Năm " + canChiYear(midLunarYear);
}

function hasReminderOn(d, m, y) {
  const [ld, lm] = convertSolar2Lunar(d, m, y);
  return loadReminders().some(r => r.lunarDay === ld && r.lunarMonth === lm);
}

function renderPanel() {
  const [ld, lm, ly, leap] = convertSolar2Lunar(selected.d, selected.m, selected.y);
  $("selTitle").textContent = `${pad2(selected.d)}/${pad2(selected.m)}/${selected.y}`;
  const jd = jdFromDate(selected.d, selected.m, selected.y);
  $("selLunar").textContent =
    `Âm lịch: ${ld}/${lm}${leap ? " (nhuận)" : ""} · Ngày ${canChiDay(jd)} · Tháng ${canChiMonth(lm, ly)} · Năm ${canChiYear(ly)}`;

  const list = loadReminders().filter(r => r.lunarDay === ld && r.lunarMonth === lm);
  const box = $("reminderList");
  box.innerHTML = "";
  if (list.length === 0) {
    box.innerHTML = `<div class="empty-note">Chưa có nhắc nhở nào cho ngày âm lịch này.</div>`;
  } else {
    list.forEach(r => {
      const item = document.createElement("div");
      item.className = "reminder-item";
      item.innerHTML = `
        <div class="txt">
          <strong>${escapeHtml(r.title)}</strong>
          <small>${r.time} · ${r.repeat ? "Lặp lại hằng năm" : "Chỉ một lần"}${r.leadDays > 0 ? " · Báo trước " + r.leadDays + " ngày" : ""}</small>
        </div>
        <button data-id="${r.id}">Xóa</button>
      `;
      item.querySelector("button").addEventListener("click", async () => {
        try {
          await deleteReminderApi(r.id);
        } catch (e) {
          alert("Không xóa được, kiểm tra kết nối tới máy chủ.");
          return;
        }
        renderPanel();
        renderCalendar();
      });
      box.appendChild(item);
    });
  }
  renderUpcoming();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function occurrenceFor(r) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const [hh, mm] = r.time.split(":").map(Number);
  const leadMs = (r.leadDays || 0) * 24 * 60 * 60 * 1000;
  for (let i = 0; i < 400; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const [ld, lm, ly] = convertSolar2Lunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
    if (ld === r.lunarDay && lm === r.lunarMonth && (r.repeat || ly === r.targetLunarYear)) {
      const eventDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0);
      const notifyDate = new Date(eventDate.getTime() - leadMs);
      if (notifyDate.getTime() >= Date.now() - 60000) {
        return { eventDate, notifyDate };
      }
      if (!r.repeat) return null;
    }
  }
  return null;
}

function renderUpcoming() {
  const list = loadReminders();
  const withDates = list.map(r => ({ r, occ: occurrenceFor(r) }))
    .filter(x => x.occ)
    .sort((a,b) => a.occ.notifyDate - b.occ.notifyDate);

  const box = $("upcomingList");
  box.innerHTML = "";
  if (withDates.length === 0) {
    box.innerHTML = `<div class="empty-note" style="padding-left:2px;">Chưa có nhắc nhở nào được đặt.</div>`;
    return;
  }
  withDates.forEach(({ r, occ }) => {
    const item = document.createElement("div");
    item.className = "reminder-item";
    const ev = occ.eventDate;
    const nt = occ.notifyDate;
    const evStr = `${pad2(ev.getDate())}/${pad2(ev.getMonth()+1)}/${ev.getFullYear()}`;
    let subLine = `Âm ${r.lunarDay}/${r.lunarMonth} · Ngày: ${evStr}`;
    if (r.leadDays > 0) {
      const ntStr = `${pad2(nt.getDate())}/${pad2(nt.getMonth()+1)}/${nt.getFullYear()} · ${pad2(nt.getHours())}:${pad2(nt.getMinutes())}`;
      subLine += ` · Báo trước ${r.leadDays} ngày lúc ${ntStr}`;
    } else {
      subLine += ` lúc ${pad2(nt.getHours())}:${pad2(nt.getMinutes())}`;
    }
    item.innerHTML = `
      <div class="txt">
        <strong>${escapeHtml(r.title)}</strong>
        <small>${subLine}</small>
      </div>
    `;
    box.appendChild(item);
  });
}

// ---- Modal thêm nhắc nhở ----
$("openAdd").addEventListener("click", () => {
  const [ld, lm] = convertSolar2Lunar(selected.d, selected.m, selected.y);
  $("fTitle").value = "";
  $("fDay").value = ld;
  $("fMonth").value = lm;
  $("fTime").value = "08:00";
  $("fLead").value = "0";
  $("fRepeat").checked = true;
  $("overlay").classList.add("show");
});
$("cancelBtn").addEventListener("click", () => $("overlay").classList.remove("show"));
$("overlay").addEventListener("click", (e) => { if (e.target.id === "overlay") $("overlay").classList.remove("show"); });

$("saveBtn").addEventListener("click", async () => {
  const title = $("fTitle").value.trim();
  const day = parseInt($("fDay").value, 10);
  const month = parseInt($("fMonth").value, 10);
  const time = $("fTime").value || "08:00";
  const leadDays = parseInt($("fLead").value, 10) || 0;
  const repeat = $("fRepeat").checked;
  if (!title || !day || !month || day < 1 || day > 30 || month < 1 || month > 12) {
    alert("Vui lòng nhập đầy đủ tên nhắc nhở, ngày (1-30) và tháng (1-12) âm lịch hợp lệ.");
    return;
  }
  const [, , curLunarYear] = convertSolar2Lunar(selected.d, selected.m, selected.y);
  try {
    await addReminderApi({
      title, lunarDay: day, lunarMonth: month, time, repeat, leadDays,
      targetLunarYear: curLunarYear,
    });
  } catch (e) {
    alert("Không lưu được nhắc nhở — kiểm tra kết nối tới máy chủ rồi thử lại.");
    return;
  }
  $("overlay").classList.remove("show");
  renderPanel();
  renderCalendar();
});

// ---- Thông báo ----
$("enableNotif").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("Trình duyệt này không hỗ trợ thông báo.");
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    new Notification("Đã bật thông báo", { body: "Bạn sẽ nhận nhắc nhở khi ứng dụng đang mở." });
  }
});

async function checkReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  for (const r of loadReminders()) {
    const occ = occurrenceFor(r);
    if (!occ) continue;
    const nt = occ.notifyDate;
    const key = `${nt.getFullYear()}-${nt.getMonth()+1}-${nt.getDate()}-${nt.getHours()}-${nt.getMinutes()}`;
    const sameMoment = nt.getFullYear() === now.getFullYear() && nt.getMonth() === now.getMonth() &&
      nt.getDate() === now.getDate() && nt.getHours() === now.getHours() && nt.getMinutes() === now.getMinutes();
    if (sameMoment && r.lastNotifiedKey !== key) {
      const body = r.leadDays > 0
        ? `Còn ${r.leadDays} ngày nữa tới ngày âm lịch ${r.lunarDay}/${r.lunarMonth}`
        : `Hôm nay là ngày âm lịch ${r.lunarDay}/${r.lunarMonth}`;
      new Notification(r.title, { body, icon: "icon-192.png" });
      await patchReminderApi(r.id, { lastNotifiedKey: key });
    }
  }
}
setInterval(checkReminders, 20000);

// ---- Đồng bộ định kỳ với server ----
// Đồng bộ nền chỉ chạy 1 lần/ngày lúc 01h (đỡ tốn tài nguyên máy chủ khi có
// nhiều tab/thiết bị mở sẵn cả ngày). Mỗi lần thực sự mở lại app (chuyển tab,
// bật màn hình...) vẫn luôn đồng bộ ngay lập tức — xem visibilitychange bên dưới —
// nên dữ liệu vẫn mới mỗi khi bạn thật sự dùng đến, chỉ là không tự làm mới
// liên tục trong lúc để im một chỗ.
function msUntilNextHour(hour) {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}
function scheduleDailySync() {
  setTimeout(async function runDailySync() {
    await fetchReminders();
    renderCalendar();
    renderPanel();
    setInterval(async () => {
      await fetchReminders();
      renderCalendar();
      renderPanel();
    }, 24 * 60 * 60 * 1000);
  }, msUntilNextHour(1));
}
scheduleDailySync();

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    await fetchReminders();
    renderCalendar();
    renderPanel();
  }
});

// ---- Sao lưu / khôi phục (vẫn giữ để chuyển dữ liệu cũ hoặc phòng thân) ----
$("exportBtn").addEventListener("click", () => {
  const data = loadReminders();
  if (data.length === 0) {
    alert("Chưa có nhắc nhở nào để sao lưu.");
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date();
  a.href = url;
  a.download = `sao-luu-nhac-nho-${now.getFullYear()}${pad2(now.getMonth()+1)}${pad2(now.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const incoming = JSON.parse(reader.result);
      if (!Array.isArray(incoming)) throw new Error("bad format");
      const result = await importRemindersApi(incoming);
      renderPanel();
      renderCalendar();
      alert(`Đã khôi phục ${result.added} nhắc nhở vào máy chủ dùng chung (đã gộp, không đè lên dữ liệu hiện có).`);
    } catch (err) {
      alert("File không hợp lệ, hoặc không kết nối được máy chủ. Vui lòng thử lại.");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

// ---- Điều hướng tháng ----
$("prevBtn").addEventListener("click", () => {
  viewMonth--; if (viewMonth < 1) { viewMonth = 12; viewYear--; }
  renderCalendar();
});
$("nextBtn").addEventListener("click", () => {
  viewMonth++; if (viewMonth > 12) { viewMonth = 1; viewYear++; }
  renderCalendar();
});

$("todayBtn").addEventListener("click", () => {
  viewMonth = today.getMonth() + 1;
  viewYear = today.getFullYear();
  selected = { d: today.getDate(), m: viewMonth, y: viewYear };
  renderCalendar();
  renderPanel();
});

$("openJump").addEventListener("click", () => {
  $("jumpMonth").value = viewMonth;
  $("jumpYear").value = viewYear;
  $("jumpOverlay").classList.add("show");
});
$("jumpCancelBtn").addEventListener("click", () => $("jumpOverlay").classList.remove("show"));
$("jumpOverlay").addEventListener("click", (e) => { if (e.target.id === "jumpOverlay") $("jumpOverlay").classList.remove("show"); });
$("jumpGoBtn").addEventListener("click", () => {
  const m = parseInt($("jumpMonth").value, 10);
  const y = parseInt($("jumpYear").value, 10);
  if (!y || y < 1800 || y > 2199 || m < 1 || m > 12) {
    alert("Vui lòng nhập năm hợp lệ (1800-2199).");
    return;
  }
  viewMonth = m;
  viewYear = y;
  const daysInTarget = new Date(y, m, 0).getDate();
  const keepDay = Math.min(selected.d, daysInTarget);
  selected = { d: keepDay, m, y };
  $("jumpOverlay").classList.remove("show");
  renderCalendar();
  renderPanel();
});

// ---- Biểu tượng pha mặt trăng ----
function updateMoonSeal() {
  const [ld] = convertSolar2Lunar(today.getDate(), today.getMonth()+1, today.getFullYear());
  let icon = "🌑";
  if (ld <= 1) icon = "🌑";
  else if (ld < 7) icon = "🌒";
  else if (ld <= 8) icon = "🌓";
  else if (ld < 15) icon = "🌔";
  else if (ld <= 16) icon = "🌕";
  else if (ld < 22) icon = "🌖";
  else if (ld <= 23) icon = "🌗";
  else icon = "🌘";
  $("moonSeal").textContent = icon;
}

// ---- Service worker ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---- Khởi động ----
(async function init() {
  updateMoonSeal();
  await fetchReminders();
  renderCalendar();
  renderPanel();
})();
