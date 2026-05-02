
# Prayer Bulletin Generator

A modern, interactive web application to generate beautiful prayer bulletins with geographic context and real-time demographic analytics for India.

## ✨ Features

- **Interactive India Map**: Visualize national context with state-level highlighting.
- **Regional Breakdown**: Dynamic district-level maps for every Indian state.
- **Real-time Analytics**: Fetches live data from **Wikidata API** for:
  - Population (Total, Cr/L format)
  - Area (km²)
  - State Capital
  - Literacy Rates
  - Religious Demographics (%)
  - Head of Government (Chief Minister)
- **Local Disk Caching**: Optimized performance using a local file-based cache for state data.
- **PDF Generation**: High-quality PDF export of the generated bulletin using `html2canvas-pro` and `jsPDF`.
- **Responsive Design**: Premium aesthetics with Tailwind CSS v4 and Glassmorphism effects.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm / yarn / pnpm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

### Environment Variables

No API keys are required as it uses public Wikidata SPARQL endpoints. You can copy the example:
```bash
cp .env.example .env
```

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Mapping**: react-simple-maps (D3-geo based)
- **Styling**: Tailwind CSS v4
- **Data Source**: Wikidata (SPARQL)
- **PDF**: html2canvas-pro, jsPDF

## 📂 Project Structure

- `src/app/bulletin`: Main bulletin generation logic and UI.
- `src/components/maps`: Custom India and State-District map components.
- `src/lib/wikidata.ts`: Wikidata API fetcher with two-step validation.
- `src/app/api/state-data`: Server-side API with disk caching logic.
- `data/cache`: Local storage for fetched state statistics.

## 📝 License

© 2024 Prayer Department | AGDMC. All rights reserved.
