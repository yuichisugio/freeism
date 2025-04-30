CREATE EXTENSION IF NOT EXISTS pgroonga;

CREATE INDEX pgroonga_index_auction_listings ON auction_listings USING pgroonga (fts);

CREATE INDEX pgroonga_index_auction_listings_fts ON auction_listings USING pgroonga (fts);
