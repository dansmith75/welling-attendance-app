# Welling United Red OBDSFL Attendance App

A simple mobile-first attendance capture app for the Welling United Red OBDSFL 26/27 dashboard project.

Version 1 is deliberately simple:

- HTML, CSS and JavaScript only
- No backend
- No Supabase yet
- Player names loaded from `players.json`
- Attendance saved locally in the browser using `localStorage`
- Export button creates a clean JSON file for the dashboard/data process

## How to run it locally

Because the app loads `players.json`, use a small local web server rather than double-clicking `index.html`.

The easiest VS Code option:

1. Install the VS Code extension called **Live Server**.
2. Right-click `index.html`.
3. Choose **Open with Live Server**.

## File overview

```text
welling-attendance-app/
├── index.html       # The page structure
├── styles.css       # Mobile-first styling
├── app.js           # Attendance logic
├── players.json     # Player list
└── README.md        # Project notes
```

## Version plan

### Version 1
Local browser storage and JSON export.

### Version 2
Connect to Supabase so attendance sessions save automatically online.

### Version 3
Connect exported/saved data into the main Welling dashboard JSON process.
