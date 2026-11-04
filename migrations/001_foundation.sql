CREATE TABLE purchase_requests (id text PRIMARY KEY, doc jsonb NOT NULL, CHECK (id=doc->>'id'));
CREATE TABLE payments (
 id text PRIMARY KEY, doc jsonb NOT NULL,
 purchase_request_id text GENERATED ALWAYS AS (doc->>'purchase_request_id') STORED REFERENCES purchase_requests(id),
 status text GENERATED ALWAYS AS (doc->>'status') STORED,
 CHECK (id=doc->>'id'), CHECK (doc->'paypal'->>'environment'='sandbox')
);
CREATE UNIQUE INDEX one_open_payment ON payments(purchase_request_id) WHERE status IN ('CREATING','AWAITING_PAYER','APPROVED','CAPTURING','PENDING');
CREATE UNIQUE INDEX paypal_order_owner ON payments ((doc->'paypal'->>'order_id')) WHERE doc->'paypal'->>'order_id' IS NOT NULL;
CREATE UNIQUE INDEX paypal_capture_owner ON payments ((doc->'paypal'->>'capture_id')) WHERE doc->'paypal'->>'capture_id' IS NOT NULL;
CREATE INDEX request_agent ON purchase_requests ((doc->'agent'->>'id'));
CREATE INDEX request_fingerprint ON purchase_requests ((doc->>'fingerprint'));
CREATE TABLE agents (id text PRIMARY KEY, doc jsonb NOT NULL);
CREATE UNIQUE INDEX agent_key ON agents ((doc->>'key_hash'));
CREATE TABLE idempotency (id text PRIMARY KEY, doc jsonb NOT NULL);
CREATE TABLE webhooks (id text PRIMARY KEY, doc jsonb NOT NULL);
CREATE TABLE rate_limits (id text PRIMARY KEY, doc jsonb NOT NULL);
CREATE TABLE audit_events (seq bigint PRIMARY KEY, id text UNIQUE NOT NULL, doc jsonb NOT NULL);
CREATE FUNCTION audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit events are append-only'; END $$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION audit_immutable();
