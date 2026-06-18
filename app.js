const STORAGE_KEY = "devops-roadmap-config";

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

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function showStatus(message, type) {
  const el = document.getElementById("status");
  el.textContent = message;
  el.className = "status-message" + (type ? " " + type : "");
}

async function fetchWorkItems(org, project, accessToken, workItemTypes, areaPath) {
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
      Authorization: `Bearer ${accessToken}`,
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
      headers: { Authorization: `Bearer ${accessToken}` },
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

function updateUI() {
  const signedOutDiv = document.getElementById("signed-out");
  const signedInDiv = document.getElementById("signed-in");
  const fetchBtn = document.getElementById("fetch-btn");
  const userName = document.getElementById("user-name");

  if (isSignedIn()) {
    signedOutDiv.style.display = "none";
    signedInDiv.style.display = "block";
    fetchBtn.disabled = false;
    userName.textContent = getAccountName();
  } else {
    signedOutDiv.style.display = "block";
    signedInDiv.style.display = "none";
    fetchBtn.disabled = true;
  }
}

async function init() {
  const orgInput = document.getElementById("org-input");
  const projectInput = document.getElementById("project-input");
  const typeSelect = document.getElementById("type-select");
  const areaInput = document.getElementById("area-input");
  const clientIdInput = document.getElementById("client-id-input");
  const tenantIdInput = document.getElementById("tenant-id-input");
  const saveAppBtn = document.getElementById("save-app-btn");
  const signInBtn = document.getElementById("sign-in-btn");
  const signOutBtn = document.getElementById("sign-out-btn");
  const saveConfigBtn = document.getElementById("save-config-btn");
  const fetchBtn = document.getElementById("fetch-btn");

  const authConfig = loadAuthConfig();
  if (authConfig.clientId) clientIdInput.value = authConfig.clientId;
  if (authConfig.tenantId) tenantIdInput.value = authConfig.tenantId;

  const config = loadConfig();
  if (config.org) orgInput.value = config.org;
  if (config.project) projectInput.value = config.project;
  if (config.type) typeSelect.value = config.type;
  if (config.area) areaInput.value = config.area;

  if (authConfig.clientId) {
    try {
      await initMsal(authConfig.clientId, authConfig.tenantId);
      await handleRedirect();
    } catch (err) {
      showStatus("Auth init failed: " + err.message, "error");
    }
  }

  updateUI();

  saveAppBtn.addEventListener("click", () => {
    const clientId = clientIdInput.value.trim();
    const tenantId = tenantIdInput.value.trim() || "common";
    if (!clientId) {
      showStatus("Client ID is required.", "error");
      return;
    }
    saveAuthConfig({ clientId, tenantId });
    showStatus("App config saved! You can now sign in.", "success");
    initMsal(clientId, tenantId).then(() => updateUI());
  });

  signInBtn.addEventListener("click", async () => {
    try {
      await signIn();
    } catch (err) {
      showStatus("Sign in failed: " + err.message, "error");
    }
  });

  signOutBtn.addEventListener("click", async () => {
    await signOut();
  });

  saveConfigBtn.addEventListener("click", () => {
    saveConfig({
      org: orgInput.value.trim(),
      project: projectInput.value.trim(),
      type: typeSelect.value,
      area: areaInput.value.trim(),
    });
    showStatus("Settings saved!", "success");
  });

  fetchBtn.addEventListener("click", async () => {
    const org = orgInput.value.trim();
    const project = projectInput.value.trim();
    const types = typeSelect.value;
    const area = areaInput.value.trim();

    if (!org || !project) {
      showStatus("Please fill in Organization and Project.", "error");
      return;
    }

    if (!isSignedIn()) {
      showStatus("Please sign in first.", "error");
      return;
    }

    fetchBtn.disabled = true;
    showStatus("Acquiring access token...", "");
    document.getElementById("preview").innerHTML = "";

    try {
      const accessToken = await getAccessToken();
      showStatus("Fetching work items from Azure DevOps...", "");

      const items = await fetchWorkItems(org, project, accessToken, types, area);
      renderPreview(items);

      if (items.length === 0) {
        showStatus("No work items with Start/Target dates found.", "error");
        fetchBtn.disabled = false;
        return;
      }

      showStatus(`Rendering Gantt chart with ${items.length} items...`, "");
      await renderGanttChart(items);
      showStatus("Gantt chart created on the board!", "success");
    } catch (err) {
      showStatus("Error: " + err.message, "error");
    } finally {
      fetchBtn.disabled = false;
    }
  });
}

miro.board.ui.on("icon:click", async () => {
  await miro.board.ui.openPanel({ url: "index.html" });
});

init();
