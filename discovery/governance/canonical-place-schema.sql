-- SRCHN canonical place schema proposal, 2 November 2026.
-- Migration design only. Not applied to a production database.
-- Public raw source records remain distinct from owner-submitted and verified data.

CREATE TABLE places (
  place_id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('raw_source','editorial_starter','submitted','pending_review','claimed_pending','verified','rejected','stale','closed')),
  primary_category_id TEXT NOT NULL,
  primary_subcategory_id TEXT,
  locality_id TEXT,
  address_line TEXT,
  pincode TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  latitude REAL,
  longitude REAL,
  coordinate_precision TEXT,
  geocoding_source TEXT,
  geo_last_checked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE place_names (
  place_id TEXT NOT NULL REFERENCES places(place_id),
  name TEXT NOT NULL,
  name_type TEXT NOT NULL CHECK (name_type IN ('canonical','alternate','alias','transliteration')),
  language TEXT,
  source TEXT,
  PRIMARY KEY (place_id, name_type, name, language)
);

CREATE TABLE taxonomy_categories (
  category_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  route TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE taxonomy_subcategories (
  subcategory_id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES taxonomy_categories(category_id),
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE place_category_contexts (
  place_id TEXT NOT NULL REFERENCES places(place_id),
  category_id TEXT NOT NULL REFERENCES taxonomy_categories(category_id),
  subcategory_id TEXT REFERENCES taxonomy_subcategories(subcategory_id),
  mapping_rule TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('low','medium','high')),
  approved_by TEXT,
  approved_at TEXT,
  PRIMARY KEY (place_id, category_id, subcategory_id)
);

CREATE TABLE sources (
  source_id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_url TEXT,
  licence TEXT,
  attribution TEXT,
  retrieval_at TEXT NOT NULL,
  import_batch_id TEXT,
  transformation_version TEXT NOT NULL
);

CREATE TABLE place_source_records (
  place_id TEXT NOT NULL REFERENCES places(place_id),
  source_id TEXT NOT NULL REFERENCES sources(source_id),
  source_feature_id TEXT NOT NULL,
  source_category TEXT,
  original_tags_json TEXT NOT NULL,
  coordinate_precision TEXT,
  dedupe_decision TEXT,
  mapping_version TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  PRIMARY KEY (source_id, source_feature_id)
);

CREATE TABLE place_verification (
  place_id TEXT PRIMARY KEY REFERENCES places(place_id),
  method TEXT,
  verifier TEXT,
  verified_at TEXT,
  evidence_pointer TEXT,
  next_check_at TEXT,
  notes TEXT
);

CREATE TABLE place_claims (
  claim_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES places(place_id),
  claimant_reference TEXT NOT NULL,
  claim_state TEXT NOT NULL CHECK (claim_state IN ('submitted','under_review','approved','rejected','expired')),
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewer TEXT,
  evidence_pointer TEXT
);

CREATE TABLE place_media (
  media_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES places(place_id),
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL,
  uploader TEXT,
  rights_declaration TEXT NOT NULL,
  source_url TEXT,
  licence TEXT,
  attribution TEXT,
  consent_record TEXT,
  moderation_state TEXT NOT NULL CHECK (moderation_state IN ('pending','approved','rejected','expired')),
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE place_facts (
  place_id TEXT NOT NULL REFERENCES places(place_id),
  fact_key TEXT NOT NULL,
  fact_value TEXT,
  source_id TEXT REFERENCES sources(source_id),
  owner_supplied INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT,
  PRIMARY KEY (place_id, fact_key)
);

CREATE TABLE place_hours (
  place_id TEXT PRIMARY KEY REFERENCES places(place_id),
  raw_source_text TEXT,
  structured_hours_json TEXT,
  timezone TEXT,
  source_id TEXT REFERENCES sources(source_id),
  verified_at TEXT
);

CREATE TABLE dedupe_clusters (
  cluster_id TEXT PRIMARY KEY,
  canonical_place_id TEXT NOT NULL REFERENCES places(place_id),
  decision TEXT NOT NULL CHECK (decision IN ('merged','held_for_review','split')),
  rule_version TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reversed_at TEXT
);

CREATE TABLE dedupe_cluster_members (
  cluster_id TEXT NOT NULL REFERENCES dedupe_clusters(cluster_id),
  place_id TEXT NOT NULL REFERENCES places(place_id),
  match_score REAL,
  match_reason TEXT NOT NULL,
  PRIMARY KEY (cluster_id, place_id)
);

CREATE TABLE audit_events (
  audit_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX places_category_idx ON places(primary_category_id, primary_subcategory_id);
CREATE INDEX places_locality_idx ON places(locality_id);
CREATE INDEX places_geo_idx ON places(latitude, longitude);
CREATE INDEX place_source_feature_idx ON place_source_records(source_feature_id);
CREATE INDEX place_facts_key_idx ON place_facts(fact_key);
