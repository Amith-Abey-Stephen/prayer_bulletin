# Prayer Bulletin Generator

A modern, interactive web application to generate beautiful prayer bulletins with geographic context and real-time demographic analytics for India.

## ✨ Features

- **Smart Search Suggestions**: Instant autocomplete for **States, Districts, and Towns** across India.
- **AI-Powered Data Extraction**: Leverages **Gemini 2.0 Flash** via OpenRouter for high-fidelity demographic extraction when structured data is unavailable.
- **Hybrid Data Engine**: Combines **Wikidata (SPARQL)**, **Wikipedia Extracts**, and **AI Intelligence** to provide:
  - Population (formatted in Cr/Lakhs)
  - Area Coverage (entire region context)
  - Regional Capitals & Major Urban Centers
  - Literacy Rates & Religious Demographics (%)
  - Ruling Political Parties
- **Interactive Geospatial Visualization**:
  - **National Context**: India map with state-level highlighting.
  - **Regional Breakdown**: Dynamic district-level maps for every Indian state.
- **Performance Optimized**:
  - **Batch Processing**: Parallel fetching of district summaries for rapid bulletin generation.
  - **Robust Caching**: Multi-layer caching (Memory + Disk) to reduce API calls and latency.
- **Premium Design & Export**:
  - **Refined Layout**: National -> Regional -> Analytics "Zoom-in" flow.
  - **High-Quality PDF**: Optimized for professional PDF export using `html2canvas-pro` and `jsPDF`.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- OpenRouter API Key (for AI extraction fallback)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables in `.env`:
   ```env
   OPENROUTER_API_KEY=your_key_here
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **AI Engine**: Gemini 2.0 Flash (via OpenRouter)
- **Mapping**: react-simple-maps (D3-geo based)
- **Styling**: Tailwind CSS v4
- **Data APIs**: Wikidata (SPARQL), Wikipedia (MediaWiki)
- **Validation**: Zod (Structured metadata enforcement)

## 📂 Project Structure

- `src/app/bulletin`: Main bulletin generation logic and UI.
- `src/services/MetadataService.ts`: Core logic for Wikidata/AI hybrid fetching.
- `lib/ai-extractor.ts`: Zod-validated AI extraction engine.
- `src/components/maps`: Custom India and State-District map components.
- `data/cache`: Local storage for fetched regional statistics.

## 📝 License

© 2026 Prayer Department | AGDMC. All rights reserved.
