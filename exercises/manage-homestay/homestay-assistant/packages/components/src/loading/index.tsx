import { Loader } from "lucide-react";

const ITEM_COUNT = 3;
const STAGGER_MS = 180;

type LoadingProps = {
  size?: number;
};

export const Loading = ({ size = 20 }: LoadingProps) => {
  return (
    <div
      className="flex items-center justify-center gap-2 px-2 py-3"
      role="status"
      aria-label="Loading"
      aria-live="polite"
    >
      <style>{`
        @keyframes loading-grow {
          0%,
          100% {
            transform: scale(0.7);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .loading-grow-item {
            animation: none !important;
            transform: scale(1);
            opacity: 0.7;
          }
        }
      `}</style>

      {Array.from({ length: ITEM_COUNT }, (_, index) => (
        <Loader
          key={`${index}-loading`}
          className="animate-spin loading-grow-item shrink-0 text-muted-foreground"
          size={size}
          role="status"
          aria-label="Loading..."
          style={{
            animation: "loading-grow 1.1s ease-in-out infinite",
            animationDelay: `${index * STAGGER_MS}ms`,
          }}
        />
      ))}
    </div>
  );
};
