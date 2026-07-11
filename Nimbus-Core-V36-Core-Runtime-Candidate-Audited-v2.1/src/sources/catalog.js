const HIGH_DOMAINS = Object.freeze([
  "rentry.co",
  "pastebin.com",
  "paste.ee",
  "justpaste.it",
  "controlc.com",
  "dpaste.org",
  "pastes.io",
  "paste.rs",
  "pastelink.net",
  "telegra.ph",
  "reddit.com",
  "old.reddit.com",
  "archive.org",
  "github.com",
  "gist.github.com",
  "raw.githubusercontent.com",
  "gitlab.com",
  "notion.site",
  "linktr.ee",
  "blogspot.com"
]);

const RESERVE_DOMAINS = Object.freeze([
  "hastebin.com",
  "github.io",
  "bitbucket.org",
  "sourceforge.net",
  "slideshare.net",
  "issuu.com",
  "beacons.ai",
  "bio.link",
  "solo.to",
  "msha.ke",
  "taplink.cc",
  "allmylinks.com",
  "instabio.cc",
  "heylink.me",
  "lnk.bio",
  "flow.page",
  "about.me",
  "carrd.co",
  "campsite.bio",
  "linkin.bio",
  "bio.fm",
  "hypage.com",
  "koji.to",
  "snipfeed.co",
  "milkshake.app",
  "shor.by",
  "tap.bio",
  "medium.com",
  "substack.com",
  "notion.so",
  "docs.google.com",
  "sites.google.com",
  "wordpress.com",
  "tumblr.com",
  "wixsite.com",
  "weebly.com",
  "gitbook.io",
  "readthedocs.io",
  "readme.io",
  "calameo.com"
]);

const ENGINES = Object.freeze([
  {
    id: "bing-rss",
    sourceType: "rss",
    template: "https://www.bing.com/search?format=rss&q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22{facet}"
  },
  {
    id: "ddg-lite",
    sourceType: "html",
    template: "https://lite.duckduckgo.com/lite/?q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22{facet}"
  },
  {
    id: "ddg-html",
    sourceType: "html",
    template: "https://duckduckgo.com/html/?q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22{facet}"
  },
  {
    id: "bing-web",
    sourceType: "html",
    template: "https://www.bing.com/search?q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22{facet}&count=20"
  }
]);

const RESERVE_FACETS = Object.freeze([
  "",
  "%20archive",
  "%20collection",
  "%20public",
  "%20index",
  "%20folder"
]);

function category(domain) {
  if (/paste|rentry|controlc|dpaste/.test(domain)) return "paste";
  if (/git/.test(domain)) return "code";
  if (/reddit/.test(domain)) return "community";
  if (/archive/.test(domain)) return "archive";
  return "web";
}

function createSource({
  id,
  name,
  domain,
  engine,
  facet = "",
  enabled,
  priority,
  categoryName = category(domain)
}) {
  return {
    id,
    name,
    category: categoryName,
    sourceType: engine.sourceType,
    templateUrl: engine.template
      .replace("{domain}", domain)
      .replace("{facet}", facet),
    enabled,
    defaultEnabled: enabled,
    priority,
    rankScore: 0
  };
}

export function sourceCatalog() {
  const rows = [];

  for (const domain of HIGH_DOMAINS) {
    for (const engine of ENGINES) {
      const number = rows.length + 1;
      rows.push(createSource({
        id: `high_${String(number).padStart(3, "0")}`,
        name: `${engine.id} ${domain}`,
        domain,
        engine,
        enabled: true,
        priority: 1000 - number
      }));
    }
  }

  let reserveNumber = 0;
  outer:
  for (const domain of RESERVE_DOMAINS) {
    for (const facet of RESERVE_FACETS) {
      for (const engine of ENGINES.slice(0, 3)) {
        reserveNumber += 1;
        rows.push(createSource({
          id: `reserve_${String(reserveNumber).padStart(3, "0")}`,
          name: `${engine.id} ${domain}${facet.replaceAll("%20", " ")}`,
          domain,
          engine,
          facet,
          enabled: false,
          priority: 500 - reserveNumber,
          categoryName: "reserve"
        }));
        if (rows.length === 300) break outer;
      }
    }
  }

  if (rows.length !== 300) {
    throw new Error(`Source catalog invariant failed: expected 300, received ${rows.length}`);
  }

  return rows;
}
