# Azure DevOps Roadmap - Miro App

A Miro app that connects to Azure DevOps via OAuth (Microsoft Entra ID), fetches work items with dates, and renders a Gantt chart directly on your board.

## Features

- OAuth sign-in via Microsoft Identity Platform (PKCE flow, no client secret needed)
- Fetches Epics, Features, Stories, or PBIs from Azure DevOps
- Renders a color-coded Gantt chart with timeline headers
- Filters by area path
- No secrets stored in the repo — tokens are acquired per-session via browser redirect

## Setup

### 1. Register an Azure AD App

1. Go to [Azure Portal > App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **New registration**
3. Set:
   - **Name**: `Miro DevOps Roadmap`
   - **Supported account types**: Accounts in this organizational directory only (single tenant) or multi-tenant
   - **Redirect URI**: Select **Single-page application (SPA)** and enter `https://dawid33.github.io/WikiMiroApp/`
4. Click **Register**
5. Copy the **Application (client) ID** and **Directory (tenant) ID**

### 2. Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission > APIs my organization uses**
3. Search for **Azure DevOps** (resource ID: `499b84ac-1321-427f-aa17-267ca6975798`)
4. Select **Delegated permissions** > `user_impersonation`
5. Click **Grant admin consent** (or have an admin do it)

### 3. Enable GitHub Pages

1. Go to your repo **Settings > Pages**
2. Under "Build and deployment", select **GitHub Actions** as the source
3. Push to `master` — the workflow deploys automatically

Your app will be available at: `https://dawid33.github.io/WikiMiroApp/`

### 4. Create the Miro App

1. Go to https://developers.miro.com and sign in
2. Click **Create app**
3. Set the **App URL** to: `https://dawid33.github.io/WikiMiroApp/`
4. Under permissions, enable **boards:read** and **boards:write**
5. Install the app to your team

### 5. Use the App

1. Open a Miro board and launch the app from the toolbar
2. Enter your **Client ID** and **Tenant ID** from step 1, click Save
3. Click **Sign in with Microsoft** — you'll be redirected to Microsoft login
4. After sign-in, enter your Azure DevOps org/project and click **Fetch & Generate Gantt Chart**

## How It Works

- Uses [MSAL.js 2.x](https://github.com/AzureAD/microsoft-authentication-library-for-js) with PKCE (Authorization Code flow)
- No client secret is needed — this is a public client SPA
- Tokens are cached in localStorage and refreshed silently
- The Azure DevOps REST API is called with the OAuth Bearer token
- Work items are filtered to those with Start Date or Target Date set

## Local Development

Serve the files locally for testing:

```bash
npx http-server . -p 3000
```

Add `http://localhost:3000/` as an additional redirect URI in your Azure AD app registration.
