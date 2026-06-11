import { cn } from "@/lib/utils";

/**
 * East Anglia AI Services brand mark — a gold, right-facing AI head silhouette
 * with circuit-board traces feeding the brain. Rendered inline so it stays crisp
 * at any size and needs no network request. Uses a unique gradient id per render
 * to avoid collisions when multiple logos appear on the same page.
 */
export function Logo({
  className,
  title = "East Anglia AI Services",
}: {
  className?: string;
  title?: string;
}) {
  const id = "ea-gold";
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={cn("size-7", className)}
    >
      <defs>
        <linearGradient
          id={id}
          x1="120"
          y1="60"
          x2="400"
          y2="470"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#FFD45A" />
          <stop offset="0.5" stopColor="#F5A623" />
          <stop offset="1" stopColor="#E08600" />
        </linearGradient>
      </defs>

      <path
        fill={`url(#${id})`}
        d="M268 64c46 0 86 22 108 60c10 17 15 36 16 55c1 16 6 25 18 33c10 7 14 17 9 28c-3 7-9 11-9 19c0 7 5 11 7 18c2 8-2 15-10 18c-7 2-11 5-12 13c-2 16-9 31-22 41c-13 11-30 16-47 16l-1 38c0 6-4 9-9 9c-5 0-9-3-9-9l0-34c-32-3-58-23-72-52c-7 6-17 6-24 0c-7-6-8-16-3-24c-12-12-21-27-25-44c-8 1-16-4-18-12c-2-9 3-17 12-19c-1-9-1-18 0-27c-9-1-15-9-14-18c1-9 9-15 18-13c5-15 13-29 25-40C232 79 249 64 268 64Z"
      />

      <g
        stroke={`url(#${id})`}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M40 150 H120 L150 180 H214" />
        <path d="M28 210 H96 L122 236 H196" />
        <path d="M52 268 H140 L168 296 H214" />
        <path d="M36 330 H104 L132 302 H188" />
        <path d="M64 388 H132 L160 360 H206" />
        <path d="M150 96 V140 L176 166 H214" />
      </g>
      <g fill={`url(#${id})`}>
        <circle cx="40" cy="150" r="13" />
        <circle cx="28" cy="210" r="13" />
        <circle cx="52" cy="268" r="13" />
        <circle cx="36" cy="330" r="13" />
        <circle cx="64" cy="388" r="13" />
        <circle cx="150" cy="96" r="13" />
        <circle cx="214" cy="180" r="8" />
        <circle cx="196" cy="236" r="8" />
        <circle cx="214" cy="296" r="8" />
        <circle cx="188" cy="302" r="8" />
        <circle cx="206" cy="360" r="8" />
        <circle cx="214" cy="166" r="8" />
      </g>
    </svg>
  );
}
