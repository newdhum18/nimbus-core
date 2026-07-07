V23 rebuilt from scratch after V22 D1 migration failure.
Root cause fixed: D1 cannot add a column with a non-constant default. V23 uses safe CREATE TABLE and nullable ALTER TABLE migrations.
