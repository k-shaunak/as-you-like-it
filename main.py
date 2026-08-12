# Setup
import bs4 as bs
import requests
from datetime import datetime, timedelta
import json

# Functions

def get_schedule(path, page_id=0):  
    package = []
    missed = []
    
    while True:
        url = f"https://www.mumbaitheatreguide.com/dramas/schedules.asp?{path}&id={page_id}"
        section = requests.get(url)
        to_parse = section.text
        print(f"Parsing page {page_id + 1}")
        if section.status_code == 200: 
            if to_parse:   
                parsed_section = bs.BeautifulSoup(to_parse, "html.parser")
                for entry in parsed_section.select("tr"):
                        listing = parse_toListing(entry)
                        if listing:
                            package.append(listing)
            else:
                return [package[:-1], missed]
        else:
            missed.append(page_id)
            if len(missed) > 2:
                if missed[2] == missed[1] + 1 and missed[1] == missed[0] + 1:
                    return Exception("Poor Connection")
        page_id += 1

def parse_toListing(entry):

    ident = entry.select_one("a.schedule_title_new")
    if not ident:
        return None
    title = ident.get_text(" ", strip=True)

    link = ident.get("href")
    info = f"https://www.mumbaitheatreguide.com{link}"

    parts = link.strip("/").split("/")
    language = (
        parts[1]
        if len(parts) > 1
        else None
    )

    writer = []
    director = []
    cast = []
    artists = []

    for tag in entry.find_all("b"):
        label = tag.get_text(" ", strip=True)
        value = []
        for sibling in tag.next_siblings:
            if getattr(sibling, "name", None) == "br":
                break
            text = (
                sibling.get_text(" ", strip=True)
                if hasattr(sibling, "get_text")
                else str(sibling).strip()
            )
            if text:
                value.append(text)

        value = " ".join(value).strip()
        value = value.lstrip(":").strip()

        if label == "Writer" or label == "Author":
            writer = [
                name.strip()
                for name in value.replace("&", ",").split(",")
                if name.strip()
            ]
        elif label == "Director":
            director = [
                name.strip()
                for name in value.replace("&", ",").split(",")
                if name.strip()
            ]
        elif label == "Cast":
            cast = [
                name.strip()
                for name in value.replace("&", ",").split(",")
                if name.strip()
            ]

    schedule = entry.select_one(
        "font.schedule_summary_new"
    )
    venue_link = schedule.select_one("a")
    venue = (
        venue_link.get_text(" ", strip=True)
        if venue_link
        else None
    )
    schedule_copy = bs.BeautifulSoup(
        str(schedule),
        "html.parser"
    )

    for img in schedule_copy.find_all("img"):
        img.decompose()
    for link in schedule_copy.find_all("a"):
        link.decompose()
    schedule_text = schedule_copy.get_text(
        " ",
        strip=True
    )

    schedule_text = " ".join(schedule_text.split())
    date_text = schedule_text.split(",", 1)[0]

    listing = Listing(
        title=title,
        language=language,
        writer=writer,
        director=director,
        cast=cast,
        artists=artists,
        venue=venue,
        date=date_text,
        info=info
    )

    listing.parse_dates()
    return listing

def parse_date(text):
    text = text.strip()

    for fmt in ("%d %B %Y", "%d %b %Y"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            pass

    raise ValueError(f"Unknown date format: {text}")

def cleanup(listings):
    seen = set()
    result = []

    for listing in listings:
        key = (
            listing.title.strip().lower(),
            listing.venue.strip().lower() if listing.venue else None,
            tuple(listing.date),
        )

        if key not in seen:
            seen.add(key)
            result.append(listing)

    return result

# Classes

class Listing:
    def __init__(self, title, language, writer, director, cast, artists, venue, date, info):
        self.title = title
        self.language = language
        self.writer = writer 
        self.director = director
        self.cast = cast
        self.artists = artists
        self.venue = venue
        self.date = date
        self.info = info

    def parse_dates(self):
        text = self.date.strip()
        date_series = []

        if " - " in text:
            start_text, end_text = text.split(" - ", 1)

            start = parse_date(start_text)
            end = parse_date(end_text)

            current = start

            while current <= end:
                date_series.append(current.strftime('%d-%m-%Y'))
                current += timedelta(days=1)

        else:
            date_series.append(parse_date(text).strftime('%d-%m-%Y'))

        self.date = date_series

    def __str__(self):
        return (
            f"Title: {self.title}\n"
            f"Language: {self.language}\n"
            f"Writer: {self.writer}\n"
            f"Director: {self.director}\n"
            f"Cast: {', '.join(self.cast) if self.cast else 'N/A'}\n"
            f"Artists: {', '.join(self.artists) if self.artists else 'N/A'}\n"
            f"Venue: {self.venue}\n"
            f"Date: {', '.join(self.date) if self.date else 'N/A'}\n"
            f"Info: {self.info}"
        )

class Artistes:
    def __init__(self):
        self.writers = set()
        self.actors = set()
        self.directors = set()
        self.artists = set()

    def add_artistes(self, listing):
        for artiste in listing.cast:
            self.actors.add(artiste)

        for artiste in listing.writer:
            self.writers.add(artiste)

        for artiste in listing.director:
            self.directors.add(artiste)

        for artiste in listing.artists:
            self.artists.add(artiste)

    def __str__(self):
        return (
            f"Writers: {self.writers}\n"
            f"Directors: {self.directors}\n"
            f"Actors: {self.actors}\n"
            f"Artists: {self.artists}\n"
        )

# Payload
## Core Query
language = None ## None, english, hindi, marathi, gujarati, other; filter_by lanugage
filter_by = "citywise" ## citywise, lanugage, venue 
venue = None ## None, <list at :  https://www.mumbaitheatreguide.com/dramas/auditoriums/>; Join w/ %20; filter_by venue; citywise not empty
playname = None ## Playname not implemented 
citywise = "mumbai" ## None, <list at : https://www.mumbaitheatreguide.com/dramas/cities/; use delhi for New Delhi>; filter_by citywise, else required for venue

## Query Path
path = f"shedulelangauge={language}&theatre_type={filter_by}&auditorium={venue}&playname={playname}&cityname={citywise}"

# Data Compilation

web_data = get_schedule(path=path) # Retrieves Live Listings

show_data = web_data[0]
listings = cleanup(show_data)

known_artistes = Artistes()
venues = set()
dates = set()
for listing in listings:
    known_artistes.add_artistes(listing)
    if listing.venue:
        venues.add(listing.venue)
    dates.update(listing.date)


with open("listings.json", "w", encoding="utf-8") as f:
    json.dump(
        [
            {
                "title": listing.title,
                "language": listing.language,
                "writer": listing.writer,
                "director": listing.director,
                "cast": listing.cast,
                "artists": listing.artists,
                "venue": listing.venue,
                "date": listing.date,
                "info": listing.info
            }
            for listing in listings
        ],
        f,
        ensure_ascii=False,
        indent=2
    )