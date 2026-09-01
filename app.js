/*
  Exir Calendar - Jalali calendar prototype v2

  Storage:
  - Local browser storage works immediately.
  - Optional GitHub sync writes calendar.json to your repository.
  - GitHub credentials are kept in sessionStorage only and are never hard-coded.

  IMPORTANT:
  A GitHub Pages site cannot securely hide a password/token in client-side JS.
  The GitHub token method below is intended for a single administrator.
  Use a fine-grained token restricted to this repository and Contents: Read/Write.
*/

const MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const WEEKDAYS = ["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"];
const COLORS = ["blue","green","orange","red","purple","teal","pink","indigo","yellow","gray"];
const COLOR_NAMES = {blue:"آبی",green:"سبز",orange:"نارنجی",red:"قرمز",purple:"بنفش",teal:"فیروزه‌ای",pink:"صورتی",indigo:"نیلی",yellow:"زرد",gray:"خاکستری"};

const STORAGE_KEY = "exir-calendar-data-v2";
const GITHUB_SESSION_KEY = "exir-calendar-github-session-v1";
const GITHUB_FILE = "calendar.json";
const TEHRAN_TZ = "Asia/Tehran";

let current = todayJalali();
let data = loadData();
let selectedJalaliDate = null;
let toastTimer = null;

const $ = id => document.getElementById(id);

const monthTitle = $("monthTitle");
const weekdays = $("weekdays");
const calendarGrid = $("calendarGrid");
const eventModal = $("eventModal");
const eventForm = $("eventForm");
const eventId = $("eventId");
const eventTitle = $("eventTitle");
const eventDescription = $("eventDescription");
const eventStartTime = $("eventStartTime");
const eventEndTime = $("eventEndTime");
const eventColor = $("eventColor");
const colorPicker = $("colorPicker");
const offDay = $("offDay");
const eventFields = $("eventFields");
const selectedDateLabel = $("selectedDateLabel");
const modalTitle = $("modalTitle");
const deleteEventBtn = $("deleteEventBtn");
const toast = $("toast");

const syncModal = $("syncModal");
const githubOwner = $("githubOwner");
const githubRepo = $("githubRepo");
const githubBranch = $("githubBranch");
const githubToken = $("githubToken");
const syncStatus = $("syncStatus");

init();

function init() {
  buildColorPicker();
  render();

  $("prevMonthBtn").addEventListener("click", () => { current = addJalaliMonths(current, -1); render(); });
  $("nextMonthBtn").addEventListener("click", () => { current = addJalaliMonths(current, 1); render(); });
  $("todayBtn").addEventListener("click", () => { current = todayJalali(); render(); });
  $("printBtn").addEventListener("click", () => window.print());

  $("modeBtn").addEventListener("click", () => {
    document.body.classList.toggle("view-mode");
    const viewing = document.body.classList.contains("view-mode");
    $("modeBtn").textContent = viewing ? "حالت مدیریت" : "حالت نمایش";
    showToast(viewing ? "حالت نمایش فعال شد" : "حالت مدیریت فعال شد");
  });

  $("syncBtn").addEventListener("click", openSyncModal);
  $("closeModalBtn").addEventListener("click", closeModal);
  $("cancelBtn").addEventListener("click", closeModal);
  $("closeSyncBtn").addEventListener("click", closeSyncModal);
  $("cancelSyncBtn").addEventListener("click", closeSyncModal);
  $("saveGithubBtn").addEventListener("click", connectGithub);
  $("clearGithubBtn").addEventListener("click", clearGithubSession);
  $("offDay").addEventListener("change", toggleOffDayFields);
  eventForm.addEventListener("submit", saveEvent);
  deleteEventBtn.addEventListener("click", deleteEvent);

  eventModal.addEventListener("click", e => { if (e.target === eventModal) closeModal(); });
  syncModal.addEventListener("click", e => { if (e.target === syncModal) closeSyncModal(); });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (!eventModal.classList.contains("hidden")) closeModal();
      if (!syncModal.classList.contains("hidden")) closeSyncModal();
    }
  });
}

function loadData() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      events: Array.isArray(raw?.events) ? raw.events : [],
      offDays: Array.isArray(raw?.offDays) ? raw.offDays : []
    };
  } catch {
    return {events: [], offDays: []};
  }
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function render() {
  weekdays.innerHTML = "";
  WEEKDAYS.forEach(day => {
    const el = document.createElement("div");
    el.className = "weekday";
    el.textContent = day;
    weekdays.appendChild(el);
  });

  monthTitle.textContent = `${MONTHS[current.month - 1]} ${toPersianDigits(current.year)}`;
  calendarGrid.innerHTML = "";

  const firstGregorian = jalaliToGregorian(current.year, current.month, 1);
  const firstSaturdayIndex = (firstGregorian.getDay() + 1) % 7;
  const lastDay = jalaliMonthLength(current.year, current.month);
  const today = todayJalali();

  for (let i = 0; i < firstSaturdayIndex; i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell empty";
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= lastDay; day++) {
    const dateKey = makeDateKey(current.year, current.month, day);
    const cell = document.createElement("div");
    cell.className = "day-cell";

    const isToday = sameDate(today, {year:current.year, month:current.month, day});
    const isOff = data.offDays.includes(dateKey);

    if (isToday) cell.classList.add("today");
    if (isOff) cell.classList.add("off-day");

    const number = document.createElement("div");
    number.className = "day-number";
    number.textContent = toPersianDigits(day);
    cell.appendChild(number);

    if (isOff) {
      const badge = document.createElement("span");
      badge.className = "off-badge";
      badge.textContent = "تعطیل";
      cell.appendChild(badge);
    }

    const hint = document.createElement("div");
    hint.className = "add-hint";
    hint.textContent = "برای افزودن / ویرایش کلیک کنید";
    cell.appendChild(hint);

    const eventsContainer = document.createElement("div");
    eventsContainer.className = "events";

    data.events
      .filter(e => e.date === dateKey)
      .sort((a,b) => (a.startTime || "").localeCompare(b.startTime || ""))
      .forEach(ev => {
        const eventEl = document.createElement("div");
        eventEl.className = `event ${ev.color || "blue"}`;

        const titleEl = document.createElement("div");
        titleEl.className = "event-title";

        if (ev.startTime || ev.endTime) {
          const timeEl = document.createElement("span");
          timeEl.className = "event-time";
          timeEl.textContent = formatTimeRange(ev.startTime, ev.endTime);
          titleEl.appendChild(timeEl);
        }

        const text = document.createElement("span");
        text.textContent = ev.title;
        titleEl.appendChild(text);
        eventEl.appendChild(titleEl);

        eventEl.addEventListener("click", e => {
          e.stopPropagation();
          if (!document.body.classList.contains("view-mode")) openEditModal(ev);
        });

        eventsContainer.appendChild(eventEl);
      });

    cell.appendChild(eventsContainer);

    cell.addEventListener("click", () => {
      if (!document.body.classList.contains("view-mode")) openDayModal(dateKey);
    });

    calendarGrid.appendChild(cell);
  }
}

function openDayModal(dateKey) {
  selectedJalaliDate = parseDateKey(dateKey);
  eventId.value = "";
  eventTitle.value = "";
  eventDescription.value = "";
  eventStartTime.value = "";
  eventEndTime.value = "";
  eventColor.value = "blue";
  selectColor("blue");

  const off = data.offDays.includes(dateKey);
  offDay.checked = off;
  toggleOffDayFields();

  modalTitle.textContent = "مدیریت روز";
  selectedDateLabel.textContent = formatJalali(selectedJalaliDate);
  deleteEventBtn.classList.add("hidden");

  eventModal.classList.remove("hidden");
  setTimeout(() => eventTitle.focus(), 0);
}

function openEditModal(ev) {
  selectedJalaliDate = parseDateKey(ev.date);
  eventId.value = ev.id;
  eventTitle.value = ev.title;
  eventDescription.value = ev.description || "";
  eventStartTime.value = ev.startTime || "";
  eventEndTime.value = ev.endTime || "";
  eventColor.value = ev.color || "blue";
  selectColor(eventColor.value);

  offDay.checked = data.offDays.includes(ev.date);
  toggleOffDayFields();

  modalTitle.textContent = "ویرایش رویداد";
  selectedDateLabel.textContent = formatJalali(selectedJalaliDate);
  deleteEventBtn.classList.remove("hidden");

  eventModal.classList.remove("hidden");
  setTimeout(() => eventTitle.focus(), 0);
}

function toggleOffDayFields() {
  eventFields.classList.toggle("hidden", offDay.checked);
  eventTitle.required = !offDay.checked;
}

function closeModal() {
  eventModal.classList.add("hidden");
  eventForm.reset();
  selectedJalaliDate = null;
}

function saveEvent(e) {
  e.preventDefault();
  if (!selectedJalaliDate) return;

  const dateKey = makeDateKey(selectedJalaliDate.year, selectedJalaliDate.month, selectedJalaliDate.day);

  // Off-day is a property of the whole date.
  if (offDay.checked) {
    if (!data.offDays.includes(dateKey)) data.offDays.push(dateKey);
  } else {
    data.offDays = data.offDays.filter(d => d !== dateKey);
  }

  const id = eventId.value;
  const existing = data.events.findIndex(ev => ev.id === id);

  if (offDay.checked) {
    // Do not create an event when the user is only marking the day off.
    if (existing >= 0) data.events.splice(existing, 1);
    saveLocal();
    closeModal();
    render();
    showToast("روز به‌عنوان تعطیل ذخیره شد");
    syncIfConfigured();
    return;
  }

  const title = eventTitle.value.trim();
  if (!title) return;

  if (eventStartTime.value && eventEndTime.value && eventEndTime.value < eventStartTime.value) {
    showToast("زمان پایان نمی‌تواند قبل از زمان شروع باشد");
    return;
  }

  const item = {
    id: id || crypto.randomUUID(),
    date: dateKey,
    title,
    description: eventDescription.value.trim(),
    startTime: eventStartTime.value,
    endTime: eventEndTime.value,
    color: eventColor.value
  };

  if (existing >= 0) {
    data.events[existing] = item;
    showToast("رویداد ویرایش شد");
  } else {
    data.events.push(item);
    showToast("رویداد اضافه شد");
  }

  saveLocal();
  closeModal();
  render();
  syncIfConfigured();
}

function deleteEvent() {
  const id = eventId.value;
  if (!id) return;
  if (!confirm("این رویداد حذف شود؟")) return;

  data.events = data.events.filter(ev => ev.id !== id);
  saveLocal();
  closeModal();
  render();
  showToast("رویداد حذف شد");
  syncIfConfigured();
}

function buildColorPicker() {
  colorPicker.innerHTML = "";
  COLORS.forEach(color => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `color-choice ${color}`;
    button.title = COLOR_NAMES[color];
    button.setAttribute("aria-label", COLOR_NAMES[color]);
    button.addEventListener("click", () => selectColor(color));
    colorPicker.appendChild(button);
  });
}

function selectColor(color) {
  eventColor.value = color;
  document.querySelectorAll(".color-choice").forEach(el => {
    el.classList.toggle("selected", el.classList.contains(color));
  });
}

function formatTimeRange(start, end) {
  if (start && end) return `${toPersianDigits(start)}–${toPersianDigits(end)}`;
  return start ? toPersianDigits(start) : toPersianDigits(end);
}

/* ---------- GitHub storage ---------- */

function getGithubSession() {
  try { return JSON.parse(sessionStorage.getItem(GITHUB_SESSION_KEY)); }
  catch { return null; }
}

function openSyncModal() {
  const s = getGithubSession();
  if (s) {
    githubOwner.value = s.owner || "";
    githubRepo.value = s.repo || "";
    githubBranch.value = s.branch || "main";
    githubToken.value = s.token || "";
    syncStatus.textContent = "ورود GitHub برای این نشست ذخیره شده است.";
  } else {
    githubOwner.value = "zahrar87";
    githubRepo.value = "exir_calendar";
    githubBranch.value = "main";
    githubToken.value = "";
    syncStatus.textContent = "";
  }
  syncModal.classList.remove("hidden");
}

function closeSyncModal() {
  syncModal.classList.add("hidden");
}

async function connectGithub() {
  const owner = githubOwner.value.trim();
  const repo = githubRepo.value.trim();
  const branch = githubBranch.value.trim() || "main";
  const token = githubToken.value.trim();

  if (!owner || !repo || !token) {
    syncStatus.textContent = "نام کاربری، repository و token را وارد کنید.";
    return;
  }

  syncStatus.textContent = "در حال دریافت اطلاعات از GitHub...";

  try {
    const s = {owner, repo, branch, token};
    sessionStorage.setItem(GITHUB_SESSION_KEY, JSON.stringify(s));

    const remote = await githubGetFile(s);
    if (remote?.data) {
      data = normalizeData(remote.data);
      saveLocal();
      render();
      syncStatus.textContent = "تقویم از GitHub دریافت شد.";
      showToast("اطلاعات GitHub دریافت شد");
    } else {
      syncStatus.textContent = "فایل calendar.json پیدا نشد؛ یک فایل جدید ساخته خواهد شد.";
      await githubPutFile(s, data, "Create calendar data");
      syncStatus.textContent = "فایل calendar.json ساخته شد.";
      showToast("ذخیره‌سازی GitHub آماده شد");
    }
  } catch (err) {
    sessionStorage.removeItem(GITHUB_SESSION_KEY);
    syncStatus.textContent = `خطا: ${err.message}`;
  }
}

function clearGithubSession() {
  sessionStorage.removeItem(GITHUB_SESSION_KEY);
  githubToken.value = "";
  syncStatus.textContent = "اطلاعات ورود از این مرورگر پاک شد.";
  showToast("ورود GitHub پاک شد");
}

async function syncIfConfigured() {
  const s = getGithubSession();
  if (!s) return;

  try {
    await githubPutFile(s, data, "Update calendar data");
    showToast("در GitHub ذخیره شد");
  } catch (err) {
    console.error(err);
    showToast("ذخیره محلی انجام شد؛ GitHub خطا داد");
  }
}

async function githubGetFile(s) {
  const url = `https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${GITHUB_FILE}?ref=${encodeURIComponent(s.branch)}`;
  const res = await fetch(url, {headers: githubHeaders(s.token)});
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const json = await res.json();
  const decoded = decodeBase64Unicode(json.content.replace(/\n/g, ""));
  return {sha: json.sha, data: JSON.parse(decoded)};
}

async function githubPutFile(s, value, message) {
  const existing = await githubGetFile(s);
  const content = encodeBase64Unicode(JSON.stringify(normalizeData(value), null, 2));
  const url = `https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${GITHUB_FILE}`;

  const body = {
    message,
    content,
    branch: s.branch
  };
  if (existing?.sha) body.sha = existing.sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: githubHeaders(s.token),
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 180)}`);
  }
  return res.json();
}

function githubHeaders(token) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };
}

function encodeBase64Unicode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

function decodeBase64Unicode(base64) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeData(value) {
  return {
    events: Array.isArray(value?.events) ? value.events : [],
    offDays: Array.isArray(value?.offDays) ? value.offDays : []
  };
}

/* ---------- Jalali calendar ---------- */

function todayJalali() {
  // Always use Tehran/Iran time for "today", regardless of the visitor's computer timezone.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TEHRAN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const get = type => Number(parts.find(p => p.type === type).value);
  return gregorianToJalaliFromNumbers(get("year"), get("month"), get("day"));
}

function gregorianToJalaliFromNumbers(gy, gm, gd) {
  const gdm = [0,31,59,90,120,151,181,212,243,273,304,334];
  const gy2 = gy + 1;
  let days = 355666 + 365 * gy + div(gy2,4) - div(gy2,100) + div(gy2,400) + gd + gdm[gm-1];

  let jy = -1595 + 33 * div(days,12053);
  days %= 12053;
  jy += 4 * div(days,1461);
  days %= 1461;

  if (days > 365) {
    jy += div(days - 1,365);
    days = (days - 1) % 365;
  }

  const jm = days < 186 ? 1 + div(days,31) : 7 + div(days - 186,30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return {year:jy, month:jm, day:jd};
}

function div(a,b) { return Math.floor(a/b); }

function jalaliToGregorian(jy,jm,jd) {
  jy += 1595;
  let days = -355668 + 365*jy + div(jy,33)*8 + div((jy%33)+3,4) + jd +
    (jm < 7 ? (jm-1)*31 : (jm-1)*30+6);

  let gy = 400 * div(days,146097);
  days %= 146097;

  if (days > 36524) {
    gy += 100 * div(--days,36524);
    days %= 36524;
    if (days >= 365) days++;
  }

  gy += 4 * div(days,1461);
  days %= 1461;

  if (days > 365) {
    gy += div(days-1,365);
    days = (days-1) % 365;
  }

  let gd = days + 1;
  const salA = [0,31,isGregorianLeap(gy)?29:28,31,30,31,30,31,31,30,31,30,31];
  let gm = 1;
  while (gm <= 12 && gd > salA[gm]) { gd -= salA[gm]; gm++; }
  return new Date(gy,gm-1,gd);
}

function isGregorianLeap(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function jalaliMonthLength(year,month) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isJalaliLeap(year) ? 30 : 29;
}

function isJalaliLeap(year) {
  const a = jalaliToGregorian(year,12,1);
  const b = jalaliToGregorian(year+1,1,1);
  return Math.round((b-a)/86400000) === 30;
}

function addJalaliMonths(date,amount) {
  let month = date.month + amount;
  let year = date.year;
  while (month > 12) { month -= 12; year++; }
  while (month < 1) { month += 12; year--; }
  return {year,month,day:Math.min(date.day,jalaliMonthLength(year,month))};
}

function makeDateKey(year,month,day) {
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function parseDateKey(key) {
  const [year,month,day] = key.split("-").map(Number);
  return {year,month,day};
}

function sameDate(a,b) {
  return a.year===b.year && a.month===b.month && a.day===b.day;
}

function formatJalali(date) {
  const weekday = WEEKDAYS[(jalaliToGregorian(date.year,date.month,date.day).getDay()+1)%7];
  return `${weekday}، ${toPersianDigits(date.day)} ${MONTHS[date.month-1]} ${toPersianDigits(date.year)}`;
}

function toPersianDigits(value) {
  return String(value).replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[d]);
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.remove("hidden");
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2300);
}
