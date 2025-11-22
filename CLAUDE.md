# Circle Packer

A browser-based tool that converts CSV files into interactive D3.js circle packing diagrams.

## Project Overview

This is a client-side web application that visualizes hierarchical data from CSV files. Users drag and drop a CSV file onto the page, select columns to define hierarchy levels, and generate a circle packing visualization. All processing happens in the browser - no data is sent to any server.

## Key Files

- `index.html` - Main HTML page with the UI structure (upload area, column selectors, chart area)
- `circlepacker.js` - Core application logic including:
  - File drag-and-drop handling
  - CSV parsing with PapaParse
  - Data transformation into hierarchical structure
  - D3.js circle packing visualization (based on Observable's pack implementation)
- `circlepacker.css` - Styling for the application
- `lib/papaparse/papaparse.min.js` - CSV parsing library

## How to Run

This is a static web application with no build process. To run locally:

1. Open `index.html` directly in a browser, or
2. Serve with any static file server (e.g., `python -m http.server`)

The app is also hosted at: https://drnsmth.github.io/circlepacker/

## Dependencies

- D3.js v7 (loaded from CDN)
- PapaParse (bundled in `lib/`)

## How It Works

1. User drops a CSV file onto the upload area
2. PapaParse parses the CSV with headers
3. Column names populate dropdown menus for:
   - First/Second/Third hierarchy levels
   - Label column for leaf nodes
   - Color column for distinct value coloring
4. Clicking "Pack It" transforms flat CSV data into nested hierarchy
5. D3.js pack layout generates the circle packing SVG

## Code Conventions

- Vanilla JavaScript (no framework)
- Global state for `data` and `packedData`
- D3.js for DOM manipulation and visualization
- CSV files are gitignored to protect private data
