import type { Seg } from "@/lib/i18n";
import type { Dict } from "./tr";

/**
 * English strings.
 *
 * Typed as `Dict`, so a missing or renamed key is a compile error — Turkish
 * can never leak into the English build by accident.
 *
 * Voice note: the Turkish original is deliberately plain and self-critical
 * ("we were wrong, we fixed it"). Keep that. No marketing tone, no hedging
 * away the platform's admitted limits, and no regional characterisation of
 * where fires occur — land cover is described, never people.
 */
export const en: Dict = {
  locale: "en",

  common: {
    brand: "Wildfire",
    about: "About",
    liveMap: "Live map",
    liveMapBack: "← Live map",
    archive: "Archive",
    stats: "Season statistics",
    statsShort: "Statistics",
    backToMap: "← Back to the map",
    close: "Close",
    show: "Show",
    mapLoading: "loading map…",
    otherLang: "TR",
    otherLangTitle: "Türkçeye geç",
    langLabel: "Language",
  },

  top: {
    windows: { h24: "24h", h48: "48h", h120: "5d" },
    toggles: {
      wind: { label: "Wind", title: "Animated wind flow" },
      heat: { label: "Heat", title: "Detection density heat map" },
      cones: { label: "Forecast", title: "Wind-driven spread shape" },
      smoke: {
        label: "Smoke",
        title:
          "Surface fine particulate (PM2.5) field. The dispersion is computed by ECMWF/CAMS; the grid is coarse because the model's own resolution is coarse. It also includes non-fire sources (traffic, industry, dust).",
      },
      msg: {
        label: "MSG 15min",
        title:
          "Meteosat: scans every 15 minutes and fills the gap between polar satellite passes. The location is coarse (pixel 15-25 km²); the ring shows that uncertainty.",
      },
      news: {
        label: "News reports",
        title:
          "Fires reported in the news — here to catch what the satellite cannot see. This data is UNVERIFIED: the location is inferred from a headline, so it is drawn as an approximate area rather than a point. It is not counted as an active fire and no spread forecast is drawn for it.",
      },
      aircraft: {
        label: "Aircraft",
        title:
          "Water-bombing aircraft and helicopters flying near a fire (ADS-B). This is NOT satellite data: it comes from a volunteer-run receiver network, so an aircraft that does not broadcast — or flies outside coverage — will not appear. We know the aircraft type, not its mission: read it as \"there is a response here\", not as an official tasking record.",
      },
      burnt: {
        label: "Burnt area",
        title: "EFFIS burnt area perimeters (Sentinel-2)",
      },
      danger: { label: "Danger", title: "GWIS fire weather index forecast" },
      satellite: { label: "Satellite", title: "Sentinel-2 cloudless mosaic (10 m)" },
      today: {
        label: "Today",
        title:
          "NASA GIBS daily true colour — smoke from large fires is visible (250 m)",
      },
      terrain: {
        label: "Terrain",
        title: "Hillshade — shows valleys and ridges",
      },
    },
    demoData: "Demo data",
    myLocation: "My location",
    myLocationTitle:
      "Show your own position on the map (your location never leaves your device)",
    alerts: "Alerts",
    alertsTitle: "Watch a place and get notified if a fire starts near it",
    freshTitle: "Newest satellite detection {clock} · data as of {fetched}",
    waitingTitle: "Waiting for data",
    lastDetection: "last detection {ago}",
    waitingData: "waiting for data",
    blindGap: " · observation gap, next pass {next}",
  },

  legend: {
    intensity: "Detection intensity (FRP, MW)",
    trail: "Path travelled — the ring marks where it was first seen",
    burned: "Burned area (history of the selected fire)",
    reach: "Possible reach (1·3·6 h · 90%) — the wide end is where the fire is heading",
    smoke: "Smoke (PM2.5) — darker means denser; field from the CAMS model, coarse grid",
    recent: "Detection seen in the last 6 hours",
    note: [
      ["A satellite does not see flames, it sees "],
      ["heat", "b"],
      [
        ": chimneys, power plants and stubble burning also show up as dots. A dot that appears in the same place every day is usually a permanent heat source.",
      ],
    ] as Seg[],
    limits: "Errors and limitations →",
  },

  panel: {
    activeHere: "Active in Türkiye",
    abroadTitle:
      "{n} events are in neighbouring countries (the satellite's field of view does not stop at the border)",
    counts: " active · {events} events",
    fixedCount: " · {n} fixed sources",
    abroadCount: " · +{n} across the border",
    searchPlaceholder: "Search a province or district — Muğla, Çine…",
    searchAria: "Search fires by province or district name",
    hideFarm: "Hide stubble",
    hideFarmTitle:
      "Removes fires on agricultural land (stubble burning) from the list and the map. The classification comes from CORINE land cover; there is no coverage in the eastern provinces, so events there are not hidden.",
    fuelLoading: "querying land cover…",
    matches: "{n} matches",
    empty:
      "No satellite detections in the selected time window. You can try widening the window; satellites scan each region a few times a day.",
    noMatch: [
      ["{q}", "b"],
      [
        ": no detections. That does not mean there is no fire there — the satellite can miss small and short-lived fires.",
      ],
    ] as Seg[],
  },

  card: {
    status: { active: "ACTIVE", waning: "WANING", old: "OLD" },
    abroad: "ABROAD",
    fixedSource: "FIXED SOURCE",
    meta: "{count} detections · {mw} MW · {ago}",
    trend: { up: "heat rose", down: "heat fell", flat: "heat flat" },
    drift: "{km} km towards {dir}",
    stationary:
      "This point has not moved across {n} satellite passes. It may be a permanent heat source (chimney, power plant, industrial facility).",
    disclaimer: [
      [
        "A satellite sees heat; not every detection is a fire. The direction is an indication, not an official warning. In an emergency call ",
      ],
      ["112", "m"],
      [" · Forest fire hotline "],
      ["177", "m"],
    ] as Seg[],
  },

  weather: {
    unavailable: "Local weather data is unavailable right now.",
    wind: "Wind",
    windValue: "from {dir} at {n} km/h",
    gust: "Gust",
    gustValue: "{n} km/h",
    humidity: "Humidity",
    humidityValue: "{n}%",
    temp: "Temperature",
    tempValue: "{n}°C",
    vpd: "VPD",
    vpdValue: "{n} kPa",
    fwi: "Fire weather index",
    fwiTitle:
      "FFMC {ffmc} · DMC {dmc} · DC {dc} · ISI {isi} · BUI {bui} ({days}-day series)",
    smoke: "Smoke (PM2.5)",
    smokeTitle: "Surface fine particulate — a proxy for smoke (CAMS)",
    smokeValue: "{n} µg/m³",
    terrain: "Terrain",
    terrainTitle:
      "Fire accelerates uphill — even when the wind blows the other way",
    terrainValue: "{m} m · {slope}% slope",
    upslope: "uphill {dir}",
  },

  fwiLevels: ["Very low", "Low", "Moderate", "High", "Very high", "Extreme"],

  fuel: {
    ORMAN: { ad: "Forest", not: "tree cover" },
    MAKI: { ad: "Maquis", not: "sclerophyllous shrub" },
    OT: { ad: "Grassland", not: "meadow/steppe" },
    TARIM: {
      ad: "Agricultural land",
      not: "most likely stubble burning — not a forest fire",
    },
    YAPI: {
      ad: "Built-up/industrial",
      not: "may be chimney or facility heat",
    },
    CIPLAK: { ad: "Bare ground", not: "sparse vegetation" },
    SU: { ad: "Water surface", not: "most likely a false positive" },
  },

  assess: {
    fixed: [
      ["This is not a fire.", "b"],
      [" This point has appeared hot on "],
      ["{days} separate days", "m"],
      [" this season. A satellite sees "],
      ["heat", "b"],
      [
        ", not flames; refineries, steel plants, power stations and gas flares are hot every day. For comparison: the longest measured forest fire in Türkiye lasted 16.5 days. These records stay on the map but are ",
      ],
      ["excluded from the active fire count", "b"],
      ["."],
    ] as Seg[],
    footprint: [
      ["Area the satellite saw as hot: "],
      ["≈{ha} ha", "m"],
      [
        " ({cells} VIIRS pixels) — this is not an official burnt area: smouldering sections lose their heat signature, and a detected pixel may not have burned in full.",
        "d",
      ],
    ] as Seg[],
    fuelLine: [["Land cover: "], ["{ad}", "b"], [" — {not}"]] as Seg[],
    heatUp: [
      [
        "Rising heat does not mean the fire will keep growing: when we measured it, this signal predicted the next advance ",
      ],
      ["no better than a coin flip", "b"],
      [", and risen heat usually fell back again."],
    ] as Seg[],
    gap: "Currently in a satellite observation gap: the next detection is expected {next}. No detection does not mean the fire is out.",
    history: [
      ["First seen: "],
      ["{first}", "m"],
      [" · tracked across {passes} satellite passes over {span}"],
    ] as Seg[],
    spanHours: "{n} hours",
    spanDays: "{n} days",
    drift: [
      ["Where it came from: "],
      ["{from}", "m"],
      [" → "],
      ["towards {to}", "m"],
      [", {km} km in {hours} h"],
    ] as Seg[],
    noDrift:
      "No clear change of position: the fire is widening where it started.",
    cone: [
      ["Most likely direction: "],
      ["{dir}", "m"],
      [" · the resultant of wind and slope"],
    ] as Seg[],
    coneWeak: " — but the wind is weak, so the direction is not strong",
    coneSpread: " · margin ±{deg}°",
    coneMean: [
      ["The shape is the 1·3·6 hour "],
      ["90% reach", "b"],
      [": in nine out of ten fires we measured, "],
      ["even the furthest advancing point", "b"],
      [
        " stayed inside this boundary — and that rate was tested on seasons the model had never seen. It reaches ",
      ],
      ["2.4 times", "b"],
      [
        " further ahead than behind; real fires draw a teardrop like this. Firefighting response is not accounted for.",
      ],
    ] as Seg[],
    windTurn: [
      ["The wind turns "],
      ["about {deg}° over the next 6 hours", "b"],
      [" — the outer rings are drawn for that turn"],
    ] as Seg[],
    observed: [
      ["The most reliable directional evidence we have is observation: "],
      ["it advanced towards {dir} on the recent passes", "b"],
    ] as Seg[],
    agree: "The observed advance agrees with the forecast direction — confidence increases",
    disagree: [
      [
        "The observed advance deviates from the wind direction; terrain, fuel or firefighting may be at play — ",
      ],
      ["go by the observed direction", "b"],
    ] as Seg[],
    slope: "Steep slope ({slope}%): it may also climb uphill towards {dir}",
    past: "The forecast shape is drawn in the live view only",
    calm: "The wind is calm — no clear direction",
  },

  smoke: {
    label: "Smoke forecast",
    unavailable: "The smoke forecast is unavailable right now.",
    bands: {
      good: "good",
      moderate: "moderate",
      sensitive: "unhealthy for sensitive groups",
      unhealthy: "unhealthy",
      veryUnhealthy: "very unhealthy",
      hazardous: "hazardous",
    },
    today: "today {t}",
    tomorrow: "tomorrow {t}",
    dayAfter: "in two days {t}",
    peaks: " is the peak",
    noPeak: "no marked rise expected over the next 48 hours",
    source:
      "We do not compute the dispersion: this is the output of the ECMWF/CAMS model. It also includes non-fire sources (traffic, industry, dust).",
  },

  share: {
    button: "Share",
    copied: "link copied",
    failed: "could not copy",
    title: "{place} — {mw} MW fire detection",
    text: "{title} · on the Algow Wildfire map",
  },

  alerts: {
    heading: "Fire alerts near me",
    intro: [
      [
        "Save the places you want to watch; your device will alert you when a new fire is detected around them. The locations you save are kept ",
      ],
      ["on this device only", "b"],
      [" and never reach any server."],
    ] as Seg[],
    permissionDenied:
      "Notification permission was denied — you need to enable it in your browser settings",
    permissionAsk: "Allow notifications",
    namePlaceholder: "Place name (home, field, work...)",
    radiusAria: "Alert radius",
    fromLocation: "My position",
    fromMap: "Centre of the map",
    add: "Add this place to my watch list",
    remove: "Remove",
    removeAria: "Stop watching {name}",
    footer:
      "With the app fully closed, notifications may not arrive on every device; the most reliable way is to add the app to your home screen. Alerts depend on satellite passes — small fires may not be seen. In an emergency call 112 / 177.",
    notifyTitle: "{name}: fire {km} km away",
    notifyBody: "{place} · {mw} MW · {count} satellite detections",
  },

  geo: {
    unsupported: "This browser does not support location services",
    timeout: "Could not get your location — try again in the open",
    unavailable: "The location service is not responding right now",
    locating: "getting location…",
    denied:
      "Location permission was not granted. If you allow this site to use your location in your browser settings, you can see yourself on the map.",
    nearest: [
      ["The nearest fire to you is "],
      ["{km} km", "b"],
      [" away, towards "],
      ["{dir}", "b"],
    ] as Seg[],
    none: "No active fire detections near you.",
    accuracy: "location ±{m} m · never leaves your device",
  },

  /** Meteosat heat ring card — opens when a ring on the map is clicked */
  heat: {
    title: "Possible fire in this area",
    badge: "UNCONFIRMED",
    reading: "Meteosat saw heat inside this ring: {frp} MW · pixel {km2} km²",
    scanned: "scanned {ago}",
    confidence: "{n}% confidence",
    disclaimer:
      "This is a heat measurement, not a confirmed fire. The ring is the true area of the pixel — we do not know where inside it the heat is. Until a high-resolution satellite (VIIRS) confirms it, this could be a fire, but it could equally be an industrial stack or a stubble burn. It is not counted as an active fire.",
  },
  /** News report card — opens when a circle on the map is clicked */
  aircraft: {
    unknown: "Aircraft",
    badgeSure: "FIREFIGHTING AIRCRAFT",
    badgeMaybe: "LIKELY",
    altitude: "{ft} ft",
    speed: "{kt} kt",
    distance: "{km} km from fire",
    onGround: "on the ground",
    age: "position {sn} s old",
    maybeNote:
      "This airframe is used for firefighting but can also be an air ambulance or a transport; it is listed because it is flying low right next to the fire.",
    disclaimer:
      "Source: airplanes.live (volunteer ADS-B network). The type and position are real data; the mission is not. An absent aircraft does not mean there is no response — not every aircraft broadcasts.",
  },
  news: {
    status: {
      devam: "ONGOING",
      kontrol: "CONTAINED",
      sondu: "EXTINGUISHED",
    },
    sourceCount: "reported by {n} outlets",
    trusted: "includes an established outlet",
    disclaimer:
      "Unverified news report — not a satellite detection. The location is inferred from a headline; the circle is an approximate area of about {km} km, not the fire itself.",
  },
  banner: {
    offline:
      "You are offline — showing the last data stored on your device{when}. It refreshes on its own once you are back online.",
    offlineWhen: " ({clock})",
    eventMissing:
      "The shared fire is not visible in the selected time window — it may be out, or the satellite may not have seen heat there for a while. You can try widening the window.",
    noData:
      "NASA FIRMS data is unreachable right now — the connection will be retried periodically.",
    sourcesDown:
      "{down} of {total} satellite sources are not responding — some detections may be missing.",
    windPartial:
      "Wind data is partly missing — the direction forecast is not shown in some regions.",
    windDown:
      "Wind data is unreachable — the direction forecast and the wind layer are off for now.",
    thin: "Your connection looks slow, so the wind animation and the heat layer started switched off.",
    thinAction: "Turn on anyway",
    staleWindow:
      "The {want} window you selected could not be fetched — the screen still shows {have} data.",
    staleConn: "Connection problem — showing the last data fetched at {clock}.",
    window120: "5-day",
    windowHours: "{n}-hour",
    firstAlarm: "⚡ {n} new heat source — not yet confirmed:",
    firstAlarmNote:
      " · Meteosat scans every 10 minutes, so we show this without waiting for a high-resolution pass. It may or may not be a fire.",
    newsPopupHint: " · click a circle to see the report",
    newsCount: "{n} fires in the news",
    newsUnverified:
      " · unverified reports; the circle is the approximate area of the place, not counted as active fires",
    newsUnlocated: " · {n} reports could not be located",
    msgSource: "{src} {min}min",
    msgScan: " · Meteosat {clock} scan: ",
    msgCount: "{n} detections · ",
    msgCoarse:
      "the location is coarse (the orange ring is the pixel's real footprint)",
    msgEmpty:
      "no detections over Türkiye in this scan — Meteosat only sees large fires, so keep the high-resolution layer on",
  },

  layerNote: {
    heatZoom:
      "The heat layer switches off when you zoom in — at this scale individual detections are already visible.",
    conePast:
      "The forecast shape is drawn in the live view only; it is hidden because you have rewound time.",
    coneSmall:
      "The reach shape is hidden at this scale: the widest ring is {km} km, which is a few pixels — it is not drawn because it cannot be read. Zoom in on a fire and the shape appears.",
    coneCalm:
      "No forecast shape: the wind is very calm where the active fires are.",
    coneWaiting: "Waiting for wind data to draw the forecast shape.",
    windWaiting: "Waiting for data to animate the wind.",
    windReduced: "The wind animation is off because reduced motion is enabled.",
    fuelLoading: "Querying land cover — the stubble filter will settle shortly.",
    farmHidden: "Stubble filter: {n} agricultural fires hidden.",
    farmUnclassified:
      " The cover of {n} events could not be queried (CORINE does not cover the eastern provinces) — those are still in the list.",
  },

  intro: {
    alt: "What your hands set alight, your tears cannot put out. — Algow",
    skip: "Skip",
  },

  timeline: {
    play: "Play the time sequence",
    pause: "Pause",
    scrubAria: "Time slider",
    live: "LIVE",
    now: "NOW",
  },

  map: {
    firstSeen: "FIRST SEEN",
  },

  embed: {
    fullMap: "Full map ↗",
    detail: "detail and forecast ↗",
    cardMeta: "{count} detections · {mw} MW · {ago}",
    mobileCount: " active fires · {events} events",
  },

  province: {
    season: "{ad} · {yil} season",
    none: "The satellite saw no fire-related heat detection in this province this season.",
    detections: " fire detections · past avg. {avg}",
    above: "above",
    below: "below",
    diff: " {n}% {dir}",
    highest: [
      ["Peak heat "],
      ["{date}", "m"],
      [" · {place} · "],
      ["{mw} MW", "m"],
    ] as Seg[],
    fixedNote:
      "A further {n} detections come from permanent heat sources (industrial facility, power station) — not counted as fire.",
    countNote:
      "This is a count of detections, not of fires: a single long-running fire produces many detections, while a small fire may not show up at all.",

    h1: "{ad} wildfire map",
    h2Season: "{ad} {yil} fire season",
    liNone:
      "In {ad}, the satellite saw no fire-related heat detection this season.",
    summary:
      "In {ad}, the satellite saw {n} fire-related heat detections in the {yil} season — {kiyas}.{enBuyuk}",
    summaryNear: "close to the past-season average",
    summaryDiff: "{n}% {dir} the past-season average",
    summaryTop:
      " Peak heat was measured on {date} near {place} ({mw} MW).",
    liThisSeason: "Fire-related heat detections this season: {n}",
    liPastAvg: "Average for the same period over the past five seasons: {n}",
    liPastDiff: " (this season {n}% {dir})",
    liBusiest: "Busiest day: {date} ({n} detections)",
    liHighest: "Peak heat: {date}, {place}, {mw} MW",
    liFixed:
      "A further {n} detections come from permanent heat sources (industrial facility, power station) and are not counted as fire.",
    h3Years: "{ad} by year",
    liYear: "{yil}: {n} detections",
    h2Meaning: "What these numbers mean",
    meaning:
      "The numbers are satellite heat detections, not a count of fires: a single fire lasting days produces many detections, while a small, short-lived fire may not show up at all. Areas under cloud are missing too. The data comes from NASA FIRMS (VIIRS 375 m) detections; the current season comes from the near-real-time feed and past seasons from the reprocessed archive, so the comparison is approximate. This page is not an official warning; in an emergency call 112, and 177 to report a forest fire.",
    navNearby: "Nearby provinces",
    h2Nearby: "Wildfire maps of provinces near {ad}",
    linkProvince: "{ad} wildfire map",
    linkStats: "Türkiye-wide season statistics",
    linkArchive: "Satellite archive of past fires",
    srH1: "{ad} wildfire map — live satellite detections and direction forecast",
    srH1Home:
      "Algow Wildfire — live wildfire map of Türkiye and direction forecast",
  },

  archive: {
    h1: "Fire archive",
    intro:
      "The live map only shows the last few days; the satellite archive goes back to 2012. The records below were prepared from NASA FIRMS archive (SP) data: you can replay from start to finish where a fire began, which way it moved and how many days it lasted.",
    empty: "No archive record has been prepared yet.",
    itemMeta:
      "{from} → {to} · {days} days · {n} satellite detections · peak {mw} MW",
    itemDetections: "satellite detections",
    itemDays: "days",
    itemMax: "peak",
    footer:
      "A satellite sees heat anomalies; the number of detections is not directly proportional to the burnt area, and fires under cloud, moving beneath the canopy, or dying out between two passes appear incomplete in the record. This page is not an official record of a fire's size — it is what the satellite saw.",

    viewerFallback: "Archive",
    viewerError:
      "This archive record could not be loaded. Check your connection and try again.",
    viewerMeta: "{il} · {days} days · {n} detections",
    viewerCount: " detections · {mw} MW total",
    viewerNote:
      "NASA FIRMS archive (SP) data. No forecast shape is drawn: we do not present a forecast that was never made that day as if it had been.",
    viewerNoteMtg:
      "EUMETSAT LSA SAF Meteosat (MTG) data — this fire has no record in NASA FIRMS at all. The pixel is about 1.7 km²; the cluster of points shows the coarse cells where heat was seen, not the shape of the fire. No forecast shape is drawn: we do not present a forecast that was never made that day as if it had been.",
    srH1: "{ad} — satellite record",
    srBody:
      "{il} · {n} satellite detections · {days} days · peak fire radiative power {mw} MW. The record was prepared from NASA FIRMS archive (SP) data; the satellite sees heat and sections under cloud may be missing.",
    srBodyMtg:
      "{il} · {n} satellite detections · {days} days · peak fire radiative power {mw} MW. The record was prepared from EUMETSAT LSA SAF Meteosat (MTG) data; this fire has no record in the NASA FIRMS archive at all. The Meteosat pixel is about 1.7 km², so the location is coarse.",
  },

  stats: {
    notReady: "The statistics data has not been prepared yet.",
    h1: "{yil} fire season — what did the satellite see?",
    intro:
      "Heat detections recorded over Türkiye by the NASA FIRMS satellites since 1 May, compared with the same period of the past five seasons. Permanent heat sources (refineries, steel plants, power stations) are excluded from these figures.",
    thisSeason: "this season",
    detections: "heat detections",
    pastAvg: "past 5-season avg.",
    vsPast: "this season {n}% {dir}",
    above: "above",
    below: "below",
    peakSeason: "highest season",
    peakDetections: "{n} detections",
    h2Curve: "How the season is going",
    curveAria:
      "Cumulative satellite detection curve from the start of the season to today; {yil} and previous seasons",
    curveStart: "1 May",
    curveEnd: "today",
    curveLegend: "cumulative detections · from 1 May",
    h2Totals: "Totals by season",
    totalsNote:
      "The {yil} season is still under way; the other years are clipped to the same calendar window (1 May – today), which is what makes the comparison fair.",
    h2Provinces: "By province",
    provincesNote:
      "This table counts the same thing for every province: the heat detections the satellite saw there. Fixed industrial sources are removed; what remains contains both forest fires and stubble fires on agricultural land, and the two are not separated from each other. A high number can mean many forest fires or a lot of farmland — which one it is follows from that province's land cover.",
    provincesStubble:
      "Let us also say this plainly: burning stubble is illegal, and rightly so. The fire kills what lives in the soil rather than merely clearing its surface, costs the field its own fertility for years, and sends smoke into the lungs of the nearest settlement; when the wind picks up it does not stay in the field either — it crosses into the forest at its edge. In a country whose summers run dry, whose winds run hard and whose forests grow back slowly, keeping this habit alive is a serious disgrace against nature.",
    thProvince: "province",
    thThis: "this season",
    thPast: "past avg.",
    thPeak: "peak heat",
    h2NotWhat: "What these numbers are not",
    notWhat: [
      [
        ["Not a count of fires.", "b"],
        [
          " A single fire lasting days produces hundreds of detections; a small, short-lived fire may not show up at all.",
        ],
      ],
      [
        ["Not burnt area.", "b"],
        [" There is no fixed ratio between detection counts and hectares."],
      ],
      [
        ["Incomplete.", "b"],
        [
          " Fires under cloud, moving beneath the canopy, or dying out between two satellite passes never enter the record.",
        ],
      ],
      [
        ["Mixed sources.", "b"],
        [
          " The current season comes from the near-real-time feed, past seasons from the reprocessed archive. There is no day where the two overlap, so we could not measure the difference; the comparison is approximate.",
        ],
      ],
      [
        [
          "The source set is deliberately fixed (Suomi-NPP and NOAA-20). Including NOAA-21 would make the 2021–2022 seasons look artificially low.",
        ],
      ],
    ] as Seg[][],
    footer:
      "Data: NASA FIRMS (VIIRS 375 m). This page is generated automatically from satellite records and updates as the season goes on; it is not an official statistic.",
  },

  og: {
    status: { active: "ACTIVE", waning: "WANING", old: "OLD" },
    detections: "{n} satellite detections · {span}",
    drift: "Observed advance: {km} km towards {dir}",
    fallbackTitle: "Live wildfire map of Türkiye",
    fallbackSub:
      "Satellite detections, wind flow and direction forecast on one map",
    footer: "NASA FIRMS · not an official warning · 112 / 177",
  },

  shareMeta: {
    spanHours: "tracked for {n} hours",
    spanDays: "tracked for {n} days",
    status: { active: "active", waning: "waning", old: "old record" },
    title: "{place} — {mw} MW fire detection",
    lead: "Satellite detection {status}",
    count: "{n} detections",
    drift: "observed advance {km} km towards {dir}",
    tail: "A satellite sees heat, not every detection is a fire; this is not an official warning.",
  },

  meta: {
    homeTitle: "Algow Wildfire — live wildfire map of Türkiye and spread forecast",
    homeDescription:
      "Track wildfires across Türkiye on a map using NASA FIRMS satellite detections and Open-Meteo wind data; see how a fire has advanced and where the wind points it next. The satellite detects heat anomalies, so not every dot is a fire. Free, built for the public good.",
    homeOgTitle: "Algow Wildfire — live wildfire map of Türkiye",
    homeOgDescription:
      "Satellite detections, wind flow and spread forecast on one map. Built on NASA FIRMS + Open-Meteo open data.",
    appTitle: "Algow Wildfire",
    aboutTitle: "About — Algow Wildfire",
    aboutDescription:
      "An honest account of Algow Wildfire's data sources, how fresh the data really is, and how the spread forecast works.",
    statsTitle: "Türkiye fire season statistics — satellite detections",
    statsDescription:
      "Heat detections seen by satellites in Türkiye this fire season, compared with past seasons. Distribution by province, the season curve, and the limits of the data.",
    archiveTitle: "Fire archive — satellite records of past major wildfires",
    archiveDescription:
      "Replays of Türkiye's major forest fires from the NASA FIRMS satellite archive: where the fire started, which way it moved, how many days it lasted.",
    archiveFireTitle: "{ad} — satellite record and advance",
    archiveFireDescription:
      "{ad} ({il}): {n} satellite detections, {days} days, peak {mw} MW. A replay prepared from the NASA FIRMS archive — where the fire started and which way it moved.",
    provinceTitle: "{ad} wildfire map — live satellite detections",
    provinceDescription:
      "{ozet} Live map, the direction the fire came from, and its possible reach given the wind.",
    provinceFallback:
      "Track forest fires in and around {ad} live with NASA FIRMS satellite detections.",
    embedTitle: "Algow Wildfire — embeddable map",
  },
};
