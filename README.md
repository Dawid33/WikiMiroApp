# Azure DevOps Roadmap - Miro App

A Miro app that connects to Azure DevOps, fetches work items with dates, and renders a Gantt chart directly on your board.

## Features

- Fetches Epics, Features, Stories, or PBIs from Azure DevOps
- Renders a color-coded Gantt chart with timeline headers
- Filters by area path
- PAT entered at runtime and stored in browser localStorage only — never in the repo

## Setup

### 1. Create a PAT in Azure DevOps

1. Go to Azure DevOps > User Settings > Personal Access Tokens
2. Click **New Token**
3. Set scope: **Work Items > Read**
4. Copy the token — you'll paste it into the Miro panel at runtime

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

### 4. Use the App

1. Open a Miro board and launch the app from the toolbar
2. Enter your Azure DevOps org, project, and PAT
3. Click **Save Settings** (stored in your browser only)
4. Click **Fetch & Generate Gantt Chart**

## Security

The PAT is stored in your browser's `localStorage` and sent directly from your browser to the Azure DevOps API. It never passes through any intermediary server or gets committed to the repository. Each user enters their own PAT.

## Local Development

```bash
npx http-server . -p 3000
```
