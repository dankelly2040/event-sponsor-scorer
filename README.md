# Sponsor Score

**Should I sponsor this event?** Upload your target account list and an event's attendee list. Get a score in seconds.

[Try it live](https://event-sponsor-scorer.expo.app)

## How it works

1. Upload your target account list (CSV, Excel, or ODS)
2. Upload last year's attendee list from the event organizer
3. The tool fuzzy-matches company names across both lists
4. You get a score (A-F) and a clear recommendation

## What it scores

- **Account overlap** (50% weight): What percentage of your target accounts are in the attendee list?
- **Contact quality** (30% weight): Are the right people there? Scores title relevance and contact density per account.
- **Cost efficiency** (20% weight): If you enter the sponsorship cost, it calculates your cost per target account reached.

## Privacy

All processing happens in your browser. No data is uploaded to any server.

## Supported file formats

CSV, TSV, Excel (.xlsx, .xls, .xlsb, .xlsm), and ODS (LibreOffice/Google Sheets).

## Tech stack

- [Expo](https://expo.dev) (web-only) + [Expo Router](https://docs.expo.dev/router/introduction/)
- [PapaParse](https://www.papaparse.com/) for CSV/TSV parsing
- [SheetJS](https://sheetjs.com/) for Excel/ODS parsing
- [Fuse.js](https://www.fusejs.io/) for fuzzy company name matching
- Deployed on [EAS Hosting](https://docs.expo.dev/eas/hosting/introduction/)

## Development

```bash
npm install
npm run web
```

## How company matching works

Before fuzzy matching, company names are normalized: lowercased, common suffixes stripped (Inc, LLC, Corp, Ltd, GmbH, etc.), punctuation removed, and whitespace collapsed. This handles ~70% of matches. Fuse.js handles the remaining fuzzy cases.

## License

MIT
