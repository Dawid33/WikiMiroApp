# Azure DevOps Roadmap - Miro App

A Miro app that connects to Azure DevOps, fetches work items with dates, and renders a Gantt chart directly on your board.

## Features

- Fetches Epics, Features, Stories, or PBIs from Azure DevOps
- Renders a color-coded Gantt chart with timeline headers
- Filters by area path
- Config stored via `miro.board.storage` — set once by an admin, available to all board members
- PAT never committed to the repo

## Setup

### 1. Create a PAT in Azure DevOps

1. Go to Azure DevOps > User Settings > Personal Access Tokens
2. Click **New Token**
3. Set scope: **Work Items > Read**
4. Copy the token

### 2. Enable GitHub Pages

1. Go to your repo **Settings > Pages**
2. Under "Build and deployment", select **GitHub Actions** as the source
3. Push to `master` — the workflow deploys automatically

Your app will be available at: `https://dawid33.github.io/WikiMiroApp/`

### 3. Create the Miro App

1. Go to https://developers.miro.com and sign in
2. Click **Create app**
3. Set the **App URL** to: `https://dawid33.github.io/WikiMiroApp/`
4. Under permissions, enable **boards:read** and **boards:write**
5. Install the app to your team

### 4. Admin: Configure the Board

1. Open a Miro board and launch the app from the toolbar
2. Expand **Admin Setup**
3. Enter your org, project, PAT, work item types, and optional area path
4. Click **Save to Board** — this stores the config in Miro's board-level storage

### 5. All Users: Generate the Chart

Once an admin has saved the config, any board member can open the app panel and click **Fetch & Generate Gantt Chart** — no PAT entry needed on their side.

## How Storage Works

The app uses `miro.board.storage` (a key-value store scoped to the board + app combination). The PAT is stored there — accessible to anyone with board access but never committed to source control or exposed outside Miro.

## Local Development

```bash
npx http-server . -p 3000
```
