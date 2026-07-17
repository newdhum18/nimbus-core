-- V37.1 approved-source reset: remove every old source and install only the six verified note platforms.
DELETE FROM source_tombstones;
DELETE FROM sources;
INSERT INTO sources(id,name,category,source_type,template_url,enabled,default_enabled,priority,rank_score,created_at,updated_at) VALUES
('approved_rentry','Rentry','approved-note','html','https://lite.duckduckgo.com/lite/?q=site%3Arentry.co%20{q}%20%22mega.nz%2Ffolder%2F%22',1,1,1600,100,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('approved_controlc','ControlC','approved-note','html','https://lite.duckduckgo.com/lite/?q=site%3Acontrolc.com%20{q}%20%22mega.nz%2Ffolder%2F%22',1,1,1590,98,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('approved_justpaste','JustPaste.it','approved-note','html','https://lite.duckduckgo.com/lite/?q=site%3Ajustpaste.it%20{q}%20%22mega.nz%2Ffolder%2F%22',1,1,1580,96,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('approved_telegra','Telegraph','approved-note','html','https://lite.duckduckgo.com/lite/?q=site%3Atelegra.ph%20{q}%20%22mega.nz%2Ffolder%2F%22',1,1,1570,94,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('approved_pastemode','Pastemode','approved-note','html','https://lite.duckduckgo.com/lite/?q=site%3Apastemode.com%20{q}%20%22mega.nz%2Ffolder%2F%22',1,1,1560,92,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('approved_pastelink','Pastelink','approved-note','html','https://lite.duckduckgo.com/lite/?q=site%3Apastelink.net%20{q}%20%22mega.nz%2Ffolder%2F%22',1,1,1550,90,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
