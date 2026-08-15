# Theatre Events Browser
```sandbox.ipynb``` houses a Python notebook containing an early implementation of a local client for listings on [Mumbai Theatre Guide](https://www.mumbaitheatreguide.com/).

This project is a product of the paucity of aggregated and query-able event listings on mainstream browsing/booking platforms. In particular, it allows for filtering events by artist.

The python script requires ```bs4```, ```requests```, ```datetime```, and ```json``` libraries to function correctly.

Web client scripts (html, css, js) have been created using Generative AI.

## Scope for Refinement
1. ```cleanup(...)``` addresses duplicates serially, based on a ```title, venue, date``` hash. This results in duplicates containing less/imprecise information being retained if they appear earlier in the list.
2. Multiple venue options for a listing are not handled during data retrieval. They are managed as exceptions in the web-client where appropriate.
3. The tool is intended to exhaustively aggregate listings, including those not monitored by Mumbai Theatre Guide. ```Listings``` and ```Artistes``` classes enable this in principle, however full coverage is yet to be achieved.
4. It is technically feasible to implement direct-to-inbox updates for a pre-specified set of filters with the current data pipeline.
5. The ```Artistes``` class has been conceived to facilitated graph-derived functionality, including static computational profiling of implied preferences.

## Observed Issues 
1. Cast member names joined by 'and' are parsed as a single entry.