import { cn } from "@repo/utils";

type PageHeaderProps = {
  label?: string;
  title?: string;
  description?: string;
  className?: string;
};

export const PageHeader = ({
  label,
  title = "Find your space",
  description,
  className,
}: PageHeaderProps) => {
  return (
    <div className={cn("mb-4", className)}>
      {label ? (
        <p className="mb-2 text-[11px] font-medium tracking-[0.25em] text-muted-foreground">
          {label}
        </p>
      ) : null}
      <h1 className="font-serif text-4xl font-normal tracking-tight text-foreground md:text-5xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
};
