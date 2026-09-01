/*
  Shamsi Calendar prototype
  No server/database required for this first version.
  Events are stored in this browser's localStorage.

  IMPORTANT:
  This prototype intentionally keeps all data local.
  Later, we can replace save/load with a shared database or GitHub-backed system.
*/

const MONTHS = [
  "فروردین", "اردیبهشت", "خرداد",
  "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر",
  "دی", "بهمن", "اسفند"
];

const WEEKDAYS = [
  "شنبه", "یکشنبه", "دوشنبه",
  "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"
];

const STORAGE_KEY = "shamsi-calendar-events-v1";

let current = gregorianToJalali(new Date());
let events = loadEvents();
let selectedJalaliDate = null;
let toastTimer = null;

const monthTitle = document.getElementById("monthTitle");
const gregorianHint = document.getElementById("gregorianHint");
const weekdays = document.getElementById("weekdays");
const calendarGrid = document.getElementById("calendarGrid");
const eventModal = document.getElementById("eventModal");
const eventForm = document.getElementById("eventForm");
const eventId = document.getElementById("eventId");
const eventTitle = document.getElementById("eventTitle");
const eventDescription = document.getElementById("eventDescription");
const eventTime = document.getElementById("eventTime");
const eventColor = document.getElementById("eventColor");
const selectedDateLabel = document.getElementById("selectedDateLabel");
const modalTitle = document.getElementById("modalTitle");
const deleteEventBtn = document.getElementById("deleteEventBtn");
const toast = document.getElementById("toast");

document.getElementById("prevMonthBtn").addEventListener("click", () => {
  current = addJalaliMonths(current, -1);
  render();
});

document.getElementById("nextMonthBtn").addEventListener("click", () => {
  current = addJalaliMonths(current, 1);
  render();
});

document.getElementById("todayBtn").addEventListener("click", () => {
  current = gregorianToJalali(new Date());
  render();
});

document.getElementById("printBtn").addEventListener("click", () => {
  window.print();
});

document.getElementById("modeBtn").addEventListener("click", () => {
  document.body.classList.toggle("view-mode");
  const viewMode = document.body.classList.contains("view-mode");
  document.getElementById("modeBtn").textContent = viewMode ? "حالت مدیریت" : "حالت نمایش";
  showToast(viewMode ? "حالت نمایش فعال شد" : "حالت مدیریت فعال شد");
});

document.getElementById("closeModalBtn").addEventListener("click", closeModal);
document.getElementById("cancelBtn").addEventListener("click", closeModal);

eventModal.addEventListener("click", (e) => {
  if (e.target === eventModal) closeModal();
});

eventForm.addEventListener("submit", saveEvent);
deleteEventBtn.addEventListener("click", deleteEvent);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !eventModal.classList.contains("hidden")) {
    closeModal();
  }
});

function render() {
  renderWeekdays();
  renderMonth();
}

function renderWeekdays() {
  weekdays.innerHTML = "";
  WEEKDAYS.forEach(day => {
    const el = document.createElement("div");
    el.className = "weekday";
    el.textContent = day;
    weekdays.appendChild(el);
  });
}

function renderMonth() {
  monthTitle.textContent = `${MONTHS[current.month - 1]} ${toPersianDigits(current.year)}`;

  const firstGregorian = jalaliToGregorian(current.year, current.month, 1);
  const lastDay = jalaliMonthLength(current.year, current.month);
  const lastGregorian = jalaliToGregorian(current.year, current.month, lastDay);

  gregorianHint.textContent =
    `تقریباً ${formatGregorian(firstGregorian)} تا ${formatGregorian(lastGregorian)}`;

  calendarGrid.innerHTML = "";

  // JS: Sunday=0 ... Saturday=6
  // We want Saturday first: Saturday=0 ... Friday=6
  const firstSaturdayIndex = (firstGregorian.getDay() + 1) % 7;

  for (let i = 0; i < firstSaturdayIndex; i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell empty";
    calendarGrid.appendChild(empty);
  }

  const today = gregorianToJalali(new Date());

  for (let day = 1; day <= lastDay; day++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";

    const dateKey = makeDateKey(current.year, current.month, day);
    const isToday =
      today.year === current.year &&
      today.month === current.month &&
      today.day === day;

    if (isToday) cell.classList.add("today");

    const number = document.createElement("div");
    number.className = "day-number";
    number.textContent = toPersianDigits(day);
    cell.appendChild(number);

    const hint = document.createElement("div");
    hint.className = "add-hint";
    hint.textContent = "برای افزودن کلیک کنید";
    cell.appendChild(hint);

    const eventsContainer = document.createElement("div");
    eventsContainer.className = "events";

    const dayEvents = events
      .filter(e => e.date === dateKey)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    dayEvents.forEach(ev => {
      const eventEl = document.createElement("div");
      eventEl.className = `event ${ev.color || "blue"}`;

      const titleEl = document.createElement("div");
      titleEl.className = "event-title";

      if (ev.time) {
        const timeEl = document.createElement("span");
        timeEl.className = "event-time";
        timeEl.textContent = toPersianDigits(ev.time);
        titleEl.appendChild(timeEl);
      }

      const text = document.createElement("span");
      text.textContent = ev.title;
      titleEl.appendChild(text);

      eventEl.appendChild(titleEl);

      eventEl.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!document.body.classList.contains("view-mode")) {
          openEditModal(ev);
        }
      });

      eventsContainer.appendChild(eventEl);
    });

    cell.appendChild(eventsContainer);

    cell.addEventListener("click", () => {
      if (!document.body.classList.contains("view-mode")) {
        openAddModal(dateKey);
      }
    });

    calendarGrid.appendChild(cell);
  }
}

function openAddModal(dateKey) {
  selectedJalaliDate = parseDateKey(dateKey);
  eventId.value = "";
  eventTitle.value = "";
  eventDescription.value = "";
  eventTime.value = "";
  eventColor.value = "blue";

  modalTitle.textContent = "افزودن رویداد";
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
  eventTime.value = ev.time || "";
  eventColor.value = ev.color || "blue";

  modalTitle.textContent = "ویرایش رویداد";
  selectedDateLabel.textContent = formatJalali(selectedJalaliDate);
  deleteEventBtn.classList.remove("hidden");

  eventModal.classList.remove("hidden");
  setTimeout(() => eventTitle.focus(), 0);
}

function closeModal() {
  eventModal.classList.add("hidden");
  eventForm.reset();
  selectedJalaliDate = null;
}

function saveEvent(e) {
  e.preventDefault();

  const title = eventTitle.value.trim();
  if (!title || !selectedJalaliDate) return;

  const data = {
    id: eventId.value || crypto.randomUUID(),
    date: makeDateKey(
      selectedJalaliDate.year,
      selectedJalaliDate.month,
      selectedJalaliDate.day
    ),
    title,
    description: eventDescription.value.trim(),
    time: eventTime.value,
    color: eventColor.value
  };

  const existingIndex = events.findIndex(ev => ev.id === data.id);

  if (existingIndex >= 0) {
    events[existingIndex] = data;
    showToast("رویداد ویرایش شد");
  } else {
    events.push(data);
    showToast("رویداد اضافه شد");
  }

  saveEvents();
  closeModal();
  render();
}

function deleteEvent() {
  const id = eventId.value;
  if (!id) return;

  const confirmed = confirm("این رویداد حذف شود؟");
  if (!confirmed) return;

  events = events.filter(ev => ev.id !== id);
  saveEvents();
  closeModal();
  render();
  showToast("رویداد حذف شد");
}

function loadEvents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.remove("hidden");

  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2200);
}

function makeDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

function formatJalali(date) {
  return `${WEEKDAYS[jalaliWeekdayIndex(date)]}، ${toPersianDigits(date.day)} ${MONTHS[date.month - 1]} ${toPersianDigits(date.year)}`;
}

function jalaliWeekdayIndex(date) {
  const g = jalaliToGregorian(date.year, date.month, date.day);
  return (g.getDay() + 1) % 7;
}

function formatGregorian(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function toPersianDigits(value) {
  return String(value).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
}

function addJalaliMonths(date, amount) {
  let month = date.month + amount;
  let year = date.year;

  while (month > 12) {
    month -= 12;
    year++;
  }

  while (month < 1) {
    month += 12;
    year--;
  }

  const maxDay = jalaliMonthLength(year, month);
  return {
    year,
    month,
    day: Math.min(date.day, maxDay)
  };
}

/*
  Jalali conversion routines.
  Based on the well-known Jalaali calendar algorithm.
*/

function div(a, b) {
  return Math.floor(a / b);
}

function jalaliToGregorian(jy, jm, jd) {
  jy += 1595;

  let days =
    -355668 +
    365 * jy +
    div(jy, 33) * 8 +
    div((jy % 33) + 3, 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 1) * 30 + 6);

  let gy = 400 * div(days, 146097);
  days %= 146097;

  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }

  gy += 4 * div(days, 1461);
  days %= 1461;

  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }

  let gd = days + 1;
  const sal_a = [
    0,
    31,
    isGregorianLeap(gy) ? 29 : 28,
    31, 30, 31, 30,
    31, 31, 30, 31, 30, 31
  ];

  let gm;
  for (gm = 1; gm <= 12 && gd > sal_a[gm]; gm++) {
    gd -= sal_a[gm];
  }

  return new Date(gy, gm - 1, gd);
}

function gregorianToJalali(date) {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();

  let g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

  let gy2 = gy + 1;
  let days;

  if (gm > 2) {
    days =
      355666 +
      365 * gy +
      div(gy2, 4) -
      div(gy2, 100) +
      div(gy2, 400) +
      gd +
      g_d_m[gm - 1];
  } else {
    days =
      355666 +
      365 * gy +
      div(gy2, 4) -
      div(gy2, 100) +
      div(gy2, 400) +
      gd +
      g_d_m[gm - 1];
  }

  let jy = -1595 + 33 * div(days, 12053);
  days %= 12053;

  jy += 4 * div(days, 1461);
  days %= 1461;

  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }

  let jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  let jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);

  return { year: jy, month: jm, day: jd };
}

function isGregorianLeap(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function jalaliMonthLength(year, month) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isJalaliLeap(year) ? 30 : 29;
}

function isJalaliLeap(year) {
  // Compare the last day of Esfand with the first day of Farvardin.
  // This uses the same conversion algorithm as the rest of the calendar.
  const current = jalaliToGregorian(year, 12, 1);
  const next = jalaliToGregorian(year + 1, 1, 1);
  const diff = Math.round((next - current) / 86400000);
  return diff === 30;
}

render();
