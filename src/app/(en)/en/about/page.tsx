/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import LangSwitch from "@/components/LangSwitch";
import { alternatesEn } from "@/lib/i18n";
import { getDict } from "@/i18n";

const t = getDict("en");

export const metadata: Metadata = {
  title: t.meta.aboutTitle,
  description: t.meta.aboutDescription,
  alternates: alternatesEn("/hakkinda"),
};

/**
 * İngilizce "Hakkında" sayfası.
 *
 * Sözlük yerine ayrı dosya: burası baştan sona düzyazı ve sürüm notları
 * biriktiriyor. Altmış küsur paragrafı anahtar/değer sözlüğüne çevirmek
 * hem okunmaz olurdu hem de metni düzeltmek her seferinde iki dosya
 * arasında gidip gelmek anlamına gelirdi. Türkçesi: (tr)/hakkinda.
 *
 * ⚠️ Güncelleme notu eklerken İKİ dosyaya da ekle.
 */
export default function AboutPage() {
  return (
    <div className="min-h-dvh overflow-y-auto bg-obsidian-1">
      <div className="mx-auto max-w-[640px] px-5 py-10">
        <div className="flex items-center gap-3">
          <Link
            href="/en"
            className="font-mono text-xs text-ink-3 transition-colors hover:text-ink"
          >
            {t.common.backToMap}
          </Link>
          <LangSwitch
            locale="en"
            label={t.common.otherLang}
            title={t.common.otherLangTitle}
            className="ml-auto"
          />
        </div>

        <h1 className="mt-6 text-2xl font-medium tracking-tight">
          What does this map show?
        </h1>
        <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-2">
          <p>
            Algow Wildfire is a free platform that tracks active fires in
            Türkiye and its immediate surroundings using satellite data, and
            shows the likely direction of spread given the wind. The aim is
            simple: anyone, without technical knowledge, should be able to see
            at a glance where fires are and which way they might advance. It
            was built for the public good; it carries no advertising and sells
            no data.
          </p>

          <h2 className="pt-2 text-lg font-medium tracking-tight text-ink">
            Where does the data come from?
          </h2>
          <p>
            Fire detections come from the VIIRS and MODIS satellite sensors via
            NASA&apos;s FIRMS system. These satellites scan each region a few
            times a day; a detection is the heat anomaly the satellite saw at
            that moment. So the map is not instantaneous like a security
            camera: detections land with a delay of one to four hours,
            depending on when the satellite passed over. The &quot;last
            detection&quot; badge at the top exists precisely for that honesty —
            you can see at any moment how fresh the data is. Small fires, or
            fires under cloud, may not appear at all; a point missing from the
            map is not a guarantee that there is no fire there.
          </p>
          <p>
            To close that gap in part we use a second source:{" "}
            <b>Meteosat</b>, Europe&apos;s weather satellite. Because it turns
            with the Earth it sees Türkiye continuously and scans{" "}
            <b>every ten minutes</b>; the data reaches us within roughly half an
            hour. Since August 2026 we have been using the new-generation{" "}
            <b>Meteosat Third Generation</b> product: when we measured it, a
            single pixel covers <b>about two square kilometres</b> over our
            country. In the previous generation that was fifteen to twenty-five
            square kilometres — so the location of a fire is now roughly ten
            times more precise. Even so, because this is an area and not a
            point, we draw those detections as an orange ring showing the
            pixel&apos;s real size — the fire is somewhere inside that ring, not
            exactly at its centre. It still cannot see small fires. In short,
            Meteosat does not replace the high-resolution satellites; it fills
            the blind hours between them. If the new product is unreachable, it
            falls back to the previous generation on its own.
          </p>
          <p>
            Wind, humidity, temperature and vapour pressure deficit (VPD) come
            from Open-Meteo&apos;s open weather models. The particles flowing
            across the map show the current wind field; when you click a fire,
            the panel that opens summarises the fire weather of that area. The
            same panel carries the Fire Weather Index, which describes how dry
            the fuel is, the particulate measurement that traces smoke in the
            air, and the slope information that tells you where flames could
            climb.
          </p>
          <p>
            All times on this site are <b>Türkiye time (UTC+3)</b>, in 24-hour
            format. They are deliberately not converted to your own time zone:
            &quot;the fire started at 03:00&quot; should mean the same thing
            here as it does on the ground.
          </p>

          <h2 className="pt-2 text-lg font-medium tracking-tight text-ink">
            Not every dot on this map is a fire
          </h2>
          <p>
            This has to be said plainly: a satellite does not see flames, it{" "}
            <b>sees heat</b>. The sensor flags every point on the surface that
            is markedly hotter than its surroundings. A forest fire is the most
            striking of those, but not the only one. The stacks of refineries
            and petrochemical plants, gas flares, thermal power stations, steel
            and cement works and waste incinerators keep showing up at the same
            point day and night. Post-harvest stubble burning also fills the map
            with small dots, especially in July and August. If you rewind the
            time slider and a dot appears in the same place at the same
            intensity every day, what is there is most likely not a fire but a
            permanent heat source.
          </p>
          <p>
            Errors run the other way too. Fires under cloud, advancing beneath
            tree cover, or falling between satellite passes may not appear at
            all. Because the sensor works at low resolution, a few hundred
            metres of positional error is normal; the dot at the centre of a
            detection marks the centre of that pixel, not the exact location of
            the flame. Hot bare rock and sun glint occasionally produce false
            detections as well.
          </p>
          <p>
            In short, this map is a{" "}
            <b>clue and a situational-awareness tool</b>; it does not replace
            observation on the ground, official statements, or the forest
            service. A point appearing here does not prove there is a fire
            there, and its absence does not show that there is not.
          </p>

          <h2 className="pt-2 text-lg font-medium tracking-tight text-ink">
            How does the direction forecast work, and what does it not promise?
          </h2>
          <p>
            The blue shape around a fire starts from the leading edge seen on
            the last satellite pass and shows the likely direction of spread
            and, at a rough rate, the one, three and six hour reach. The
            direction is computed from the{" "}
            <b>resultant of wind and terrain slope</b> (the vector sum of the
            Rothermel wind and slope coefficients; the fuel is assumed to be
            Mediterranean maquis). On flat ground the slope term approaches zero
            on its own; on a steep slope it pulls the shape uphill. Fuel
            moisture and firefighting response are not accounted for.
          </p>
          <p>
            Here is the part that most deserves honesty: we ran a backtest
            against our own data. <b>Six fire seasons</b> (2021–2026),{" "}
            <b>468 thousand satellite detections</b>,{" "}
            <b>232 measurable advances from 79 fires</b> in forest and maquis.
            For each one we compared the forecast at one pass with the direction
            the fire actually grew in on the next pass.
          </p>
          <p>
            The result: the forecast is <b>better than random, but not
            certain</b>. The median angular error is <b>68°</b> (random
            expectation is 90°); <b>33%</b> of forecasts land within 45°
            (25% at random), and <b>16%</b> point the completely wrong way
            (25% at random). This page previously said, on the basis of
            twenty-three samples, that the forecast was &quot;no better than
            random&quot;;{" "}
            <b>that sample was small enough to have misled us</b> — we corrected
            it. Taking slope into account markedly reduces the worst error on
            steep ground (over 15%): the rate of completely reversed forecasts
            falls <b>from 22% to 11%</b>.
          </p>
          <p>
            We also measured the <i>size</i> of the shape for the first time,
            and here we had been seriously wrong. The old rings rested on no
            measurement at all and were <b>several times</b> the truth — we drew
            the 3-hour ring at 7.6 km, whereas the fires we measured advanced
            far less than that from their own edge in the same time. The rings
            were shrunk to match the measurement and now have a clear, testable
            meaning:{" "}
            <b>&quot;in nine out of ten fires, even the furthest advancing point
            stayed inside this boundary&quot;</b>. We tested that rate on
            seasons the model had never seen — holding each season out in turn,
            tuning on the rest and measuring on the one left out; the average
            came to <b>90%</b>. Our first attempt only reached 81%, so we
            enlarged the rings accordingly. In the same way the angle of the
            shape, at 15–30°, was too narrow and too confident; it covered only
            30% of the observed deviations. The angle now comes from the
            measured distribution too — when the wind is weak the direction is
            nearly undetermined, so the shape widens, and{" "}
            <b>when it is very uncertain a disc is drawn instead of a wedge</b>:
            so as not to imply a precision we do not have.
          </p>
          <p>
            We measured the ceiling as well: even if the <i>actual</i> mean wind
            between two passes were known in advance, the median error would
            only fall to 64°. So the remaining error does not come from the wind
            forecast but from <b>firefighting response and the detail of
            terrain and fuel</b> — no forecast shape can close that
            uncertainty. One more finding: the{" "}
            <b>direction observed on a fire&apos;s previous pass is a poor
            predictor of its next step</b> (median error 99°, worse than
            random) — because once the advancing head is suppressed, the fire
            keeps burning at the flanks and to the rear. That is why we do not
            extend the white trail forwards.
          </p>
          <p>
            For that reason we present the shape not as a prophecy but as the
            statement{" "}
            <b>&quot;wind and terrain point this way right now&quot;</b>. The
            white trail, which shows where the fire has actually advanced over
            the last few hours, rests on observation and is more reliable; when
            the two diverge, <b>go by the observed direction</b>. Under no
            circumstances is this shape a tool for evacuation decisions.
          </p>

          <div className="rounded-md border border-danger/40 bg-danger/10 p-4 text-ink">
            <p className="leading-relaxed">
              This site is not an official warning system. If you see a fire or
              you are in danger, call without losing time:
            </p>
            <p className="mt-2 font-mono text-xl">
              112 <span className="text-sm text-ink-2">Emergency</span>
              <span className="mx-3 text-ink-3">·</span>
              177 <span className="text-sm text-ink-2">Forest fire hotline</span>
            </p>
          </div>

          <h2 className="pt-2 text-lg font-medium tracking-tight text-ink">
            Your location and your privacy
          </h2>
          <p>
            With the &quot;My location&quot; button in the top bar you can see
            yourself on the map and read how many kilometres away, and in which
            direction, the nearest fire is. Your location is processed on your
            own device only; it is not sent to us or to any other server, and it
            is not stored. You can switch it off at any time with the same
            button. The site does not track visitors, use cookies, or carry
            advertising.
          </p>

          <h2 className="pt-2 text-lg font-medium tracking-tight text-ink">
            Open source
          </h2>
          <p>
            The source code of this platform is open under{" "}
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-line underline-offset-2 hover:text-ink"
            >
              AGPL-3.0
            </a>
            . You may inspect it, run it and add new features on top of it; we
            would like you to. There is one condition: if you make your version
            available to others, you have to leave its source open too. That way
            the project stays in everyone&apos;s hands and nobody can release a
            closed copy of it. The Algow name and visual identity are outside
            this licence; give your own version your own name.
          </p>

          <h2 className="pt-2 text-lg font-medium tracking-tight text-ink">
            Release notes
          </h2>
          <p className="text-sm">
            We write down here what we changed and when — especially when we are
            correcting our own mistake.
          </p>

          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-ink">
                2 August 2026 — English language support
              </p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    The whole platform is now available in English.
                  </b>{" "}
                  The map, the fire panel, the province pages, the season
                  statistics and the archive all have an English version under{" "}
                  <span className="font-mono">/en</span>. Turkish addresses did
                  not change: every link that was shared before still works.
                  Place names stay Turkish in both languages — a name is an
                  identity, and translating it would break the link between the
                  map and what people say on the ground.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">
                2 August 2026 — permanent heat sources, province pages, sharing
              </p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    We stopped counting industrial facilities as fires — our
                    counter was inflated.
                  </b>{" "}
                  A satellite sees heat, not flames; refineries, steel plants
                  and power stations are hot every day. We were counting those
                  as &quot;active fires&quot;. We measured it: there are 50
                  places seen hot on{" "}
                  <b className="font-medium">more than 40 separate days</b> at
                  the same point. For comparison, the longest measured forest
                  fire in Türkiye lasted 16.5 days. Those points stay on the map
                  but are now marked as a &quot;fixed source&quot; and left out
                  of the fire count. That is why the figure in the header
                  dropped — the old one was wrong, the new one is right.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    A separate page was opened for each of the 81 provinces.
                  </b>{" "}
                  Every province page carries that province&apos;s season data:
                  how many detections, how it compares with past seasons, when
                  and where the peak heat was measured. Permanent heat sources
                  are subtracted from those numbers — otherwise the figure in
                  industrial regions comes out many times higher than the truth.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Fires can now be shared.
                  </b>{" "}
                  When you select a fire and send its link, the other side sees
                  that fire directly; in chat apps the place name, radiative
                  power and duration appear too. The numbers on the card are not
                  written into the link — they are produced from real data each
                  time, so that a fabricated card cannot be made.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    A smoke forecast was added.
                  </b>{" "}
                  We show when the fine particulate matter (PM2.5) in the air at
                  the fire&apos;s location will peak over the next 48 hours. We
                  do not compute the dispersion ourselves; we relay the output
                  of CAMS, Europe&apos;s atmosphere monitoring service.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    An archive of past fires was opened.
                  </b>{" "}
                  The 2021 Manavgat, Marmaris and Milas fires can be replayed
                  from beginning to end. The forecast shape is deliberately not
                  drawn in the archive: we do not present a forecast that was
                  never made that day as if it had been.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Fires on agricultural land can be hidden, and a province /
                    district search arrived.
                  </b>{" "}
                  Detections whose land cover is agricultural drop out of the
                  list and the map with one button. Events whose cover could not
                  be queried are not hidden, and how many of them there are is
                  written out — a silently cleaned map would be misleading.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    The reach shape is drawn at close zoom.
                  </b>{" "}
                  At the country view the shape was only a few pixels; even when
                  drawn it could not be read and just left a smudge. It now
                  appears as you approach a fire, and the reason it is not shown
                  is written out. The outermost 6-hour boundary was also made
                  distinct — that was the line that most needed reading, yet it
                  was the faintest.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    The area the satellite saw as hot is shown.
                  </b>{" "}
                  In hectares. This is not an official burnt area: smouldering
                  sections lose their heat signature, and a detected pixel may
                  not have burned in full. We named it accordingly.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">
                2 August 2026 — Cyprus and visuals
              </p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    Place names were set to Turkish and the TRNC boundary was
                    added.
                  </b>{" "}
                  Although this was a Turkish product, the map showed names in
                  the local language — Greek in Cyprus, English for the country
                  name. It now reads Lefkoşa, Girne, Gazimağusa, Larnaka, Baf
                  and Türkiye. The TRNC land boundary is drawn as well; the
                  island had looked like a single piece.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    The &quot;growing&quot; label was tested, failed, and its
                    wording was corrected.
                  </b>{" "}
                  The trend label on the fire card read like a forecast. We
                  measured it over 820 advances:{" "}
                  <b className="font-medium">
                    its discriminating power is a coin flip
                  </b>{" "}
                  (AUC 0.502). A fire labelled &quot;growing&quot; does not
                  advance more than one labelled &quot;receding&quot;; what is
                  more, risen heat usually falls back. The label now says what
                  it is: <b className="font-medium">heat rose / heat fell</b> —
                  a description of the past, not a forecast of the future.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    The promotional screenshots were refreshed.
                  </b>{" "}
                  The screenshots on the project page at algow.net were updated
                  to this version; the new reach shape, the terrain layer and
                  the honesty notices are visible. The previous version&apos;s
                  images were not deleted and remain accessible in the archive.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">2 August 2026 — audit</p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    Province boundaries are now complete.
                  </b>{" "}
                  The basemap&apos;s province boundaries arrived broken and in
                  some regions were not drawn at all. We now draw the boundaries
                  from our own data (Natural Earth, public domain) — 81
                  provinces, complete at every zoom. To keep the first load
                  quick, they are fetched after the map settles.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Regression tests were added to the direction calculation.
                  </b>{" "}
                  The direction of the shape is now a multi-layered
                  computation; a single sign error in it could have reversed the
                  shape without visibly breaking anything. 25 tests were added,
                  and we verified that they really catch it by injecting a
                  deliberate error.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    We tested our own claim, it came out wrong, and we fixed it.
                  </b>{" "}
                  We had tuned the &quot;90%&quot; threshold of the rings on the
                  same data we measured it with — that is, the claim was
                  confirming itself. Holding each season out in turn and testing
                  on it showed that the ring covered a fire&apos;s furthest point
                  only <b className="font-medium">81%</b> of the time. The rings
                  were enlarged; with the new setting, coverage on unseen
                  seasons is <b className="font-medium">90%</b>.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">2 August 2026 — map pass</p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">Topography was added.</b>{" "}
                  The &quot;Terrain&quot; button turns on hillshading: valleys,
                  ridges and slope aspects become visible. Since half of fire
                  behaviour is terrain, this also makes it readable why the
                  shape leans the way it does.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    The satellite basemap was renewed, and a daily image
                    arrived.
                  </b>{" "}
                  The previous basemap was a mosaic that could be years old. In
                  its place came{" "}
                  <b className="font-medium">Sentinel-2 cloudless</b> (10 m,
                  cloud-free). In addition, the{" "}
                  <b className="font-medium">&quot;Today&quot;</b> button opens
                  NASA GIBS daily true colour imagery — the resolution is coarse
                  (250 m) but the date is today, so smoke from large fires can
                  be seen.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Doubled city names were fixed.
                  </b>{" "}
                  The setting we used to show labels at an early zoom was
                  opening city layers that should exclude one another at the
                  same time; the same city was written twice.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">2 August 2026 — second pass</p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    The reach shape was measured: it is a teardrop now, not a
                    circle.
                  </b>{" "}
                  We measured the question &quot;how far did fires advance in
                  directions deviating by so much from the forecast
                  direction?&quot;. Fires travel{" "}
                  <b className="font-medium">2.4 times</b> further ahead than
                  behind. A symmetric circle threw that information away; the
                  shape now draws the measured envelope, and the arrow at its
                  tip makes the lean readable.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    The rings are drawn with hourly forecast wind.
                  </b>{" "}
                  Previously it was assumed that &quot;the current wind holds
                  for six hours&quot;. Each ring now uses the wind of its own
                  hour; if the wind turns, the outer rings bend accordingly and
                  the panel says by how many degrees.
                </li>
                <li>
                  <b className="font-medium text-ink">Land cover is shown.</b>{" "}
                  The CORINE land class of the selected fire is written out.
                  Stubble burning on agricultural land is now marked as{" "}
                  &quot;not a forest fire&quot;.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Satellite observation gap warning.
                  </b>{" "}
                  Pass windows are measured from the data itself. If we are in a
                  gap it says so in the top bar and in the panel:{" "}
                  <i>no detection does not mean the fire is out</i>.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">2 August 2026</p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    The size of the shape was measured and reduced.
                  </b>{" "}
                  Until now the radius of the rings rested on no measurement and
                  was <b className="font-medium">8–12 times</b> the truth. We
                  measured it with six seasons of data: we were drawing the
                  3-hour ring at 7.6 km, while 90% of fires had advanced less
                  than 2.5 km from their own edge in that time. The rings were
                  pulled back to that measurement.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    The angle of the shape reflects the real uncertainty.
                  </b>{" "}
                  The old narrow 15–30° wedge covered only 30% of the observed
                  deviations. The angle now comes from the measured
                  distribution; when the wind is weak the direction is nearly
                  undetermined, so{" "}
                  <b className="font-medium">a disc is drawn instead of a
                  wedge</b>.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Terrain slope was added to the direction forecast.
                  </b>{" "}
                  The direction is now the resultant of wind and slope. On steep
                  ground the rate of completely reversed forecasts fell from 22%
                  to 11%.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    The validation was redone and our old verdict corrected.
                  </b>{" "}
                  This page used to say, on the basis of twenty-three samples,
                  that &quot;the forecast is no better than random&quot;.
                  Repeating it with six seasons and 468 thousand detections
                  showed that to be a small-sample error.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">1 August 2026</p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  The Meteosat 15-minute layer was added; the observation gap
                  fell from 5 hours to about 35 minutes.
                </li>
                <li>
                  The fire weather index (FWI), smoke (PM2.5), terrain slope,
                  burnt area and danger layers were added.
                </li>
                <li>
                  Fire alerts near me were added — saved places never leave the
                  device.
                </li>
                <li>The platform went live; the source code was opened.</li>
              </ul>
            </div>
          </div>

          <h2 className="pt-2 text-lg font-medium tracking-tight text-ink">
            Attributions
          </h2>
          <p className="text-sm">
            Fire data: NASA FIRMS (Fire Information for Resource Management
            System), VIIRS and MODIS products. Weather data:{" "}
            <a
              href="https://open-meteo.com/"
              className="underline decoration-line underline-offset-2 hover:text-ink"
              rel="noreferrer"
              target="_blank"
            >
              Open-Meteo
            </a>{" "}
            (CC BY 4.0). Basemap: ©{" "}
            <a
              href="https://carto.com/attributions"
              className="underline decoration-line underline-offset-2 hover:text-ink"
              rel="noreferrer"
              target="_blank"
            >
              CARTO
            </a>{" "}
            · ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              className="underline decoration-line underline-offset-2 hover:text-ink"
              rel="noreferrer"
              target="_blank"
            >
              OpenStreetMap
            </a>{" "}
            contributors. Satellite imagery: <b>Sentinel-2 cloudless</b> (EOX IT
            Services, contains modified Copernicus Sentinel data). Daily
            imagery: <b>NASA EOSDIS GIBS</b>, VIIRS/NOAA-20 true colour. Terrain
            elevation: Mapzen/AWS Terrain Tiles (SRTM, ASTER). NASA has not
            endorsed or supported the content of this platform; the data is
            presented as is.
          </p>
        </div>

        <footer className="mt-10 border-t border-line pt-5">
          <a
            href="https://algow.net"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2.5"
          >
            <img
              src="/brand/algow-wordmark.webp"
              alt="Algow"
              className="h-[15px] w-auto"
            />
          </a>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            This platform was built by Algow for the public and environmental
            good, and is offered free of charge.
          </p>
        </footer>
      </div>
    </div>
  );
}
