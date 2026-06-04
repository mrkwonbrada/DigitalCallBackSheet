const STORAGE_PREFIX = "callbackSheet:";
const ACTIVE_KEY = "callbackSheet:activeDate";
const DEFAULT_HOURS = ["12시", "13시", "14시", "15시", "16시", "17시", "18시", "19시", "20시"];
const PRODUCTIVITY_MULTIPLIER = 3.675;
const BASIC_FIELDS = ["name", "date", "weather", "teamMember", "placeName", "address", "territoryCode", "theme"];
const SIGNUP_FIELDS = [
  "serialNumber",
  "ageOrBirthYear",
  "gender",
  "signupTime",
  "paymentType",
  "bankOrCardCompany",
  "withdrawalDate",
  "donorName",
  "obj",
  "handling",
  "quality",
  "taxDeduction",
  "donationAmount",
  "note"
];
const BUTTON_FIELDS = ["gender", "paymentType", "withdrawalDate", "obj", "handling", "quality", "taxDeduction", "donationAmount"];
const PRESET_AMOUNTS = [30000, 50000, 70000, 100000];

let data = createEmptyData();
let saveTimer;

const elements = {
  summaryStats: document.querySelector("#summaryStats"),
  hourlyRecords: document.querySelector("#hourlyRecords"),
  signupForms: document.querySelector("#signupForms"),
  signupSummary: document.querySelector("#signupSummary"),
  savedDates: document.querySelector("#savedDates"),
  saveStatus: document.querySelector("#saveStatus"),
  saveButton: document.querySelector("#saveButton"),
  loadButton: document.querySelector("#loadButton"),
  csvButton: document.querySelector("#csvButton"),
  shareButton: document.querySelector("#shareButton"),
  addHourButton: document.querySelector("#addHourButton"),
  addSignupButton: document.querySelector("#addSignupButton")
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  const activeDate = localStorage.getItem(ACTIVE_KEY);
  const today = new Date().toISOString().slice(0, 10);
  data.basicInfo.date = today;

  if (activeDate && localStorage.getItem(storageKey(activeDate))) {
    data = normalizeData(JSON.parse(localStorage.getItem(storageKey(activeDate))));
  }

  bindBasicInputs();
  bindGlobalActions();
  renderAll();
  updateSavedDates();
}

function createEmptyData() {
  // 이 구조를 기준으로 PDF 출력, 구글시트 연동, 월별 통계를 확장할 수 있습니다.
  return {
    basicInfo: {
      name: "",
      date: "",
      weather: "",
      teamMember: "",
      placeName: "",
      address: "",
      territoryCode: "",
      theme: ""
    },
    hourlyRecords: DEFAULT_HOURS.map(createHourlyRecord),
    signups: []
  };
}

function createHourlyRecord(time = "") {
  return {
    time,
    stop: 0,
    pitch: 0,
    close: 0,
    memo: "",
    signupCount: 0
  };
}

function normalizeData(savedData) {
  const empty = createEmptyData();
  const savedHourly = Array.isArray(savedData.hourlyRecords) ? savedData.hourlyRecords : [];
  const hourlyRecords = savedHourly.length ? savedHourly : empty.hourlyRecords;

  return {
    basicInfo: { ...empty.basicInfo, ...(savedData.basicInfo || {}) },
    hourlyRecords: hourlyRecords.map(normalizeHourlyRecord),
    signups: (savedData.signups || []).map(normalizeSignup)
  };
}

function normalizeHourlyRecord(record) {
  const { signupMarked, ...currentRecord } = record;
  const signupCount = Number.isFinite(Number(record.signupCount))
    ? Number(record.signupCount)
    : signupMarked
      ? 1
      : 0;

  return {
    ...createHourlyRecord(record.time || ""),
    ...currentRecord,
    stop: Number(record.stop) || 0,
    pitch: Number(record.pitch) || 0,
    close: Number(record.close) || 0,
    signupCount: Math.max(0, signupCount)
  };
}

function normalizeSignup(signup) {
  const { selfIntro, durationMark, ...currentSignup } = signup;
  return {
    ...emptySignup(false),
    ...currentSignup,
    donorName: currentSignup.donorName || selfIntro || "",
    obj: normalizeOX(currentSignup.obj),
    handling: normalizeOX(currentSignup.handling),
    quality: currentSignup.quality || durationMark || "",
    taxDeduction: normalizeOX(currentSignup.taxDeduction),
    donationAmount: Number(currentSignup.donationAmount) || 0,
    collapsed: Boolean(currentSignup.collapsed),
    confirmed: Boolean(currentSignup.confirmed)
  };
}

function normalizeOX(value) {
  if (value === "있음") return "O";
  if (value === "없음") return "X";
  return value || "";
}

function emptySignup(collapsed = false) {
  return {
    serialNumber: "",
    ageOrBirthYear: "",
    gender: "",
    signupTime: "",
    paymentType: "",
    bankOrCardCompany: "",
    withdrawalDate: "",
    donorName: "",
    obj: "",
    handling: "",
    quality: "",
    taxDeduction: "",
    donationAmount: 30000,
    note: "",
    collapsed,
    confirmed: false
  };
}

function bindBasicInputs() {
  BASIC_FIELDS.forEach((field) => {
    const input = document.querySelector(`[data-basic="${field}"]`);
    const updateBasicField = () => {
      if (field === "territoryCode") {
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
      }
      data.basicInfo[field] = input.value;
      if (field === "date") {
        localStorage.setItem(ACTIVE_KEY, input.value);
        updateSavedDates();
      }
      queueAutoSave();
    };

    input.addEventListener("input", updateBasicField);
    input.addEventListener("change", updateBasicField);
  });
}

function bindGlobalActions() {
  elements.saveButton.addEventListener("click", () => saveData(true));
  elements.loadButton.addEventListener("click", loadSelectedDate);
  elements.csvButton.addEventListener("click", downloadCsv);
  elements.shareButton.addEventListener("click", shareSheet);
  elements.addHourButton.addEventListener("click", addHourlyRecord);
  elements.addSignupButton.addEventListener("click", () => {
    data.signups.push(emptySignup(false));
    renderSignups();
    updateSummary();
    queueAutoSave();
  });
}

function renderAll() {
  renderBasicInfo();
  renderHourlyRecords();
  renderSignups();
  updateSummary();
}

function renderBasicInfo() {
  BASIC_FIELDS.forEach((field) => {
    const input = document.querySelector(`[data-basic="${field}"]`);
    input.value = data.basicInfo[field] || "";
  });
}

function addHourlyRecord() {
  const time = prompt("추가할 시간대를 입력해주세요. 예: 11시, 20시 30분, 21시");
  if (!time) return;
  data.hourlyRecords.push(createHourlyRecord(time.trim()));
  renderHourlyRecords();
  queueAutoSave();
}

function renderHourlyRecords() {
  elements.hourlyRecords.innerHTML = "";
  const hourTemplate = document.querySelector("#hourlyTemplate");
  const counterTemplate = document.querySelector("#counterTemplate");

  data.hourlyRecords.forEach((record, recordIndex) => {
    const hourNode = hourTemplate.content.cloneNode(true);
    const card = hourNode.querySelector(".hour-card");
    const timeInput = hourNode.querySelector(".hour-time-input");
    const counterGrid = hourNode.querySelector(".counter-grid");
    const memo = hourNode.querySelector(".hour-memo");
    const deleteHour = hourNode.querySelector(".delete-hour");
    const signupBadge = hourNode.querySelector(".signup-badge");

    card.classList.toggle("signup-marked", Number(record.signupCount) > 0);
    signupBadge.textContent = `SIGNUP ${Number(record.signupCount) || 0}`;
    timeInput.value = record.time;
    memo.value = record.memo;

    timeInput.addEventListener("input", () => {
      data.hourlyRecords[recordIndex].time = timeInput.value;
      queueAutoSave();
    });

    memo.addEventListener("input", () => {
      data.hourlyRecords[recordIndex].memo = memo.value;
      queueAutoSave();
    });

    deleteHour.addEventListener("click", () => {
      if (!confirm(`${record.time || "이 시간대"} 기록을 삭제할까요?`)) return;
      data.hourlyRecords.splice(recordIndex, 1);
      renderHourlyRecords();
      updateSummary();
      queueAutoSave();
    });

    ["stop", "pitch", "close", "signupCount"].forEach((field) => {
      const counterNode = counterTemplate.content.cloneNode(true);
      const label = counterNode.querySelector(".counter-label");
      const input = counterNode.querySelector(".counter-input");
      const minus = counterNode.querySelector(".minus");
      const plus = counterNode.querySelector(".plus");

      label.textContent = labelText(field);
      input.value = Number(record[field]) || 0;

      input.addEventListener("input", () => {
        setHourlyValue(recordIndex, field, input.value);
        input.value = data.hourlyRecords[recordIndex][field];
        if (field === "signupCount") renderHourlyRecords();
      });
      minus.addEventListener("click", () => {
        setHourlyValue(recordIndex, field, data.hourlyRecords[recordIndex][field] - 1);
        if (field === "signupCount") renderHourlyRecords();
        else input.value = data.hourlyRecords[recordIndex][field];
      });
      plus.addEventListener("click", () => {
        setHourlyValue(recordIndex, field, data.hourlyRecords[recordIndex][field] + 1);
        if (field === "signupCount") renderHourlyRecords();
        else input.value = data.hourlyRecords[recordIndex][field];
      });

      counterGrid.appendChild(counterNode);
    });

    elements.hourlyRecords.appendChild(hourNode);
  });
}

function labelText(field) {
  const labels = {
    stop: "Stop",
    pitch: "Pitch",
    close: "Close",
    signupCount: "사인업"
  };
  return labels[field] || field;
}

function setHourlyValue(recordIndex, field, value) {
  data.hourlyRecords[recordIndex][field] = Math.max(0, Number(value) || 0);
  updateSummary();
  queueAutoSave();
}

function renderSignups() {
  elements.signupForms.innerHTML = "";
  const signupTemplate = document.querySelector("#signupTemplate");

  data.signups.forEach((signup, index) => {
    const signupNode = signupTemplate.content.cloneNode(true);
    const card = signupNode.querySelector(".signup-card");
    const toggleButton = signupNode.querySelector(".signup-toggle");
    const confirmButton = signupNode.querySelector(".confirm-signup");
    const editButton = signupNode.querySelector(".edit-signup");
    const deleteButton = signupNode.querySelector(".delete-signup");
    const customAmount = signupNode.querySelector(".custom-amount");
    const editable = !signup.confirmed;

    card.dataset.index = index;
    card.classList.toggle("collapsed", Boolean(signup.collapsed));
    card.classList.toggle("confirmed", Boolean(signup.confirmed));
    toggleButton.textContent = `${signupSummaryText(signup)} ${signup.collapsed ? "펼치기" : "접기"}`;

    toggleButton.addEventListener("click", () => {
      data.signups[index].collapsed = !data.signups[index].collapsed;
      renderSignups();
      queueAutoSave();
    });

    SIGNUP_FIELDS.forEach((field) => {
      const input = signupNode.querySelector(`[data-signup="${field}"]`);
      if (!input) return;
      input.value = signup[field] ?? "";
      input.disabled = !editable;

      const updateSignupField = () => {
        if (data.signups[index].confirmed) return;
        const value = field === "donationAmount" ? Math.max(0, Number(input.value) || 0) : input.value;
        data.signups[index][field] = value;
        updateSummary();
        renderSignupSummary();
        queueAutoSave();
      };

      input.addEventListener("input", updateSignupField);
      input.addEventListener("change", updateSignupField);
    });

    bindChoiceButtons(signupNode, index, editable);
    updateCustomAmountVisibility(customAmount, signup.donationAmount);

    confirmButton.addEventListener("click", () => {
      data.signups[index].confirmed = true;
      data.signups[index].collapsed = true;
      renderSignups();
      queueAutoSave();
    });

    editButton.addEventListener("click", () => {
      data.signups[index].confirmed = false;
      data.signups[index].collapsed = false;
      renderSignups();
      queueAutoSave();
    });

    deleteButton.addEventListener("click", () => {
      if (!confirm("이 사인업 기록을 삭제할까요?")) return;
      data.signups.splice(index, 1);
      renderSignups();
      updateSummary();
      queueAutoSave();
    });

    elements.signupForms.appendChild(signupNode);
  });

  renderSignupSummary();
}

function bindChoiceButtons(signupNode, signupIndex, editable) {
  BUTTON_FIELDS.forEach((field) => {
    const group = signupNode.querySelector(`[data-choice-field="${field}"]`);
    if (!group) return;

    const currentValue = field === "donationAmount"
      ? donationChoiceValue(data.signups[signupIndex].donationAmount)
      : data.signups[signupIndex][field];

    group.querySelectorAll("[data-choice]").forEach((button) => {
      const choice = button.dataset.choice;
      const isDisabled = !editable || (field === "withdrawalDate" && data.signups[signupIndex].paymentType === "카드" && choice === "15일");

      button.classList.toggle("selected", String(currentValue) === choice);
      button.disabled = isDisabled;

      button.addEventListener("click", () => {
        if (data.signups[signupIndex].confirmed) return;
        handleChoice(signupIndex, field, choice);
      });
    });
  });
}

function handleChoice(signupIndex, field, choice) {
  if (field === "donationAmount") {
    if (choice === "custom") {
      if (PRESET_AMOUNTS.includes(Number(data.signups[signupIndex].donationAmount))) {
        data.signups[signupIndex].donationAmount = 0;
      }
    } else {
      data.signups[signupIndex].donationAmount = Number(choice);
    }
    renderSignups();
    updateSummary();
    queueAutoSave();
    return;
  }

  data.signups[signupIndex][field] = choice;

  if (field === "paymentType" && choice === "카드") {
    data.signups[signupIndex].withdrawalDate = "1일";
  }

  renderSignups();
  updateSummary();
  queueAutoSave();
}

function donationChoiceValue(amount) {
  const numericAmount = Number(amount) || 0;
  return PRESET_AMOUNTS.includes(numericAmount) ? String(numericAmount) : "custom";
}

function updateCustomAmountVisibility(customAmount, amount) {
  customAmount.classList.toggle("hidden", donationChoiceValue(amount) !== "custom");
}

function signupSummaryText(signup) {
  const donorName = signup.donorName || "이름 없음";
  const time = signup.signupTime || "시간 없음";
  const amount = formatCurrency(signup.donationAmount);
  const payment = signup.paymentType || "결제 미선택";
  const quality = signup.quality || "퀄리티 미선택";
  return `${donorName} / ${time} / ${amount} / ${payment} / ${quality}`;
}

function renderSignupSummary() {
  elements.signupSummary.innerHTML = "";

  if (data.signups.length === 0) {
    elements.signupSummary.innerHTML = '<tr><td colspan="14">아직 사인업 기록이 없습니다.</td></tr>';
    return;
  }

  data.signups.forEach((signup) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(signup.donorName || "-")}</td>
      <td>${escapeHtml(signup.signupTime || "-")}</td>
      <td>${escapeHtml(signup.serialNumber || "-")}</td>
      <td>${escapeHtml(signup.ageOrBirthYear || "-")}</td>
      <td>${escapeHtml(signup.gender || "-")}</td>
      <td>${formatCurrency(signup.donationAmount)}</td>
      <td>${escapeHtml(signup.paymentType || "-")}</td>
      <td>${escapeHtml(signup.bankOrCardCompany || "-")}</td>
      <td>${escapeHtml(signup.withdrawalDate || "-")}</td>
      <td>${escapeHtml(signup.obj || "-")}</td>
      <td>${escapeHtml(signup.handling || "-")}</td>
      <td>${escapeHtml(signup.quality || "-")}</td>
      <td>${escapeHtml(signup.taxDeduction || "-")}</td>
      <td>${escapeHtml(signup.note || "-")}</td>
    `;
    elements.signupSummary.appendChild(row);
  });
}

function calculateSummary() {
  // 모든 요약 통계는 현재 data 객체에서 계산해 화면, CSV, 공유가 같은 값을 씁니다.
  const totalStop = data.hourlyRecords.reduce((sum, record) => sum + (Number(record.stop) || 0), 0);
  const totalPitch = data.hourlyRecords.reduce((sum, record) => sum + (Number(record.pitch) || 0), 0);
  const totalClose = data.hourlyRecords.reduce((sum, record) => sum + (Number(record.close) || 0), 0);
  const totalSignups = data.signups.length;
  const totalDonation = data.signups.reduce((sum, signup) => sum + (Number(signup.donationAmount) || 0), 0);
  const productivity = Math.round(totalDonation * PRODUCTIVITY_MULTIPLIER);

  return {
    totalStop,
    totalPitch,
    totalClose,
    totalSignups,
    totalDonation,
    productivity,
    pitchRate: percent(totalPitch, totalStop),
    closeRate: percent(totalClose, totalPitch),
    signupRate: percent(totalSignups, totalClose)
  };
}

function updateSummary() {
  const summary = calculateSummary();
  const items = [
    ["총 Stop", summary.totalStop],
    ["총 Pitch", summary.totalPitch],
    ["총 Close", summary.totalClose],
    ["총 사인업", summary.totalSignups],
    ["총 후원금액", formatCurrency(summary.totalDonation)],
    ["생산성", formatCurrency(summary.productivity)],
    ["Pitch 전환율", `${summary.pitchRate}%`],
    ["Close 전환율", `${summary.closeRate}%`],
    ["Signup 전환율", `${summary.signupRate}%`]
  ];

  elements.summaryStats.innerHTML = items
    .map(([label, value]) => `<div class="summary-item"><strong>${label}</strong><span>${value}</span></div>`)
    .join("");
}

function percent(numerator, denominator) {
  if (!denominator) return "0.0";
  return ((numerator / denominator) * 100).toFixed(1);
}

function formatCurrency(value) {
  return `${(Number(value) || 0).toLocaleString("ko-KR")}원`;
}

function queueAutoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveData(false), 500);
}

function saveData(showMessage) {
  if (showMessage && !isTerritoryCodeValid(data.basicInfo.territoryCode)) {
    showStatus("테리토리 코드는 영어 4자리 또는 숫자 5자리로 입력해주세요.");
    document.querySelector('[data-basic="territoryCode"]').focus();
    return;
  }

  const date = data.basicInfo.date || new Date().toISOString().slice(0, 10);
  data.basicInfo.date = date;
  localStorage.setItem(storageKey(date), JSON.stringify(data));
  localStorage.setItem(ACTIVE_KEY, date);
  updateSavedDates();
  if (showMessage) showStatus(`${date} 기록을 저장했습니다.`);
}

function loadSelectedDate() {
  const date = elements.savedDates.value;
  if (!date) {
    showStatus("불러올 날짜를 선택해주세요.");
    return;
  }
  const saved = localStorage.getItem(storageKey(date));
  if (!saved) {
    showStatus("해당 날짜의 저장 기록이 없습니다.");
    return;
  }
  data = normalizeData(JSON.parse(saved));
  localStorage.setItem(ACTIVE_KEY, date);
  renderAll();
  updateSavedDates();
  showStatus(`${date} 기록을 불러왔습니다.`);
}

function updateSavedDates() {
  const current = data.basicInfo.date || "";
  const dates = Object.keys(localStorage)
    .filter((key) => key.startsWith(STORAGE_PREFIX) && key !== ACTIVE_KEY)
    .map((key) => key.replace(STORAGE_PREFIX, ""))
    .sort()
    .reverse();

  elements.savedDates.innerHTML = '<option value="">저장된 날짜 선택</option>';
  dates.forEach((date) => {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = date;
    option.selected = date === current;
    elements.savedDates.appendChild(option);
  });
}

function storageKey(date) {
  return `${STORAGE_PREFIX}${date}`;
}

function isTerritoryCodeValid(value) {
  if (!value) return true;
  return /^[A-Z]{4}$/.test(value) || /^\d{5}$/.test(value);
}

function buildCsvBlob() {
  const summary = calculateSummary();
  const rows = [
    ["구분", "항목", "값"],
    ...Object.entries(data.basicInfo).map(([key, value]) => ["기본 정보", basicLabel(key), value]),
    [],
    ["시간", "Stop", "Pitch", "Close", "사인업", "기타 메모"],
    ...data.hourlyRecords.map((record) => [
      record.time,
      record.stop,
      record.pitch,
      record.close,
      record.signupCount,
      record.memo
    ]),
    [],
    [
      "시리얼넘버",
      "나이 또는 년생",
      "성별",
      "시간",
      "결제수단",
      "은행명 또는 카드사명",
      "출금일",
      "후원자 이름",
      "Obj",
      "Handling",
      "퀄리티",
      "소득공제",
      "후원금액",
      "비고",
      "확정 여부"
    ],
    ...data.signups.map((signup) => [
      ...SIGNUP_FIELDS.map((field) => signup[field]),
      signup.confirmed ? "Y" : "N"
    ]),
    [],
    ["요약", "총 Stop", summary.totalStop],
    ["요약", "총 Pitch", summary.totalPitch],
    ["요약", "총 Close", summary.totalClose],
    ["요약", "총 사인업 수", summary.totalSignups],
    ["요약", "총 후원금액", summary.totalDonation],
    ["요약", "생산성", summary.productivity],
    ["요약", "Pitch 전환율", `${summary.pitchRate}%`],
    ["요약", "Close 전환율", `${summary.closeRate}%`],
    ["요약", "Signup 전환율", `${summary.signupRate}%`]
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
}

function downloadCsv() {
  saveData(false);
  const blob = buildCsvBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = csvFileName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function shareSheet() {
  saveData(false);
  const text = buildShareText();
  const file = new File([buildCsvBlob()], csvFileName(), { type: "text/csv" });

  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: "콜백싯 요약", text, files: [file] });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: "콜백싯 요약", text });
      return;
    }
    await copyShareText(text);
  } catch (error) {
    if (error.name !== "AbortError") {
      await copyShareText(text);
    }
  }
}

async function copyShareText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  showStatus("공유 기능이 지원되지 않아 요약 내용을 클립보드에 복사했습니다.");
}

function buildShareText() {
  const summary = calculateSummary();
  return [
    "[콜백싯 요약]",
    `날짜: ${data.basicInfo.date || "-"}`,
    `이름: ${data.basicInfo.name || "-"}`,
    `장소: ${data.basicInfo.placeName || "-"} / ${data.basicInfo.territoryCode || "-"}`,
    `총 Stop: ${summary.totalStop}`,
    `총 Pitch: ${summary.totalPitch}`,
    `총 Close: ${summary.totalClose}`,
    `총 사인업: ${summary.totalSignups}`,
    `총 후원금액: ${formatCurrency(summary.totalDonation)}`,
    `생산성: ${formatCurrency(summary.productivity)}`
  ].join("\n");
}

function csvFileName() {
  return `callback-sheet-${data.basicInfo.date || "today"}.csv`;
}

function showStatus(message) {
  elements.saveStatus.textContent = message;
  setTimeout(() => {
    if (elements.saveStatus.textContent === message) elements.saveStatus.textContent = "";
  }, 3500);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function basicLabel(key) {
  const labels = {
    name: "이름",
    date: "날짜",
    weather: "날씨",
    teamMember: "팀원 이름",
    placeName: "장소명",
    address: "주소",
    territoryCode: "테리토리 코드",
    theme: "오늘의 테마"
  };
  return labels[key] || key;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
