import { AppBar } from "../AppBar";
import { useDb } from "../DbContext";
import { listDisplayedContentSources, type ContentSource } from "../db";
import { ExternalLink } from "../components/ExternalLink";
import { useI18n } from "../i18n";

/** About & Sources (QR-DESIGN-007A). Credits the three text sources the app
 * displays, read live from the bundled content database so the licence and the
 * review status shown are exactly what the database records. The status is
 * never upgraded: a source marked "candidate" is shown as a candidate. No
 * source link is rendered as a tappable anchor, because an in-WebView link
 * would navigate away from the app. */
export function AboutScreen({ onBack }: { onBack: () => void }) {
  const { d } = useI18n();
  const { db, version } = useDb();
  const sources = listDisplayedContentSources(db);

  const typeLabel = (s: ContentSource): string =>
    s.content_type === "arabic_text"
      ? d.about.arabicText
      : s.edition_identifier.startsWith("kazimirski")
        ? d.about.frenchTranslation
        : d.about.englishTranslation;
  const statusLabel = (s: ContentSource): string =>
    s.verification_status === "verified"
      ? d.about.statusVerified
      : s.verification_status === "candidate"
        ? d.about.statusCandidate
        : d.about.statusOther;

  return (
    <div data-testid="about-screen">
      <AppBar title={d.about.title} onBack={onBack} />
      <p className="text-muted" style={{ lineHeight: 1.6 }}>
        {d.about.intro}
      </p>

      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <div className="setting-row">
          <span className="setting-text">
            <span className="setting-title">{d.about.version}</span>
          </span>
          <span className="text-muted" dir="ltr" data-testid="about-app-version">
            {__APP_VERSION__}
          </span>
        </div>
        <div className="setting-row">
          <span className="setting-text">
            <span className="setting-title">{d.about.contentVersion}</span>
          </span>
          <span className="text-muted" dir="ltr" data-testid="about-content-version">
            {version?.version ?? "—"}
          </span>
        </div>
      </div>

      <h2 className="group-label">{d.about.sourcesHeading}</h2>
      <ul className="source-list" data-testid="about-sources">
        {sources.map((s) => (
          <li
            key={s.edition_identifier}
            className="card source-card"
            data-testid={`about-source-${s.edition_identifier}`}
            data-status={s.verification_status}
          >
            <h3 className="source-type">{typeLabel(s)}</h3>
            <p className="source-name" dir="ltr">
              {s.dataset_name}
            </p>
            <dl className="source-meta">
              <div className="source-row">
                <dt>{d.about.sourceLabel}</dt>
                <dd dir="ltr">{s.provider_name}</dd>
              </div>
              {s.translator && (
                <div className="source-row">
                  <dt>{d.about.translator}</dt>
                  <dd dir="ltr">{s.translator}</dd>
                </div>
              )}
              <div className="source-row">
                <dt>{d.about.licenseLabel}</dt>
                <dd dir="ltr">{s.license_name}</dd>
              </div>
              <div className="source-row">
                <dt>{d.about.statusLabel}</dt>
                <dd data-testid={`about-status-${s.edition_identifier}`}>{statusLabel(s)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <p
        className="setting-hint"
        dir="ltr"
        style={{ margin: "16px 4px" }}
        data-testid="about-tanzil"
      >
        {d.about.tanzilNotice}
      </p>
      <div style={{ margin: "4px 4px 16px" }}>
        <ExternalLink
          to="tanzil"
          label={d.about.openTanzil}
          accessibleLabel={d.about.openTanzilLabel}
          failureMessage={d.about.linkNote}
          testId="about-tanzil-link"
        />
        <p className="setting-hint" style={{ margin: "6px 0 0" }}>
          {d.about.linkNote}
        </p>
      </div>
      <p className="setting-hint" style={{ margin: "12px 4px" }}>
        {d.about.scopeNote}
      </p>
    </div>
  );
}
