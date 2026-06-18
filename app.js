const STORAGE_KEYS = {
  org: "devops_org",
  project: "devops_project",
  pat: "devops_pat",
  type: "devops_type",
  area: "devops_area",
  adminId: "devops_admin_id",
};

const COLORS = {
  Epic: { fill: "#4262ff", text: "#ffffff" },
  Feature: { fill: "#ff6b35", text: "#ffffff" },
  "User Story": { fill: "#2e7d32", text: "#ffffff" },
  "Product Backlog Item": { fill: "#7b1fa2", text: "#ffffff" },
  default: { fill: "#607d8b", text: "#ffffff" },
};

const GANTT = {
  rowHeight: 60,
  headerHeight: 80,
  dayWidth: 20,
  labelWidth: 280,
  barHeight: 36,
  padding: 40,
};

function getCollection() {
  return miro.board.storage.collection("config");
}

async function loadBoardConfig() {
  const collection = getCollection();
  const org = await collection.get(STORAGE_KEYS.org);
  const project = await collection.get(STORAGE_KEYS.project);
  const pat = await collection.get(STORAGE_KEYS.pat);
  const type = await collection.get(STORAGE_KEYS.type);
  const area = await collection.get(STORAGE_KEYS.area);
  return {
    org: org || "",
    project: project || "",
    pat: pat || "",
    type: type || "Epic",
    area: area || "",
  };
}

async function saveBoardConfig(config, userId) {
  const collection = getCollection();
  await collection.set(STORAGE_KEYS.org, config.org);
  await collection.set(STORAGE_KEYS.project, config.project);
  await collection.set(STORAGE_KEYS.pat, config.pat);
  await collection.set(STORAGE_KEYS.type, config.type);
  await collection.set(STORAGE_KEYS.area, config.area);
  await collection.set(STORAGE_KEYS.adminId, String(userId));
}

async function getAdminId() {
  const collection = getCollection();
  return (await collection.get(STORAGE_KEYS.adminId)) || null;
}

async function clearBoardConfig() {
  const collection = getCollection();
  const keys = Object.values(STORAGE_KEYS);
  for (const key of keys) {
    await collection.remove(key);
  }
}

function showStatus(message, type) {
  const el = document.getElementById("status");
  el.textContent = message;
  el.className = "status-message" + (type ? " " + type : "");
}

function getAuthHeader(pat) {
  return "Basic " + btoa(":" + pat);
}

async function fetchWorkItems(org, project, pat, workItemTypes, areaPath) {
  const typeConditions = workItemTypes
    .split(",")
    .map((t) => `[System.WorkItemType] = '${t.trim()}'`)
    .join(" OR ");

  let whereClause = `(${typeConditions}) AND [System.State] <> 'Removed'`;
  if (areaPath) {
    whereClause += ` AND [System.AreaPath] UNDER '${areaPath}'`;
  }

  const wiql = `SELECT [System.Id] FROM WorkItems WHERE ${whereClause} ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.Title] ASC`;

  const wiqlUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=7.1`;
  const response = await fetch(wiqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(pat),
    },
    body: JSON.stringify({ query: wiql }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`WIQL query failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const ids = data.workItems.map((wi) => wi.id);

  if (ids.length === 0) return [];

  const batchSize = 200;
  const allItems = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const fields = [
      "System.Id",
      "System.Title",
      "System.WorkItemType",
      "System.State",
      "System.AreaPath",
      "System.IterationPath",
      "Microsoft.VSTS.Scheduling.StartDate",
      "Microsoft.VSTS.Scheduling.TargetDate",
      "Microsoft.VSTS.Common.Priority",
    ].join(",");

    const itemsUrl = `https://dev.azure.com/${org}/_apis/wit/workitems?ids=${batch.join(",")}&fields=${fields}&api-version=7.1`;
    const itemsResponse = await fetch(itemsUrl, {
      headers: { Authorization: getAuthHeader(pat) },
    });

    if (!itemsResponse.ok) {
      throw new Error(`Failed to fetch work items (${itemsResponse.status})`);
    }

    const itemsData = await itemsResponse.json();
    allItems.push(...itemsData.value);
  }

  return allItems
    .map((item) => ({
      id: item.id,
      title: item.fields["System.Title"],
      type: item.fields["System.WorkItemType"],
      state: item.fields["System.State"],
      area: item.fields["System.AreaPath"],
      iteration: item.fields["System.IterationPath"],
      startDate: item.fields["Microsoft.VSTS.Scheduling.StartDate"],
      targetDate: item.fields["Microsoft.VSTS.Scheduling.TargetDate"],
      priority: item.fields["Microsoft.VSTS.Common.Priority"],
    }))
    .filter((item) => item.startDate || item.targetDate);
}

function computeTimeline(items) {
  const now = new Date();
  let minDate = new Date(now);
  let maxDate = new Date(now);

  items.forEach((item) => {
    const start = item.startDate ? new Date(item.startDate) : null;
    const end = item.targetDate ? new Date(item.targetDate) : null;

    if (start && start < minDate) minDate = new Date(start);
    if (end && end > maxDate) maxDate = new Date(end);
    if (start && start > maxDate) maxDate = new Date(start);
    if (end && end < minDate) minDate = new Date(end);
  });

  minDate.setDate(1);
  maxDate.setMonth(maxDate.getMonth() + 1, 0);

  return { minDate, maxDate };
}

function daysBetween(a, b) {
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function removeExistingChart() {
  const frames = await miro.board.get({ type: "frame" });
  for (const frame of frames) {
    if (frame.title === "Product Roadmap") {
      const children = await frame.getChildren();
      for (const child of children) {
        await miro.board.remove(child);
      }
      await miro.board.remove(frame);
    }
  }
}

async function renderGanttChart(items) {
  const { minDate, maxDate } = computeTimeline(items);
  const totalDays = daysBetween(minDate, maxDate);
  const chartWidth = GANTT.labelWidth + totalDays * GANTT.dayWidth + GANTT.padding * 2;
  const chartHeight = GANTT.headerHeight + items.length * GANTT.rowHeight + GANTT.padding * 2;

  const viewport = await miro.board.viewport.get();
  const originX = viewport.x + viewport.width / 2 - chartWidth / 2;
  const originY = viewport.y + viewport.height / 2 - chartHeight / 2;

  const frame = await miro.board.createFrame({
    title: "Product Roadmap",
    x: originX + chartWidth / 2,
    y: originY + chartHeight / 2,
    width: chartWidth,
    height: chartHeight,
    style: { fillColor: "#ffffff" },
  });

  await renderTimelineHeader(originX, originY, minDate, maxDate, totalDays);
  await renderWorkItems(items, originX, originY, minDate);

  await miro.board.viewport.zoomTo(frame);
  return frame;
}

async function renderTimelineHeader(originX, originY, minDate, maxDate, totalDays) {
  const headerY = originY + GANTT.padding + GANTT.headerHeight / 2;
  const chartStartX = originX + GANTT.padding + GANTT.labelWidth;

  const current = new Date(minDate);
  while (current <= maxDate) {
    const dayOffset = daysBetween(minDate, current);
    const x = chartStartX + dayOffset * GANTT.dayWidth;
    const monthName = current.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    const remainingDays = Math.min(
      daysInMonth - current.getDate() + 1,
      daysBetween(current, maxDate) + 1
    );
    const monthWidth = remainingDays * GANTT.dayWidth;

    await miro.board.createShape({
      shape: "rectangle",
      x: x + monthWidth / 2,
      y: headerY,
      width: monthWidth,
      height: 36,
      content: `<strong>${monthName}</strong>`,
      style: {
        fillColor: "#f5f5f5",
        borderColor: "#ddd",
        borderWidth: 1,
        fontSize: 12,
        textAlign: "center",
      },
    });

    current.setMonth(current.getMonth() + 1, 1);
  }
}

async function renderWorkItems(items, originX, originY, minDate) {
  const chartStartX = originX + GANTT.padding + GANTT.labelWidth;
  const rowStartY = originY + GANTT.padding + GANTT.headerHeight;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const y = rowStartY + i * GANTT.rowHeight + GANTT.rowHeight / 2;
    const colors = COLORS[item.type] || COLORS.default;

    const labelX = originX + GANTT.padding + GANTT.labelWidth / 2;
    await miro.board.createShape({
      shape: "rectangle",
      x: labelX,
      y: y,
      width: GANTT.labelWidth - 16,
      height: GANTT.barHeight,
      content: `<strong>${item.title}</strong>`,
      style: {
        fillColor: "#fafafa",
        borderColor: "#e0e0e0",
        borderWidth: 1,
        fontSize: 11,
        textAlign: "left",
        textAlignVertical: "middle",
      },
    });

    const start = item.startDate ? new Date(item.startDate) : new Date(item.targetDate);
    const end = item.targetDate ? new Date(item.targetDate) : new Date(item.startDate);

    const startOffset = daysBetween(minDate, start);
    const duration = Math.max(daysBetween(start, end), 1);
    const barWidth = duration * GANTT.dayWidth;
    const barX = chartStartX + startOffset * GANTT.dayWidth + barWidth / 2;

    await miro.board.createShape({
      shape: "round_rectangle",
      x: barX,
      y: y,
      width: barWidth,
      height: GANTT.barHeight,
      content: `<strong>${item.type}</strong> | ${item.state}`,
      style: {
        fillColor: colors.fill,
        fontFamily: "arial",
        fontSize: 10,
        color: colors.text,
        borderWidth: 0,
        textAlign: "center",
        textAlignVertical: "middle",
      },
    });
  }
}

function renderPreview(items) {
  const preview = document.getElementById("preview");
  if (items.length === 0) {
    preview.innerHTML = '<p style="font-size:12px;color:#888;">No items with dates found.</p>';
    return;
  }

  const html = items
    .slice(0, 15)
    .map((item) => {
      const colors = COLORS[item.type] || COLORS.default;
      return `
      <div class="preview-item">
        <div class="preview-color" style="background:${colors.fill}"></div>
        <span class="preview-title">${item.title}</span>
        <span class="preview-dates">${formatDate(item.startDate)} → ${formatDate(item.targetDate)}</span>
      </div>`;
    })
    .join("");

  const extra = items.length > 15 ? `<p style="font-size:11px;color:#888;margin-top:8px;">+ ${items.length - 15} more items</p>` : "";
  preview.innerHTML = `<h3>${items.length} work items found</h3>${html}${extra}`;
}

function updateUI(config, isAdmin) {
  const banner = document.getElementById("configured-banner");
  const connectedOrg = document.getElementById("connected-org");
  const adminSection = document.getElementById("admin-section");
  const fetchBtn = document.getElementById("fetch-btn");

  adminSection.style.display = isAdmin ? "block" : "none";

  if (config.org && config.pat) {
    banner.style.display = "block";
    connectedOrg.textContent = `${config.org}/${config.project}`;
    adminSection.removeAttribute("open");
    fetchBtn.disabled = false;
  } else {
    banner.style.display = "none";
    if (isAdmin) {
      adminSection.setAttribute("open", "");
    }
    fetchBtn.disabled = true;
  }
}

async function init() {
  const orgInput = document.getElementById("org-input");
  const projectInput = document.getElementById("project-input");
  const patInput = document.getElementById("pat-input");
  const typeSelect = document.getElementById("type-select");
  const areaInput = document.getElementById("area-input");
  const saveBtn = document.getElementById("save-config-btn");
  const clearBtn = document.getElementById("clear-config-btn");
  const fetchBtn = document.getElementById("fetch-btn");
  const refreshBtn = document.getElementById("refresh-btn");

  const userInfo = await miro.board.getUserInfo();
  const currentUserId = userInfo.id;

  let config;
  try {
    config = await loadBoardConfig();
  } catch {
    config = { org: "", project: "", pat: "", type: "Epic", area: "" };
  }

  const adminId = await getAdminId();
  const isAdmin = !adminId || adminId === currentUserId;

  orgInput.value = config.org;
  projectInput.value = config.project;
  patInput.value = config.pat;
  if (config.type) typeSelect.value = config.type;
  areaInput.value = config.area;

  updateUI(config, isAdmin);

  saveBtn.addEventListener("click", async () => {
    const newConfig = {
      org: orgInput.value.trim(),
      project: projectInput.value.trim(),
      pat: patInput.value.trim(),
      type: typeSelect.value,
      area: areaInput.value.trim(),
    };

    if (!newConfig.org || !newConfig.project || !newConfig.pat) {
      showStatus("Organization, Project, and PAT are required.", "error");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      await saveBoardConfig(newConfig, currentUserId);
      config = newConfig;
      updateUI(config, isAdmin);
      showStatus("Config saved to board storage!", "success");
    } catch (err) {
      showStatus("Failed to save: " + err.message, "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save to Board";
    }
  });

  clearBtn.addEventListener("click", async () => {
    try {
      await clearBoardConfig();
      config = { org: "", project: "", pat: "", type: "Epic", area: "" };
      orgInput.value = "";
      projectInput.value = "";
      patInput.value = "";
      typeSelect.value = "Epic";
      areaInput.value = "";
      updateUI(config, isAdmin);
      showStatus("Config cleared.", "success");
    } catch (err) {
      showStatus("Failed to clear: " + err.message, "error");
    }
  });

  async function generateChart() {
    if (!config.org || !config.project || !config.pat) {
      showStatus("Please configure the connection in Admin Setup.", "error");
      return;
    }

    fetchBtn.disabled = true;
    refreshBtn.disabled = true;
    showStatus("Fetching work items from Azure DevOps...", "");
    document.getElementById("preview").innerHTML = "";

    try {
      const items = await fetchWorkItems(config.org, config.project, config.pat, config.type, config.area);
      renderPreview(items);

      if (items.length === 0) {
        showStatus("No work items with Start/Target dates found.", "error");
        return;
      }

      showStatus("Removing existing chart...", "");
      await removeExistingChart();

      showStatus(`Rendering Gantt chart with ${items.length} items...`, "");
      await renderGanttChart(items);
      refreshBtn.style.display = "block";
      showStatus("Gantt chart created on the board!", "success");
    } catch (err) {
      showStatus("Error: " + err.message, "error");
    } finally {
      fetchBtn.disabled = false;
      refreshBtn.disabled = false;
    }
  }

  fetchBtn.addEventListener("click", generateChart);
  refreshBtn.addEventListener("click", generateChart);
}

miro.board.ui.on("icon:click", async () => {
  await miro.board.ui.openPanel({ url: "index.html" });
});

init();
