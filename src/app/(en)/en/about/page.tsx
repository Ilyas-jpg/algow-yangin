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
            How many fires do we actually see? (we measured it)
          </h2>
          <p>
            The sentence above — &quot;we may miss fires&quot; — stayed{" "}
            <i>qualitative</i>{" "}
            for a long time: we did not know how many we were missing. Now we
            have measured it. We deliberately used an{" "}
            <b>independent reference</b>{" "}
            rather than our own data: the{" "}
            <b>burnt-area maps</b>{" "}
            that the European Forest Fire Information System (EFFIS) derives
            from satellite imagery. That distinction
            matters, because burnt area and active fire are{" "}
            <i>two different measurements</i>: a burn scar stays on the ground
            even if no satellite happened to look while the flames were
            burning. So we are not grading ourselves with our own ruler.
          </p>
          <p>
            For the 2025 season in Türkiye we checked how many of the{" "}
            <b>351 fires larger than 30 hectares</b>{" "}
            recorded by EFFIS produced at least one detection in our pipeline:
          </p>
          <ul className="space-y-1 pl-4 [&>li]:list-disc">
            <li>
              <b>Above 1,000 hectares: 100%</b>{" "}
              (25 out of 25)
            </li>
            <li>500–1,000 hectares: 91%</li>
            <li>100–500 hectares: 80%</li>
            <li>30–100 hectares: 78%</li>
          </ul>
          <p>
            Overall we catch <b>81% of fires above 30 hectares</b>. Treat that
            as a lower bound: for some of the apparent misses we do have
            detections, but they sit a few days away from the date EFFIS
            recorded — a burn scar only becomes visible in imagery{" "}
            <i>after</i>{" "}
            the fire has burned. Allowing for that date
            uncertainty the figure rises to <b>86%</b>, and ignoring dates
            entirely it reaches <b>91%</b>. The true value lies in that range.
          </p>
          <p>
            <b>What this does not say matters more:</b>{" "}
            below 30 hectares we can offer no assurance. EFFIS has its own
            minimum mapping size, so small fires fall{" "}
            <i>outside</i>{" "}
            this measurement, and the evidence
            we do have points the other way — two fires in grass and scrub near
            Dikili, put out quickly, were never seen by our system at all. The
            measurement covers a single season (2025). In short:{" "}
            <b>reliable for large fires, not for small ones.</b>
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

          <section
            aria-labelledby="memorial"
            className="rounded-md border border-line bg-obsidian-2 p-5"
          >
            <div className="h-px w-10 bg-ok" />
            <h2
              id="memorial"
              className="mt-4 text-lg font-medium tracking-tight text-ink"
            >
              Those who fell protecting the forests
            </h2>
            <p className="mt-3 leading-relaxed">
              <b className="font-medium text-ink">23 July 2025</b>, Seyitgazi in
              Eskişehir. The crew working the fire was caught between the flames
              when the wind turned.{" "}
              <b className="font-medium text-ink">
                Five forest workers and five AKUT search-and-rescue volunteers
              </b>{" "}
              fell. Across that season&apos;s forest fires in Türkiye{" "}
              <b className="font-medium text-ink">17 lives</b>{" "}
              were given; there were also those who fell in the line of duty in
              İzmir Ödemiş, in Bursa and in Osmaniye. In Turkish they are called{" "}
              <i>şehit</i> — the word this country reserves for those who die
              serving it.
            </p>
            <p className="mt-3 leading-relaxed">
              They walked toward what everyone else runs from. On a fire line a
              wind shift is a matter of seconds, and it can close the way back
              at once. That is what happened at Seyitgazi. We remember them with
              respect and gratitude.
            </p>
            <p className="mt-3 leading-relaxed">
              The cone on this site measures exactly one thing:{" "}
              <b className="font-medium text-ink">
                where the wind is carrying the fire
              </b>
              . That is why this page states plainly how honestly we can measure
              it and where we get it wrong — overstating a forecast means
              somebody in the field trusting the wrong thing.
            </p>
            <p className="mt-3 leading-relaxed text-ink-3">
              This platform is not an official operational tool and does not
              reach the crews on the ground. We make no claim to make their work
              easier. We simply work knowing the price paid by the people who
              protect this country&apos;s forests.
            </p>
          </section>

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
                6 August 2026 — we answered &quot;how many fires do we
                miss?&quot; with a number for the first time
              </p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    Detection completeness measured — against an independent
                    source.
                  </b>{" "}
                  Until now we said &quot;we may miss small fires&quot; without
                  knowing how many. We compared against EFFIS burnt-area maps:
                  we catch{" "}
                  <b className="font-medium text-ink">
                    every fire above 1,000 hectares and 81% of those above 30
                    hectares
                  </b>
                  . Because burnt area and active fire are two different
                  measurements, this is not us grading ourselves with our own
                  ruler. Added as the &quot;How many fires do we actually
                  see?&quot; section above.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    We corrected the measurement twice, and both corrections
                    changed the answer.
                  </b>{" "}
                  The first figure was 73% — then we realised we had measured
                  using only two of the four satellite sources the site
                  actually uses. Adding the missing two gave 81%. Second: the
                  date EFFIS records is systematically late, because a burn
                  scar only appears in imagery after the fire has burned, which
                  makes it easy to think we missed something.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Three improvement ideas were tried; none held, and nothing
                    on the map changed.
                  </b>{" "}
                  We wanted to add Landsat as a second verification source — we
                  measured it, and that product does not cover Türkiye at all.
                  We tried tuning the cone radius by fuel type; forest and
                  scrub already want the same setting. And we tried machine
                  learning for direction once more, this time only on
                  &quot;clean&quot; fires: it briefly looked like it worked,
                  until a deliberately meaningless filter produced the same
                  apparent gain, which showed the effect was not real. None of
                  the three shipped.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-ink">
                5 August 2026 — we retested the &quot;nine out of ten&quot; claim
                against ten times the data; this time it held
              </p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    The coverage claim was independently confirmed.
                  </b>{" "}
                  The site says &quot;nine out of ten of the cells the fire
                  advanced into stay inside the shape we draw&quot;. That claim
                  turned out to be wrong once before (see the 2 August note), so
                  we tested it again — this time not with 232 cases from Türkiye
                  but with{" "}
                  <b className="font-medium text-ink">
                    2,383 cases and 41,103 cells from eight seasons across the
                    Mediterranean basin
                  </b>
                  . Result: 90.4% overall, 89.1% for Türkiye alone. When we
                  picked the setting from data outside Türkiye — never seeing
                  Türkiye at all — and then tested it there, we still got 89%, so
                  the figure is not luck specific to one country. Holding out
                  each season in turn gives 90% on average.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    We tried to shrink the cone, found no meaningful way, and
                    chose to change nothing.
                  </b>{" "}
                  Three separate routes to a narrower cone at the same
                  reliability were tested: varying the safety margin with wind
                  speed, letting the fire correct itself from its own previously
                  observed advance, and predicting &quot;this fire will not
                  grow&quot;. Each gained only about 3% on its own, and combining
                  them did not add up — they all trim the same excess. We did not
                  break something that works for a gain smaller than our
                  measurement uncertainty.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Machine learning did not beat the physics model at predicting
                    direction.
                  </b>{" "}
                  We trained a model on eight seasons of data. In the geography
                  it was trained on it was a few degrees better than the physics
                  model, but in Türkiye the difference vanished into noise. We
                  write this down because saying &quot;we added AI&quot; is easy
                  and saying it did not work is hard.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Nothing changed on the map
                  </b>{" "}
                  in this round. The work was measuring and verifying.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">
                4 August 2026 — a new satellite, pixel honesty, and a failure we
                had been silent about
              </p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    The reach shape now changes with the wind — and our earlier
                    measurement was broken.
                  </b>{" "}
                  We drew the shape as &quot;2.4 times longer ahead than
                  behind&quot;, the same at every wind speed. When we measured
                  that number we took the fire&apos;s direction from its{" "}
                  <i>centre of mass</i>; in a 30-kilometre fire, the direction
                  that looks &quot;backwards&quot; from the centre can be the
                  flank of the front. We redid it per 375-metre cell, each cell
                  measured from its own nearest burnt neighbour (5,719 cells):
                  in light wind a fire really does advance almost equally in
                  every direction (1.2×, nearly a circle), while above 15 km/h
                  it{" "}
                  <b className="font-medium text-ink">barely moves backwards</b>{" "}
                  at all (5.5×). One fixed shape got both wrong. The new shape
                  both covers more (88% → 91%) and is{" "}
                  <b className="font-medium text-ink">smaller</b> — in strong
                  wind the area we draw shrank by a third, because we no longer
                  spend it on the side the fire does not go.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    A &quot;Clean&quot; button, and information bands you can
                    dismiss.
                  </b>{" "}
                  Clean view hides the top strip, the list on the left, the
                  legend and the data-source notes, leaving just the map — for
                  screenshots, or simply for looking at the map. The small
                  handle at the top right, or ESC, brings it all back. Each
                  information band at the top now also has an × of its own, so
                  you can dismiss the ones you have read; on a phone that gives
                  the map noticeably more room.{" "}
                  <b className="font-medium text-ink">
                    One exception is the unverified heat source warning:
                  </b>{" "}
                  dismissing it applies only to that alert, and it returns when
                  the satellite sees a new source. We did not want the site&apos;s
                  earliest warning to be silenced for good. In clean view the
                  Algow signature sits at the bottom left and a very faint{" "}
                  <b className="font-medium text-ink">yangin.algow.net</b>{" "}
                  watermark covers the map: the platform is free and open
                  source, but its imagery should not be sold on as someone
                  else&apos;s work.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Heat sources in Syria and Iraq moved to the bottom of the
                    list.
                  </b>{" "}
                  Our satellite window also covers neighbouring countries, and
                  most of the large power readings there are not fires: it is
                  gas flared at oil wells, industrial heat that never goes out.
                  A 1,171-megawatt flare near Mosul was pushing a real
                  512-megawatt forest fire in Çankırı down the list. We did not
                  remove them from the map — we show what the satellite sees —
                  but they now sort last. Greece and the Balkans are excluded
                  from this: a large fire there is a real fire.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Fire weather had been broken for months in Greece and the
                    Balkans — now fixed.
                  </b>{" "}
                  When we widened the map westwards we had written the boundary
                  by hand in six separate places and forgot to update five of
                  them. For every fire west of 24.9° east, wind, humidity, fire
                  weather index, smoke forecast, slope and fuel type came back
                  silently empty. Nothing errored, so it simply looked like
                  &quot;no data&quot;. Some of the largest fires on the map were
                  in exactly that area. The boundary now lives in one place and
                  a test stops it being copied again.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    We now draw the satellite pixel at its real size.
                  </b>{" "}
                  Zoom in and each detection gets a dashed ellipse around it:
                  that is the cell the heat sits inside. The dot does not mean
                  &quot;the fire is exactly here&quot;. On VIIRS the cell is 375
                  m at best; on MODIS it grows to 4 km at the edge of the swath
                  — so you can now see why a position sometimes looks off.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    The active fire count dropped a little, because it used to be
                    slightly inflated.
                  </b>{" "}
                  Every detection carries a confidence flag and we were ignoring
                  it. Low-confidence <i>daytime</i> detections are now drawn
                  faint and left out of the counter. Daytime false alarms are
                  mostly sun glint: greenhouse sheeting, metal roofs, water. At
                  night that mechanism does not exist, so night detections are
                  not downgraded — fires grow at night too.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    A new satellite: Sentinel-3.
                  </b>{" "}
                  Europe&apos;s SLSTR adds about four passes a day at 1 km.
                  Sharper than Meteosat but slower: we measured roughly two
                  hours from sensing to publication. So it does not close the
                  blind gap, it adds another pass to the sharp layer. It also
                  reports its own error margin, which is why we can say
                  &quot;30 ± 4 MW&quot;.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    We say so when the sensor saturates.
                  </b>{" "}
                  In a very intense fire the satellite&apos;s heat channel
                  saturates and the power it reports becomes a <i>lower bound</i>.
                  The card then reads &quot;VERY INTENSE&quot;: the figure shown
                  is the smallest the fire could be.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Where a fire is heading is now written out, not just drawn.
                  </b>{" "}
                  The projected reach was already on the map but stayed abstract
                  for anyone not looking at it. It now reads &quot;in this
                  direction: X ~7 km&quot;. This is not an evacuation warning and
                  does not mean the fire will get there — wind turns and crews
                  intervene.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Smoke: a measurement when there is one, the model otherwise.
                  </b>{" "}
                  Until now the smoke line was entirely model output
                  (ECMWF/CAMS) and we never said so. If a ground station within
                  25 km of the fire is reporting, its real value now appears on
                  its own line. To be honest about it: in Türkiye that line will
                  usually be missing, because the national air quality
                  network&apos;s open feed{" "}
                  <b className="font-medium text-ink">stopped in May 2023</b> —
                  of 406 registered stations only 8 still report and all of them
                  are in Istanbul. It works in Greece and the rest of Europe.
                  When there is no station, the line below says the figure is
                  model output only.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Sharing a link now shows our opening screen.
                  </b>{" "}
                  The preview card in chat apps and social media is the same
                  screen you see when the site opens. And for search engines and
                  browsers without JavaScript, the page summary now comes from
                  the server: the age of the newest detection, the number of
                  active events and the emergency numbers stay readable even if
                  the map never loads.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">
                3 August 2026 — Greece now covered, firefighting aircraft on the
                map
              </p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    The area the map covers now extends further west.
                  </b>{" "}
                  Previously we only saw Greece&apos;s Aegean coast and its
                  eastern islands; the western mainland, the Peloponnese, the
                  Ionian islands and the south of Crete were outside the box
                  entirely. On the first day of the wider coverage the largest
                  fire there measured{" "}
                  <b className="font-medium text-ink">2,645 MW</b>{" "}
                  — twice the
                  size of the largest fire we had ever recorded in Türkiye.
                  Fires in neighbouring countries carry an &quot;ABROAD&quot;
                  badge and are excluded from the Türkiye counter.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    The event list is now ordered by fire size.
                  </b>{" "}
                  Cross-border fires used to be pushed to the bottom
                  unconditionally. Once coverage widened, that rule started
                  hiding information: 1,230 MW was burning at Corinth while a
                  182 MW fire sat at the top of the list. Which country a fire
                  is in is now told by the badge on the card, not by its
                  position.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    A new layer shows the aircraft and helicopters working a
                    fire.
                  </b>{" "}
                  The source is an open ADS-B network run by volunteers. We
                  genuinely know the aircraft type and registration; we do not
                  know its mission — so read this layer as &quot;there is a
                  response here&quot;, not as an official tasking record. An
                  absent aircraft does not mean there is no response either: not
                  every aircraft broadcasts, and coverage is weak over
                  mountains. It is not counted as an active fire.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    Our own mistake: part of the wind map was silently coming up
                    empty.
                  </b>{" "}
                  Widening the coverage pushed us past the per-minute limit of
                  the service we get wind data from, and the northern part of
                  the grid could not be filled. That matters, because a fire
                  with no wind data gets{" "}
                  <b className="font-medium text-ink">no spread forecast</b>{" "}
                  either — people were seeing an incomplete map without knowing
                  why. We made the grid slightly coarser; the whole coverage now
                  fills. The cost is about 11 degrees of extra coarseness in the
                  direction calculation, which is well inside the forecast&apos;s
                  own margin of error, so it is the right trade.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">
                3 August 2026 — the fire we missed, news reports, first alarm
              </p>
              <ul className="mt-1.5 space-y-1.5 pl-4 [&>li]:list-disc">
                <li>
                  <b className="font-medium text-ink">
                    On 2 August we failed to show you the fire at Bayramiç —
                    even though we had seen it.
                  </b>{" "}
                  The high-resolution satellites (VIIRS/MODIS){" "}
                  <b className="font-medium text-ink">never saw it</b>: the fire
                  started and was contained between their passes. The
                  geostationary Meteosat saw it at{" "}
                  <b className="font-medium text-ink">16:08 local time</b>,{" "}
                  <b className="font-medium text-ink">91 minutes before</b> the
                  first news report, peaking at 303 MW. But that detection was
                  only a temporary orange ring on the map: it never entered the
                  fire list, was not counted, raised no alert, and vanished once
                  the fire died down. We had the information and did not tell
                  you.
                </li>
                <li>
                  <b className="font-medium text-ink">First alarm added.</b>{" "}
                  Heat sources that Meteosat can see but a high-resolution
                  satellite has not yet confirmed are now called out above the
                  map. They are unconfirmed and are not counted as active fires;
                  known industrial sources are excluded. Clicking a Meteosat
                  ring now says &quot;possible fire in this area&quot; and
                  explains what remains uncertain.
                </li>
                <li>
                  <b className="font-medium text-ink">
                    News report layer added.
                  </b>{" "}
                  For the small, short-lived fires satellites cannot see, news
                  is now watched as a second channel. These are unverified
                  reports: they are drawn as an approximate area rather than a
                  point, and are not counted as active fires. Clicking a circle
                  shows which report it rests on, how many outlets carried it,
                  and whether the fire has been contained.
                </li>
                <li>
                  The Bayramiç fire has been{" "}
                  <Link href="/en/archive/bayramic-2026" className="underline">
                    added to the archive
                  </Link>{" "}
                  — the only record there built entirely from Meteosat
                  detections, because no other satellite left a trace of it.
                </li>
              </ul>
            </div>
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
