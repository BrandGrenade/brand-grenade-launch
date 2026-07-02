update sessions set status='interrupted' where is_preflight_test=true and status='running';
update preflight_checks set status='abandoned', completed_at=now() where status='running';