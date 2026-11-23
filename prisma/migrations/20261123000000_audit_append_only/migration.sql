-- Audit log is append-only: rows can't be deleted or rewritten, even by the application role.
-- The only permitted update is detaching a row from a deleted organisation (ON DELETE SET NULL).
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AuditLog is append-only';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.action IS DISTINCT FROM OLD.action
     OR NEW."actorUserId" IS DISTINCT FROM OLD."actorUserId"
     OR NEW."actorApiKeyId" IS DISTINCT FROM OLD."actorApiKeyId"
     OR NEW."targetType" IS DISTINCT FROM OLD."targetType"
     OR NEW."targetId" IS DISTINCT FROM OLD."targetId"
     OR NEW.ip IS DISTINCT FROM OLD.ip
     OR NEW.meta IS DISTINCT FROM OLD.meta
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR (NEW."organizationId" IS DISTINCT FROM OLD."organizationId" AND NEW."organizationId" IS NOT NULL) THEN
    RAISE EXCEPTION 'AuditLog is append-only';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
