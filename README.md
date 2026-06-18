# Wiki Miro App

A Miro app that lets you search Wikipedia and add article summaries as sticky notes to your board.

## Features

- Search Wikipedia directly from the Miro panel
- View article snippets before adding them
- Creates sticky notes with the article title and summary
- Notes are placed near the center of your current viewport

## Setup

### 1. Enable GitHub Pages

1. Go to your repo **Settings > Pages**
2. Under "Build and deployment", select **GitHub Actions** as the source
3. Push to `master` — the workflow deploys automatically

Your app will be available at: `https://dawid33.github.io/WikiMiroApp/`

### 2. Create a Miro App

1. Go to https://developers.miro.com and sign in
2. Click **Create app**
3. Set the **App URL** to: `https://dawid33.github.io/WikiMiroApp/`
4. Under permissions, enable **boards:read** and **boards:write**
5. Install the app to your team

### 3. Use the App

1. Open a Miro board
2. Find the app icon in the left toolbar
3. Search for a Wikipedia article
4. Click "Add to Board" to create a sticky note with the summary
