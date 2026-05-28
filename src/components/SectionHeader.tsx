interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <div className="mb-7">
      {eyebrow ? <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-laboratory-blue">{eyebrow}</p> : null}
      <h1 className="text-3xl font-semibold tracking-normal text-laboratory-ink sm:text-4xl">{title}</h1>
      {description ? <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{description}</p> : null}
    </div>
  );
}
