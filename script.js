let listings = [];

let artisteIndex = new Map();


// ============================================================================
// CONFIGURATION
// ============================================================================

const artisteFields = {
    Actor: "cast",
    Director: "director",
    Writer: "writer",
    Artist: "artists"
};


// ============================================================================
// FILTER STATE
// ============================================================================
//
// Within a facet:
//     OR
//
// Across facets:
//     AND
//
// Example:
//
//     (Artist A OR Artist B)
//     AND
//     (Venue X OR Venue Y)
//     AND
//     (Hindi OR English)
//     AND
//     date range
//
// ============================================================================

const filters = {
    artistes: new Set(),
    venues: new Set(),
    languages: new Set(),

    dateFrom: null,
    dateTo: null
};


const expandedArtistes = new Set();

let artisteSearch = "";


// ============================================================================
// NORMALISATION
// ============================================================================

function normaliseVenue(value) {

    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {
        return "Other";
    }

    return String(value).trim();
}


function normaliseLanguage(value) {

    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {
        return "Other";
    }

    return String(value).trim();
}


// ============================================================================
// DATE PARSING
// ============================================================================
//
// Source format:
//
//     DD-MM-YYYY
//
// The website's date inputs use:
//
//     YYYY-MM-DD
//
// We convert both to native Date objects for comparison.
// ============================================================================

function parseDate(value) {

    if (!value) {
        return null;
    }


    const parts =
        String(value)
            .split("-")
            .map(Number);


    if (parts.length !== 3) {
        return null;
    }


    const [day, month, year] = parts;


    const date =
        new Date(
            year,
            month - 1,
            day
        );


    date.setHours(
        0,
        0,
        0,
        0
    );


    return date;
}


// ============================================================================
// LOAD LISTINGS
// ============================================================================

async function loadListings() {

    try {

        const response =
            await fetch("listings.json");


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        listings =
            await response.json();


        artisteIndex =
            buildArtisteIndex();


        updateFilters();

        render();

    }
    catch (error) {

        console.error(
            "Could not load listings.json:",
            error
        );


        document
            .getElementById("listings")
            .textContent =
                "Unable to load listings.";
    }
}


// ============================================================================
// BUILD ARTISTE INDEX
// ============================================================================
//
// Creates:
//
//     artiste name → roles
//
// Example:
//
//     "Amit Trivedi" → { Actor, Director }
//
// This is derived from listings.json at runtime.
// ============================================================================

function buildArtisteIndex() {

    const index =
        new Map();


    for (const listing of listings) {

        for (
            const [role, field]
            of Object.entries(artisteFields)
        ) {

            const names =
                Array.isArray(listing[field])
                    ? listing[field]
                    : [];


            for (const name of names) {

                if (!name) {
                    continue;
                }


                if (!index.has(name)) {

                    index.set(
                        name,
                        new Set()
                    );
                }


                index
                    .get(name)
                    .add(role);
            }
        }
    }


    return index;
}


// ============================================================================
// ARTISTE MATCHING
// ============================================================================
//
// Each artiste selection is:
//
//     role|name
//
// Multiple selections are OR.
//
// Example:
//
//     Actor|Amit Trivedi
//     Actor|Naseeruddin Shah
//
// means:
//
//     Amit Trivedi as Actor
//     OR
//     Naseeruddin Shah as Actor
//
// ============================================================================

function matchesArtistes(listing) {

    if (
        filters.artistes.size === 0
    ) {
        return true;
    }


    return [
        ...filters.artistes
    ].some(key => {

        const separator =
            key.indexOf("|");


        const role =
            key.substring(
                0,
                separator
            );


        const name =
            key.substring(
                separator + 1
            );


        const field =
            artisteFields[role];


        const people =
            Array.isArray(
                listing[field]
            )
                ? listing[field]
                : [];


        return people.includes(name);
    });
}


// ============================================================================
// VENUE MATCHING
// ============================================================================
//
// Multiple venues are OR.
// ============================================================================

function matchesVenue(listing) {

    if (
        filters.venues.size === 0
    ) {
        return true;
    }


    return filters.venues.has(
        normaliseVenue(
            listing.venue
        )
    );
}


// ============================================================================
// LANGUAGE MATCHING
// ============================================================================
//
// Multiple languages are OR.
// ============================================================================

function matchesLanguage(listing) {

    if (
        filters.languages.size === 0
    ) {
        return true;
    }


    return filters.languages.has(
        normaliseLanguage(
            listing.language
        )
    );
}


// ============================================================================
// DATE MATCHING
// ============================================================================
//
// A listing may have multiple dates.
//
// A listing matches if AT LEAST ONE of its dates falls inside the
// selected range.
//
// Therefore:
//
//     listing date 1 OR date 2 OR date 3
//
// must satisfy:
//
//     date >= from
//     AND
//     date <= to
//
// ============================================================================

function matchesDate(listing) {

    if (
        !filters.dateFrom &&
        !filters.dateTo
    ) {
        return true;
    }


    const dates =
        Array.isArray(listing.date)
            ? listing.date
            : [];


    return dates.some(value => {

        const date =
            parseDate(value);


        if (!date) {
            return false;
        }


        if (
            filters.dateFrom &&
            date < filters.dateFrom
        ) {
            return false;
        }


        if (
            filters.dateTo &&
            date > filters.dateTo
        ) {
            return false;
        }


        return true;
    });
}


// ============================================================================
// MASTER FILTER
// ============================================================================
//
// Different facets are AND.
//
// The excludedFacet parameter is used when calculating counts.
//
// For example:
//
//     matchesFilters(listing, "venues")
//
// means:
//
//     Apply artistes
//     AND languages
//     AND dates
//
// but DON'T apply the currently selected venues.
//
// This allows us to calculate prospective venue counts.
// ============================================================================

function matchesFilters(
    listing,
    excludedFacet = null
) {

    if (
        excludedFacet !== "artistes" &&
        !matchesArtistes(listing)
    ) {
        return false;
    }


    if (
        excludedFacet !== "venues" &&
        !matchesVenue(listing)
    ) {
        return false;
    }


    if (
        excludedFacet !== "languages" &&
        !matchesLanguage(listing)
    ) {
        return false;
    }


    if (
        excludedFacet !== "dates" &&
        !matchesDate(listing)
    ) {
        return false;
    }


    return true;
}


// ============================================================================
// ARTISTE COUNTS
// ============================================================================
//
// Ignore artiste selections.
//
// Retain venue + language + date selections.
//
// Thus:
//
//     Artist counts
//
// are conditional on the other currently selected facets.
// ============================================================================

function getArtisteCounts() {

    const counts =
        new Map();


    const candidates =
        listings.filter(listing =>
            matchesFilters(
                listing,
                "artistes"
            )
        );


    for (const listing of candidates) {

        for (
            const [role, field]
            of Object.entries(artisteFields)
        ) {

            const names =
                Array.isArray(listing[field])
                    ? listing[field]
                    : [];


            const uniqueNames =
                [...new Set(names)];


            for (const name of uniqueNames) {

                if (!name) {
                    continue;
                }


                const key =
                    `${role}|${name}`;


                counts.set(
                    key,
                    (counts.get(key) || 0) + 1
                );
            }
        }
    }


    return counts;
}


// ============================================================================
// VENUE COUNTS
// ============================================================================
//
// Ignore venue selections.
//
// Retain artiste + language + date selections.
// ============================================================================

function getVenueCounts() {

    const counts =
        new Map();


    const candidates =
        listings.filter(listing =>
            matchesFilters(
                listing,
                "venues"
            )
        );


    for (const listing of candidates) {

        const venue =
            normaliseVenue(
                listing.venue
            );


        counts.set(
            venue,
            (counts.get(venue) || 0) + 1
        );
    }


    return counts;
}


// ============================================================================
// LANGUAGE COUNTS
// ============================================================================
//
// Ignore language selections.
//
// Retain artiste + venue + date selections.
// ============================================================================

function getLanguageCounts() {

    const counts =
        new Map();


    const candidates =
        listings.filter(listing =>
            matchesFilters(
                listing,
                "languages"
            )
        );


    for (const listing of candidates) {

        const language =
            normaliseLanguage(
                listing.language
            );


        counts.set(
            language,
            (counts.get(language) || 0) + 1
        );
    }


    return counts;
}


// ============================================================================
// SORT SELECTED OPTIONS FIRST
// ============================================================================

function selectedFirst(
    values,
    selected,
    getKey = value => value
) {

    return [...values].sort((a, b) => {

        const keyA =
            getKey(a);

        const keyB =
            getKey(b);


        const selectedA =
            selected.has(keyA);

        const selectedB =
            selected.has(keyB);


        if (
            selectedA !== selectedB
        ) {

            return selectedB - selectedA;
        }


        return keyA.localeCompare(
            keyB
        );
    });
}


// ============================================================================
// CHECK WHETHER AN ARTISTE HAS A SELECTED ROLE
// ============================================================================

function isArtisteSelected(name) {

    return [
        ...filters.artistes
    ].some(key =>
        key.endsWith(
            `|${name}`
        )
    );
}


// ============================================================================
// ARTISTE AGGREGATE COUNT
// ============================================================================
//
// This is the number of listings containing the artiste in ANY role,
// conditional on all the other active facets.
//
// A listing is counted only once even if the artiste appears in
// multiple roles.
// ============================================================================

function getArtisteAggregateCount(name) {

    return listings.filter(listing => {

        if (
            !matchesFilters(
                listing,
                "artistes"
            )
        ) {
            return false;
        }


        return Object.values(
            artisteFields
        ).some(field => {

            const people =
                Array.isArray(
                    listing[field]
                )
                    ? listing[field]
                    : [];


            return people.includes(name);
        });

    }).length;
}


// ============================================================================
// RENDER ARTISTES
// ============================================================================

function renderArtistes() {

    const container =
        document.getElementById(
            "artiste-options"
        );


    container.innerHTML = "";


    const counts =
        getArtisteCounts();


    let artistes =
        [...artisteIndex.entries()];


    // --------------------------------------------------------------
    // SEARCH
    // --------------------------------------------------------------

    if (artisteSearch) {

        artistes =
            artistes.filter(([name]) =>
                name
                    .toLowerCase()
                    .includes(
                        artisteSearch.toLowerCase()
                    )
            );
    }


    // --------------------------------------------------------------
    // REMOVE ARTISTES WITH ZERO MATCHING LISTINGS
    // --------------------------------------------------------------


    artistes =
        artistes.filter(([name]) => {

            const count =
                getArtisteAggregateCount(
                    name
                );


            return (
                count > 0 ||
                isArtisteSelected(name)
            );
        });


    // --------------------------------------------------------------
    // SELECTED ARTISTES FIRST
    // --------------------------------------------------------------

    artistes.sort(
        ([nameA], [nameB]) => {

            const selectedA =
                isArtisteSelected(nameA);

            const selectedB =
                isArtisteSelected(nameB);


            if (
                selectedA !== selectedB
            ) {

                return selectedB - selectedA;
            }


            return nameA.localeCompare(
                nameB
            );
        }
    );

    // --------------------------------------------------------------
    // RENDER
    // --------------------------------------------------------------

    for (
        const [name, roles]
        of artistes
    ) {

        const artisteContainer =
            document.createElement(
                "div"
            );


        artisteContainer.className =
            "artiste";


        // ----------------------------------------------------------
        // HEADER
        // ----------------------------------------------------------

        const header =
            document.createElement(
                "div"
            );


        header.className =
            "artiste-header";


        const toggle =
            document.createElement(
                "button"
            );


        toggle.className =
            "toggle";


        toggle.textContent =
            expandedArtistes.has(name)
                ? "−"
                : "+";


        toggle.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                if (
                    expandedArtistes.has(name)
                ) {

                    expandedArtistes.delete(
                        name
                    );

                }
                else {

                    expandedArtistes.add(
                        name
                    );
                }


                renderArtistes();
            }
        );


        const nameElement =
            document.createElement(
                "span"
            );


        nameElement.className =
            "artiste-name";


        nameElement.textContent =
            name;


        const artisteCount =
            getArtisteAggregateCount(
                name
            );


        const countElement =
            document.createElement(
                "span"
            );


        countElement.className =
            "option-count";


        countElement.textContent =
            artisteCount;


        header.appendChild(
            toggle
        );

        header.appendChild(
            nameElement
        );

        header.appendChild(
            countElement
        );


        artisteContainer.appendChild(
            header
        );


        // ----------------------------------------------------------
        // ROLES
        // ----------------------------------------------------------

        if (
            expandedArtistes.has(name)
        ) {

            const rolesContainer =
                document.createElement(
                    "div"
                );


            rolesContainer.className =
                "roles";


            for (
                const role
                of [...roles].sort()
            ) {

                const key =
                    `${role}|${name}`;


                const roleContainer =
                    document.createElement(
                        "label"
                    );


                roleContainer.className =
                    "role";


                const checkbox =
                    document.createElement(
                        "input"
                    );


                checkbox.type =
                    "checkbox";


                checkbox.checked =
                    filters.artistes.has(
                        key
                    );


                checkbox.addEventListener(
                    "change",
                    () => {

                        if (
                            checkbox.checked
                        ) {

                            filters.artistes.add(
                                key
                            );

                        }
                        else {

                            filters.artistes.delete(
                                key
                            );
                        }


                        updateFilters();

                        render();
                    }
                );


                const roleName =
                    document.createElement(
                        "span"
                    );


                roleName.textContent =
                    role;


                const roleCount =
                    document.createElement(
                        "span"
                    );


                roleCount.className =
                    "role-count";


                roleCount.textContent =
                    counts.get(key) || 0;


                roleContainer.appendChild(
                    checkbox
                );

                roleContainer.appendChild(
                    roleName
                );

                roleContainer.appendChild(
                    roleCount
                );


                rolesContainer.appendChild(
                    roleContainer
                );
            }


            artisteContainer.appendChild(
                rolesContainer
            );
        }


        container.appendChild(
            artisteContainer
        );
    }
}


// ============================================================================
// RENDER VENUES
// ============================================================================

function renderVenues() {

    const container =
        document.getElementById(
            "venue-options"
        );


    container.innerHTML = "";


    const counts =
        getVenueCounts();


    const venues =
        [
            ...new Set(
                listings.map(listing =>
                    normaliseVenue(
                        listing.venue
                    )
                )
            )
        ];


    const sortedVenues =
        selectedFirst(
            venues,
            filters.venues
        );


    for (
        const venue
        of sortedVenues
    ) {

        const count =
            counts.get(venue) || 0;


        // Hide unavailable options unless already selected.

        if (
            count === 0 &&
            !filters.venues.has(venue)
        ) {
            continue;
        }


        const label =
            document.createElement(
                "label"
            );


        label.className =
            "option";


        const checkbox =
            document.createElement(
                "input"
            );


        checkbox.type =
            "checkbox";


        checkbox.checked =
            filters.venues.has(venue);


        checkbox.addEventListener(
            "change",
            () => {

                if (
                    checkbox.checked
                ) {

                    filters.venues.add(
                        venue
                    );

                }
                else {

                    filters.venues.delete(
                        venue
                    );
                }


                updateFilters();

                render();
            }
        );


        const name =
            document.createElement(
                "span"
            );


        name.className =
            "option-name";


        name.textContent =
            venue;


        const countElement =
            document.createElement(
                "span"
            );


        countElement.className =
            "option-count";


        countElement.textContent =
            count;


        label.appendChild(
            checkbox
        );

        label.appendChild(
            name
        );

        label.appendChild(
            countElement
        );


        container.appendChild(
            label
        );
    }
}


// ============================================================================
// RENDER LANGUAGES
// ============================================================================

function renderLanguages() {

    const container =
        document.getElementById(
            "language-options"
        );


    container.innerHTML = "";


    const counts =
        getLanguageCounts();


    const languages =
        [
            ...new Set(
                listings.map(listing =>
                    normaliseLanguage(
                        listing.language
                    )
                )
            )
        ];


    const sortedLanguages =
        selectedFirst(
            languages,
            filters.languages
        );


    for (
        const language
        of sortedLanguages
    ) {

        const count =
            counts.get(language) || 0;


        // Hide unavailable options unless selected.

        if (
            count === 0 &&
            !filters.languages.has(
                language
            )
        ) {
            continue;
        }


        const label =
            document.createElement(
                "label"
            );


        label.className =
            "option";


        const checkbox =
            document.createElement(
                "input"
            );


        checkbox.type =
            "checkbox";


        checkbox.checked =
            filters.languages.has(
                language
            );


        checkbox.addEventListener(
            "change",
            () => {

                if (
                    checkbox.checked
                ) {

                    filters.languages.add(
                        language
                    );

                }
                else {

                    filters.languages.delete(
                        language
                    );
                }


                updateFilters();

                render();
            }
        );


        const name =
            document.createElement(
                "span"
            );


        name.className =
            "option-name";


        name.textContent =
            language;


        const countElement =
            document.createElement(
                "span"
            );


        countElement.className =
            "option-count";


        countElement.textContent =
            count;


        label.appendChild(
            checkbox
        );

        label.appendChild(
            name
        );

        label.appendChild(
            countElement
        );


        container.appendChild(
            label
        );
    }
}


// ============================================================================
// DATE SUMMARY
// ============================================================================

function formatDateForSummary(date) {

    if (!date) {
        return "";
    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short"
        }
    );
}


function formatDateSummary() {

    const from =
        filters.dateFrom;

    const to =
        filters.dateTo;


    if (
        from &&
        to
    ) {

        return (
            `· ${formatDateForSummary(from)}` +
            `–${formatDateForSummary(to)}`
        );
    }


    if (from) {

        return (
            `· from ` +
            `${formatDateForSummary(from)}`
        );
    }


    if (to) {

        return (
            `· until ` +
            `${formatDateForSummary(to)}`
        );
    }


    return "";
}


// ============================================================================
// FILTER BUTTON SUMMARIES
// ============================================================================

function updateFilterSummaries() {

    const summaries = {

        artistes:
            filters.artistes.size,

        venues:
            filters.venues.size,

        languages:
            filters.languages.size,

        dates:
            formatDateSummary()
    };


    document
        .querySelectorAll(
            ".filter-button"
        )
        .forEach(button => {

            const filter =
                button.dataset.filter;


            const summary =
                button.querySelector(
                    ".filter-summary"
                );


            const value =
                summaries[filter];


            if (!value) {

                summary.textContent = "";

                return;
            }


            if (
                filter === "dates"
            ) {

                summary.textContent =
                    value;

                return;
            }


            summary.textContent =
                `· ${value}`;
        });
}


// ============================================================================
// DATE FILTER
// ============================================================================

function setupDateFilter() {

    const fromInput =
        document.getElementById(
            "date-from"
        );


    const toInput =
        document.getElementById(
            "date-to"
        );


    fromInput.addEventListener(
        "change",
        () => {

            filters.dateFrom =
                fromInput.value
                    ? new Date(
                        `${fromInput.value}T00:00:00`
                    )
                    : null;


            updateFilters();

            render();
        }
    );


    toInput.addEventListener(
        "change",
        () => {

            filters.dateTo =
                toInput.value
                    ? new Date(
                        `${toInput.value}T00:00:00`
                    )
                    : null;


            updateFilters();

            render();
        }
    );


    document
        .getElementById(
            "clear-dates"
        )
        .addEventListener(
            "click",
            () => {

                filters.dateFrom =
                    null;

                filters.dateTo =
                    null;


                fromInput.value =
                    "";

                toInput.value =
                    "";


                updateFilters();

                render();
            }
        );
}


// ============================================================================
// FILTER PANEL
// ============================================================================

const filterPanel =
    document.getElementById(
        "filter-panel"
    );


const filterPanelTitle =
    document.getElementById(
        "filter-panel-title"
    );


const filterContents = {

    artistes:
        document.getElementById(
            "artiste-filter"
        ),

    venues:
        document.getElementById(
            "venue-filter"
        ),

    languages:
        document.getElementById(
            "language-filter"
        ),

    dates:
        document.getElementById(
            "date-filter"
        )
};


document
    .querySelectorAll(
        ".filter-button"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const filter =
                    button.dataset.filter;


                const isOpen =
                    filterPanel.classList.contains(
                        "open"
                    ) &&
                    button.classList.contains(
                        "active"
                    );


                // Close every facet.

                document
                    .querySelectorAll(
                        ".filter-button"
                    )
                    .forEach(item =>
                        item.classList.remove(
                            "active"
                        )
                    );


                document
                    .querySelectorAll(
                        ".filter-content"
                    )
                    .forEach(item =>
                        item.classList.remove(
                            "active"
                        )
                    );


                if (isOpen) {

                    filterPanel.classList.remove(
                        "open"
                    );

                    return;
                }


                button.classList.add(
                    "active"
                );


                filterPanelTitle.textContent =
                    button
                        .querySelector("span")
                        .textContent;


                filterContents[filter]
                    .classList.add(
                        "active"
                    );


                filterPanel.classList.add(
                    "open"
                );
            }
        );
    });


document
    .getElementById(
        "close-filter"
    )
    .addEventListener(
        "click",
        () => {

            filterPanel.classList.remove(
                "open"
            );


            document
                .querySelectorAll(
                    ".filter-button"
                )
                .forEach(button =>
                    button.classList.remove(
                        "active"
                    )
                );
        }
    );


// ============================================================================
// ARTISTE SEARCH
// ============================================================================

document
    .getElementById(
        "artiste-search"
    )
    .addEventListener(
        "input",
        event => {

            artisteSearch =
                event.target.value;


            renderArtistes();
        }
    );


// ============================================================================
// CLEAR ALL FILTERS
// ============================================================================

document
    .getElementById(
        "clear-filters"
    )
    .addEventListener(
        "click",
        () => {

            filters.artistes.clear();

            filters.venues.clear();

            filters.languages.clear();


            filters.dateFrom =
                null;

            filters.dateTo =
                null;


            artisteSearch =
                "";


            document
                .getElementById(
                    "artiste-search"
                )
                .value = "";


            document
                .getElementById(
                    "date-from"
                )
                .value = "";


            document
                .getElementById(
                    "date-to"
                )
                .value = "";


            updateFilters();

            render();
        }
    );


// ============================================================================
// UPDATE ALL FACETS
// ============================================================================

function updateFilters() {

    renderArtistes();

    renderVenues();

    renderLanguages();

    updateFilterSummaries();
}


// ============================================================================
// RENDER LISTINGS
// ============================================================================

function render() {

    const container =
        document.getElementById(
            "listings"
        );


    const results =
        listings.filter(listing =>
            matchesFilters(listing)
        );


    container.innerHTML = "";


    document
        .getElementById(
            "result-count"
        )
        .textContent =
            `${results.length} listing` +
            `${results.length === 1
                ? ""
                : "s"}`;


    for (
        const listing
        of results
    ) {

        const article =
            document.createElement(
                "article"
            );


        // ----------------------------------------------------------
        // TITLE
        // ----------------------------------------------------------

        const title =
            document.createElement(
                "h2"
            );


        title.textContent =
            listing.title;


        // ----------------------------------------------------------
        // DETAILS
        // ----------------------------------------------------------

        const details =
            document.createElement(
                "p"
            );


        details.textContent = [

            normaliseLanguage(
                listing.language
            ),

            normaliseVenue(
                listing.venue
            ),

            ...(Array.isArray(
                listing.date
            )
                ? listing.date
                : [])

        ]
            .filter(Boolean)
            .join(" · ");


        // ----------------------------------------------------------
        // PEOPLE
        // ----------------------------------------------------------

        const people =
            document.createElement(
                "p"
            );


        const roles = [];


        if (
            Array.isArray(
                listing.writer
            ) &&
            listing.writer.length
        ) {

            roles.push(
                `Writer: ${
                    listing.writer.join(", ")
                }`
            );
        }


        if (
            Array.isArray(
                listing.director
            ) &&
            listing.director.length
        ) {

            roles.push(
                `Director: ${
                    listing.director.join(", ")
                }`
            );
        }


        if (
            Array.isArray(
                listing.cast
            ) &&
            listing.cast.length
        ) {

            roles.push(
                `Cast: ${
                    listing.cast.join(", ")
                }`
            );
        }


        if (
            Array.isArray(
                listing.artists
            ) &&
            listing.artists.length
        ) {

            roles.push(
                `Artists: ${
                    listing.artists.join(", ")
                }`
            );
        }


        people.textContent =
            roles.join(" | ");


        // ----------------------------------------------------------
        // LINK
        // ----------------------------------------------------------

        const link =
            document.createElement(
                "a"
            );


        link.href =
            listing.info;


        link.textContent =
            "More information";


        link.target =
            "_blank";


        link.rel =
            "noopener noreferrer";


        // ----------------------------------------------------------
        // APPEND
        // ----------------------------------------------------------

        article.appendChild(
            title
        );

        article.appendChild(
            details
        );

        if (people.textContent) {

            article.appendChild(
                people
            );
        }

        article.appendChild(
            link
        );


        container.appendChild(
            article
        );
    }
}


// ============================================================================
// INITIALISE
// ============================================================================

setupDateFilter();

loadListings();