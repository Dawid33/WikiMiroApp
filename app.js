async function init() {
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const resultsDiv = document.getElementById("results");
  const statusDiv = document.getElementById("status");

  function showStatus(message, isError) {
    statusDiv.textContent = message;
    statusDiv.className = "status-message" + (isError ? " error" : "");
    if (message && !isError) {
      setTimeout(() => {
        statusDiv.textContent = "";
      }, 3000);
    }
  }

  async function searchWikipedia(query) {
    const url =
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        list: "search",
        srsearch: query,
        srlimit: "5",
        format: "json",
        origin: "*",
      });

    const response = await fetch(url);
    const data = await response.json();
    return data.query.search;
  }

  function stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  function renderResults(results) {
    if (results.length === 0) {
      resultsDiv.innerHTML = '<p class="loading">No results found.</p>';
      return;
    }

    resultsDiv.innerHTML = results
      .map(
        (item) => `
      <div class="result-card">
        <h3>${item.title}</h3>
        <p>${stripHtml(item.snippet)}...</p>
        <button class="btn btn-secondary" data-title="${item.title}" data-pageid="${item.pageid}">
          Add to Board
        </button>
      </div>
    `
      )
      .join("");

    resultsDiv.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => addToBoard(btn.dataset.title, btn.dataset.pageid));
    });
  }

  async function getArticleSummary(title) {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.extract || "No summary available.";
  }

  async function addToBoard(title, pageid) {
    try {
      showStatus("Fetching article summary...", false);
      const summary = await getArticleSummary(title);
      const truncated = summary.length > 200 ? summary.substring(0, 197) + "..." : summary;

      const viewport = await miro.board.viewport.get();
      const centerX = viewport.x + viewport.width / 2;
      const centerY = viewport.y + viewport.height / 2;

      await miro.board.createStickyNote({
        content: `<strong>${title}</strong><br/><br/>${truncated}`,
        x: centerX + (Math.random() - 0.5) * 400,
        y: centerY + (Math.random() - 0.5) * 400,
        width: 300,
        style: {
          fillColor: "#fff9b1",
        },
      });

      showStatus(`Added "${title}" to the board!`, false);
    } catch (err) {
      showStatus("Failed to add to board: " + err.message, true);
    }
  }

  async function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    resultsDiv.innerHTML = '<p class="loading">Searching...</p>';
    showStatus("", false);

    try {
      const results = await searchWikipedia(query);
      renderResults(results);
    } catch (err) {
      resultsDiv.innerHTML = "";
      showStatus("Search failed: " + err.message, true);
    }
  }

  searchBtn.addEventListener("click", handleSearch);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
  });
}

miro.board.ui.on("icon:click", async () => {
  await miro.board.ui.openPanel({ url: "index.html" });
});

init();
