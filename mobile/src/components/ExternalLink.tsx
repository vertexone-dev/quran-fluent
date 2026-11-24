import { useState, type ReactNode } from "react";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { EXTERNAL_LINKS, isAllowedExternalUrl, type ExternalLinkKey } from "../external-links";

/** A link to one of the allowlisted external destinations. It renders as a real
 * anchor (so assistive tech announces a link) with `noopener noreferrer` and no
 * tokens or user data in the URL. Inside the Capacitor shell a top-level
 * navigation to a non-app host is handed to the system browser, so the app's own
 * state is left untouched; there is no navigation bridge. A URL that is not on
 * the allowlist is never rendered as a link and its click is cancelled. */
export function ExternalLink({
  to,
  label,
  accessibleLabel,
  failureMessage,
  testId,
  children,
}: {
  to: ExternalLinkKey;
  label?: string;
  accessibleLabel: string;
  failureMessage: string;
  testId?: string;
  children?: ReactNode;
}) {
  const href = EXTERNAL_LINKS[to];
  const allowed = isAllowedExternalUrl(href);
  const [failed, setFailed] = useState(false);

  if (!allowed) {
    return (
      <p
        role="status"
        className="text-muted"
        data-testid={testId ? `${testId}-blocked` : undefined}
      >
        {failureMessage}
      </p>
    );
  }
  return (
    <>
      <a
        className="external-link"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={accessibleLabel}
        data-testid={testId}
        onClick={(e) => {
          if (!isAllowedExternalUrl(e.currentTarget.href)) {
            e.preventDefault();
            setFailed(true);
          }
        }}
      >
        <ExternalLinkIcon size={18} aria-hidden="true" />
        <span>{children ?? label}</span>
      </a>
      {failed && (
        <p
          role="status"
          className="text-muted"
          data-testid={testId ? `${testId}-failed` : undefined}
        >
          {failureMessage}
        </p>
      )}
    </>
  );
}
