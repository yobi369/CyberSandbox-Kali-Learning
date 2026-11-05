\set ON_ERROR_STOP on
\getenv app_password CYBERSANDBOX_APP_PASSWORD

SELECT format('CREATE ROLE cybersandbox_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cybersandbox_app')
\gexec

SELECT format('ALTER ROLE cybersandbox_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L', :'app_password')
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO cybersandbox_app', current_database())
\gexec

GRANT USAGE ON SCHEMA public TO cybersandbox_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cybersandbox_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO cybersandbox_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cybersandbox_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO cybersandbox_app;
REVOKE CREATE ON SCHEMA public FROM cybersandbox_app;
ALTER ROLE cybersandbox_app SET idle_in_transaction_session_timeout = '15s';
ALTER ROLE cybersandbox_app SET statement_timeout = '30s';
DO $$ DECLARE r record; BEGIN
 SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolinherit INTO r FROM pg_roles WHERE rolname='cybersandbox_app';
 IF r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolbypassrls OR r.rolinherit THEN RAISE EXCEPTION 'unsafe cybersandbox_app role attributes'; END IF;
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_roles p ON p.oid=c.relowner WHERE p.rolname='cybersandbox_app' AND c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','S','v','m','f')) THEN RAISE EXCEPTION 'cybersandbox_app must not own database objects'; END IF;
 IF EXISTS (SELECT 1 FROM pg_namespace n JOIN pg_roles p ON p.oid=n.nspowner WHERE p.rolname='cybersandbox_app' AND n.nspname='public') THEN RAISE EXCEPTION 'cybersandbox_app must not own the public schema'; END IF;
END $;
