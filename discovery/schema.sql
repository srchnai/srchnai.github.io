-- Proposed migration only. Not applied. Existing server receipt storage is separate.
CREATE TABLE discovery_categories(id TEXT PRIMARY KEY,name TEXT NOT NULL,sort_order INTEGER NOT NULL);
CREATE TABLE discovery_subcategories(id TEXT PRIMARY KEY,category_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT,icon TEXT);
CREATE TABLE discovery_places(id TEXT PRIMARY KEY,name TEXT NOT NULL,lat REAL,lon REAL,address TEXT,neighbourhood TEXT,verification_status TEXT NOT NULL DEFAULT 'unreviewed',source_id TEXT NOT NULL,source_record TEXT,updated_at INTEGER);
CREATE TABLE discovery_place_subcategories(place_id TEXT,subcategory_id TEXT,PRIMARY KEY(place_id,subcategory_id));
CREATE TABLE discovery_sources(id TEXT PRIMARY KEY,url TEXT,licence TEXT,attribution TEXT,fetched_at INTEGER);
CREATE TABLE discovery_images(id TEXT PRIMARY KEY,place_id TEXT,url TEXT,source_url TEXT,author TEXT,licence TEXT,licence_url TEXT,rights_status TEXT NOT NULL DEFAULT 'unreviewed');
CREATE TABLE discovery_descriptions(place_id TEXT PRIMARY KEY,original_text TEXT,original_language TEXT);
CREATE TABLE discovery_translations(place_id TEXT,language TEXT,text TEXT,status TEXT NOT NULL DEFAULT 'unreviewed',reviewer TEXT,PRIMARY KEY(place_id,language));
CREATE TABLE discovery_audio(id TEXT PRIMARY KEY,place_id TEXT,language TEXT,voice TEXT,url TEXT,status TEXT NOT NULL DEFAULT 'unreviewed');
CREATE TABLE discovery_hours(place_id TEXT PRIMARY KEY,raw TEXT,verified_at INTEGER,source_url TEXT);
CREATE TABLE discovery_amenities(place_id TEXT,amenity TEXT,source_url TEXT,PRIMARY KEY(place_id,amenity));
CREATE TABLE discovery_events(id TEXT PRIMARY KEY,place_id TEXT,name TEXT,start_at TEXT,end_at TEXT,source_url TEXT,verification_status TEXT);
-- Current favourites remain browser-local. No account identifiers are collected by this preview.
