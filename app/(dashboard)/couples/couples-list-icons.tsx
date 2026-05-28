/**
 * Small inline SVGs for the couples-list selection checkboxes.
 *
 * Inlined (not lucide-react) because they're sized to fit the
 * 16×16 marquee checkbox at exact pixel widths and we want full
 * control over the stroke + path geometry.
 *
 * @module app/(dashboard)/couples/couples-list-icons
 */

export function CheckMark() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 5.2L4 7.2L8 3"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashMark() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.5 5H7.5"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
