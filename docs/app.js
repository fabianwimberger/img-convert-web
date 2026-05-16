const fileInput = document.querySelector("#file-input");
const dropZone = document.querySelector("#drop-zone");
const fileTable = document.querySelector("#file-table");
const rowTemplate = document.querySelector("#file-row-template");
const settingsForm = document.querySelector("#settings-form");
const qualityInput = document.querySelector("#quality-input");
const qualityValue = document.querySelector("#quality-value");
const backgroundInput = document.querySelector("#background-input");
const backgroundValue = document.querySelector("#background-value");
const keepNamesInput = document.querySelector("#keep-names-input");
const convertButton = document.querySelector("#convert-button");
const clearButton = document.querySelector("#clear-button");
const downloadAllButton = document.querySelector("#download-all-button");
const selectionSummary = document.querySelector("#selection-summary");
const outputSummary = document.querySelector("#output-summary");
const preview = document.querySelector("#preview");
const encoderStatus = document.querySelector("#encoder-status");
const themeToggle = document.querySelector("#theme-toggle");

const extensionByMime = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

const state = {
  files: [],
  selectedId: null,
  encoders: new Map(),
  theme: localStorage.getItem("theme") || "light",
};

document.documentElement.dataset.theme = state.theme;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function outputName(file, mime, index) {
  const extension = extensionByMime[mime];
  const base = keepNamesInput.checked
    ? file.name.replace(/\.[^.]+$/, "")
    : `converted-${String(index + 1).padStart(3, "0")}`;
  return `${base}.${extension}`;
}

function selectedMime() {
  return new FormData(settingsForm).get("format");
}

function selectedShortSide() {
  return Number(new FormData(settingsForm).get("shortSide"));
}

function statusText(record) {
  if (record.error) {
    return "Failed";
  }
  if (record.output) {
    return "Done";
  }
  if (record.status === "processing") {
    return "Converting";
  }
  return "Ready";
}

function render() {
  fileTable.innerHTML = "";

  if (state.files.length === 0) {
    fileTable.innerHTML = '<tr class="empty-row"><td colspan="5">No images loaded</td></tr>';
  } else {
    state.files.forEach((record, index) => {
      const row = rowTemplate.content.firstElementChild.cloneNode(true);
      const nameButton = row.querySelector(".file-name");
      const meta = row.querySelector(".file-meta");
      const inputSize = row.querySelector(".input-size");
      const outputSize = row.querySelector(".output-size");
      const status = row.querySelector(".row-status");
      const downloadButton = row.querySelector(".download-button");

      nameButton.textContent = record.file.name;
      nameButton.classList.toggle("selected", record.id === state.selectedId);
      nameButton.addEventListener("click", () => selectRecord(record.id));

      meta.textContent = record.dimensions || record.file.type || "image";
      inputSize.textContent = formatBytes(record.file.size);
      outputSize.textContent = record.output ? formatBytes(record.output.blob.size) : "-";

      status.textContent = statusText(record);
      status.classList.toggle("done", Boolean(record.output));
      status.classList.toggle("error", Boolean(record.error));

      downloadButton.disabled = !record.output;
      downloadButton.addEventListener("click", () => {
        if (record.output) {
          downloadBlob(record.output.blob, record.output.name);
        }
      });

      row.dataset.id = record.id;
      row.dataset.index = String(index);
      fileTable.append(row);
    });
  }

  const converted = state.files.filter((record) => record.output).length;
  const totalOutput = state.files.reduce((sum, record) => sum + (record.output?.blob.size || 0), 0);
  selectionSummary.textContent = `${state.files.length} file${state.files.length === 1 ? "" : "s"} selected`;
  outputSummary.textContent = converted > 0 ? `${converted} converted, ${formatBytes(totalOutput)}` : "Ready";
  convertButton.disabled = state.files.length === 0;
  clearButton.disabled = state.files.length === 0;
  downloadAllButton.disabled = converted === 0;

  renderPreview();
}

function renderPreview() {
  const selected = state.files.find((record) => record.id === state.selectedId);
  preview.innerHTML = "";

  if (!selected) {
    preview.classList.add("empty-preview");
    preview.textContent = "No preview";
    return;
  }

  preview.classList.remove("empty-preview");
  const image = document.createElement("img");
  image.alt = selected.file.name;
  image.src = selected.output ? selected.output.url : selected.url;
  preview.append(image);
}

function selectRecord(id) {
  state.selectedId = id;
  render();
}

async function addFiles(files) {
  const accepted = [...files].filter((file) => file.type.startsWith("image/") || /\.(bmp|svg)$/i.test(file.name));

  for (const file of accepted) {
    const record = {
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      dimensions: "",
      status: "ready",
      output: null,
      error: "",
    };

    state.files.push(record);
    measureImage(record).catch(() => {
      record.dimensions = file.type || "image";
      render();
    });
  }

  if (!state.selectedId && state.files.length > 0) {
    state.selectedId = state.files[0].id;
  }

  render();
}

async function measureImage(record) {
  const image = await loadImage(record.url);
  record.dimensions = `${image.naturalWidth} x ${image.naturalHeight}`;
  render();
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image decode failed"));
    image.src = url;
  });
}

function targetSize(width, height, shortSide) {
  if (shortSide === 0) {
    return { width, height };
  }

  const currentShortSide = Math.min(width, height);
  if (currentShortSide <= shortSide) {
    return { width, height };
  }

  const scale = shortSide / currentShortSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function convertRecord(record, index) {
  const mime = selectedMime();
  const image = await loadImage(record.url);
  const dimensions = targetSize(image.naturalWidth, image.naturalHeight, selectedShortSide());
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  const ctx = canvas.getContext("2d", { alpha: mime !== "image/jpeg" });
  if (!ctx) {
    throw new Error("Canvas unavailable");
  }

  if (mime === "image/jpeg") {
    ctx.fillStyle = backgroundInput.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, mime, Number(qualityInput.value) / 100);

  if (record.output?.url) {
    URL.revokeObjectURL(record.output.url);
  }

  record.output = {
    blob,
    name: outputName(record.file, mime, index),
    url: URL.createObjectURL(blob),
  };
  record.error = "";
  record.status = "ready";
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Encoder unavailable"));
        return;
      }
      resolve(blob);
    }, mime, quality);
  });
}

async function convertAll() {
  convertButton.disabled = true;
  outputSummary.textContent = "Converting";

  for (const [index, record] of state.files.entries()) {
    record.status = "processing";
    record.error = "";
    render();

    try {
      await convertRecord(record, index);
    } catch (error) {
      record.status = "ready";
      record.error = error instanceof Error ? error.message : "Conversion failed";
    }
  }

  render();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function canEncode(mime) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const blob = await canvasToBlob(canvas, mime, 0.8).catch(() => null);
  return blob?.type === mime;
}

async function detectEncoders() {
  const results = await Promise.all(Object.keys(extensionByMime).map(async (mime) => [mime, await canEncode(mime)]));
  state.encoders = new Map(results);

  for (const input of document.querySelectorAll('input[name="format"]')) {
    const supported = state.encoders.get(input.value);
    input.disabled = !supported;
    input.closest("label").title = supported ? "" : "Not supported by this browser";
  }

  if (!state.encoders.get(selectedMime())) {
    const firstSupported = [...state.encoders.entries()].find(([, supported]) => supported);
    if (firstSupported) {
      document.querySelector(`input[name="format"][value="${firstSupported[0]}"]`).checked = true;
    }
  }

  const supportedLabels = [...state.encoders.entries()]
    .filter(([, supported]) => supported)
    .map(([mime]) => extensionByMime[mime].toUpperCase())
    .join(", ");

  encoderStatus.textContent = supportedLabels ? `Encoders: ${supportedLabels}` : "No encoders";
  encoderStatus.classList.toggle("ready", Boolean(supportedLabels));
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value, true);
}

function dosTime(date) {
  return ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() / 2) & 0x1f);
}

function dosDate(date) {
  return (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
}

async function buildZip(records) {
  const encoder = new TextEncoder();
  const chunks = [];
  const centralDirectory = [];
  let offset = 0;
  const now = new Date();
  const time = dosTime(now);
  const date = dosDate(now);

  for (const record of records) {
    const data = new Uint8Array(await record.output.blob.arrayBuffer());
    const filename = encoder.encode(record.output.name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + filename.length);
    const localView = new DataView(local.buffer);

    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, time);
    writeUint16(localView, 12, date);
    writeUint32(localView, 14, crc);
    writeUint32(localView, 18, data.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, filename.length);
    writeUint16(localView, 28, 0);
    local.set(filename, 30);

    chunks.push(local, data);

    const central = new Uint8Array(46 + filename.length);
    const centralView = new DataView(central.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, time);
    writeUint16(centralView, 14, date);
    writeUint32(centralView, 16, crc);
    writeUint32(centralView, 20, data.length);
    writeUint32(centralView, 24, data.length);
    writeUint16(centralView, 28, filename.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    central.set(filename, 46);
    centralDirectory.push(central);

    offset += local.length + data.length;
  }

  const centralSize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 8, records.length);
  writeUint16(endView, 10, records.length);
  writeUint32(endView, 12, centralSize);
  writeUint32(endView, 16, offset);
  writeUint16(endView, 20, 0);

  return new Blob([...chunks, ...centralDirectory, end], { type: "application/zip" });
}

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
}

dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  convertAll();
});

qualityInput.addEventListener("input", () => {
  qualityValue.textContent = qualityInput.value;
});

backgroundInput.addEventListener("input", () => {
  backgroundValue.textContent = backgroundInput.value;
});

clearButton.addEventListener("click", () => {
  for (const record of state.files) {
    URL.revokeObjectURL(record.url);
    if (record.output?.url) {
      URL.revokeObjectURL(record.output.url);
    }
  }

  state.files = [];
  state.selectedId = null;
  render();
});

downloadAllButton.addEventListener("click", async () => {
  const records = state.files.filter((record) => record.output);
  if (records.length === 0) {
    return;
  }

  downloadAllButton.disabled = true;
  downloadAllButton.textContent = "Building ZIP";
  const blob = await buildZip(records);
  downloadBlob(blob, "converted-images.zip");
  downloadAllButton.textContent = "Download ZIP";
  render();
});

themeToggle.addEventListener("click", () => {
  state.theme = state.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem("theme", state.theme);
});

detectEncoders();
render();
